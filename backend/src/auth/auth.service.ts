import { Injectable, BadRequestException, ConflictException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, randomInt } from 'crypto';
import { User } from '../users/entities/user.entity';
import { Organization } from '../orgs/entities/organization.entity';
import { Location } from '../locations/entities/location.entity';
import { RefreshSession } from './entities/refresh-session.entity';
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

export type AuthUserResponse = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgId: string | null;
  orgName: string | null;
  avatarUrl: string | null;
  theme: string;
  mustChangePassword: boolean;
  termsAcceptanceRequired: boolean;
};

export type InviteUserResponse = {
  invitationSent: true;
  emailQueued: boolean;
  user: Pick<AuthUserResponse, 'id' | 'email' | 'name' | 'role' | 'orgId'>;
};

export type PublicAuthSessionResponse = {
  access_token: string;
  refresh_csrf_token: string;
  user: AuthUserResponse;
};

export type AuthenticatedSessionResponse = PublicAuthSessionResponse & {
  refreshToken: string;
  refreshTokenMaxAgeMs: number;
};

export type RefreshSessionMetadata = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

const getJwtSecret = () => process.env.JWT_SECRET || 'dev_secret_change_me';
const DEFAULT_REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INVITE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TERMS_OF_USE_VERSION = '2026-07-15';
const PLACEHOLDER_SUPERADMIN_EMAILS = new Set([
  'admin@example.org',
  'admin@example.com',
  'admin@example.net',
]);

function parseDurationToMs(raw: string | undefined, fallbackMs: number) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return fallbackMs;

  const match = value.match(/^(\d+)(ms|s|m|h|d)?$/);
  if (!match) return fallbackMs;

  const amount = Number.parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount < 1) return fallbackMs;

  const unit = match[2] || 'ms';
  if (unit === 'ms') return amount;
  if (unit === 's') return amount * 1000;
  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 'h') return amount * 60 * 60 * 1000;
  return amount * 24 * 60 * 60 * 1000;
}

function splitRefreshToken(refreshToken: string) {
  const [id, secret] = String(refreshToken || '').split('.');
  if (!id || !secret) return null;
  return { id, secret };
}

@Injectable()
export class AuthService {
  private readonly MAX_FAILED_LOGINS = 5;
  private readonly LOGIN_LOCKOUT_MS = 10 * 60 * 1000;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(RefreshSession) private readonly refreshSessions: Repository<RefreshSession>,
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

  getRefreshTokenMaxAgeMs() {
    return parseDurationToMs(process.env.JWT_REFRESH_EXPIRATION, DEFAULT_REFRESH_TOKEN_TTL_MS);
  }

  private getInviteTokenExpirationSeconds() {
    return Math.floor(
      Math.min(
        parseDurationToMs(process.env.INVITE_TOKEN_EXPIRATION, MAX_INVITE_TOKEN_TTL_MS),
        MAX_INVITE_TOKEN_TTL_MS,
      ) / 1000,
    );
  }

  private createRefreshTokenParts() {
    return {
      id: randomBytes(24).toString('hex'),
      secret: randomBytes(48).toString('base64url'),
    };
  }

  private createRefreshCsrfToken() {
    return randomBytes(32).toString('base64url');
  }

  private clearRefreshSession(user: User) {
    user.refreshTokenId = null;
    user.refreshTokenHash = null;
    user.refreshTokenCsrfHash = null;
    user.refreshTokenExpiresAt = null;
  }

  private async revokeAllRefreshSessionsForUser(userId: string) {
    await this.refreshSessions.delete({ userId });
  }

  private async issueRefreshSession(user: User, metadata?: RefreshSessionMetadata) {
    const refreshTokenParts = this.createRefreshTokenParts();
    const refreshToken = `${refreshTokenParts.id}.${refreshTokenParts.secret}`;
    const refreshCsrfToken = this.createRefreshCsrfToken();
    const refreshTokenMaxAgeMs = this.getRefreshTokenMaxAgeMs();
    const now = new Date();

    const session = this.refreshSessions.create({
      userId: user.id,
      tokenId: refreshTokenParts.id,
      tokenHash: await bcrypt.hash(refreshTokenParts.secret, 10),
      csrfHash: await bcrypt.hash(refreshCsrfToken, 10),
      expiresAt: new Date(Date.now() + refreshTokenMaxAgeMs),
      createdAt: now,
      lastUsedAt: now,
      userAgent: metadata?.userAgent ? String(metadata.userAgent).slice(0, 255) : null,
      ipAddress: metadata?.ipAddress ? String(metadata.ipAddress).slice(0, 80) : null,
    });
    await this.refreshSessions.save(session);

    return { refreshToken, refreshCsrfToken, refreshTokenMaxAgeMs };
  }

