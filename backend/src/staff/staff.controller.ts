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
import { StaffService } from './staff.service';
import { Staff } from './entities/staff.entity';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { resolveOrgScope } from '../auth/org-scope-access';
import { toPublicStaff } from '../common/public-response';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('staff')
@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  private assertCanManageDestructiveAction(role: string) {
    if (role !== 'superadmin' && role !== 'org_admin' && role !== 'editor') {
      throw new ForbiddenException('Nur Editor oder Organisationsadministratoren dürfen Teammitglieder archivieren oder löschen');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Alle Mitarbeitende abrufen' })
  async findAll(@Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }, @Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const orgId = resolveOrgScope({ ...req.user, effectiveOrgId: req.effectiveOrgId });
    return (await this.staffService.findAll(isActive, orgId)).map(toPublicStaff);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Mitarbeitende nach ID abrufen' })
  async findOne(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    const staff = await this.staffService.findOneScoped(id, req.user);
    return staff ? toPublicStaff(staff) : null;
  }

  @Post()
  @ApiOperation({ summary: 'Neue Mitarbeitende anlegen' })
  async create(@Body() data: Partial<Staff>, @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    const bodyOrgId = (data as Partial<Staff> & { orgId?: string | null }).orgId ?? null;
    const orgId = req.user.role === 'superadmin' && typeof req.effectiveOrgId === 'undefined'
      ? bodyOrgId
      : resolveOrgScope({ ...req.user, effectiveOrgId: req.effectiveOrgId });
    return toPublicStaff(await this.staffService.create({ ...data, orgId }));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mitarbeitende bearbeiten' })
  async update(@Param('id') id: string, @Body() data: Partial<Staff>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    if (data.active === false) this.assertCanManageDestructiveAction(req.user.role);
    const staff = await this.staffService.updateScoped(id, data, req.user);
    return staff ? toPublicStaff(staff) : null;
  }

  @Delete(':id')
  @Roles('superadmin', 'org_admin', 'editor')
  @ApiOperation({ summary: 'Mitarbeitende löschen' })
  remove(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    this.assertCanManageDestructiveAction(req.user.role);
    return this.staffService.removeScoped(id, req.user);
  }
}
