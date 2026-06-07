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
import { StaffService } from './staff.service';
import { Staff } from './entities/staff.entity';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { resolveOrgScope } from '../auth/org-scope-access';

@ApiTags('staff')
@Controller('staff')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Mitarbeitende abrufen' })
  findAll(@Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }, @Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const orgId = resolveOrgScope({ ...req.user, effectiveOrgId: req.effectiveOrgId });
    return this.staffService.findAll(isActive, orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Mitarbeitende nach ID abrufen' })
  findOne(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.staffService.findOneScoped(id, req.user);
  }

  @Post()
  @ApiOperation({ summary: 'Neue Mitarbeitende anlegen' })
  create(@Body() data: Partial<Staff>, @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    const bodyOrgId = (data as Partial<Staff> & { orgId?: string | null }).orgId ?? null;
    const orgId = req.user.role === 'superadmin' && typeof req.effectiveOrgId === 'undefined'
      ? bodyOrgId
      : resolveOrgScope({ ...req.user, effectiveOrgId: req.effectiveOrgId });
    return this.staffService.create({ ...data, orgId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mitarbeitende bearbeiten' })
  update(@Param('id') id: string, @Body() data: Partial<Staff>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.staffService.updateScoped(id, data, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Mitarbeitende löschen' })
  remove(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.staffService.removeScoped(id, req.user);
  }
}
