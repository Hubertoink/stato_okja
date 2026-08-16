import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  Delete,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { OrgsService } from './orgs.service';
import { OrgMasterDataService } from './org-master-data.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { toPublicUser } from '../common/public-response';
import { SUPPORTED_LOCALES, type UserRole } from '../users/entities/user.entity';
import {
  CreateOrganizationDto,
  MasterDataContentDto,
  MoveOrganizationDto,
  UpdateOrganizationBrandingDto,
  UpdateOrganizationProcessesEnabledDto,
  UpdateDefaultLocaleDto,
  UpdateOpeningHoursDto,
  UpdateOrganizationTaxonomySettingsDto,
  UpsertClosureDayDto,
} from './dto/organization.dto';

function orgMoveFeatureEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(
    String(process.env.ENABLE_ORG_MOVE || '').toLowerCase(),
  );
}

@UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard)
@Controller('orgs')
export class OrgsController {
  constructor(
    private readonly service: OrgsService,
    private readonly masterData: OrgMasterDataService,
  ) {}

  private async assertCanAccessOrg(id: string, user: { role: string; orgId?: string | null }) {
    if (user.role === 'superadmin') return;
    if ((user.orgId || null) !== id) throw new ForbiddenException('Nicht erlaubt');
  }

  @Roles('superadmin', 'org_admin')
  @Get('master-data/template')
  downloadMasterDataTemplate(@Res() res: Response) {
    res
      .status(200)
      .type('text/yaml; charset=utf-8')
      .attachment('stato-stammdaten-vorlage.yaml')
      .send(OrgMasterDataService.template());
  }

  @Roles('superadmin')
  @Get()
  list() {
    return this.service.findAll();
  }

  @Roles('superadmin', 'org_admin')
  @Post()
  async create(
    @Body() body: CreateOrganizationDto,
    @Req() req: { user: { id?: string; role: string; orgId?: string | null } },
  ) {
    if (req.user.role === 'superadmin') {
      return this.service.create(body?.name, body?.parentId ?? null);
    }
    const myOrgId = req.user.orgId || null;
    if (!myOrgId) throw new ForbiddenException('Nicht erlaubt');
    if (
      typeof body?.parentId !== 'undefined' &&
      body.parentId !== null &&
      body.parentId !== myOrgId
    ) {
      throw new ForbiddenException(
        'Org-Admins können nur direkte Unterorganisationen ihrer eigenen Organisation anlegen',
      );
    }
    const created = await this.service.create(body?.name, myOrgId);
    if (req.user.id) {
      await this.service.grantActiveMembership(
        req.user.id,
        created.id,
        req.user.role as Exclude<UserRole, 'superadmin'>,
      );
    }
    return created;
  }

  @Roles('superadmin')
  @Post(':id/move-preview')
  previewMove(@Param('id') id: string, @Body() body: MoveOrganizationDto) {
    if (!orgMoveFeatureEnabled())
      throw new ForbiddenException('Organisationsverschiebung ist deaktiviert');
    return this.service.previewMoveOrg(id, body?.parentId ?? null);
  }

  @Roles('superadmin')
  @Patch(':id/move')
  move(@Param('id') id: string, @Body() body: MoveOrganizationDto) {
    if (!orgMoveFeatureEnabled())
      throw new ForbiddenException('Organisationsverschiebung ist deaktiviert');
    return this.service.moveOrg(id, body?.parentId ?? null, !!body?.force);
  }

  @Roles('superadmin', 'org_admin')
  @Get(':id/taxonomy-settings')
  taxonomySettings(
    @Param('id') id: string,
    @Req() req: { user: { id?: string; role: string; orgId?: string | null } },
  ) {
    return this.service.getChildTaxonomySettingsScoped(id, req.user);
  }

  @Roles('superadmin', 'org_admin')
  @Patch(':id/taxonomy-settings')
  updateTaxonomySettings(
    @Param('id') id: string,
    @Body() body: UpdateOrganizationTaxonomySettingsDto,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    return this.service.updateOrgTaxonomySettingsScoped(id, body || {}, req.user);
  }

  @Roles('superadmin', 'org_admin')
  @Get(':id/master-data/export')
  async exportMasterData(
    @Param('id') id: string,
    @Req()
    req: { user: { id?: string; name?: string | null; role: string; orgId?: string | null } },
    @Res() res: Response,
  ) {
    await this.assertCanAccessOrg(id, req.user);
    const exported = await this.masterData.export(id, req.user);
    res
      .status(200)
      .type('text/yaml; charset=utf-8')
      .attachment(exported.filename)
      .send(exported.content);
  }

  @Roles('superadmin', 'org_admin')
  @Post(':id/master-data/import/preview')
  async previewMasterDataImport(
    @Param('id') id: string,
    @Body() body: MasterDataContentDto,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    await this.assertCanAccessOrg(id, req.user);
    if (typeof body?.content !== 'string')
      throw new BadRequestException('Bitte übermittle eine YAML-Datei.');
    return this.masterData.preview(id, body.content);
  }

