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
import { resolveOrgScope } from '../auth/org-scope-access';
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
  constructor(private readonly customKpis: CustomKpisService) {}

  private async resolveOrgFilter(req: ReqWithScope, orgIdQuery?: string) {
    const orgId =
      req.user.role === 'superadmin' && typeof orgIdQuery !== 'undefined'
        ? orgIdQuery && orgIdQuery !== 'null'
          ? orgIdQuery
          : null
        : resolveOrgScope({ ...req.user, effectiveOrgId: req.effectiveOrgId });
    return { orgId, orgIds: undefined };
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
