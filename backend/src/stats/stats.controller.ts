import { applyDecorators, Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { resolveOrgScope } from '../auth/org-scope-access';

function parseExecutionStatuses(value?: string): string[] | undefined {
  if (!value) return undefined;
  const executionStatuses = Array.from(
    new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry === 'completed' || entry === 'cancelled'),
    ),
  );
  return executionStatuses.length > 0 ? executionStatuses : undefined;
}

function parseClosureState(value?: string): 'closed' | 'open' | undefined {
  if (value === 'closed' || value === 'open') return value;
  return undefined;
}

function ApiBaseStatsQueries() {
  return applyDecorators(
    ApiQuery({ name: 'from', required: false }),
    ApiQuery({ name: 'to', required: false }),
    ApiQuery({ name: 'projectId', required: false }),
    ApiQuery({ name: 'weekdays', required: false, description: 'CSV Liste von Wochentagen (0=So bis 6=Sa)' }),
  );
}

type ReqWithScope = {
  user: { role: string; orgId?: string | null };
  effectiveOrgId?: string | null | undefined;
};

type BaseStatsArgs = [
  from: string | undefined,
  to: string | undefined,
  orgId: string | null | undefined,
  orgIds: string[] | undefined,
  projectId: string | undefined,
  type: undefined,
  weekdays: number[] | undefined,
];

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
  constructor(private readonly statsService: StatsService) {}

  /**
   * Resolve org filtering based on effectiveOrgId and optional orgIdQuery param.
   * Returns { orgId, orgIds } for use in service calls.
   * 
  * Logic:
  * - Superadmin with effectiveOrgId === undefined: treated as null (global intentionally disabled)
  * - Superadmin with effectiveOrgId === null: filter by null org only
   * - Superadmin with effectiveOrgId === string: filter by that organization
   * - Non-superadmin: always filter by effectiveOrgId or user.orgId
   */
  private async resolveOrgFilter(
    req: ReqWithScope,
    orgIdQuery?: string,
  ): Promise<{ orgId: string | null | undefined; orgIds: string[] | undefined }> {
    const orgId =
      req.user.role === 'superadmin' && typeof orgIdQuery !== 'undefined'
        ? orgIdQuery && orgIdQuery !== 'null'
          ? orgIdQuery
          : null
        : resolveOrgScope({ ...req.user, effectiveOrgId: req.effectiveOrgId });

    return { orgId, orgIds: undefined };
  }

  private async resolveBaseStatsArgs(
    req: ReqWithScope,
    from?: string,
    to?: string,
    projectId?: string,
    orgIdQuery?: string,
    weekdaysCsv?: string,
  ): Promise<BaseStatsArgs> {
    const { orgId, orgIds } = await this.resolveOrgFilter(req, orgIdQuery);
    return [from, to, orgId, orgIds, projectId, undefined, parseWeekdays(weekdaysCsv)];
  }

  @Get('overview')
  @ApiOperation({ summary: 'Gebündelte Statistikdaten für die Statistikansicht' })
  @ApiBaseStatsQueries()
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'executionStatuses', required: false, description: 'CSV Liste (completed,cancelled)' })
  @ApiQuery({ name: 'closureState', required: false, description: 'closed|open' })
  async getOverview(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('type') type?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('executionStatuses') executionStatusesCsv?: string,
    @Query('weekdays') weekdaysCsv?: string,
    @Query('closureState') closureState?: string,
  ) {
    const [, , orgId, orgIds, , , weekdays] = await this.resolveBaseStatsArgs(
      req,
      from,
      to,
      projectId,
      orgIdQuery,
      weekdaysCsv,
    );
    return this.statsService.getOverview({
      from,
      to,
      orgId,
      orgIds,
      projectId,
      type,
      executionStatuses: parseExecutionStatuses(executionStatusesCsv),
      closureState: parseClosureState(closureState),
      weekdays,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: 'KPI-Zusammenfassung' })
  @ApiBaseStatsQueries()
  async getSummary(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('weekdays') weekdaysCsv?: string,
  ) {
    return this.statsService.getSummary(...(await this.resolveBaseStatsArgs(req, from, to, projectId, orgIdQuery, weekdaysCsv)));
  }

  @Get('by-type')
  @ApiOperation({ summary: 'Verteilung nach Tätigkeitstyp' })
  @ApiBaseStatsQueries()
  async getByType(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('weekdays') weekdaysCsv?: string,
  ) {
    return this.statsService.getByType(...(await this.resolveBaseStatsArgs(req, from, to, projectId, orgIdQuery, weekdaysCsv)));
  }

  @Get('gender')
  @ApiOperation({ summary: 'Geschlechterverteilung (Summen)' })
  @ApiBaseStatsQueries()
  async getGender(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('weekdays') weekdaysCsv?: string,
  ) {
    return this.statsService.getGender(...(await this.resolveBaseStatsArgs(req, from, to, projectId, orgIdQuery, weekdaysCsv)));
  }

  @Get('participants-timeseries')
  @ApiOperation({ summary: 'Zeitverlauf der Teilnehmenden (pro Tag)' })
  @ApiBaseStatsQueries()
  async getParticipantsTimeseries(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('weekdays') weekdaysCsv?: string,
  ) {
    return this.statsService.getParticipantsTimeseries(...(await this.resolveBaseStatsArgs(req, from, to, projectId, orgIdQuery, weekdaysCsv)));
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Verteilung nach Kategorien' })
  @ApiBaseStatsQueries()
  async getByCategory(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('weekdays') weekdaysCsv?: string,
  ) {
    return this.statsService.getByCategory(...(await this.resolveBaseStatsArgs(req, from, to, projectId, orgIdQuery, weekdaysCsv)));
  }

  @Get('by-cohort')
  @ApiOperation({ summary: 'Verteilung nach Alterskohorten' })
  @ApiBaseStatsQueries()
  async getByCohort(
    @Req() req: ReqWithScope,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('weekdays') weekdaysCsv?: string,
  ) {
    return this.statsService.getByCohort(...(await this.resolveBaseStatsArgs(req, from, to, projectId, orgIdQuery, weekdaysCsv)));
  }
}