  @Roles('superadmin', 'org_admin')
  @Post(':id/master-data/import')
  async importMasterData(
    @Param('id') id: string,
    @Body() body: MasterDataContentDto,
    @Req()
    req: { user: { id?: string; name?: string | null; role: string; orgId?: string | null } },
  ) {
    await this.assertCanAccessOrg(id, req.user);
    if (typeof body?.content !== 'string')
      throw new BadRequestException('Bitte übermittle eine YAML-Datei.');
    return this.masterData.import(id, body.content, req.user);
  }

  @Roles('superadmin')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const ok = await this.service.removeOrg(id);
    if (!ok)
      throw new BadRequestException(
        'Organisation kann nicht gelöscht werden (existieren Unterorganisationen?)',
      );
    return { ok: true };
  }

  @Roles('superadmin', 'org_admin')
  @Patch(':id/default-locale')
  async updateDefaultLocale(
    @Param('id') id: string,
    @Body() body: UpdateDefaultLocaleDto,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    await this.assertCanAccessOrg(id, req.user);
    if (!SUPPORTED_LOCALES.includes(body?.locale)) {
      throw new BadRequestException('Unsupported locale');
    }
    return this.service.updateDefaultLocale(id, body.locale);
  }

  @Roles('superadmin', 'org_admin')
  @Patch(':id/branding')
  async updateBranding(
    @Param('id') id: string,
    @Body() body: UpdateOrganizationBrandingDto,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    await this.assertCanAccessOrg(id, req.user);
    return this.service.updateBranding(id, body || {});
  }

  @Roles('superadmin')
  @Patch(':id/processes-enabled')
  updateProcessesEnabled(
    @Param('id') id: string,
    @Body() body: UpdateOrganizationProcessesEnabledDto,
  ) {
    return this.service.updateProcessesEnabled(id, body.enabled);
  }

  // List users for an org (optionally include subtree)
  @Get(':id/users')
  async usersByOrg(
    @Param('id') id: string,
    @Req() req: { user: { id?: string; role: string; orgId?: string | null } },
    @Query('includeSubtree') includeSubtree?: string,
  ) {
    const include = includeSubtree === 'true';
    if (req.user.role === 'superadmin') {
      if (include) {
        const ids = await this.service.getSubtreeOrgIds(id);
        return (await this.service.findMembershipUsersByOrgIds(ids)).map(toPublicUser);
      }
      return (await this.service.findMembershipUsersByOrgIds([id])).map(toPublicUser);
    }
    // The organisation tree may request a count for another selected access.
    // Allow that only when the requester has a direct admin membership in the
    // requested organisation. A parent/child relationship never grants this.
    if (!req.user.id) return [];
    const membership = await this.service.getActiveMembership(req.user.id, id);
    if (membership?.role !== 'org_admin') return [];
    void include; // Memberships are always exact; hierarchy never expands user data.
    return (await this.service.findMembershipUsersByOrgIds([id])).map(toPublicUser);
  }

  // Return selectable organizations. Non-superadmins receive only explicit
  // memberships, never the structural organization subtree.
  @Get('subtree')
  async subtree(
    @Req() req: { user: { id?: string; role: string; orgId?: string | null } },
    @Query('rootId') rootId?: string,
  ) {
    if (req.user.role === 'superadmin') {
      if (rootId) {
        const ids = await this.service.getSubtreeOrgIds(rootId);
        const all = await this.service.findAll();
        return all.filter((o) => ids.includes(o.id));
      }
      return this.service.findAll();
    }
    if (!req.user.id) return [];
    const memberships = await this.service.listActiveMemberships(req.user.id);
    return memberships.map((membership) => membership.organization).filter(Boolean);
  }

  // Get opening hours for an org
  @Get(':id/opening-hours')
  async getOpeningHours(
    @Param('id') id: string,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    await this.assertCanAccessOrg(id, req.user);
    return this.service.getOpeningHours(id);
  }

  // Update opening hours for an org
  @Roles('superadmin', 'org_admin', 'editor')
  @Patch(':id/opening-hours')
  async updateOpeningHours(
    @Param('id') id: string,
    @Body() body: UpdateOpeningHoursDto,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    await this.assertCanAccessOrg(id, req.user);
    return this.service.updateOpeningHours(id, body);
  }

  @Get(':id/closure-days')
  async getClosureDays(
    @Param('id') id: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    await this.assertCanAccessOrg(id, req.user);
    return this.service.getClosureDays(id, from, to);
  }

  @Patch(':id/closure-days/:date')
  async upsertClosureDay(
    @Param('id') id: string,
    @Param('date') date: string,
    @Body() body: UpsertClosureDayDto,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    await this.assertCanAccessOrg(id, req.user);
    return this.service.upsertClosureDay(id, { date, from: body?.from, to: body?.to });
  }

  @Delete(':id/closure-days/:date')
  async deleteClosureDay(
    @Param('id') id: string,
    @Param('date') date: string,
    @Req() req: { user: { role: string; orgId?: string | null } },
  ) {
    await this.assertCanAccessOrg(id, req.user);
    return this.service.removeClosureDay(id, date);
  }
}
