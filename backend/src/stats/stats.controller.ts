import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { OrgsService } from '../orgs/orgs.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';

@ApiTags('stats')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService, private readonly orgs: OrgsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'KPI-Zusammenfassung' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getSummary(
    @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orgId') orgIdQuery?: string,
  ) {
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgIdRaw = req.user.role === 'superadmin'
      ? (typeof orgIdQuery === 'undefined' ? superAdminScoped : (orgIdQuery || null))
      : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);
    const orgId: string | null | undefined = orgIdRaw;
    let orgIds: string[] | undefined;
    if (typeof orgIdRaw === 'string') {
      orgIds = await this.orgs.getSubtreeOrgIds(orgIdRaw);
    }
    return this.statsService.getSummary(from, to, orgId, orgIds);
  }

  @Get('by-type')
  @ApiOperation({ summary: 'Verteilung nach Tätigkeitstyp' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getByType(
    @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orgId') orgIdQuery?: string,
  ) {
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgIdRaw = req.user.role === 'superadmin'
      ? (typeof orgIdQuery === 'undefined' ? superAdminScoped : (orgIdQuery || null))
      : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);
    const orgId: string | null | undefined = orgIdRaw;
    let orgIds: string[] | undefined;
    if (typeof orgIdRaw === 'string') {
      orgIds = await this.orgs.getSubtreeOrgIds(orgIdRaw);
    }
    return this.statsService.getByType(from, to, orgId, orgIds);
  }

  @Get('gender')
  @ApiOperation({ summary: 'Geschlechterverteilung (Summen)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getGender(
    @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orgId') orgIdQuery?: string,
  ) {
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgIdRaw = req.user.role === 'superadmin'
      ? (typeof orgIdQuery === 'undefined' ? superAdminScoped : (orgIdQuery || null))
      : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);
    const orgId: string | null | undefined = orgIdRaw;
    let orgIds: string[] | undefined;
    if (typeof orgIdRaw === 'string') {
      orgIds = await this.orgs.getSubtreeOrgIds(orgIdRaw);
    }
    return this.statsService.getGender(from, to, orgId, orgIds);
  }

  @Get('participants-timeseries')
  @ApiOperation({ summary: 'Zeitverlauf der Teilnehmenden (pro Tag)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getParticipantsTimeseries(
    @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orgId') orgIdQuery?: string,
  ) {
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgIdRaw = req.user.role === 'superadmin'
      ? (typeof orgIdQuery === 'undefined' ? superAdminScoped : (orgIdQuery || null))
      : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);
    const orgId: string | null | undefined = orgIdRaw;
    let orgIds: string[] | undefined;
    if (typeof orgIdRaw === 'string') {
      orgIds = await this.orgs.getSubtreeOrgIds(orgIdRaw);
    }
    return this.statsService.getParticipantsTimeseries(from, to, orgId, orgIds);
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Verteilung nach Kategorien' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getByCategory(
    @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orgId') orgIdQuery?: string,
  ) {
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgIdRaw = req.user.role === 'superadmin'
      ? (typeof orgIdQuery === 'undefined' ? superAdminScoped : (orgIdQuery || null))
      : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);
    const orgId: string | null | undefined = orgIdRaw;
    let orgIds: string[] | undefined;
    if (typeof orgIdRaw === 'string') {
      orgIds = await this.orgs.getSubtreeOrgIds(orgIdRaw);
    }
    return this.statsService.getByCategory(from, to, orgId, orgIds);
  }

  @Get('by-cohort')
  @ApiOperation({ summary: 'Verteilung nach Alterskohorten' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getByCohort(
    @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orgId') orgIdQuery?: string,
  ) {
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgIdRaw = req.user.role === 'superadmin'
      ? (typeof orgIdQuery === 'undefined' ? superAdminScoped : (orgIdQuery || null))
      : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);
    const orgId: string | null | undefined = orgIdRaw;
    let orgIds: string[] | undefined;
    if (typeof orgIdRaw === 'string') {
      orgIds = await this.orgs.getSubtreeOrgIds(orgIdRaw);
    }
    return this.statsService.getByCohort(from, to, orgId, orgIds);
  }
}
