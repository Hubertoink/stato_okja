import { Body, Controller, Get, Post, Patch, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
  invite(@Body() body: { email: string; name: string; role?: 'org_admin'|'user'; orgId?: string|null; orgName?: string }) {
    // Require an organization either by id or by name (for auto-create)
    if (!body?.orgId && !body?.orgName) {
      throw new BadRequestException('Organisation ist erforderlich');
    }
    return this.auth.inviteUser(body);
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
  adminResetPassword(@Body() body: { userId: string }) {
    if (!body?.userId) throw new BadRequestException('userId erforderlich');
    return this.auth.adminResetPassword(body.userId);
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
