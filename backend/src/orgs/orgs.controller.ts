import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, ForbiddenException, Delete, BadRequestException } from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { OpeningHours, OrganizationClosureDay, OrganizationTaxonomySettingsUpdatePayload } from './entities/organization.entity';

function orgMoveFeatureEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.ENABLE_ORG_MOVE || '').toLowerCase());
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs')
export class OrgsController {
  constructor(private readonly service: OrgsService) {}

  @Roles('superadmin')
  @Get()
  list() { return this.service.findAll(); }

  @Roles('superadmin', 'org_admin')
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
    if (typeof body?.parentId !== 'undefined' && body.parentId !== null && body.parentId !== myOrgId) {
      throw new ForbiddenException('Org-Admins können nur direkte Unterorganisationen ihrer eigenen Organisation anlegen');
    }
    return this.service.create(body?.name, myOrgId);
  }

  @Roles('superadmin')
  @Post(':id/move-preview')
  previewMove(@Param('id') id: string, @Body() body: { parentId?: string | null }) {
    if (!orgMoveFeatureEnabled()) throw new ForbiddenException('Organisationsverschiebung ist deaktiviert');
    return this.service.previewMoveOrg(id, body?.parentId ?? null);
  }

  @Roles('superadmin')
  @Patch(':id/move')
  move(@Param('id') id: string, @Body() body: { parentId?: string | null; force?: boolean }) {
    if (!orgMoveFeatureEnabled()) throw new ForbiddenException('Organisationsverschiebung ist deaktiviert');
    return this.service.moveOrg(id, body?.parentId ?? null, !!body?.force);
  }

  @Roles('superadmin', 'org_admin')
  @Get(':id/taxonomy-settings')
  taxonomySettings(
    @Param('id') id: string,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    return this.service.getChildTaxonomySettingsScoped(id, req.user);
  }

  @Roles('superadmin', 'org_admin')
  @Patch(':id/taxonomy-settings')
  updateTaxonomySettings(
    @Param('id') id: string,
    @Body() body: OrganizationTaxonomySettingsUpdatePayload,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    return this.service.updateOrgTaxonomySettingsScoped(id, body || {}, req.user);
  }

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
          return this.service.findUsersByOrgIds(ids);
        })();
      }
      return this.service.findUsersByOrg(id || null);
    }
    const myOrgId = req.user.orgId || null;
    if (!myOrgId) return [];
    return (async () => {
      const ids = await this.service.getSubtreeOrgIds(myOrgId);
      if (!ids.includes(id)) return [];
      if (include) {
        const subtree = await this.service.getSubtreeOrgIds(id);
        return this.service.findUsersByOrgIds(subtree);
      }
      return this.service.findUsersByOrg(id || null);
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

  // Get opening hours for an org
  @Get(':id/opening-hours')
  async getOpeningHours(
    @Param('id') id: string,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    // Allow access if superadmin or if org is in user's subtree
    if (req.user.role !== 'superadmin') {
      const myOrgId = req.user.orgId || null;
      if (!myOrgId) throw new ForbiddenException('Nicht erlaubt');
      const subtree = await this.service.getSubtreeOrgIds(myOrgId);
      if (!subtree.includes(id)) throw new ForbiddenException('Nicht erlaubt');
    }
    return this.service.getOpeningHours(id);
  }

  // Update opening hours for an org
  @Patch(':id/opening-hours')
  async updateOpeningHours(
    @Param('id') id: string,
    @Body() body: OpeningHours,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    // superadmin or org_admin of that org (or parent org)
    if (req.user.role !== 'superadmin') {
      const myOrgId = req.user.orgId || null;
      if (!myOrgId) throw new ForbiddenException('Nicht erlaubt');
      const subtree = await this.service.getSubtreeOrgIds(myOrgId);
      if (!subtree.includes(id)) throw new ForbiddenException('Nicht erlaubt');
    }
    return this.service.updateOpeningHours(id, body);
  }

  @Get(':id/closure-days')
  async getClosureDays(
    @Param('id') id: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    if (req.user.role !== 'superadmin') {
      const myOrgId = req.user.orgId || null;
      if (!myOrgId) throw new ForbiddenException('Nicht erlaubt');
      const subtree = await this.service.getSubtreeOrgIds(myOrgId);
      if (!subtree.includes(id)) throw new ForbiddenException('Nicht erlaubt');
    }
    return this.service.getClosureDays(id, from, to);
  }

  @Patch(':id/closure-days/:date')
  async upsertClosureDay(
    @Param('id') id: string,
    @Param('date') date: string,
    @Body() body: Pick<OrganizationClosureDay, 'from' | 'to'>,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    if (req.user.role !== 'superadmin') {
      const myOrgId = req.user.orgId || null;
      if (!myOrgId) throw new ForbiddenException('Nicht erlaubt');
      const subtree = await this.service.getSubtreeOrgIds(myOrgId);
      if (!subtree.includes(id)) throw new ForbiddenException('Nicht erlaubt');
    }
    return this.service.upsertClosureDay(id, { date, from: body?.from, to: body?.to });
  }

  @Delete(':id/closure-days/:date')
  async deleteClosureDay(
    @Param('id') id: string,
    @Param('date') date: string,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    if (req.user.role !== 'superadmin') {
      const myOrgId = req.user.orgId || null;
      if (!myOrgId) throw new ForbiddenException('Nicht erlaubt');
      const subtree = await this.service.getSubtreeOrgIds(myOrgId);
      if (!subtree.includes(id)) throw new ForbiddenException('Nicht erlaubt');
    }
    return this.service.removeClosureDay(id, date);
  }
}
