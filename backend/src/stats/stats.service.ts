import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Activity } from '../activities/entities/activity.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { ActivityExecutionStatus, ActivityType } from '../common/enums';
import { OrgsService } from '../orgs/orgs.service';

type StatsScope = {
  from?: string;
  to?: string;
  orgId?: string | null;
  orgIds?: string[];
  projectId?: string;
  type?: string;
  executionStatuses?: string[];
  closureState?: 'closed' | 'open';
  weekdays?: number[];
};

type ActivityCohortRow = {
  id: string;
  cohorts: string | Array<{ cohortId: string; m?: number; w?: number; d?: number }> | null;
};

type StatsTagRow = {
  id: string;
  name: string;
  count: string;
};

type StatsProjectRow = {
  id: string;
  name: string;
  count: string;
};

@Injectable()
export class StatsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Activity)
    private activityRepository: Repository<Activity>,
    @InjectRepository(Cohort)
    private cohortRepository: Repository<Cohort>,
    private readonly orgs: OrgsService,
  ) {}

  private getWeekdayExpression(column: string) {
    const dbType = this.dataSource.options.type;
    if (dbType === 'postgres') {
      return `CAST(EXTRACT(DOW FROM ${column}) AS integer)`;
    }
    return `CAST(strftime('%w', ${column}) AS integer)`;
  }

  private applyWeekdayFilter(qb: SelectQueryBuilder<Activity>, weekdays?: number[]) {
    if (!Array.isArray(weekdays) || weekdays.length === 0) return;
    qb.andWhere(`${this.getWeekdayExpression('activity.date')} IN (:...weekdays)`, { weekdays });
  }

  private normalizeExecutionStatuses(values?: string[]): ActivityExecutionStatus[] {
    if (!Array.isArray(values) || values.length === 0) {
      return [ActivityExecutionStatus.COMPLETED];
    }

    return Array.from(
      new Set(
        values.map((value) =>
          value === ActivityExecutionStatus.CANCELLED
            ? ActivityExecutionStatus.CANCELLED
            : ActivityExecutionStatus.COMPLETED,
        ),
      ),
    );
  }

  private normalizeClosureState(value?: string): 'closed' | 'open' | undefined {
    return value === 'closed' || value === 'open' ? value : undefined;
  }

  private async createFilteredActivityQuery(
    from?: string,
    to?: string,
    orgId?: string | null,
    orgIds?: string[],
    projectId?: string,
    type?: string,
    executionStatuses?: string[],
    weekdays?: number[],
    closureState?: string,
  ) {
    const qb = this.activityRepository.createQueryBuilder('activity');

    if (from) qb.andWhere('activity.date >= :from', { from });
    if (to) qb.andWhere('activity.date <= :to', { to });

    if (Array.isArray(orgIds) && orgIds.length) {
      qb.andWhere('activity.orgId IN (:...orgIds)', { orgIds });
    } else if (typeof orgId !== 'undefined') {
      if (orgId === null) qb.andWhere('activity.orgId IS NULL');
      else qb.andWhere('activity.orgId = :orgId', { orgId });
    }

    if (projectId) {
      qb.andWhere('activity.projectId = :projectId', { projectId });
    }

    if (type) {
      qb.andWhere('activity.type = :type', { type });
    }

    qb.andWhere('COALESCE(activity.executionStatus, :defaultExecutionStatus) IN (:...executionStatuses)', {
      defaultExecutionStatus: ActivityExecutionStatus.COMPLETED,
      executionStatuses: this.normalizeExecutionStatuses(executionStatuses),
    });

    const normalizedClosureState = this.normalizeClosureState(closureState);
    if (normalizedClosureState) {
      const closedDates = await this.orgs.getClosedDatesForOrganizations(orgId, orgIds, from, to);
      if (normalizedClosureState === 'closed') {
        if (closedDates.length === 0) {
          qb.andWhere('1 = 0');
        } else {
          qb.andWhere('activity.date IN (:...closedDates)', { closedDates });
        }
      } else if (closedDates.length > 0) {
        qb.andWhere('activity.date NOT IN (:...closedDates)', { closedDates });
      }
    }

    this.applyWeekdayFilter(qb, weekdays);

    return qb;
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value) || 0;
    return 0;
  }

  private toCalendarDateString(value: string | Date | null | undefined): string {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: process.env.TZ || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(value);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) return '';
    return `${year}-${month}-${day}`;
  }

  private parseCohorts(value: ActivityCohortRow['cohorts']) {
    if (!value) return [] as Array<{ cohortId: string; m: number; w: number; d: number }>;
    if (Array.isArray(value)) {
      return value.map((entry) => ({
        cohortId: entry.cohortId,
        m: entry.m || 0,
        w: entry.w || 0,
        d: entry.d || 0,
      }));
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as Array<{ cohortId: string; m?: number; w?: number; d?: number }>;
        if (!Array.isArray(parsed)) return [];
        return parsed.map((entry) => ({
          cohortId: entry.cohortId,
          m: entry.m || 0,
          w: entry.w || 0,
          d: entry.d || 0,
        }));
      } catch {
        return [];
      }
    }
    return [] as Array<{ cohortId: string; m: number; w: number; d: number }>;
  }

  async getAvailableYears(orgId?: string | null, orgIds?: string[]) {
    const rows = await (await this.createFilteredActivityQuery(undefined, undefined, orgId, orgIds, undefined))
      .select('activity.date', 'date')
      .distinct(true)
      .orderBy('activity.date', 'DESC')
      .getRawMany<{ date: string | Date }>();

    const years = new Set<string>();
    for (const row of rows) {
      const value = this.toCalendarDateString(row?.date);
      const year = value.slice(0, 4);
      if (year) years.add(year);
    }

    return Array.from(years).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }

  async getOverview(scope: StatsScope) {
    const { from, to, orgId, orgIds, projectId, type, executionStatuses, closureState, weekdays } = scope;
    const [summary, byType, gender, participantsTimeseries, byCategory, byCohort, topTags, topProjects, availableYears] = await Promise.all([
      this.getSummary(from, to, orgId, orgIds, projectId, type, weekdays, executionStatuses, closureState),
      this.getByType(from, to, orgId, orgIds, projectId, type, weekdays, executionStatuses, closureState),
      this.getGender(from, to, orgId, orgIds, projectId, type, weekdays, executionStatuses, closureState),
      this.getParticipantsTimeseries(from, to, orgId, orgIds, projectId, type, weekdays, executionStatuses, closureState),
      this.getByCategory(from, to, orgId, orgIds, projectId, type, weekdays, executionStatuses, closureState),
      this.getByCohort(from, to, orgId, orgIds, projectId, type, weekdays, executionStatuses, closureState),
      this.getTopTags(from, to, orgId, orgIds, projectId, type, weekdays, executionStatuses, closureState),
      projectId ? Promise.resolve([]) : this.getTopProjects(from, to, orgId, orgIds, type, weekdays, executionStatuses, closureState),
      this.getAvailableYears(orgId, orgIds),
    ]);

    return {
      summary,
      byType,
      gender,
      participantsTimeseries,
      byCategory,
      byCohort,
      topTags,
      topProjects,
      availableYears,
    };
  }

  async getSummary(from?: string, to?: string, orgId?: string|null, orgIds?: string[], projectId?: string, type?: string, weekdays?: number[], executionStatuses?: string[], closureState?: string) {
    const closureDaysCount =
      closureState === 'closed'
        ? (await this.orgs.getClosedDatesForOrganizations(orgId, orgIds, from, to)).length
        : 0;

    const raw = await (await this.createFilteredActivityQuery(from, to, orgId, orgIds, projectId, type, executionStatuses, weekdays, closureState))
      .select('COUNT(*)', 'totalActivities')
      .addSelect('COALESCE(SUM(activity.countTotal), 0)', 'totalParticipants')
      .addSelect('COALESCE(SUM(activity.countMale), 0)', 'totalMale')
      .addSelect('COALESCE(SUM(activity.countFemale), 0)', 'totalFemale')
      .addSelect('COALESCE(SUM(activity.countDiverse), 0)', 'totalDiverse')
      .addSelect('COALESCE(SUM(activity.durationMinutes), 0)', 'totalDurationMinutes')
      .getRawOne<{
        totalActivities: string;
        totalParticipants: string;
        totalMale: string;
        totalFemale: string;
        totalDiverse: string;
        totalDurationMinutes: string;
      }>();

    const totalActivities = this.toNumber(raw?.totalActivities);
    const totalParticipants = this.toNumber(raw?.totalParticipants);
    const totalMale = this.toNumber(raw?.totalMale);
    const totalFemale = this.toNumber(raw?.totalFemale);
    const totalDiverse = this.toNumber(raw?.totalDiverse);
    const totalDurationMinutes = this.toNumber(raw?.totalDurationMinutes);

    return {
      totalActivities,
      totalParticipants,
      totalMale,
      totalFemale,
      totalDiverse,
      totalDurationMinutes,
      totalHours: +(totalDurationMinutes / 60).toFixed(1),
      averageParticipants: totalActivities > 0 ? +(totalParticipants / totalActivities).toFixed(1) : 0,
      closureDaysCount,
    };
  }

  async getByType(from?: string, to?: string, orgId?: string|null, orgIds?: string[], projectId?: string, type?: string, weekdays?: number[], executionStatuses?: string[], closureState?: string) {
    const rows = await (await this.createFilteredActivityQuery(from, to, orgId, orgIds, projectId, type, executionStatuses, weekdays, closureState))
      .select('activity.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(activity.countTotal), 0)', 'totalParticipants')
      .groupBy('activity.type')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany<{ type: string; count: string; totalParticipants: string }>();

    return rows.map((row) => ({
      type: row.type,
      count: this.toNumber(row.count),
      totalParticipants: this.toNumber(row.totalParticipants),
    }));
  }

  async getGender(from?: string, to?: string, orgId?: string|null, orgIds?: string[], projectId?: string, type?: string, weekdays?: number[], executionStatuses?: string[], closureState?: string) {
    const raw = await (await this.createFilteredActivityQuery(from, to, orgId, orgIds, projectId, type, executionStatuses, weekdays, closureState))
      .select('COALESCE(SUM(activity.countMale), 0)', 'male')
      .addSelect('COALESCE(SUM(activity.countFemale), 0)', 'female')
      .addSelect('COALESCE(SUM(activity.countDiverse), 0)', 'diverse')
      .getRawOne<{ male: string; female: string; diverse: string }>();

    const male = this.toNumber(raw?.male);
    const female = this.toNumber(raw?.female);
    const diverse = this.toNumber(raw?.diverse);
    return { male, female, diverse };
  }

  async getParticipantsTimeseries(from?: string, to?: string, orgId?: string|null, orgIds?: string[], projectId?: string, type?: string, weekdays?: number[], executionStatuses?: string[], closureState?: string) {
    const rows = await (await this.createFilteredActivityQuery(from, to, orgId, orgIds, projectId, type, executionStatuses, weekdays, closureState))
      .select('activity.date', 'date')
      .addSelect('COALESCE(SUM(activity.countTotal), 0)', 'totalParticipants')
      .addSelect('COUNT(*)', 'activityCount')
      .groupBy('activity.date')
      .orderBy('activity.date', 'ASC')
      .getRawMany<{ date: string | Date; totalParticipants: string; activityCount: string }>();

    return rows.map((row) => ({
      date: this.toCalendarDateString(row.date),
      totalParticipants: this.toNumber(row.totalParticipants),
      activityCount: this.toNumber(row.activityCount),
    }));
  }

  async getByCategory(from?: string, to?: string, orgId?: string|null, orgIds?: string[], projectId?: string, type?: string, weekdays?: number[], executionStatuses?: string[], closureState?: string) {
    const categoryIdExpr = `CASE
      WHEN category.id IS NULL AND activity.type = '${ActivityType.OPEN_DOOR}' THEN '__open_door__'
      WHEN category.id IS NULL THEN '__uncategorized__'
      ELSE CAST(category.id AS text)
    END`;
    const categoryNameExpr = `CASE
      WHEN category.id IS NULL AND activity.type = '${ActivityType.OPEN_DOOR}' THEN 'Offene Tür'
      WHEN category.name IS NULL OR category.name = '' THEN 'Unkategorisiert'
      ELSE category.name
    END`;

    const rows = await (await this.createFilteredActivityQuery(from, to, orgId, orgIds, projectId, type, executionStatuses, weekdays, closureState))
      .leftJoin('activity.categories', 'category')
      .leftJoin('activity.project', 'project')
      .select(categoryIdExpr, 'id')
      .addSelect(categoryNameExpr, 'name')
      .addSelect('COUNT(DISTINCT activity.id)', 'count')
      .groupBy(categoryIdExpr)
      .addGroupBy(categoryNameExpr)
      .orderBy('COUNT(DISTINCT activity.id)', 'DESC')
      .getRawMany<{ id: string; name: string; count: string }>();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      count: this.toNumber(row.count),
    })).sort((a, b) => b.count - a.count);
  }

  async getTopTags(from?: string, to?: string, orgId?: string|null, orgIds?: string[], projectId?: string, type?: string, weekdays?: number[], executionStatuses?: string[], closureState?: string) {
    const rows = await (await this.createFilteredActivityQuery(from, to, orgId, orgIds, projectId, type, executionStatuses, weekdays, closureState))
      .innerJoin('activity.tags', 'tag')
      .select('tag.id', 'id')
      .addSelect('tag.name', 'name')
      .addSelect('COUNT(DISTINCT activity.id)', 'count')
      .groupBy('tag.id')
      .addGroupBy('tag.name')
      .orderBy('COUNT(DISTINCT activity.id)', 'DESC')
      .limit(10)
      .getRawMany<StatsTagRow>();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      count: this.toNumber(row.count),
    }));
  }

  async getTopProjects(from?: string, to?: string, orgId?: string|null, orgIds?: string[], type?: string, weekdays?: number[], executionStatuses?: string[], closureState?: string) {
    const rows = await (await this.createFilteredActivityQuery(from, to, orgId, orgIds, undefined, type, executionStatuses, weekdays, closureState))
      .innerJoin('activity.project', 'project')
      .select('project.id', 'id')
      .addSelect('project.title', 'name')
      .addSelect('COUNT(activity.id)', 'count')
      .groupBy('project.id')
      .addGroupBy('project.title')
      .orderBy('COUNT(activity.id)', 'DESC')
      .limit(10)
      .getRawMany<StatsProjectRow>();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      count: this.toNumber(row.count),
    }));
  }

  async getByCohort(from?: string, to?: string, orgId?: string|null, orgIds?: string[], projectId?: string, type?: string, weekdays?: number[], executionStatuses?: string[], closureState?: string) {
    const activities = await (await this.createFilteredActivityQuery(from, to, orgId, orgIds, projectId, type, executionStatuses, weekdays, closureState))
      .select('activity.id', 'id')
      .addSelect('activity.cohorts', 'cohorts')
      .getRawMany<ActivityCohortRow>();

    // Sum cohorts JSON m/w/d by cohortId and count distinct activities per cohort
    const map = new Map<string, { cohortId: string; m: number; w: number; d: number }>();
    const usage = new Map<string, Set<string>>();
    for (const a of activities) {
      for (const ch of this.parseCohorts(a.cohorts)) {
        const entry = map.get(ch.cohortId) || { cohortId: ch.cohortId, m: 0, w: 0, d: 0 };
        entry.m += ch.m || 0;
        entry.w += ch.w || 0;
        entry.d += ch.d || 0;
        map.set(ch.cohortId, entry);
        if (!usage.has(ch.cohortId)) usage.set(ch.cohortId, new Set());
        usage.get(ch.cohortId)!.add(a.id);
      }
    }
    const cohQB = this.cohortRepository.createQueryBuilder('h');
    if (Array.isArray(orgIds) && orgIds.length) {
      cohQB.where('h.orgId IN (:...orgIds)', { orgIds });
    } else if (typeof orgId !== 'undefined') {
      if (orgId === null) cohQB.where('h.orgId IS NULL');
      else cohQB.where('h.orgId = :orgId', { orgId });
    }
    const cohorts = await cohQB.select('h.id', 'id').addSelect('h.name', 'name').getRawMany<{ id: string; name: string }>();
    const nameMap = new Map(cohorts.map((c) => [c.id, c.name] as const));

    // Ignore cohortIds that don't exist anymore, so the UI doesn't show raw IDs or a generic bucket.
    return Array.from(map.values())
      .filter((v) => nameMap.has(v.cohortId))
      .map((v) => ({
        cohortId: v.cohortId,
        name: nameMap.get(v.cohortId)!,
        male: v.m,
        female: v.w,
        diverse: v.d,
        total: v.m + v.w + v.d,
        activities: usage.get(v.cohortId)?.size || 0,
      }))
      .sort((a, b) => b.total - a.total);
  }
}
