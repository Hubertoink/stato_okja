import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { OrgsService } from '../orgs/orgs.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';

type ReqWithScope = {
  user: { role: string; orgId?: string | null };
  effectiveOrgId?: string | null | undefined;
};

function parseWeekdays(value?: string): number[] | undefined {
  if (!value) return undefined;
  const weekdays = Array.from(
    new Set(
      value
        .split(',')
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 6),
    ),
  ).sort((left, right) => left - right);
  return weekdays.length > 0 ? weekdays : undefined;
}

@ApiTags('stats')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService, private readonly orgs: OrgsService) {}

  /**
   * Resolve org filtering based on effectiveOrgId and optional orgIdQuery param.
   * Returns { orgId, orgIds } for use in service calls.
   * 
  * Logic:
  * - Superadmin with effectiveOrgId === undefined: treated as null (global intentionally disabled)
  * - Superadmin with effectiveOrgId === null: filter by null org only
   * - Superadmin with effectiveOrgId === string: filter by subtree
   * - Non-superadmin: always filter by effectiveOrgId or user.orgId
   */
  private async resolveOrgFilter(
    req: ReqWithScope,
    orgIdQuery?: string,
  ): Promise<{ orgId: string | null | undefined; orgIds: string[] | undefined }> {
    let orgId: string | null | undefined = undefined;
    let orgIds: string[] | undefined = undefined;

    if (req.user.role === 'superadmin') {
      // Check if orgIdQuery param overrides header
      if (typeof orgIdQuery !== 'undefined') {
        const oid = orgIdQuery || null;
        if (typeof oid === 'string' && oid !== 'null') {
          orgIds = await this.orgs.getSubtreeOrgIds(oid);
        } else {
          orgId = null;
        }
      } else if (typeof req.effectiveOrgId === 'undefined' || req.effectiveOrgId === null) {
        // Root/no-org selected - filter by null org (global disabled)
        orgId = null;
      } else {
        // Specific org selected - filter by subtree
        orgIds = await this.orgs.getSubtreeOrgIds(req.effectiveOrgId);
      }
    } else {
      // Non-superadmin: use effectiveOrgId or fallback to user.orgId
      const oid = typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId;
      if (typeof oid === 'string') {
        orgIds = await this.orgs.getSubtreeOrgIds(oid);
      } else {
        orgId = null;
      }
    }

    return { orgId, orgIds };
  }

  @Get('overview')
  @ApiOperation({ summary: 'Gebündelte Statistikdaten für die Statistikansicht' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'weekdays', required: false, description: 'CSV Liste von Wochentagen (0=So bis 6=Sa)' })
  async getOverview(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('type') type?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('weekdays') weekdaysCsv?: string,
  ) {
    const { orgId, orgIds } = await this.resolveOrgFilter(req, orgIdQuery);
    return this.statsService.getOverview({ from, to, orgId, orgIds, projectId, type, weekdays: parseWeekdays(weekdaysCsv) });
  }

  @Get('summary')
  @ApiOperation({ summary: 'KPI-Zusammenfassung' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'weekdays', required: false, description: 'CSV Liste von Wochentagen (0=So bis 6=Sa)' })
  async getSummary(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('weekdays') weekdaysCsv?: string,
  ) {
    const { orgId, orgIds } = await this.resolveOrgFilter(req, orgIdQuery);
    return this.statsService.getSummary(from, to, orgId, orgIds, projectId, undefined, parseWeekdays(weekdaysCsv));
  }

  @Get('by-type')
  @ApiOperation({ summary: 'Verteilung nach Tätigkeitstyp' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'weekdays', required: false, description: 'CSV Liste von Wochentagen (0=So bis 6=Sa)' })
  async getByType(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('weekdays') weekdaysCsv?: string,
  ) {
    const { orgId, orgIds } = await this.resolveOrgFilter(req, orgIdQuery);
    return this.statsService.getByType(from, to, orgId, orgIds, projectId, undefined, parseWeekdays(weekdaysCsv));
  }

  @Get('gender')
  @ApiOperation({ summary: 'Geschlechterverteilung (Summen)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'weekdays', required: false, description: 'CSV Liste von Wochentagen (0=So bis 6=Sa)' })
  async getGender(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('weekdays') weekdaysCsv?: string,
  ) {
    const { orgId, orgIds } = await this.resolveOrgFilter(req, orgIdQuery);
    return this.statsService.getGender(from, to, orgId, orgIds, projectId, undefined, parseWeekdays(weekdaysCsv));
  }

  @Get('participants-timeseries')
  @ApiOperation({ summary: 'Zeitverlauf der Teilnehmenden (pro Tag)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'weekdays', required: false, description: 'CSV Liste von Wochentagen (0=So bis 6=Sa)' })
  async getParticipantsTimeseries(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('weekdays') weekdaysCsv?: string,
  ) {
    const { orgId, orgIds } = await this.resolveOrgFilter(req, orgIdQuery);
    return this.statsService.getParticipantsTimeseries(from, to, orgId, orgIds, projectId, undefined, parseWeekdays(weekdaysCsv));
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Verteilung nach Kategorien' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'weekdays', required: false, description: 'CSV Liste von Wochentagen (0=So bis 6=Sa)' })
  async getByCategory(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('weekdays') weekdaysCsv?: string,
  ) {
    const { orgId, orgIds } = await this.resolveOrgFilter(req, orgIdQuery);
    return this.statsService.getByCategory(from, to, orgId, orgIds, projectId, undefined, parseWeekdays(weekdaysCsv));
  }

  @Get('by-cohort')
  @ApiOperation({ summary: 'Verteilung nach Alterskohorten' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'weekdays', required: false, description: 'CSV Liste von Wochentagen (0=So bis 6=Sa)' })
  async getByCohort(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('weekdays') weekdaysCsv?: string,
  ) {
    const { orgId, orgIds } = await this.resolveOrgFilter(req, orgIdQuery);
    return this.statsService.getByCohort(from, to, orgId, orgIds, projectId, undefined, parseWeekdays(weekdaysCsv));
  }
}
