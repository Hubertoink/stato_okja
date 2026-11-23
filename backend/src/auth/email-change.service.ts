import { BadRequestException, ForbiddenException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { EmailService } from '../email/email.service';
import { User } from '../users/entities/user.entity';
import { writeMemberships } from '../users/membership-write';
import { EmailChange } from './entities/email-change.entity';
import { forcedSuperadminEmail } from './superadmin-email.config';
import { RefreshSession } from './entities/refresh-session.entity';

export type EmailChangeAction = 'approve' | 'verify' | 'cancel';
const ttlMinutes = 30;

function unavailableReason(user: User) {
  if (user.role === 'superadmin' && user.email.toLowerCase() === forcedSuperadminEmail()) return 'managed';
  if (!process.env.SMTP_HOST?.trim()) return 'smtp';
  if (!user.passwordHash || user.mustChangePassword) return 'password';
  return null;
}

function current(change: EmailChange, user: User) {
  return change.oldEmail === user.email && user.passwordHash && change.passwordFingerprint === hash(user.passwordHash) &&
    change.expiresAt.getTime() > Date.now();
}

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function invalidLink() {
  return new BadRequestException('Der Link ist ungültig oder abgelaufen.');
}

@Injectable()
export class EmailChangeService {
  private readonly logger = new Logger(EmailChangeService.name);
  constructor(@InjectRepository(EmailChange) private readonly changes: Repository<EmailChange>, private readonly email: EmailService) {}

  async status(userId: string) {
    const user = await this.changes.manager.findOneByOrFail(User, { id: userId });
    const change = await this.changes.findOneBy({ userId });
    return {
      unavailable: unavailableReason(user),
      pending: change && current(change, user)
        ? { id: change.requestId, email: change.newEmail, expiresAt: change.expiresAt } : null,
    };
  }

  async request(userId: string, address: string, password: string) {
    const newEmail = address.trim().toLowerCase();
    const requestId = randomUUID();
    const token = () => randomBytes(32).toString('hex');
    const approve = token(), verify = token(), cancel = token();
    const change = await writeMemberships(this.changes.manager, async write => {
      const user = await write.account(userId);
      if (!user.passwordHash || unavailableReason(user)) throw new ForbiddenException('Bitte wende dich an die Administration.');
      if (!await bcrypt.compare(password, user.passwordHash)) throw new BadRequestException('Aktuelles Passwort ist falsch.');
      if (newEmail === user.email.toLowerCase()) throw new BadRequestException('Bitte gib eine neue E-Mail-Adresse ein.');
      const row = write.manager.create(EmailChange, {
        userId, requestId, oldEmail: user.email, newEmail, passwordFingerprint: hash(user.passwordHash),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        approveHash: hash(approve), verifyHash: hash(verify), cancelHash: hash(cancel),
      });
      return write.manager.save(row);
    });

    const link = (action: EmailChangeAction, secret: string) => {
      const url = new URL('/email-change', process.env.APP_ORIGIN || 'http://localhost:5173');
      url.hash = new URLSearchParams({ requestId, action, token: secret }).toString();
      return url.toString();
    };
    try {
      await this.email.sendEmailChangeMessage(change.oldEmail, 'StatO – E-Mail-Änderung freigeben',
        `Für dein StatO-Konto wurde ein Wechsel auf ${newEmail} angefordert. Bitte prüfe die Adresse und gib die Änderung innerhalb von ${ttlMinutes} Minuten frei.\n\n${link('approve', approve)}\n\nFalls du das nicht veranlasst hast, brich die Änderung hier ab und kontaktiere deine Administration.\n\n${link('cancel', cancel)}`);
      await this.email.sendEmailChangeMessage(newEmail, 'StatO – Neue E-Mail-Adresse bestätigen',
        `Bitte bestätige diese Adresse für dein StatO-Konto innerhalb von ${ttlMinutes} Minuten. Falls du keinen Wechsel angefordert hast, ignoriere diese E-Mail.\n\n${link('verify', verify)}`);
    } catch {
      await this.cancel(userId, requestId);
      throw new ServiceUnavailableException('Die Bestätigungsmails konnten nicht versendet werden. Bitte versuche es erneut.');
    }
    return this.status(userId);
  }

  async cancel(userId: string, requestId: string) {
    await writeMemberships(this.changes.manager, async write => {
      await write.account(userId);
      await write.manager.delete(EmailChange, { userId, requestId });
    });
    return this.status(userId);
  }

  async respond(requestId: string, action: EmailChangeAction, token: string) {
    const snapshot = await this.changes.findOneBy({ requestId });
    if (!snapshot) throw invalidLink();
    const state = await writeMemberships(this.changes.manager, async write => {
      // Use the provisioning lock before the account row, as invitations do.
      const destination = action === 'cancel' ? null : await write.accountByEmail(snapshot.newEmail);
      const user = await write.findAccount(snapshot.userId);
      const change = await write.manager.findOneBy(EmailChange, { requestId });
      if (!user || !change || !current(change, user)) throw invalidLink();
      const key = `${action}Hash` as const;
      const expected = change[key];
      if (!expected || !timingSafeEqual(Buffer.from(hash(token)), Buffer.from(expected))) throw invalidLink();
      if (action === 'cancel') {
        await write.manager.delete(EmailChange, { requestId });
        return 'cancelled';
      }
      if (unavailableReason(user)) throw new ForbiddenException('Bitte wende dich an die Administration.');
      change[`${action}Hash`] = null;
      if (change.approveHash || change.verifyHash) {
        await write.manager.save(change);
        return 'waiting';
      }
      await write.manager.delete(EmailChange, { requestId });
      if (destination) return 'unavailable';
      await write.users.update(user.id, {
        email: change.newEmail, passwordResetTokenVersion: user.passwordResetTokenVersion + 1,
        twoFactorTokenVersion: user.twoFactorTokenVersion + 1, twoFactorCodeHash: null, twoFactorCodeExpiresAt: null,
      });
      await write.manager.delete(RefreshSession, { userId: user.id });
      return 'completed';
    });
    if (state === 'unavailable') throw new BadRequestException('Die Änderung konnte nicht abgeschlossen werden.');
    if (state === 'completed') {
      const results = await Promise.allSettled([snapshot.oldEmail, snapshot.newEmail].map(to =>
        this.email.sendEmailChangeMessage(to, 'StatO – E-Mail-Adresse geändert',
          `Die Anmeldeadresse deines StatO-Kontos wurde auf ${snapshot.newEmail} geändert. Melde dich mit dieser Adresse und deinem bisherigen Passwort an. Falls du die Änderung nicht veranlasst hast, kontaktiere umgehend deine Administration.`)));
      if (results.some(result => result.status === 'rejected')) this.logger.warn('Versand der Abschlussbenachrichtigung fehlgeschlagen.');
    }
    return { state };
  }
}
