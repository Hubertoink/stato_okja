import { writeMemberships } from '../users/membership-write';
import { Injectable, BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Raw, Repository } from 'typeorm';
import { randomBytes, randomInt, randomUUID } from 'crypto';
import { SUPPORTED_LOCALES, type SupportedLocale, SUPPORTED_THEME_MODES, type ThemeMode, SUPPORTED_NAVIGATION_LAYOUTS, type NavigationLayout, SUPPORTED_VIEW_DENSITIES, type ViewDensity, User } from '../users/entities/user.entity';
import { OrganizationMembership } from '../users/entities/organization-membership.entity';
import { Organization } from '../orgs/entities/organization.entity';
import { Location } from '../locations/entities/location.entity';
import { RefreshSession } from './entities/refresh-session.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { EmailService } from '../email/email.service';
import { getLoginLockoutConfig } from './login-lockout.config';
import type { UserRole } from '../users/entities/user.entity';
import { AuditService } from '../common/audit.service';
import { AuditAction } from '../common/enums';
import { normalizeUploadPath } from '../common/upload-paths';
import { getJwtSecret, isStrictSecurityMode } from '../config/security.config';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from './password-policy';
import { LegalContentService } from '../legal/legal-content.service';
import { getTwoFactorCodeTtlSeconds, isTwoFactorAuthenticationEnabled } from './two-factor.config';
import { forcedSuperadminEmail, seedSuperadminEmail } from './superadmin-email.config';
import { assertInitialSetupToken } from './initial-setup-token';

export type PasswordResetMode = 'email' | 'admin_temp_password' | 'hybrid';
export type AdminResetActionMode = 'email' | 'temporary_password';
export type UserProvisioningMode = 'email' | 'local';
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
  themeMode: ThemeMode;
  viewDensity: ViewDensity;
  navigationLayout: NavigationLayout;
  sidebarColoredIcons: boolean;
  locale: SupportedLocale;
  mustChangePassword: boolean;
  termsAcceptanceRequired: boolean;
  memberships: Array<{
    orgId: string;
    orgName: string;
    role: Exclude<UserRole, 'superadmin'>;
  }>;
};

