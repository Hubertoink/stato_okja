import { Brackets, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { Activity } from './entities/activity.entity';
import { ActivityExecutionStatus } from '../common/enums';
import { OrgsService } from '../orgs/orgs.service';

export type ActivityListFilters = {
  search?: string;
  from?: string;
  to?: string;
  type?: string;
  types?: string[];
  locationId?: string;
  locationIds?: string[];
  projectIds?: string[];
  categoryIds?: string[];
  uncategorized?: boolean;
  tagIds?: string[];
  staffIds?: string[];
  cohortIds?: string[];
  executionStatuses?: string[];
  closureState?: string;
  weekdays?: number[];
  hasNotes?: boolean;
  participantsMin?: number;
  participantsMax?: number;
  durationMin?: number;
  durationMax?: number;
  orgId?: string | null;
  orgIds?: string[];
  order?: 'asc' | 'desc';
};

type ClosureStateFilter = 'closed' | 'open';
type ActivityJoin = 'location' | 'categories' | 'tags' | 'project' | 'staff' | 'attachments';

export function applyActivityRelationJoins<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  activityAlias: string,
  joins: ActivityJoin[],
) {
  for (const join of joins) {
    qb.leftJoinAndSelect(`${activityAlias}.${join}`, join);
  }
  return qb;
}

export class ActivityListQuery {
  constructor(
    private readonly activityRepository: Repository<Activity>,
    private readonly orgs: Pick<OrgsService, 'getClosedDatesForOrganizations'>,
  ) {}

  async findAll(filters?: ActivityListFilters): Promise<Activity[]> {
    const qb = await this.build(filters, { includeStaff: true });
    const rows = await qb.getMany();
    if (filters?.cohortIds?.length && !this.usesPostgresCohortQuery()) {
      return rows.filter((row) => this.matchesSelectedCohorts(row, filters.cohortIds));
    }
    return rows;
  }

  async findPaged(
    filters: ActivityListFilters & { page: number; limit: number },
  ): Promise<{ data: Activity[]; total: number; page: number; pageSize: number }> {
    const qb = await this.build(filters, { includeStaff: false });
    const page = Math.max(filters.page || 1, 1);
    const limit = Math.min(Math.max(filters.limit || 50, 1), 50);

    if (filters?.cohortIds?.length && !this.usesPostgresCohortQuery()) {
      const rows = await qb.getMany();
      const filteredRows = rows.filter((row) => this.matchesSelectedCohorts(row, filters.cohortIds));
      const start = (page - 1) * limit;
      return {
        data: filteredRows.slice(start, start + limit),
        total: filteredRows.length,
        page,
        pageSize: limit,
      };
    }

    qb.take(limit).skip((page - 1) * limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: rows, total, page, pageSize: limit };
  }

  async build(
    filters?: ActivityListFilters,
    options?: {
      includeStaff?: boolean;
    },
  ) {
    const qb = applyActivityRelationJoins(
      this.activityRepository.createQueryBuilder('a'),
      'a',
      ['location', 'categories', 'tags', 'project'],
    ).distinct(true);

    if (options?.includeStaff !== false) {
      qb.leftJoinAndSelect('a.staff', 'staff');
    } else if (filters?.staffIds && filters.staffIds.length) {
      qb.leftJoin('a.staff', 'staff');
    }

    if (filters?.from && filters?.to) {
      qb.andWhere('a.date BETWEEN :from AND :to', { from: filters.from, to: filters.to });
    }
    if (filters?.search) {
      const search = `%${filters.search.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((b) => {
          b.where("LOWER(COALESCE(a.title, '')) LIKE :search", { search });
          b.orWhere("LOWER(COALESCE(project.title, '')) LIKE :search", { search });
        }),
      );
    }
    if (Array.isArray(filters?.orgIds) && filters!.orgIds!.length) {
      qb.andWhere('a.orgId IN (:...orgIds)', { orgIds: filters!.orgIds! });
    } else if (typeof filters?.orgId !== 'undefined') {
      if (filters.orgId === null) qb.andWhere('a.orgId IS NULL');
      else qb.andWhere('a.orgId = :orgId', { orgId: filters.orgId });
    }
    if (filters?.types && filters.types.length) {
      qb.andWhere('a.type IN (:...types)', { types: filters.types });
    } else if (filters?.type) {
      qb.andWhere('a.type = :type', { type: filters.type });
    }
    if (filters?.locationIds && filters.locationIds.length) {
      qb.andWhere('a.locationId IN (:...locationIds)', { locationIds: filters.locationIds });
    } else if (filters?.locationId) {
      qb.andWhere('a.locationId = :locationId', { locationId: filters.locationId });
    }
    if (filters?.projectIds && filters.projectIds.length) {
      qb.andWhere('a.projectId IN (:...projectIds)', { projectIds: filters.projectIds });
    }
    if (filters?.uncategorized) {
      if (filters?.categoryIds && filters.categoryIds.length) {
        qb.andWhere(
          new Brackets((b) => {
            b.where('categories.id IN (:...categoryIds)', { categoryIds: filters.categoryIds });
            b.orWhere('categories.id IS NULL');
          }),
        );
      } else {
        qb.andWhere('categories.id IS NULL');
      }
    } else if (filters?.categoryIds && filters.categoryIds.length) {
      qb.andWhere('categories.id IN (:...categoryIds)', { categoryIds: filters.categoryIds });
    }
    if (filters?.tagIds && filters.tagIds.length) {
      qb.andWhere('tags.id IN (:...tagIds)', { tagIds: filters.tagIds });
    }
    if (filters?.staffIds && filters.staffIds.length) {
      qb.andWhere('staff.id IN (:...staffIds)', { staffIds: filters.staffIds });
    }
    if (filters?.cohortIds && filters.cohortIds.length && this.usesPostgresCohortQuery()) {
      qb.andWhere(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN a.cohorts IS NULL OR CAST(a.cohorts AS text) = '' THEN '[]'::jsonb
              ELSE CAST(a.cohorts AS jsonb)
            END
          ) AS cohort_entry
          WHERE cohort_entry->>'cohortId' IN (:...cohortIds)
            AND (
              COALESCE((cohort_entry->>'m')::int, 0) +
              COALESCE((cohort_entry->>'w')::int, 0) +
              COALESCE((cohort_entry->>'d')::int, 0)
            ) > 0
        )`,
        { cohortIds: filters.cohortIds },
      );
    }
    if (filters?.executionStatuses?.length) {
      const executionStatuses = this.normalizeExecutionStatuses(filters.executionStatuses);
      if (executionStatuses?.length) {
        qb.andWhere('COALESCE(a.executionStatus, :defaultExecutionStatus) IN (:...executionStatuses)', {
          defaultExecutionStatus: ActivityExecutionStatus.COMPLETED,
          executionStatuses,
        });
      }
    }
    await this.applyClosureStateFilter(qb, filters);
    this.applyWeekdayFilter(qb, filters?.weekdays);
    if (typeof filters?.hasNotes !== 'undefined') {
      if (filters.hasNotes) qb.andWhere("a.notes IS NOT NULL AND TRIM(a.notes) <> ''");
      else qb.andWhere("(a.notes IS NULL OR TRIM(a.notes) = '')");
    }
    if (typeof filters?.participantsMin === 'number') {
      qb.andWhere('a.countTotal >= :pMin', { pMin: filters.participantsMin });
    }
    if (typeof filters?.participantsMax === 'number') {
      qb.andWhere('a.countTotal <= :pMax', { pMax: filters.participantsMax });
    }
    if (typeof filters?.durationMin === 'number') {
      qb.andWhere('a.durationMinutes >= :dMin', { dMin: filters.durationMin });
    }
    if (typeof filters?.durationMax === 'number') {
      qb.andWhere('a.durationMinutes <= :dMax', { dMax: filters.durationMax });
    }

