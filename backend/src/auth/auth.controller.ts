import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Req, Res, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService, type AuthenticatedSessionResponse } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { OrgsService } from '../orgs/orgs.service';
import type { AdminResetActionMode } from './auth.service';
import { getAuthRateLimitOverride } from '../config/rate-limit.config';
import { isStrictSecurityMode } from '../config/security.config';
import type { RefreshSessionMetadata } from './auth.service';
import { getPublicLegalContent } from '../legal/legal-content';
import {
  AcceptInviteDto,
  AdminResetPasswordDto,
  ChangePasswordDto,
  InviteUserDto,
  LoginDto,
  RequestPasswordResetDto,
  ResendTwoFactorDto,
  ResetPasswordDto,
  UpdateMeDto,
  ValidateResetTokenDto,
  VerifyTwoFactorDto,
} from './dto/auth.dto';

type InviteRole = 'superadmin' | 'org_admin' | 'user';
type RefreshCookieSameSite = 'lax' | 'strict' | 'none';

const AUTH_RATE_LIMIT = {
  default: getAuthRateLimitOverride(process.env.AUTH_RATE_LIMIT_TTL, process.env.AUTH_RATE_LIMIT_MAX),
};
const REFRESH_COOKIE_NAME = 'stato_refresh_token';

