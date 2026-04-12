import { Body, Controller, Get, Post, Patch, Req, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { OrgsService } from '../orgs/orgs.service';
import type { AdminResetActionMode } from './auth.service';

type InviteRole = 'superadmin' | 'org_admin' | 'user';

function parseNonNegativeIntEnv(raw: string | undefined, fallback: number): number {
  if (typeof raw === 'undefined') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
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

  @Get('public-config')
  publicConfig() {
    const appName = String(process.env.PUBLIC_APP_NAME || 'StatO');
    const orgNameRaw = process.env.PUBLIC_ORG_NAME;
    const orgName = typeof orgNameRaw === 'string' && orgNameRaw.trim() ? orgNameRaw.trim() : null;
    const loginSubtitle = String(process.env.PUBLIC_LOGIN_SUBTITLE || 'OKJA Statistik & Dokumentation');
    const loginTitle = orgName ? `${appName} - ${orgName}` : appName;
    const liveRefreshIntervalMs = parseNonNegativeIntEnv(
      process.env.PUBLIC_LIVE_REFRESH_INTERVAL_MS,
      15000,
    );
    return {
      appName,
      orgName,
      loginTitle,
      loginSubtitle,
      liveRefreshIntervalMs,
      ...this.auth.getPublicPasswordResetConfig(),
    };
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const email = String(body?.email || '').toLowerCase();
    return this.auth.loginWithPassword(email, String(body?.password || ''));
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { user: { id: string; role: string; orgId?: string | null } }) {
    return this.auth.getProfile(req.user.id);
  }

  // Invite and accept-invite
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin','org_admin')
  @Post('invite')
  async invite(
    @Body() body: { email: string; name: string; role?: 'org_admin'|'user'; orgId?: string|null; orgName?: string },
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    // Require an organization either by id or by name (for auto-create)
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
        role,
        orgId: requestedOrgId,
        orgName: undefined,
      });
    }

    return this.auth.inviteUser({
      ...body,
      role,
    });
  }

  @Post('accept-invite')
  acceptInvite(@Body() body: { token: string; password: string }) {
    return this.auth.acceptInvite(body?.token, body?.password);
  }

  // Password reset: self-service request + reset
  @Post('request-password-reset')
  requestPasswordReset(@Body() body: { email: string }) {
    return this.auth.requestPasswordReset(String(body?.email || ''));
  }

  @Post('reset-password')
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.auth.resetPassword(String(body?.token || ''), String(body?.password || ''));
  }

  // Superadmin-triggered reset link for a user
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  @Post('admin-reset-password')
  adminResetPassword(
    @Req() req: { user: { id: string; name?: string | null; orgId?: string | null } },
    @Body() body: { userId: string; mode?: AdminResetActionMode; temporaryPassword?: string },
  ) {
    if (!body?.userId) throw new BadRequestException('userId erforderlich');
    return this.auth.adminResetPassword(body.userId, {
      mode: body?.mode,
      temporaryPassword: body?.temporaryPassword,
      actor: {
        id: req.user.id,
        name: req.user.name ?? null,
        orgId: req.user.orgId ?? null,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Req() req: { user: { id: string } }, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.auth.changePassword(req.user.id, body?.currentPassword, body?.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @Req() req: { user: { id: string } },
    @Body() body: { name?: string; avatarUrl?: string | null; theme?: string },
  ) {
    return this.auth.updateProfile(req.user.id, body);
  }
}
