import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { OrgsService } from '../orgs/orgs.service';
import { Location } from './entities/location.entity';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { resolveOrgScope } from '../auth/org-scope-access';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('locations')
@Controller('locations')
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService, private readonly orgs: OrgsService) {}

  private assertCanManageDestructiveAction(role: string) {
    if (role !== 'superadmin' && role !== 'org_admin' && role !== 'editor') {
      throw new ForbiddenException('Nur Editor oder Organisationsadministratoren dürfen Einrichtungen archivieren oder löschen');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Alle Standorte/Räume abrufen' })
  async findAll(@Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }, @Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const orgIdRaw = resolveOrgScope({ ...req.user, effectiveOrgId: req.effectiveOrgId });
    let orgId: string | null | undefined = orgIdRaw;
    let orgIds: string[] | undefined;
    if (typeof orgIdRaw === 'string') {
      orgIds = await this.orgs.getSubtreeOrgIds(orgIdRaw);
      orgId = undefined;
    }
  return this.locationsService.findAll(isActive, orgId, orgIds);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Standort nach ID abrufen' })
  findOne(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.locationsService.findOneScoped(id, req.user);
  }

  @Post()
  @ApiOperation({ summary: 'Neuen Standort anlegen' })
  create(@Body() data: Partial<Location>, @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    const orgId = resolveOrgScope({ ...req.user, effectiveOrgId: req.effectiveOrgId });
    return this.locationsService.create({ ...data, orgId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Standort bearbeiten' })
  update(@Param('id') id: string, @Body() data: Partial<Location>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    const rest: Partial<Location> = { ...(data as Partial<Location>) };
    delete (rest as Partial<Location> & { orgId?: string | null }).orgId;
    if (rest.active === false) this.assertCanManageDestructiveAction(req.user.role);
    return this.locationsService.updateScoped(id, rest, req.user);
  }

  @Delete(':id')
  @Roles('superadmin', 'org_admin', 'editor')
  @ApiOperation({ summary: 'Standort löschen' })
  remove(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    this.assertCanManageDestructiveAction(req.user.role);
    return this.locationsService.removeScoped(id, req.user);
  }
}
