import { Body, Controller, Get, Post, Patch, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.auth.validateUser(body?.email, body?.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return this.auth.login(user);
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
    return this.auth.inviteUser(body);
  }

  @Post('accept-invite')
  acceptInvite(@Body() body: { token: string; password: string }) {
    return this.auth.acceptInvite(body?.token, body?.password);
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
    @Body() body: { name?: string; avatarUrl?: string | null },
  ) {
    return this.auth.updateProfile(req.user.id, body);
  }
}