    const dir = filters?.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy('a.date', dir as 'ASC' | 'DESC').addOrderBy('a.startTime', dir as 'ASC' | 'DESC');
    return qb;
  }

  private usesPostgresCohortQuery(): boolean {
    const dbType = String(process.env.DB_TYPE || 'postgres').toLowerCase();
    return dbType === 'postgres' || dbType === 'postgresql';
  }

  private matchesSelectedCohorts(
    activity: Pick<Activity, 'cohorts'>,
    cohortIds?: string[],
  ): boolean {
    if (!Array.isArray(cohortIds) || cohortIds.length === 0) return true;
    if (!Array.isArray(activity.cohorts) || activity.cohorts.length === 0) return false;

    return cohortIds.some((cohortId) =>
      activity.cohorts.some((entry) => {
        if (!entry || entry.cohortId !== cohortId) return false;
        const total = Number(entry.m || 0) + Number(entry.w || 0) + Number(entry.d || 0);
        return total > 0;
      }),
    );
  }

  private getWeekdayExpression(column: string) {
    const dbType = this.activityRepository.manager.connection.options.type;
    if (dbType === 'postgres') {
      return `CAST(EXTRACT(DOW FROM ${column}) AS integer)`;
    }
    return `CAST(strftime('%w', ${column}) AS integer)`;
  }

  private applyWeekdayFilter(qb: SelectQueryBuilder<Activity>, weekdays?: number[]) {
    if (!Array.isArray(weekdays) || weekdays.length === 0) return;
    qb.andWhere(`${this.getWeekdayExpression('a.date')} IN (:...weekdays)`, { weekdays });
  }

  private normalizeExecutionStatus(value?: string | null): ActivityExecutionStatus {
    return value === ActivityExecutionStatus.CANCELLED
      ? ActivityExecutionStatus.CANCELLED
      : ActivityExecutionStatus.COMPLETED;
  }

  private normalizeExecutionStatuses(values?: string[] | null): ActivityExecutionStatus[] | undefined {
    if (!Array.isArray(values) || values.length === 0) return undefined;

    const normalized = Array.from(
      new Set(values.map((value) => this.normalizeExecutionStatus(value))),
    );

    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeClosureState(value?: string | null): ClosureStateFilter | undefined {
    return value === 'closed' || value === 'open' ? value : undefined;
  }

  private async applyClosureStateFilter(
    qb: SelectQueryBuilder<Activity>,
    filters?: Pick<ActivityListFilters, 'from' | 'to' | 'orgId' | 'orgIds' | 'closureState'>,
  ) {
    const closureState = this.normalizeClosureState(filters?.closureState);
    if (!closureState) return;

    const closedDates = await this.orgs.getClosedDatesForOrganizations(
      filters?.orgId,
      filters?.orgIds,
      filters?.from,
      filters?.to,
    );

    if (closureState === 'closed') {
      if (closedDates.length === 0) {
        qb.andWhere('1 = 0');
        return;
      }
      qb.andWhere('a.date IN (:...closedDates)', { closedDates });
      return;
    }

    if (closedDates.length > 0) {
      qb.andWhere('a.date NOT IN (:...closedDates)', { closedDates });
    }
  }
}
