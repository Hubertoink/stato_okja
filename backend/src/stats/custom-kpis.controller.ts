import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { OrgsService } from '../orgs/orgs.service';
import { CreateCustomKpiDto, UpdateCustomKpiDto } from './dto/custom-kpi.dto';
import { CustomKpisService } from './custom-kpis.service';
import type { CustomKpiSurface } from './entities/custom-kpi.entity';

type ReqWithScope = {
  user: { id: string; role: string; orgId?: string | null };
  effectiveOrgId?: string | null | undefined;
};

@ApiTags('stats')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('stats/custom-kpis')
export class CustomKpisController {
  constructor(
    private readonly customKpis: CustomKpisService,
    private readonly orgs: OrgsService,
  ) {}

  private async resolveOrgFilter(req: ReqWithScope, orgIdQuery?: string) {
    let orgId: string | null | undefined = undefined;
    let orgIds: string[] | undefined = undefined;

    if (req.user.role === 'superadmin') {
      if (typeof orgIdQuery !== 'undefined') {
        const requestedOrgId = orgIdQuery || null;
        if (typeof requestedOrgId === 'string' && requestedOrgId !== 'null') {
          orgIds = await this.orgs.getSubtreeOrgIds(requestedOrgId);
        } else {
          orgId = null;
        }
      } else if (typeof req.effectiveOrgId === 'undefined' || req.effectiveOrgId === null) {
        orgId = null;
      } else {
        orgIds = await this.orgs.getSubtreeOrgIds(req.effectiveOrgId);
      }
    } else {
      const effectiveOrgId =
        typeof req.effectiveOrgId === 'undefined' ? req.user.orgId || null : req.effectiveOrgId;
      if (typeof effectiveOrgId === 'string') {
        orgIds = await this.orgs.getSubtreeOrgIds(effectiveOrgId);
      } else {
        orgId = null;
      }
    }

    return { orgId, orgIds };
  }

  @Get()
  @ApiOperation({ summary: 'Eigene KPI-Definitionen des angemeldeten Users' })
  list(@Req() req: ReqWithScope) {
    return this.customKpis.list(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Eigene KPI anlegen' })
  create(@Req() req: ReqWithScope, @Body() body: CreateCustomKpiDto) {
    return this.customKpis.create(req.user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Eigene KPI bearbeiten' })
  update(@Req() req: ReqWithScope, @Param('id') id: string, @Body() body: UpdateCustomKpiDto) {
    return this.customKpis.update(req.user.id, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eigene KPI löschen' })
  remove(@Req() req: ReqWithScope, @Param('id') id: string) {
    return this.customKpis.remove(req.user.id, id);
  }

  @Get('results')
  @ApiOperation({ summary: 'Berechnete eigene KPIs' })
  @ApiQuery({ name: 'surface', required: false, description: 'dashboard|statistics' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'orgId', required: false })
  async results(
    @Req() req: ReqWithScope,
    @Query('surface') surface?: CustomKpiSurface,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orgId') orgIdQuery?: string,
  ) {
    const orgFilter = await this.resolveOrgFilter(req, orgIdQuery);
    return this.customKpis.getResults(req.user.id, orgFilter, { surface, from, to });
  }
}