export type InviteUserResponse = {
  invitationSent: true;
  emailQueued: boolean;
  outcome?: 'invited' | 'resent' | 'access_added' | 'already_member';
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

const DEFAULT_REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INVITE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PLACEHOLDER_SUPERADMIN_EMAILS = new Set([
  'admin@example.org',
  'admin@example.com',
  'admin@example.net',
]);

function resolveLocale(value?: string | null): SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale) ? (value as SupportedLocale) : 'de';
}

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
  private readonly loginLockout = getLoginLockoutConfig();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(OrganizationMembership)
    private readonly memberships: Repository<OrganizationMembership>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(RefreshSession) private readonly refreshSessions: Repository<RefreshSession>,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly legalContent: LegalContentService,
  ) {}

  private getPasswordResetMode(): PasswordResetMode {
    const raw = String(process.env.PASSWORD_RESET_MODE || 'email').trim().toLowerCase();
    if (raw === 'admin_temp_password' || raw === 'hybrid' || raw === 'email') return raw;
    return 'email';
  }

  private getUserProvisioningMode(): UserProvisioningMode {
    const raw = String(process.env.USER_PROVISIONING_MODE || 'email').trim().toLowerCase();
    return raw === 'local' ? 'local' : 'email';
  }

  getPublicPasswordResetConfig() {
    const passwordResetMode = this.getPasswordResetMode();
    return {
      passwordResetMode,
      forgotPasswordEnabled: passwordResetMode !== 'admin_temp_password',
      adminTemporaryPasswordEnabled: passwordResetMode !== 'email',
      userProvisioningMode: this.getUserProvisioningMode(),
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
    await writeMemberships(this.users.manager, async write => {
      const current = await write.account(user.id);
      if (current.email !== user.email || current.passwordHash !== user.passwordHash) {
        throw new UnauthorizedException('Bitte melde dich erneut an.');
      }
      await write.manager.getRepository(RefreshSession).save(session);
    });

    return { refreshToken, refreshCsrfToken, refreshTokenMaxAgeMs, sessionId: session.id };
  }

  private async getSessionUser(user: User, requestedOrgId?: string | null): Promise<AuthUserResponse> {
    const memberships = user.role === 'superadmin'
      ? []
      : await this.memberships.find({
          where: { userId: user.id, status: 'active' },
          relations: { organization: true },
          order: { createdAt: 'ASC' },
        });
    const selectedMembership =
      (requestedOrgId
        ? memberships.find((membership) => membership.orgId === requestedOrgId)
        : undefined) ??
      memberships.find((membership) => membership.orgId === user.orgId) ??
      memberships[0];
    const org = selectedMembership?.organization ?? (user.role === 'superadmin' && user.orgId
      ? await this.orgs.findOne({ where: { id: user.orgId } })
      : null);
    const orgName = org?.name ?? null;
    const avatarUrl = normalizeUploadPath(user.avatarUrl);
    const rawTheme = user.theme;
    const theme =
      !rawTheme || rawTheme === 'light' || rawTheme === 'Light Steel'
        ? 'Default Theme'
        : rawTheme;
    const themeMode = SUPPORTED_THEME_MODES.includes(user.themeMode)
      ? user.themeMode
      : 'system';

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role === 'superadmin' ? user.role : selectedMembership?.role ?? 'user',
      orgId: selectedMembership?.orgId ?? null,
      orgName,
      avatarUrl,
      theme,
      themeMode,
      navigationLayout: user.navigationLayout === 'top' ? 'top' : 'sidebar',
      sidebarColoredIcons: user.sidebarColoredIcons === true,
      viewDensity: user.viewDensity === 'normal' ? 'normal' : 'compact',
      locale: resolveLocale(user.locale ?? org?.defaultLocale),
      mustChangePassword: user.mustChangePassword === true,
      termsAcceptanceRequired: user.termsAcceptedVersion !== (await this.legalContent.getTermsOfUseVersion()),
      memberships: memberships.map((membership) => ({
        orgId: membership.orgId,
        orgName: membership.organization.name,
        role: membership.role,
      })),
    };
  }

  private async createAuthenticatedSession(
    user: User,
    options?: { auditLogin?: boolean; sessionMetadata?: RefreshSessionMetadata },
  ): Promise<AuthenticatedSessionResponse> {
    const refreshSession = await this.issueRefreshSession(user, options?.sessionMetadata);
    const payload = {
      sub: user.id,
      sid: refreshSession.sessionId,
      role: user.role,
      orgId: user.orgId,
      name: user.name || null,
    };
    const token = await this.jwt.signAsync(payload);

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

    const consumed = await this.refreshSessions.delete({ id: session.id });
    if (consumed.affected !== 1) throw new UnauthorizedException('Sitzung ist nicht mehr gültig');
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

  async listRefreshSessions(userId: string, currentRefreshToken?: string) {
    const currentTokenId = splitRefreshToken(currentRefreshToken || '')?.id || null;
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
      isCurrent: session.tokenId === currentTokenId,
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
    const previousVersion = user.twoFactorTokenVersion;
    const version = previousVersion + (options?.bumpVersion ? 1 : 0);
    const result = await this.users.update({ id: user.id, email: user.email, twoFactorTokenVersion: previousVersion }, {
      twoFactorCodeHash: null, twoFactorCodeExpiresAt: null, twoFactorTokenVersion: version,
    });
    if (result.affected !== 1) throw new UnauthorizedException('Die Zwei-Faktor-Anfrage ist nicht mehr gültig');
  }

  private async issueTwoFactorChallenge(user: User): Promise<TwoFactorChallengeResponse> {
    const expiresInSeconds = getTwoFactorCodeTtlSeconds();
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const code = this.generateTwoFactorCode();
    const nextVersion = (user.twoFactorTokenVersion || 0) + 1;

    const issued = await this.users.update({ id: user.id, email: user.email, twoFactorTokenVersion: user.twoFactorTokenVersion }, {
      twoFactorTokenVersion: nextVersion, twoFactorCodeHash: await bcrypt.hash(code, 10), twoFactorCodeExpiresAt: expiresAt,
    });
    if (issued.affected !== 1) throw new UnauthorizedException('Bitte melde dich erneut an.');
    user.twoFactorTokenVersion = nextVersion;

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
    const update = {
      passwordHash: await bcrypt.hash(password, 10),
      passwordResetTokenVersion: (user.passwordResetTokenVersion || 0) + (options?.bumpResetVersion === false ? 0 : 1),
      mustChangePassword: options?.mustChangePassword === true,
    };
    await writeMemberships(this.users.manager, async write => {
      const result = await write.users.update({
        id: user.id, email: user.email, passwordResetTokenVersion: user.passwordResetTokenVersion || 0,
      }, update);
      if (result.affected !== 1) throw new UnauthorizedException('Die Anfrage ist nicht mehr gültig.');
      await write.manager.getRepository(RefreshSession).delete({ userId: user.id });
    });
    Object.assign(user, update);
  }

  private async issueResetToken(user: User) {
    const version = user.passwordResetTokenVersion + 1;
    const issued = await this.users.update({ id: user.id, email: user.email, passwordResetTokenVersion: user.passwordResetTokenVersion }, {
      passwordResetTokenVersion: version,
    });
    if (issued.affected !== 1) return null;
    return this.jwt.signAsync(
      { sub: user.id, purpose: 'reset', version },
      { expiresIn: Math.floor(parseDurationToMs(process.env.RESET_TOKEN_EXPIRATION, 60 * 60 * 1000) / 1000) },
    );
  }

  private async sendResetLink(user: User) {
    const token = await this.issueResetToken(user);
    if (!token) return { ok: true as const, mode: 'email' as const };
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

  private isInitialSetupEnabled() {
    return ['true', '1', 'yes', 'on'].includes(String(process.env.INITIAL_SETUP_ENABLED || '').trim().toLowerCase());
  }

  async isInitialSetupRequired() {
    if (!this.isInitialSetupEnabled()) return false;
    return !(await this.users.findOne({ where: { role: 'superadmin' } }));
  }

  async completeInitialSetup(password: string, metadata?: RefreshSessionMetadata, setupToken?: string, adminEmail?: string) {
    if (!this.isInitialSetupEnabled()) {
      throw new BadRequestException('Die Ersteinrichtung ist nicht aktiviert.');
    }
    assertInitialSetupToken(setupToken);
    if (!isStrongPassword(password)) {
      throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
    }

    const email = String(adminEmail || process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
    if (!email || PLACEHOLDER_SUPERADMIN_EMAILS.has(email)) {
      throw new BadRequestException('SUPERADMIN_EMAIL muss für die Ersteinrichtung gesetzt sein.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.users.manager.transaction(async (manager) => {
      // Serialize initial setup even when two backend processes receive the code.
      if (manager.connection.options.type === 'postgres') {
        await manager.query('SELECT pg_advisory_xact_lock(1937006964, 1)');
      }
      const users = manager.getRepository(User);
      if (await users.findOne({ where: { role: 'superadmin' } })) {
        throw new ConflictException('Die Ersteinrichtung wurde bereits abgeschlossen.');
      }
      return users.save(users.create({
        email,
        name: 'Super Admin',
        role: 'superadmin',
        passwordHash,
        mustChangePassword: false,
      }));
    });
    return this.createAuthenticatedSession(user, { sessionMetadata: metadata });
  }

  async ensureSeed() {
    const strictMode = isStrictSecurityMode();
    const configuredSeedEmail = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
    const seedEmail = seedSuperadminEmail();
    const forcedPassword = process.env.SUPERADMIN_PASSWORD;
    const forceEmail = forcedSuperadminEmail() !== null;
    const forcePassword = (process.env.SUPERADMIN_PASSWORD_FORCE || '').toLowerCase() === 'true';
    const existing = await this.users.findOne({ where: { role: 'superadmin' } });

    if (!existing && this.isInitialSetupEnabled()) return;

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

  private saveLoginAttempts(user: User) {
    const { failedLoginAttempts, lastFailedLoginAt, lockoutUntil } = user;
    return this.users.update({ id: user.id, email: user.email }, { failedLoginAttempts, lastFailedLoginAt, lockoutUntil });
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
      await this.saveLoginAttempts(user);
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
      now.getTime() - user.lastFailedLoginAt.getTime() > this.loginLockout.lockoutMs
    ) {
      user.failedLoginAttempts = 0;
      user.lastFailedLoginAt = null;
      await this.saveLoginAttempts(user);
    }

    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      user.lastFailedLoginAt = now;
      if (user.failedLoginAttempts >= this.loginLockout.maxAttempts) {
        user.lockoutUntil = new Date(now.getTime() + this.loginLockout.lockoutMs);
      }
      await this.saveLoginAttempts(user);
      throw new UnauthorizedException('Ungültige Zugangsdaten');
    }

    if (user.failedLoginAttempts || user.lockoutUntil || user.lastFailedLoginAt) {
      user.failedLoginAttempts = 0;
      user.lockoutUntil = null;
      user.lastFailedLoginAt = null;
      await this.saveLoginAttempts(user);
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
    role?: 'org_admin' | 'editor' | 'user' | 'superadmin';
    orgId?: string | null;
    orgName?: string;
  }): Promise<InviteUserResponse> {
    const email = payload.email.trim().toLowerCase();
    const role = payload.role ?? 'user';
    const orgId = payload.orgId ?? (payload.orgName
      ? (await this.orgs.findOne({ where: { name: payload.orgName } }))?.id ?? null
      : null);
    const previous = await this.users.findOne({ where: { email: Raw(column => `LOWER(${column}) = :email`, { email }) } });
    const id = previous?.id ?? randomUUID();
    const previousVersion = previous?.inviteTokenVersion ?? 0;
    if (previous && !previous.passwordHash && (previous.orgId !== orgId || previous.role !== role)) {
      throw new ConflictException('Die ausstehende Einladung gehört zu einer anderen Organisation oder Rolle.');
    }
    if (!previous?.passwordHash) {
      // Prepare and send before publishing the new version. Failed delivery leaves the old link usable.
      await this.sendInvitation({ id, email, name: previous?.name ?? payload.name, inviteTokenVersion: previousVersion + 1 });
    }
    return writeMemberships(this.users.manager, async write => {
      const existing = await write.accountByEmail(email);
      if (existing?.id !== previous?.id || !!existing?.passwordHash !== !!previous?.passwordHash ||
          (!existing?.passwordHash && ((existing?.inviteTokenVersion ?? 0) !== previousVersion ||
            existing?.orgId !== previous?.orgId || existing?.role !== previous?.role))) {
        throw new ConflictException('Das Benutzerkonto hat sich während der Einladung geändert. Bitte erneut versuchen.');
      }
      let targetOrgId = orgId;
      if (!targetOrgId && payload.orgName) {
        const orgs = write.manager.getRepository(Organization);
        const found = await orgs.findOneBy({ name: payload.orgName });
        if (found) {
          targetOrgId = found.id;
        } else {
          const saved = await orgs.save(orgs.create({ name: payload.orgName }));
          targetOrgId = saved.id;
          const locations = write.manager.getRepository(this.locations.target);
          await locations.save(locations.create({ name: payload.orgName, active: true, orgId: targetOrgId }));
        }
      }
      if (existing?.passwordHash) {
        if (!targetOrgId || role === 'superadmin') {
          throw new ConflictException('Bestehende Konten können nur einer Organisation zugeordnet werden.');
        }
        const { membership, alreadyActive } = await write.grant(existing, targetOrgId, role);
        return {
          invitationSent: true, emailQueued: false, outcome: alreadyActive ? 'already_member' : 'access_added',
          user: { id, email, name: existing.name, role: membership.role, orgId: targetOrgId },
        };
      }
      const user = existing ?? write.users.create({
        id, email, name: payload.name || email, role, orgId: targetOrgId, passwordHash: null, mustChangePassword: false,
      });
      user.inviteTokenVersion = previousVersion + 1;
      await write.users.save(user);
      if (targetOrgId && role !== 'superadmin') await write.grant(user, targetOrgId, role);
      return {
        invitationSent: true, emailQueued: true, outcome: existing ? 'resent' : 'invited',
        user: { id, email, name: user.name, role, orgId: targetOrgId },
      };
    });
  }

  private async sendInvitation(user: Pick<User, 'id' | 'email' | 'name' | 'inviteTokenVersion'>) {
    const token = await this.jwt.signAsync(
      { sub: user.id, purpose: 'invite', version: user.inviteTokenVersion },
      { expiresIn: this.getInviteTokenExpirationSeconds() },
    );
    const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
    try {
      const result = await this.email.sendInviteEmail(user.email, user.name || user.email, `${origin}/accept-invite?token=${token}`);
      if (!result.queued) throw new HttpException({ code: 'SMTP_NOT_CONFIGURED', message: 'Die Einladungs-E-Mail konnte nicht gesendet werden: Der E-Mail-Versand (SMTP) ist nicht konfiguriert. Bitte die Administration kontaktieren.' }, HttpStatus.SERVICE_UNAVAILABLE);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException({ code: 'INVITE_DELIVERY_FAILED', message: 'Die Einladungs-E-Mail konnte nicht zugestellt werden. Bitte Empfängeradresse und E-Mail-Versand prüfen und erneut versuchen.' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async resendInvite(userId: string, actorRole: string, orgId?: string | null) {
    if (actorRole !== 'superadmin' && actorRole !== 'org_admin') throw new ForbiddenException('Nicht erlaubt');
    const globalAdmin = actorRole === 'superadmin' && orgId === null;
    if (!globalAdmin && !orgId) throw new ForbiddenException('Organisation ist erforderlich');
    const membership = { userId, orgId: orgId ?? '', status: 'active' as const };
    if (orgId && !(await this.memberships.findOne({ where: membership }))) {
      throw new ForbiddenException('Kein Zugriff auf dieses Benutzerkonto');
    }
    const previous = await this.users.findOne({ where: { id: userId } });
    if (!previous) throw new BadRequestException('Benutzerkonto nicht gefunden');
    if (previous.passwordHash) throw new ConflictException('Die Einladung wurde bereits angenommen. Bitte die Benutzerliste aktualisieren.');
    const previousVersion = previous.inviteTokenVersion ?? 0;
    const nextVersion = previousVersion + 1;
    await this.sendInvitation({ ...previous, inviteTokenVersion: nextVersion });
    return writeMemberships(this.users.manager, async write => {
      const user = await write.findAccount(userId);
      if (!user || user.passwordHash || user.email !== previous.email || (user.inviteTokenVersion ?? 0) !== previousVersion) {
        throw new ConflictException('Die Einladung hat sich während des Versands geändert. Bitte erneut versuchen.');
      }
      if (orgId && !(await write.memberships.findOne({ where: membership }))) {
        throw new ForbiddenException('Kein Zugriff auf dieses Benutzerkonto');
      }
      await write.users.update({ id: userId }, { inviteTokenVersion: nextVersion });
      return { invitationSent: true, emailQueued: true, outcome: 'resent' };
    });
  }

  async createLocalUser(payload: {
    email: string;
    name: string;
    role?: 'org_admin' | 'editor' | 'user' | 'superadmin';
    orgId: string;
    temporaryPassword: string;
    actor?: { id?: string; name?: string | null; orgId?: string | null };
  }) {
    if (this.getUserProvisioningMode() !== 'local') {
      throw new ForbiddenException('Lokale Benutzeranlage ist deaktiviert. USER_PROVISIONING_MODE=local setzen.');
    }

    const email = payload.email.trim().toLowerCase();
    const role = payload.role ?? 'user';
    const passwordHash = isStrongPassword(payload.temporaryPassword)
      ? await bcrypt.hash(payload.temporaryPassword, 10)
      : null;
    const result = await writeMemberships(this.users.manager, async write => {
      const existing = await write.accountByEmail(email);
      if (existing?.passwordHash) {
        if (role === 'superadmin') throw new ConflictException('Eine Organisationsmitgliedschaft benötigt eine Organisationsrolle.');
        const { membership } = await write.grant(existing, payload.orgId, role);
        return { account: existing, role: membership.role, activated: false };
      }
      if (existing) {
        // A tenant-admin may complete only their own pending invitation. A temporary
        // password grants account-wide access, including memberships in other tenants.
        if (existing.orgId !== payload.orgId || existing.role !== role ||
            (await write.memberships.find({ where: { userId: existing.id, status: 'active' } })).some(m => m.orgId !== payload.orgId)) {
          throw new ConflictException('Dieses ausstehende Konto kann nicht lokal für diese Organisation aktiviert werden.');
        }
      }
      if (!passwordHash) throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
      const account = existing ?? write.users.create({ email, name: payload.name || email, role, orgId: payload.orgId });
      account.passwordHash = passwordHash;
      account.mustChangePassword = true;
      account.passwordResetTokenVersion = (account.passwordResetTokenVersion ?? 0) + 1;
      account.inviteTokenVersion = (account.inviteTokenVersion ?? 0) + 1;
      await write.users.save(account);
      const grantedRole = role === 'superadmin' ? role : (await write.grant(account, payload.orgId, role)).membership.role;
      if (existing) await write.manager.getRepository(this.refreshSessions.target).delete({ userId: account.id });
      return { account, role: grantedRole, activated: true };
    });
    const { account } = result;
    if (result.activated) {
      try {
        await this.audit.log({
          action: AuditAction.CREATE, entityType: 'user', entityId: account.id, entityTitle: account.email,
          user: payload.actor, orgId: payload.orgId, details: { provisioningMode: 'local', mustChangePassword: true },
        });
      } catch { /* An audit error must not leave the new account unusable. */ }
    }
    return { id: account.id, email: account.email, name: account.name, role: result.role,
      orgId: payload.orgId, mustChangePassword: account.mustChangePassword };
  }

  async acceptInvite(token: string, password: string, termsAccepted: boolean, metadata?: RefreshSessionMetadata) {
    if (termsAccepted !== true) throw new BadRequestException('Bitte stimme den Nutzungsbedingungen zu.');
    const invalidInvite = () => new BadRequestException('Dieser Einladungslink ist abgelaufen oder nicht mehr gültig. Bitte verwende die neueste Einladung oder bitte deine Administration um eine neue.');
    let decoded: { sub: string; purpose?: string; version?: number };
    try {
      decoded = await this.jwt.verifyAsync(token, { secret: getJwtSecret() });
    } catch {
      throw invalidInvite();
    }
    if (!decoded || !decoded.sub || decoded.purpose !== 'invite') throw invalidInvite();
    const user = await this.users.findOne({ where: { id: decoded.sub } });
    if (!user) throw invalidInvite();
    if (user.passwordHash) throw new ConflictException('Die Einladung wurde bereits angenommen. Bitte melde dich mit deinem bestehenden Passwort an.');
    if ((decoded.version ?? 0) !== (user.inviteTokenVersion ?? 0)) {
      throw invalidInvite();
    }
    if (user.role !== 'superadmin' && !(await this.memberships.count({ where: { userId: user.id, status: 'active' } }))) {
      throw invalidInvite();
    }
    if (!isStrongPassword(password)) throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
    const activation = {
      passwordHash: await bcrypt.hash(password, 10),
      mustChangePassword: false,
      termsAcceptedVersion: await this.legalContent.getTermsOfUseVersion(),
      termsAcceptedAt: new Date(),
    };
    // Do not recreate a deleted account or activate a concurrently revoked link.
    const result = await this.users.update(
      { id: user.id, passwordHash: IsNull(), inviteTokenVersion: decoded.version ?? 0 },
      activation,
    );
    if (result.affected !== 1) throw invalidInvite();
    Object.assign(user, activation);
    await this.revokeAllRefreshSessionsForUser(user.id);
    return this.login(user, metadata);
  }

  async acceptTerms(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    await this.users.update(user.id, { termsAcceptedVersion: await this.legalContent.getTermsOfUseVersion(), termsAcceptedAt: new Date() });
    return this.getProfile(user.id);
  }

  async getProfile(userId: string, requestedOrgId?: string | null) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return null;
    return this.getSessionUser(user, requestedOrgId);
  }

  async updateProfile(
    userId: string,
    patch: { name?: string; avatarUrl?: string | null; theme?: string; themeMode?: ThemeMode; viewDensity?: ViewDensity; navigationLayout?: NavigationLayout; sidebarColoredIcons?: boolean; locale?: SupportedLocale },
    selectedOrg?: string,
  ) {
    const update: Partial<User> = {};
    if (typeof patch.name === 'string') update.name = patch.name;
    if (typeof patch.avatarUrl !== 'undefined') {
      update.avatarUrl = normalizeUploadPath(patch.avatarUrl);
    }
    if (typeof patch.theme === 'string') {
      update.theme = patch.theme;
    }
    if (typeof patch.themeMode === 'string' && SUPPORTED_THEME_MODES.includes(patch.themeMode)) {
      update.themeMode = patch.themeMode;
    }
    if (typeof patch.locale === 'string') update.locale = resolveLocale(patch.locale);
    if (typeof patch.sidebarColoredIcons === 'boolean') {
      update.sidebarColoredIcons = patch.sidebarColoredIcons;
    }
    if (patch.navigationLayout && SUPPORTED_NAVIGATION_LAYOUTS.includes(patch.navigationLayout)) {
      update.navigationLayout = patch.navigationLayout;
    }
    if (patch.viewDensity && SUPPORTED_VIEW_DENSITIES.includes(patch.viewDensity)) {
      update.viewDensity = patch.viewDensity;
    }
    if (Object.keys(update).length) await this.users.update(userId, update);
    return this.getProfile(userId, selectedOrg);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    metadata?: RefreshSessionMetadata,
  ) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new BadRequestException('Passwortänderung nicht möglich');
    }
    const ok = await bcrypt.compare(currentPassword || '', user.passwordHash || '');
    if (!ok) throw new BadRequestException('Aktuelles Passwort ist falsch');
    await this.savePassword(user, newPassword, { mustChangePassword: false, bumpResetVersion: true });
    // savePassword invalidates all refresh sessions, including the one that
    // authorized this request. Replace it immediately so the mandatory
    // password change can continue to the terms-acceptance step.
    return this.createAuthenticatedSession(user, { auditLogin: false, sessionMetadata: metadata });
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

  private async getUserForResetToken(token: string) {
    let decoded: { sub: string; purpose?: string; version?: number };
    try {
      decoded = await this.jwt.verifyAsync<{ sub: string; purpose?: string; version?: number }>(token, {
        secret: getJwtSecret(),
      });
    } catch {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Reset-Link');
    }
    if (!decoded || decoded.purpose !== 'reset') {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Reset-Link');
    }
    const user = await this.users.findOne({ where: { id: decoded.sub } });
    if (!user) throw new UnauthorizedException('Ungültiger oder abgelaufener Reset-Link');
    if ((decoded.version ?? -1) !== (user.passwordResetTokenVersion || 0)) {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Reset-Link');
    }
    return user;
  }

  async validateResetToken(token: string) {
    await this.getUserForResetToken(token);
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const user = await this.getUserForResetToken(token);
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
