import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  list(@Req() req: { user: { role: string; orgId?: string|null } }) {
    if (req.user.role === 'superadmin') return this.service.findAll();
    return this.service.findByOrg(req.user.orgId || null);
  }

  @Roles('org_admin','superadmin')
  @Post()
  create(@Body() body: { email: string; name: string; role?: 'superadmin'|'org_admin'|'user'; orgId?: string|null; passwordHash?: string|null }) {
    return this.service.create(body);
  }

  @Roles('org_admin','superadmin')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() patch: { role?: 'org_admin'|'user' }) {
    await this.service.update(id, patch);
    return { ok: true };
  }

  @Roles('org_admin','superadmin')
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: { user: { id: string; orgId?: string|null; role: string } }) {
    if (req.user.id === id) throw new BadRequestException('Cannot remove yourself');
    const target = await this.service.findById(id);
    if (!target) throw new BadRequestException('User not found');
    // Prevent deleting last superadmin globally
    if (target.role === 'superadmin') {
      const superadmins = await this.service.countSuperadmins();
      if (superadmins <= 1) throw new BadRequestException('Cannot remove the last superadmin');
    }
    // Prevent deleting last org admin in the target's org
    if (target.role === 'org_admin') {
      const adminsInOrg = await this.service.countAdmins(target.orgId ?? null);
      if (adminsInOrg <= 1) throw new BadRequestException('Cannot remove the last org admin');
    }
    await this.service.remove(id);
    return { ok: true };
  }
}