  private async getSessionUser(user: User): Promise<AuthUserResponse> {
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
      termsAcceptanceRequired: user.termsAcceptedVersion !== TERMS_OF_USE_VERSION,
    };
  }

  private async createAuthenticatedSession(
    user: User,
    options?: { auditLogin?: boolean; sessionMetadata?: RefreshSessionMetadata },
  ): Promise<AuthenticatedSessionResponse> {
    const payload = { sub: user.id, role: user.role, orgId: user.orgId, name: user.name || null };
    const token = await this.jwt.signAsync(payload);
    const refreshSession = await this.issueRefreshSession(user, options?.sessionMetadata);

    if (options?.auditLogin !== false) {
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
    }

    return {
      access_token: token,
      refresh_csrf_token: refreshSession.refreshCsrfToken,
      refreshToken: refreshSession.refreshToken,
      refreshTokenMaxAgeMs: refreshSession.refreshTokenMaxAgeMs,
      user: await this.getSessionUser(user),
    };
  }

  private async getSessionForRefreshToken(refreshToken: string) {
    const parsed = splitRefreshToken(refreshToken);
    if (!parsed) throw new UnauthorizedException('Nicht autorisiert');

    const session = await this.refreshSessions.findOne({
      where: { tokenId: parsed.id },
      relations: { user: true },
    });
    if (!session?.user) {
      throw new UnauthorizedException('Nicht autorisiert');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.refreshSessions.delete({ id: session.id });
      throw new UnauthorizedException('Nicht autorisiert');
    }

    const tokenMatches = await bcrypt.compare(parsed.secret, session.tokenHash);
    if (!tokenMatches) throw new UnauthorizedException('Nicht autorisiert');

    return session;
  }

  async refreshSession(refreshToken: string, csrfToken: string, metadata?: RefreshSessionMetadata) {
    if (!refreshToken || !csrfToken) throw new UnauthorizedException('Nicht autorisiert');

    const session = await this.getSessionForRefreshToken(refreshToken);
    const csrfMatches = await bcrypt.compare(csrfToken, session.csrfHash);
    if (!csrfMatches) throw new UnauthorizedException('Nicht autorisiert');

    await this.refreshSessions.delete({ id: session.id });
    return this.createAuthenticatedSession(session.user, { auditLogin: false, sessionMetadata: metadata });
  }

  async revokeRefreshSession(refreshToken: string) {
    if (!refreshToken) return { ok: true as const };

    try {
      const session = await this.getSessionForRefreshToken(refreshToken);
      await this.refreshSessions.delete({ id: session.id });
    } catch {
      /* logout should remain idempotent */
    }

    return { ok: true as const };
  }

  async listRefreshSessions(userId: string) {
    const sessions = await this.refreshSessions.find({
      where: { userId },
      order: { lastUsedAt: 'DESC' },
    });
    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
    }));
  }

  async revokeRefreshSessionById(userId: string, sessionId: string) {
    await this.refreshSessions.delete({ id: sessionId, userId });
    return { ok: true as const };
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
    await this.revokeAllRefreshSessionsForUser(user.id);
  }

  private async issueResetToken(user: User) {
    user.passwordResetTokenVersion = (user.passwordResetTokenVersion || 0) + 1;
    await this.users.save(user);
    return this.jwt.signAsync(
      { sub: user.id, purpose: 'reset', version: user.passwordResetTokenVersion },
      { expiresIn: Math.floor(parseDurationToMs(process.env.RESET_TOKEN_EXPIRATION, 60 * 60 * 1000) / 1000) },
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

  async loginWithPassword(email: string, password: string, metadata?: RefreshSessionMetadata) {
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
      throw new UnauthorizedException('Ungültige Zugangsdaten');
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

    return this.login(user, metadata);
  }

  async verifyTwoFactorLogin(challengeToken: string, codeRaw: string, metadata?: RefreshSessionMetadata) {
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
    return this.login(user, metadata);
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

  async login(user: User, metadata?: RefreshSessionMetadata) {
    return this.createAuthenticatedSession(user, { sessionMetadata: metadata });
  }

  async inviteUser(payload: {
    email: string;
    name: string;
    role?: 'org_admin' | 'user' | 'superadmin';
    orgId?: string | null;
    orgName?: string;
  }): Promise<InviteUserResponse> {
    const email = payload.email.toLowerCase();
    let user = await this.users.findOne({ where: { email } });
    let resolvedOrgId: string | null | undefined = payload.orgId;

    // Invites must never repurpose an active account. This prevents an admin in one
    // organization from changing the role, password state, or organization of a
    // known email address from another organization.
    if (user?.passwordHash) {
      throw new ConflictException('Zu dieser E-Mail-Adresse existiert bereits ein aktives Konto.');
    }

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

    const targetOrgId = (typeof resolvedOrgId !== 'undefined' ? resolvedOrgId : payload.orgId) ?? null;
    const targetRole: UserRole = (payload.role ?? 'user') as UserRole;
    const isPendingInvite = !!user;
    const previousInviteTokenVersion = user?.inviteTokenVersion ?? 0;

    if (!user) {
      user = this.users.create({
        email,
        name: payload.name || email,
        role: targetRole,
        orgId: targetOrgId,
        passwordHash: null,
        mustChangePassword: false,
      });
    } else {
      // Resending is only valid for the same still-pending account. Role and org
      // changes belong to the dedicated user-management flow.
      if (user.orgId !== targetOrgId || user.role !== targetRole) {
        throw new ConflictException('Die ausstehende Einladung gehört zu einer anderen Organisation oder Rolle.');
      }
    }

    user.inviteTokenVersion = previousInviteTokenVersion + 1;
    await this.users.save(user);
    const token = await this.jwt.signAsync(
      { sub: user.id, purpose: 'invite', version: user.inviteTokenVersion },
      { expiresIn: this.getInviteTokenExpirationSeconds() },
    );
    const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
    const link = `${origin}/accept-invite?token=${token}`;
    try {
      const emailResult = await this.email.sendInviteEmail(user.email, user.name || user.email, link);
      if (!emailResult.queued) {
        throw new Error('Invite email was not delivered. Configure SMTP before inviting users.');
      }
      return {
        invitationSent: true,
        emailQueued: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          orgId: user.orgId,
        },
      };
    } catch (error) {
      // Do not leave a newly created, unusable account behind. For a resend, keep
      // the previously valid link active when the new delivery failed.
      if (isPendingInvite) {
        user.inviteTokenVersion = previousInviteTokenVersion;
        await this.users.save(user);
      } else {
        await this.users.delete({ id: user.id });
      }
      throw error;
    }
  }

  async acceptInvite(token: string, password: string, termsAccepted: boolean, metadata?: RefreshSessionMetadata) {
    if (termsAccepted !== true) throw new BadRequestException('Bitte stimme den Nutzungsbedingungen zu.');
    const decoded = await this.jwt.verifyAsync<{ sub: string; purpose?: string; version?: number }>(token, {
      secret: getJwtSecret(),
    });
    if (!decoded || decoded.purpose !== 'invite') throw new Error('Invalid invite token');
    const user = await this.users.findOne({ where: { id: decoded.sub } });
    if (!user) throw new Error('User not found');
    if (user.passwordHash) throw new Error('Invite already accepted');
    if ((decoded.version ?? 0) !== (user.inviteTokenVersion ?? 0)) {
      throw new Error('Invite token wurde ersetzt oder ist nicht mehr gültig');
    }
    await this.savePassword(user, password, { mustChangePassword: false, bumpResetVersion: false });
    user.termsAcceptedVersion = TERMS_OF_USE_VERSION;
    user.termsAcceptedAt = new Date();
    await this.users.save(user);
    return this.login(user, metadata);
  }

  async acceptTerms(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    user.termsAcceptedVersion = TERMS_OF_USE_VERSION;
    user.termsAcceptedAt = new Date();
    await this.users.save(user);
    return this.getProfile(user.id);
  }

  async getProfile(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return null;
    return this.getSessionUser(user);
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
