import { Injectable, BadRequestException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { User } from '../users/entities/user.entity';
import { Organization } from '../orgs/entities/organization.entity';
import { Location } from '../locations/entities/location.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { EmailService } from '../email/email.service';
import type { UserRole } from '../users/entities/user.entity';
import { AuditService } from '../common/audit.service';
import { AuditAction } from '../common/enums';
import { normalizeUploadPath } from '../common/upload-paths';
import { isStrictSecurityMode } from '../config/security.config';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from './password-policy';
import { getTwoFactorCodeTtlSeconds, isTwoFactorAuthenticationEnabled } from './two-factor.config';

export type PasswordResetMode = 'email' | 'admin_temp_password' | 'hybrid';
export type AdminResetActionMode = 'email' | 'temporary_password';
export type TwoFactorChallengeResponse = {
  requiresTwoFactor: true;
  challengeToken: string;
  emailHint: string;
  expiresInSeconds: number;
};

const getJwtSecret = () => process.env.JWT_SECRET || 'dev_secret_change_me';
const PLACEHOLDER_SUPERADMIN_EMAILS = new Set([
  'hubertoink@outlook.com',
  'admin@example.org',
  'admin@example.com',
  'admin@example.net',
]);

@Injectable()
export class AuthService {
  private readonly MAX_FAILED_LOGINS = 5;
  private readonly LOGIN_LOCKOUT_MS = 10 * 60 * 1000;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  private getPasswordResetMode(): PasswordResetMode {
    const raw = String(process.env.PASSWORD_RESET_MODE || 'email').trim().toLowerCase();
    if (raw === 'admin_temp_password' || raw === 'hybrid' || raw === 'email') return raw;
    return 'email';
  }

  getPublicPasswordResetConfig() {
    const passwordResetMode = this.getPasswordResetMode();
    return {
      passwordResetMode,
      forgotPasswordEnabled: passwordResetMode !== 'admin_temp_password',
      adminTemporaryPasswordEnabled: passwordResetMode !== 'email',
    };
  }

  private shouldSurfaceEmailDeliveryErrors() {
    const appEnv = String(process.env.APP_ENV || process.env.NODE_ENV || '').trim().toLowerCase();
    return appEnv !== 'production';
  }

  isTwoFactorAuthenticationEnabled() {
    return isTwoFactorAuthenticationEnabled();
  }

  private maskEmail(email: string) {
    const normalized = String(email || '').trim();
    const atIndex = normalized.indexOf('@');
    if (atIndex <= 1) return normalized;

    const local = normalized.slice(0, atIndex);
    const domain = normalized.slice(atIndex + 1);
    if (!domain) return `${local[0]}***`;
    return `${local[0]}***${local[local.length - 1] || ''}@${domain}`;
  }

  private generateTwoFactorCode() {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private async clearTwoFactorChallenge(user: User, options?: { bumpVersion?: boolean }) {
    user.twoFactorCodeHash = null;
    user.twoFactorCodeExpiresAt = null;
    if (options?.bumpVersion === true) {
      user.twoFactorTokenVersion = (user.twoFactorTokenVersion || 0) + 1;
    }
    await this.users.save(user);
  }

  private async issueTwoFactorChallenge(user: User): Promise<TwoFactorChallengeResponse> {
    const expiresInSeconds = getTwoFactorCodeTtlSeconds();
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const code = this.generateTwoFactorCode();
    const nextVersion = (user.twoFactorTokenVersion || 0) + 1;

    user.twoFactorTokenVersion = nextVersion;
    user.twoFactorCodeHash = await bcrypt.hash(code, 10);
    user.twoFactorCodeExpiresAt = expiresAt;
    await this.users.save(user);

    try {
      await this.email.sendTwoFactorCodeEmail(
        user.email,
        user.name || user.email,
        code,
        Math.max(1, Math.ceil(expiresInSeconds / 60)),
      );
    } catch {
      await this.clearTwoFactorChallenge(user);
      throw new HttpException(
        'Der Zwei-Faktor-Code konnte nicht versendet werden. Bitte später erneut versuchen.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const challengeToken = await this.jwt.signAsync(
      { sub: user.id, purpose: 'login-2fa', version: nextVersion },
      { expiresIn: expiresInSeconds },
    );

    return {
      requiresTwoFactor: true,
      challengeToken,
      emailHint: this.maskEmail(user.email),
      expiresInSeconds,
    };
  }

  private async verifyTwoFactorChallengeToken(challengeToken: string) {
    const decoded = await this.jwt.verifyAsync<{ sub: string; purpose?: string; version?: number }>(challengeToken, {
      secret: getJwtSecret(),
    });
    if (!decoded || decoded.purpose !== 'login-2fa' || typeof decoded.version !== 'number') {
      throw new UnauthorizedException('Ungültige Zwei-Faktor-Anfrage');
    }
    return decoded;
  }

  private async savePassword(
    user: User,
    password: string,
    options?: { mustChangePassword?: boolean; bumpResetVersion?: boolean },
  ) {
    if (!isStrongPassword(password)) {
      throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
    }
    user.passwordHash = await bcrypt.hash(password, 10);
    if (options?.bumpResetVersion !== false) {
      user.passwordResetTokenVersion = (user.passwordResetTokenVersion || 0) + 1;
    }
    user.mustChangePassword = options?.mustChangePassword === true;
    await this.users.save(user);
  }

  private async issueResetToken(user: User) {
    user.passwordResetTokenVersion = (user.passwordResetTokenVersion || 0) + 1;
    await this.users.save(user);
    return this.jwt.signAsync(
      { sub: user.id, purpose: 'reset', version: user.passwordResetTokenVersion },
      { expiresIn: process.env.RESET_TOKEN_EXPIRATION || '1h' },
    );
  }

  private async sendResetLink(user: User) {
    const token = await this.issueResetToken(user);
    const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
    const link = `${origin}/reset-password?token=${token}`;
    try {
      await this.email.sendPasswordResetEmail(user.email, user.name || user.email, link);
    } catch (error) {
      if (this.shouldSurfaceEmailDeliveryErrors()) {
        throw new HttpException(
          'Die Passwort-Reset-E-Mail konnte nicht versendet werden. Bitte SMTP-Konfiguration und Backend-Logs pruefen.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }
    return { ok: true as const, mode: 'email' as const };
  }

  async ensureSeed() {
    const strictMode = isStrictSecurityMode();
    const configuredSeedEmail = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
    const seedEmail = (configuredSeedEmail || 'Hubertoink@outlook.com').toLowerCase();
    const forcedPassword = process.env.SUPERADMIN_PASSWORD;
    const forceEmail = (process.env.SUPERADMIN_EMAIL_FORCE || '').toLowerCase() === 'true';
    const forcePassword = (process.env.SUPERADMIN_PASSWORD_FORCE || '').toLowerCase() === 'true';
    const existing = await this.users.findOne({ where: { role: 'superadmin' } });

    if (!existing && strictMode) {
      if (!configuredSeedEmail || PLACEHOLDER_SUPERADMIN_EMAILS.has(seedEmail)) {
        throw new Error(
          'SUPERADMIN_EMAIL muss in produktiven/staging Umgebungen explizit gesetzt sein und darf kein Platzhalter sein.',
        );
      }
      if (!isStrongPassword(String(forcedPassword || ''))) {
        throw new Error(
          'SUPERADMIN_PASSWORD muss in produktiven/staging Umgebungen mindestens 12 Zeichen mit Groß-/Kleinbuchstaben, Zahl und Sonderzeichen enthalten.',
        );
      }
    }

    if (!existing) {
      const user = this.users.create({
        email: seedEmail,
        name: 'Super Admin',
        role: 'superadmin',
        passwordHash: await bcrypt.hash(forcedPassword || 'admin', 10),
        mustChangePassword: false,
      });
      await this.users.save(user);
      return;
    }

    let changed = false;
    if (forceEmail && strictMode && (!configuredSeedEmail || PLACEHOLDER_SUPERADMIN_EMAILS.has(seedEmail))) {
      throw new Error('SUPERADMIN_EMAIL_FORCE erfordert in produktiven/staging Umgebungen eine explizite, nicht-placeholder SUPERADMIN_EMAIL.');
    }
    if (forceEmail && existing.email.toLowerCase() !== seedEmail) {
      existing.email = seedEmail;
      changed = true;
    }
    if (forcePassword && strictMode && !isStrongPassword(String(forcedPassword || ''))) {
      throw new Error(
        'SUPERADMIN_PASSWORD_FORCE erfordert in produktiven/staging Umgebungen ein starkes SUPERADMIN_PASSWORD mit mindestens 12 Zeichen, Groß-/Kleinbuchstaben, Zahl und Sonderzeichen.',
      );
    }
    if (forcePassword && typeof forcedPassword === 'string' && forcedPassword.length >= 6) {
      existing.passwordHash = await bcrypt.hash(forcedPassword, 10);
      existing.mustChangePassword = false;
      changed = true;
    } else if (!existing.passwordHash) {
      if (strictMode && !isStrongPassword(String(forcedPassword || ''))) {
        throw new Error(
          'Bestehender Superadmin ohne Passwort-Hash erfordert in produktiven/staging Umgebungen ein starkes SUPERADMIN_PASSWORD.',
        );
      }
      existing.passwordHash = await bcrypt.hash(forcedPassword || 'admin', 10);
      existing.mustChangePassword = false;
      changed = true;
    }
    if (changed) await this.users.save(existing);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.users
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash || '');
    return ok ? user : null;
  }

  async loginWithPassword(email: string, password: string) {
    const normalizedEmail = String(email || '').toLowerCase();
    const now = new Date();

    const user = await this.users
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email: normalizedEmail })
      .getOne();

    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.lockoutUntil && user.lockoutUntil.getTime() <= now.getTime()) {
      user.lockoutUntil = null;
      user.failedLoginAttempts = 0;
      user.lastFailedLoginAt = null;
      await this.users.save(user);
    }

    if (user.lockoutUntil && user.lockoutUntil.getTime() > now.getTime()) {
      const remainingMs = user.lockoutUntil.getTime() - now.getTime();
      const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
      throw new HttpException(
        `Zu viele Fehlversuche. Bitte in ${remainingMin} Minute(n) erneut versuchen.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      user.lastFailedLoginAt &&
      now.getTime() - user.lastFailedLoginAt.getTime() > this.LOGIN_LOCKOUT_MS
    ) {
      user.failedLoginAttempts = 0;
      user.lastFailedLoginAt = null;
      await this.users.save(user);
    }

    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      user.lastFailedLoginAt = now;
      if (user.failedLoginAttempts >= this.MAX_FAILED_LOGINS) {
        user.lockoutUntil = new Date(now.getTime() + this.LOGIN_LOCKOUT_MS);
      }
      await this.users.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.failedLoginAttempts || user.lockoutUntil || user.lastFailedLoginAt) {
      user.failedLoginAttempts = 0;
      user.lockoutUntil = null;
      user.lastFailedLoginAt = null;
      await this.users.save(user);
    }

    if (this.isTwoFactorAuthenticationEnabled()) {
      return this.issueTwoFactorChallenge(user);
    }

    return this.login(user);
  }

  async verifyTwoFactorLogin(challengeToken: string, codeRaw: string) {
    if (!this.isTwoFactorAuthenticationEnabled()) {
      throw new BadRequestException('Zwei-Faktor-Authentifizierung ist deaktiviert');
    }

    const code = String(codeRaw || '').replace(/\D/g, '');
    if (code.length !== 6) {
      throw new UnauthorizedException('Ungültiger Sicherheitscode');
    }

    const decoded = await this.verifyTwoFactorChallengeToken(challengeToken);
    const user = await this.users.findOne({ where: { id: decoded.sub } });
    if (!user) throw new UnauthorizedException('Nicht autorisiert');
    if ((user.twoFactorTokenVersion || 0) !== decoded.version) {
      throw new UnauthorizedException('Die Zwei-Faktor-Anfrage ist nicht mehr gültig');
    }
    if (!user.twoFactorCodeHash || !user.twoFactorCodeExpiresAt) {
      throw new UnauthorizedException('Kein aktiver Sicherheitscode vorhanden');
    }
    if (user.twoFactorCodeExpiresAt.getTime() < Date.now()) {
      await this.clearTwoFactorChallenge(user, { bumpVersion: true });
      throw new UnauthorizedException('Der Sicherheitscode ist abgelaufen');
    }

    const ok = await bcrypt.compare(code, user.twoFactorCodeHash);
    if (!ok) {
      throw new UnauthorizedException('Ungültiger Sicherheitscode');
    }

    await this.clearTwoFactorChallenge(user, { bumpVersion: true });
    return this.login(user);
  }

  async resendTwoFactorLogin(challengeToken: string) {
    if (!this.isTwoFactorAuthenticationEnabled()) {
      throw new BadRequestException('Zwei-Faktor-Authentifizierung ist deaktiviert');
    }

    const decoded = await this.verifyTwoFactorChallengeToken(challengeToken);
    const user = await this.users.findOne({ where: { id: decoded.sub } });
    if (!user) throw new UnauthorizedException('Nicht autorisiert');
    if ((user.twoFactorTokenVersion || 0) !== decoded.version) {
      throw new UnauthorizedException('Die Zwei-Faktor-Anfrage ist nicht mehr gültig');
    }

    return this.issueTwoFactorChallenge(user);
  }

  async login(user: User) {
    const payload = { sub: user.id, role: user.role, orgId: user.orgId, name: user.name || null };
    const token = await this.jwt.signAsync(payload);
    const orgName = user.orgId
      ? ((await this.orgs.findOne({ where: { id: user.orgId } }))?.name ?? null)
      : null;
    const avatarUrl = normalizeUploadPath(
      (user as unknown as { avatarUrl?: string | null }).avatarUrl ?? null,
    );
    const rawTheme = (user as unknown as { theme?: string }).theme;
    const theme =
      !rawTheme || rawTheme === 'light' || rawTheme === 'Light Steel'
        ? 'Default Theme'
        : rawTheme;
    try {
      await this.audit.log({
        action: AuditAction.LOGIN,
        entityType: 'auth',
        entityId: user.id,
        entityTitle: user.email || user.name || null,
        user: { id: user.id, name: user.name || null, orgId: user.orgId ?? null },
        orgId: user.orgId ?? null,
      });
    } catch {
      /* ignore audit errors */
    }

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.orgId,
        orgName,
        avatarUrl,
        theme,
        mustChangePassword: user.mustChangePassword === true,
      },
    };
  }

  async inviteUser(payload: {
    email: string;
    name: string;
    role?: 'org_admin' | 'user' | 'superadmin';
    orgId?: string | null;
    orgName?: string;
  }) {
    const email = payload.email.toLowerCase();
    let user = await this.users.findOne({ where: { email } });
    let resolvedOrgId: string | null | undefined = payload.orgId;

    if (!resolvedOrgId && payload.orgName) {
      const existingOrg = await this.orgs.findOne({ where: { name: payload.orgName } });
      if (existingOrg) {
        resolvedOrgId = existingOrg.id;
      } else {
        const newOrg = this.orgs.create({ name: payload.orgName });
        const savedOrg = await this.orgs.save(newOrg);
        const location = this.locations.create({
          name: payload.orgName,
          active: true,
          orgId: savedOrg.id,
        });
        await this.locations.save(location);
        resolvedOrgId = savedOrg.id;
      }
    }

    if (!user) {
      const role: UserRole = (payload.role ?? 'user') as UserRole;
      user = this.users.create({
        email,
        name: payload.name || email,
        role,
        orgId: (typeof resolvedOrgId !== 'undefined' ? resolvedOrgId : payload.orgId) ?? null,
        passwordHash: null,
        mustChangePassword: false,
      });
    } else {
      user.name = payload.name || user.name;
      if (payload.role) user.role = payload.role as UserRole;
      if (typeof resolvedOrgId !== 'undefined') user.orgId = resolvedOrgId ?? null;
      user.passwordHash = null;
      user.mustChangePassword = false;
    }

    await this.users.save(user);
    const token = await this.jwt.signAsync(
      { sub: user.id, purpose: 'invite' },
      { expiresIn: process.env.INVITE_TOKEN_EXPIRATION || '7d' },
    );
    const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
    const link = `${origin}/accept-invite?token=${token}`;
    try {
      await this.email.sendInviteEmail(user.email, user.name || user.email, link);
    } catch {
      /* ignore email errors */
    }
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.orgId,
      },
    };
  }

  async acceptInvite(token: string, password: string) {
    const decoded = await this.jwt.verifyAsync<{ sub: string; purpose?: string }>(token, {
      secret: getJwtSecret(),
    });
    if (!decoded || decoded.purpose !== 'invite') throw new Error('Invalid invite token');
    const user = await this.users.findOne({ where: { id: decoded.sub } });
    if (!user) throw new Error('User not found');
    if (user.passwordHash) throw new Error('Invite already accepted');
    await this.savePassword(user, password, { mustChangePassword: false, bumpResetVersion: false });
    return this.login(user);
  }

  async getProfile(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return null;
    const orgName = user.orgId
      ? ((await this.orgs.findOne({ where: { id: user.orgId } }))?.name ?? null)
      : null;
    const avatarUrl = normalizeUploadPath(
      (user as unknown as { avatarUrl?: string | null }).avatarUrl ?? null,
    );
    const rawTheme = (user as unknown as { theme?: string }).theme;
    const theme =
      !rawTheme || rawTheme === 'light' || rawTheme === 'Light Steel'
        ? 'Default Theme'
        : rawTheme;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      orgName,
      avatarUrl,
      theme,
      mustChangePassword: user.mustChangePassword === true,
    };
  }

  async updateProfile(
    userId: string,
    patch: { name?: string; avatarUrl?: string | null; theme?: string },
  ) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (typeof patch.name === 'string') user.name = patch.name;
    if (typeof patch.avatarUrl !== 'undefined') {
      (user as unknown as { avatarUrl?: string | null }).avatarUrl = normalizeUploadPath(
        patch.avatarUrl,
      );
    }
    if (typeof patch.theme === 'string') {
      (user as unknown as { theme?: string }).theme = patch.theme;
    }
    await this.users.save(user);
    return this.getProfile(user.id);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new Error('Passwortänderung nicht möglich');
    }
    const ok = await bcrypt.compare(currentPassword || '', user.passwordHash || '');
    if (!ok) throw new Error('Aktuelles Passwort ist falsch');
    await this.savePassword(user, newPassword, { mustChangePassword: false, bumpResetVersion: true });
    return { ok: true };
  }

  async verifyPasswordForUser(userId: string, password: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.passwordHash) return false;
    return bcrypt.compare(password || '', user.passwordHash || '');
  }

  async requestPasswordReset(emailRaw: string) {
    const resetConfig = this.getPublicPasswordResetConfig();
    if (!resetConfig.forgotPasswordEnabled) return { ok: true, disabled: true };

    const email = (emailRaw || '').toLowerCase().trim();
    if (!email) return { ok: true };
    const user = await this.users.findOne({ where: { email } });
    if (!user) return { ok: true };
    await this.sendResetLink(user);
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const decoded = await this.jwt.verifyAsync<{ sub: string; purpose?: string; version?: number }>(token, {
      secret: getJwtSecret(),
    });
    if (!decoded || decoded.purpose !== 'reset') throw new Error('Invalid reset token');
    const user = await this.users.findOne({ where: { id: decoded.sub } });
    if (!user) throw new Error('User not found');
    if ((decoded.version ?? -1) !== (user.passwordResetTokenVersion || 0)) {
      throw new Error('Reset token bereits verbraucht oder ersetzt');
    }
    await this.savePassword(user, password, { mustChangePassword: false, bumpResetVersion: true });
    return { ok: true };
  }

  async adminResetPassword(
    userId: string,
    options?: {
      mode?: AdminResetActionMode;
      temporaryPassword?: string;
      actor?: { id?: string; name?: string | null; orgId?: string | null };
    },
  ) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const resetConfig = this.getPublicPasswordResetConfig();
    let actionMode: AdminResetActionMode;
    if (resetConfig.passwordResetMode === 'admin_temp_password') {
      actionMode = 'temporary_password';
    } else if (resetConfig.passwordResetMode === 'email') {
      actionMode = 'email';
    } else {
      actionMode = options?.mode === 'temporary_password' ? 'temporary_password' : 'email';
    }

    if (actionMode === 'temporary_password') {
      const temporaryPassword = String(options?.temporaryPassword || '');
      if (!temporaryPassword) {
        throw new BadRequestException('Temporäres Passwort erforderlich');
      }
      await this.savePassword(user, temporaryPassword, {
        mustChangePassword: true,
        bumpResetVersion: true,
      });
      try {
        await this.audit.log({
          action: AuditAction.UPDATE,
          entityType: 'user-password',
          entityId: user.id,
          entityTitle: user.email || user.name || null,
          user: options?.actor,
          orgId: user.orgId ?? null,
          details: { resetMode: 'temporary_password', mustChangePassword: true },
        });
      } catch {
        /* ignore audit errors */
      }
      return { ok: true as const, mode: 'temporary_password' as const, mustChangePassword: true };
    }

    return this.sendResetLink(user);
  }
}