function parseNonNegativeIntEnv(raw: string | undefined, fallback: number): number {
  if (typeof raw === 'undefined') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parseBooleanish(raw: string | undefined) {
  const normalized = String(raw || '').trim().toLowerCase();
  if (!normalized) return undefined;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function getRefreshCookiePath() {
  const prefix = String(process.env.API_PREFIX || 'api').trim().replace(/^\/+|\/+$/g, '');
  return prefix ? `/${prefix}/auth` : '/auth';
}

function getRefreshCookieSameSite(): RefreshCookieSameSite {
  const configured = String(process.env.AUTH_REFRESH_COOKIE_SAMESITE || 'lax').trim().toLowerCase();
  if (configured === 'strict' || configured === 'none') return configured;
  return 'lax';
}

function shouldUseSecureRefreshCookie() {
  const explicit = parseBooleanish(process.env.AUTH_REFRESH_COOKIE_SECURE);
  if (typeof explicit === 'boolean') return explicit;
  return isStrictSecurityMode() || getRefreshCookieSameSite() === 'none';
}

function parseCookies(cookieHeader: string | undefined) {
  const cookies: Record<string, string> = {};
  for (const part of String(cookieHeader || '').split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex < 0) continue;
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function getSessionMetadata(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): RefreshSessionMetadata {
  const forwardedFor = getHeaderValue(req.headers?.['x-forwarded-for']).split(',')[0]?.trim();
  return {
    userAgent: getHeaderValue(req.headers?.['user-agent']) || null,
    ipAddress: forwardedFor || req.ip || null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly orgs: OrgsService,
  ) {}

  private parseInviteRole(role: unknown): InviteRole {
    if (role === 'superadmin' || role === 'org_admin' || role === 'user') return role;
    if (typeof role === 'undefined' || role === null || role === '') return 'user';
    throw new BadRequestException('Ungültige Rolle');
  }

  private isAuthenticatedSession(value: unknown): value is AuthenticatedSessionResponse {
    return !!value && typeof value === 'object' && 'refreshToken' in value;
  }

  private getRefreshTokenFromRequest(req: { headers?: { cookie?: string } }) {
    return parseCookies(req.headers?.cookie)[REFRESH_COOKIE_NAME] || '';
  }

  private setRefreshCookie(res: Response, session: AuthenticatedSessionResponse) {
    const sameSite = getRefreshCookieSameSite();
    const secure = shouldUseSecureRefreshCookie();
    res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: getRefreshCookiePath(),
      maxAge: session.refreshTokenMaxAgeMs,
    });
  }

  private clearRefreshCookie(res: Response) {
    const sameSite = getRefreshCookieSameSite();
    const secure = shouldUseSecureRefreshCookie();
    res.clearCookie(REFRESH_COOKIE_NAME, {
      secure,
      sameSite,
      path: getRefreshCookiePath(),
    });
  }

  private finalizeAuthSession(res: Response, session: AuthenticatedSessionResponse) {
    this.setRefreshCookie(res, session);
    const { refreshToken, refreshTokenMaxAgeMs, ...publicSession } = session;
    void refreshToken;
    void refreshTokenMaxAgeMs;
    return publicSession;
  }

  @Get('public-config')
  publicConfig() {
    const appName = String(process.env.PUBLIC_APP_NAME || 'StatO');
    const orgNameRaw = process.env.PUBLIC_ORG_NAME;
    const orgName = typeof orgNameRaw === 'string' && orgNameRaw.trim() ? orgNameRaw.trim() : null;
    const loginSubtitle = String(process.env.PUBLIC_LOGIN_SUBTITLE || 'OKJA Statistik & Dokumentation');
    const loginTitle = orgName ? `${appName} - ${orgName}` : appName;
    const liveRefreshIntervalMs = parseNonNegativeIntEnv(
      process.env.PUBLIC_LIVE_REFRESH_INTERVAL_MS,
      30000,
    );
    return {
      appName,
      orgName,
      loginTitle,
      loginSubtitle,
      liveRefreshIntervalMs,
      twoFactorEnabled: this.auth.isTwoFactorAuthenticationEnabled(),
      ...this.auth.getPublicPasswordResetConfig(),
    };
  }

  @Get('legal')
  legalContent() {
    return getPublicLegalContent();
  }

  @Throttle(AUTH_RATE_LIMIT)
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Req() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.loginWithPassword(body.email.toLowerCase(), body.password, getSessionMetadata(req));
    return this.isAuthenticatedSession(result) ? this.finalizeAuthSession(res, result) : result;
  }

  @Throttle(AUTH_RATE_LIMIT)
  @Post('verify-two-factor')
  async verifyTwoFactor(
    @Body() body: VerifyTwoFactorDto,
    @Req() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyTwoFactorLogin(body.challengeToken, body.code, getSessionMetadata(req));
    return this.finalizeAuthSession(res, result);
  }

  @Throttle(AUTH_RATE_LIMIT)
  @Post('resend-two-factor')
  resendTwoFactor(@Body() body: ResendTwoFactorDto) {
    return this.auth.resendTwoFactorLogin(body.challengeToken);
  }

  @Throttle(AUTH_RATE_LIMIT)
  @Post('refresh')
  async refresh(
    @Req() req: { headers?: { cookie?: string } },
    @Headers('x-csrf-token') csrfToken: string | string[] | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.refreshSession(
      this.getRefreshTokenFromRequest(req),
      getHeaderValue(csrfToken),
      getSessionMetadata(req),
    );
    return this.finalizeAuthSession(res, session);
  }

  @Throttle(AUTH_RATE_LIMIT)
  @Post('logout')
  async logout(
    @Req() req: { headers?: { cookie?: string } },
    @Headers('x-csrf-token') csrfToken: string | string[] | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.getRefreshTokenFromRequest(req);
    if (getHeaderValue(csrfToken)) {
      await this.auth.revokeRefreshSession(refreshToken);
    }
    this.clearRefreshCookie(res);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { user: { id: string; role: string; orgId?: string | null } }) {
    return this.auth.getProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  sessions(@Req() req: { user: { id: string } }) {
    return this.auth.listRefreshSessions(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  revokeSession(@Req() req: { user: { id: string } }, @Param('id') sessionId: string) {
    return this.auth.revokeRefreshSessionById(req.user.id, sessionId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin','org_admin')
  @Throttle(AUTH_RATE_LIMIT)
  @Post('invite')
  async invite(
    @Body() body: InviteUserDto,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    if (!body?.orgId && !body?.orgName) {
      throw new BadRequestException('Organisation ist erforderlich');
    }

    const role = this.parseInviteRole(body?.role);
    const actor = req.user;

    if (actor.role !== 'superadmin') {
      if (role === 'superadmin') throw new ForbiddenException('Nicht erlaubt');
      if (body?.orgName) {
        throw new ForbiddenException('Organisationen bitte separat innerhalb der eigenen Struktur anlegen');
      }

      const myOrgId = actor.orgId || null;
      if (!myOrgId) throw new ForbiddenException('Nicht erlaubt');

      const requestedOrgId = body?.orgId ?? myOrgId;
      if (!requestedOrgId) throw new ForbiddenException('Nicht erlaubt');

      const subtree = await this.orgs.getSubtreeOrgIds(myOrgId);
      if (!subtree.includes(requestedOrgId)) throw new ForbiddenException('Nicht erlaubt');

      return this.auth.inviteUser({
        ...body,
        name: body.name || body.email,
        role,
        orgId: requestedOrgId,
        orgName: undefined,
      });
    }

    return this.auth.inviteUser({
      ...body,
      name: body.name || body.email,
      role,
    });
  }

  @Throttle(AUTH_RATE_LIMIT)
  @Post('accept-invite')
  async acceptInvite(
    @Body() body: AcceptInviteDto,
    @Req() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.acceptInvite(body.token, body.password, body.termsAccepted, getSessionMetadata(req));
    return this.finalizeAuthSession(res, session);
  }

  @Throttle(AUTH_RATE_LIMIT)
  @Post('request-password-reset')
  requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(body.email);
  }

  @Throttle(AUTH_RATE_LIMIT)
  @Post('validate-reset-token')
  validateResetToken(@Body() body: ValidateResetTokenDto) {
    return this.auth.validateResetToken(body.token);
  }

  @Throttle(AUTH_RATE_LIMIT)
  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  @Throttle(AUTH_RATE_LIMIT)
  @Post('admin-reset-password')
  adminResetPassword(
    @Req() req: { user: { id: string; name?: string | null; orgId?: string | null } },
    @Body() body: AdminResetPasswordDto,
  ) {
    return this.auth.adminResetPassword(body.userId, {
      mode: body?.mode as AdminResetActionMode | undefined,
      temporaryPassword: body?.temporaryPassword,
      actor: {
        id: req.user.id,
        name: req.user.name ?? null,
        orgId: req.user.orgId ?? null,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(AUTH_RATE_LIMIT)
  @Post('change-password')
  changePassword(@Req() req: { user: { id: string } }, @Body() body: ChangePasswordDto) {
    return this.auth.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @Req() req: { user: { id: string } },
    @Body() body: UpdateMeDto,
  ) {
    return this.auth.updateProfile(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('accept-terms')
  acceptTerms(@Req() req: { user: { id: string } }) {
    return this.auth.acceptTerms(req.user.id);
  }
}
