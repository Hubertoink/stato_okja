import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UsersService } from '../users/users.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs')
export class OrgsController {
  constructor(private readonly service: OrgsService, private readonly users: UsersService) {}

  @Roles('superadmin')
  @Get()
  list() { return this.service.findAll(); }

  @Post()
  async create(
    @Body() body: { name: string; parentId?: string | null },
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    if (req.user.role === 'superadmin') {
      return this.service.create(body?.name, body?.parentId ?? null);
    }
    const myOrgId = req.user.orgId || null;
    if (!myOrgId) throw new ForbiddenException('Nicht erlaubt');
    const desiredParent = (typeof body?.parentId === 'undefined' || body?.parentId === null) ? myOrgId : body.parentId;
    const subtree = await this.service.getSubtreeOrgIds(myOrgId);
    if (!subtree.includes(desiredParent)) throw new ForbiddenException('Nur innerhalb der eigenen Organisation erlaubt');
    return this.service.create(body?.name, desiredParent);
  }

  @Roles('superadmin')
  @Patch(':id/move')
  move(@Param('id') id: string, @Body() body: { parentId?: string | null }) { return this.service.moveOrg(id, body?.parentId ?? null); }

  @Roles('superadmin')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const ok = await this.service.removeOrg(id);
    if (!ok) throw new BadRequestException('Organisation kann nicht gelöscht werden (existieren Unterorganisationen?)');
    return { ok: true };
  }

  // List users for an org (optionally include subtree)
  @Get(':id/users')
  usersByOrg(
    @Param('id') id: string,
    @Req() req: { user: { role: string; orgId?: string | null } },
    @Query('includeSubtree') includeSubtree?: string,
  ) {
    const include = includeSubtree === 'true';
    if (req.user.role === 'superadmin') {
      if (include) {
        return (async () => {
          const ids = await this.service.getSubtreeOrgIds(id);
          const all = await this.users.findAll();
          return all.filter(u => u.orgId && ids.includes(u.orgId));
        })();
      }
      return this.users.findByOrg(id || null);
    }
    const myOrgId = req.user.orgId || null;
    if (!myOrgId) return [];
    return (async () => {
      const ids = await this.service.getSubtreeOrgIds(myOrgId);
      if (!ids.includes(id)) return [];
      if (include) {
        const subtree = await this.service.getSubtreeOrgIds(id);
        const all = await this.users.findAll();
        return all.filter(u => u.orgId && subtree.includes(u.orgId));
      }
      return this.users.findByOrg(id || null);
    })();
  }

  // Return the list of Organization DTOs in the caller's subtree.
  // - superadmin can pass ?rootId to get any subtree; without it returns all orgs
  // - org_admin/user receive the subtree of their own org; null-org users get empty list
  @Get('subtree')
  async subtree(
    @Req() req: { user: { role: string; orgId?: string | null } },
    @Query('rootId') rootId?: string,
  ) {
    if (req.user.role === 'superadmin') {
      if (rootId) {
        const ids = await this.service.getSubtreeOrgIds(rootId);
        const all = await this.service.findAll();
        return all.filter(o => ids.includes(o.id));
      }
      return this.service.findAll();
    }
    const myOrgId = req.user.orgId || null;
    if (!myOrgId) return [];
    const ids = await this.service.getSubtreeOrgIds(myOrgId);
    const all = await this.service.findAll();
    return all.filter(o => ids.includes(o.id));
  }
}
