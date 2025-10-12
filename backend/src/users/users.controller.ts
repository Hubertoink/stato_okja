import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrgsService } from '../orgs/orgs.service';
import { OrgScopeGuard } from '../auth/org-scope.guard';

@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService, private readonly orgs: OrgsService) {}

  @Get()
  async list(@Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    if (req.user.role === 'superadmin') {
      // If a superadmin provided an effective scope, list users for that org subtree; else list all
      if (typeof req.effectiveOrgId === 'undefined') return this.service.findAll();
      if (req.effectiveOrgId === null) return this.service.findByOrg(null);
      const subtree = await this.orgs.getSubtreeOrgIds(req.effectiveOrgId);
      return this.service.findByOrgIds(subtree);
    }
    const myOrgId = (typeof req.effectiveOrgId === 'undefined') ? (req.user.orgId || null) : req.effectiveOrgId;
    if (!myOrgId) return this.service.findByOrg(null);
    const subtree = await this.orgs.getSubtreeOrgIds(myOrgId);
    return this.service.findByOrgIds(subtree);
  }

  @Roles('org_admin','superadmin')
  @Post()
  create(@Body() body: { email: string; name: string; role?: 'superadmin'|'org_admin'|'user'; orgId?: string|null }, @Req() req: { user: { role: string; orgId?: string|null } }) {
    // Require an organization for all users
    const requestedOrgId = typeof body.orgId === 'undefined' ? (req.user.orgId || null) : (body.orgId ?? null);
    if (!requestedOrgId) {
      throw new BadRequestException('Organisation ist erforderlich');
    }
    // Admins can only create users in their own org subtree
    if (req.user.role !== 'superadmin') {
      const myOrgId = req.user.orgId || null;
      // Only allow if requestedOrgId is in subtree of myOrgId
      return (async () => {
        if (!myOrgId) throw new ForbiddenException('Nicht erlaubt');
        const subtree = await this.orgs.getSubtreeOrgIds(myOrgId);
        if (!(requestedOrgId && subtree.includes(requestedOrgId))) throw new ForbiddenException('Nicht erlaubt');
        return this.service.create({ ...body, orgId: requestedOrgId });
      })();
    }
    return this.service.create({ ...body, orgId: requestedOrgId });
  }

  @Roles('org_admin','superadmin')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() patch: { role?: 'org_admin'|'user'; orgId?: string | null }, @Req() req: { user: { role: string; orgId?: string|null } }) {
    // Admins can only change role within subtree and cannot move users outside subtree
    if (req.user.role !== 'superadmin') {
      const myOrgId = req.user.orgId || null;
      const targetOrgId = typeof patch.orgId === 'undefined' ? undefined : (patch.orgId ?? null);
      if (typeof targetOrgId !== 'undefined') {
        if (myOrgId === null) {
          if (targetOrgId !== null) throw new ForbiddenException('Nicht erlaubt');
        } else {
          const subtree = await this.orgs.getSubtreeOrgIds(myOrgId);
          if (!(targetOrgId && subtree.includes(targetOrgId))) throw new ForbiddenException('Nicht erlaubt');
        }
      }
    }
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
