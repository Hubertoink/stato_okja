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
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { OrgsService } from '../orgs/orgs.service';
import { Location } from './entities/location.entity';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';

@ApiTags('locations')
@Controller('locations')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService, private readonly orgs: OrgsService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Standorte/Räume abrufen' })
  async findAll(@Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }, @Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgIdRaw = req.user.role === 'superadmin'
      ? superAdminScoped
      : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);
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
    const orgId = req.user.role === 'superadmin'
      ? ((typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId)
      : ((typeof req.effectiveOrgId === 'undefined') ? (req.user.orgId || null) : req.effectiveOrgId);
    return this.locationsService.create({ ...data, orgId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Standort bearbeiten' })
  update(@Param('id') id: string, @Body() data: Partial<Location>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    const rest: Partial<Location> = { ...(data as Partial<Location>) };
    delete (rest as Partial<Location> & { orgId?: string | null }).orgId;
    return this.locationsService.updateScoped(id, rest, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Standort löschen' })
  remove(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.locationsService.removeScoped(id, req.user);
  }
}
