import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets, SelectQueryBuilder } from 'typeorm';
import { Activity } from './entities/activity.entity';
import { ActivityType } from '../common/enums';
import { AuditService } from '../common/audit.service';
import { AuditAction } from '../common/enums';
import { Tag } from '../taxonomy/entities/tag.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Project } from '../projects/entities/project.entity';
import { OrgsService } from '../orgs/orgs.service';

type ActivityAuditSnapshot = {
  title: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  type: string | null;
  project: string | null;
  location: string | null;
  countMale: number | null;
  countFemale: number | null;
  countDiverse: number | null;
  countTotal: number | null;
  notes: string | null;
  goals: string | null;
  categories: string[];
  tags: string[];
  staff: string[];
  cohorts: string[];
};

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Cohort)
    private readonly cohortRepository: Repository<Cohort>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

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

  private normalizeAuditText(value?: string | null): string | null {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeAuditNumber(value?: number | null): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private formatAuditDate(value?: string | Date | null): string | null {
    if (!value) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) return trimmed;
      return parsed.toISOString().slice(0, 10);
    }
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  private mapRelationNames(
    items?: Array<{ id?: string | null; name?: string | null }> | null,
  ): string[] {
    if (!Array.isArray(items) || items.length === 0) return [];
    return items
      .map((item) => this.normalizeAuditText(item?.name) ?? this.normalizeAuditText(item?.id) ?? null)
      .filter((item): item is string => typeof item === 'string' && item.length > 0)
      .sort((left, right) => left.localeCompare(right, 'de'));
  }

  private mapCohortEntries(
    cohorts?: Array<{ cohortId: string; m: number; w: number; d: number }> | null,
    cohortNamesById?: Map<string, string>,
  ): string[] {
    if (!Array.isArray(cohorts) || cohorts.length === 0) return [];
    return cohorts
      .filter((entry) => entry && typeof entry.cohortId === 'string' && entry.cohortId.length > 0)
      .map((entry) => {
        const cohortLabel = cohortNamesById?.get(entry.cohortId) ?? entry.cohortId;
        return `${cohortLabel} (m:${entry.m || 0}, w:${entry.w || 0}, d:${entry.d || 0})`;
      })
      .sort((left, right) => left.localeCompare(right, 'de'));
  }

  private toActivityAuditSnapshot(
    activity: Partial<Activity> | null | undefined,
    cohortNamesById?: Map<string, string>,
  ): ActivityAuditSnapshot {
    return {
      title: this.normalizeAuditText(activity?.title ?? null),
      date: this.formatAuditDate(activity?.date ?? null),
      startTime: this.normalizeAuditText(activity?.startTime ?? null),
      endTime: this.normalizeAuditText(activity?.endTime ?? null),
      durationMinutes: this.normalizeAuditNumber(activity?.durationMinutes ?? null),
      type: this.normalizeAuditText(activity?.type ?? null),
      project:
        this.normalizeAuditText(activity?.project?.title ?? null) ??
        this.normalizeAuditText(activity?.projectId ?? null),
      location:
        this.normalizeAuditText(activity?.location?.name ?? null) ??
        this.normalizeAuditText(activity?.locationId ?? null),
      countMale: this.normalizeAuditNumber(activity?.countMale ?? null),
      countFemale: this.normalizeAuditNumber(activity?.countFemale ?? null),
      countDiverse: this.normalizeAuditNumber(activity?.countDiverse ?? null),
      countTotal: this.normalizeAuditNumber(activity?.countTotal ?? null),
      notes: this.normalizeAuditText(activity?.notes ?? null),
      goals: this.normalizeAuditText(activity?.goals ?? null),
      categories: this.mapRelationNames(activity?.categories),
      tags: this.mapRelationNames(activity?.tags),
      staff: this.mapRelationNames(activity?.staff),
      cohorts: this.mapCohortEntries(activity?.cohorts, cohortNamesById),
    };
  }

  private async loadCohortNames(
    cohorts: Array<Array<{ cohortId: string; m: number; w: number; d: number }> | null | undefined>,
  ): Promise<Map<string, string>> {
    const cohortIds = Array.from(
      new Set(
        cohorts
          .flatMap((entries) => entries ?? [])
          .map((entry) => entry?.cohortId)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      ),
    );

    if (cohortIds.length === 0) return new Map<string, string>();

    const rows = await this.cohortRepository.findBy({ id: In(cohortIds) });
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  private buildActivityAuditDiff(before: ActivityAuditSnapshot, after: ActivityAuditSnapshot) {
    const diff: Record<string, { from: unknown; to: unknown }> = {};

    const keys: Array<keyof ActivityAuditSnapshot> = [
      'title',
      'date',
      'startTime',
      'endTime',
      'durationMinutes',
      'type',
      'project',
      'location',
      'countMale',
      'countFemale',
      'countDiverse',
      'countTotal',
      'notes',
      'goals',
      'categories',
      'tags',
      'staff',
      'cohorts',
    ];

    for (const key of keys) {
      const beforeValue = before[key];
      const afterValue = after[key];
      if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) continue;
      diff[key] = { from: beforeValue, to: afterValue };
    }

    return diff;
  }

  private buildListQuery(
    filters?: {
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
    weekdays?: number[];
    hasNotes?: boolean;
    participantsMin?: number;
    participantsMax?: number;
    durationMin?: number;
    durationMax?: number;
    orgId?: string | null;
    orgIds?: string[];
    order?: 'asc' | 'desc';
    },
    options?: {
      includeStaff?: boolean;
    },
  ) {
    const qb = this.activityRepository
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.location', 'location')
      .leftJoinAndSelect('a.categories', 'categories')
      .leftJoinAndSelect('a.tags', 'tags')
      .leftJoinAndSelect('a.project', 'project')
      .distinct(true);

    if (options?.includeStaff !== false) {
      qb.leftJoinAndSelect('a.staff', 'staff');
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
    // Categories: allow filtering by explicit categories, uncategorized, or both (union)
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
    this.applyWeekdayFilter(qb, filters?.weekdays);
    if (typeof filters?.hasNotes !== 'undefined') {
      // Treat whitespace-only as empty; TRIM works in Postgres/SQLite
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

  async findAll(filters?: {
    search?: string;
    from?: string;
    to?: string;
    type?: string;
    types?: string[];
    locationId?: string;
    locationIds?: string[];
    projectIds?: string[];
    categoryIds?: string[];
    tagIds?: string[];
    cohortIds?: string[];
    weekdays?: number[];
    hasNotes?: boolean;
    uncategorized?: boolean;
    participantsMax?: number;
    durationMin?: number;
    durationMax?: number;
    orgId?: string | null;
    orgIds?: string[];
    order?: 'asc' | 'desc';
  }): Promise<Activity[]> {
    const qb = this.buildListQuery(filters, { includeStaff: true });
    const rows = await qb.getMany();
    if (filters?.cohortIds?.length && !this.usesPostgresCohortQuery()) {
      return rows.filter((row) => this.matchesSelectedCohorts(row, filters.cohortIds));
    }
    return rows;
  }

  async findAllPaged(filters: {
    search?: string;
    from?: string;
    to?: string;
    type?: string;
    types?: string[];
    locationId?: string;
    locationIds?: string[];
    projectIds?: string[];
    categoryIds?: string[];
    tagIds?: string[];
    cohortIds?: string[];
    weekdays?: number[];
    hasNotes?: boolean;
    participantsMin?: number;
    uncategorized?: boolean;
    durationMin?: number;
    durationMax?: number;
    orgId?: string | null;
    orgIds?: string[];
    order?: 'asc' | 'desc';
    page: number;
    limit: number;
  }): Promise<{ data: Activity[]; total: number; page: number; pageSize: number }> {
    const qb = this.buildListQuery(filters, { includeStaff: false });
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

  findOne(id: string): Promise<Activity | null> {
    return this.activityRepository.findOne({
      where: { id },
      relations: [
        'location',
        'categories',
        'tags',
        'staff',
        'attachments',
        'createdBy',
        'updatedBy',
        'project',
      ],
    });
  }

  async findOneScoped(id: string, user: { role: string; orgId?: string | null }) {
    const a = await this.findOne(id);
    if (!a) return null;
    if (user.role !== 'superadmin' && (a.orgId ?? null) !== (user.orgId ?? null)) {
      throw new ForbiddenException('Not allowed');
    }
    return a;
  }

  async create(
    data: Partial<Activity> & {
      tagIds?: string[];
      staffIds?: string[];
      categoryIds?: string[];
      cohorts?:
        | Array<{ cohortId: string; m?: number; w?: number; d?: number }>
        | Array<{ cohortId: string; count: number; gender?: string }>;
    },
    user?: { id?: string; name?: string; orgId?: string | null },
  ): Promise<Activity> {
    const { tagIds, staffIds, categoryIds, cohorts, ...rest } = data as Partial<Activity> & {
      tagIds?: string[];
      staffIds?: string[];
      categoryIds?: string[];
      cohorts?:
        | Array<{ cohortId: string; m?: number; w?: number; d?: number }>
        | Array<{ cohortId: string; count: number; gender?: 'm' | 'w' | 'd' }>;
    };

    // locationId is optional; if omitted, activity can still be created

    const activity = this.activityRepository.create(rest);
  const activityOrgId = (rest.orgId ?? null) as string | null;

    // If a project is linked, enforce the activity type to match the project's type
    const restWithProject = rest as Partial<Activity> & { projectId?: string | null };
    if (restWithProject.projectId) {
      const project = await this.projectRepository.findOne({
        where: { id: restWithProject.projectId },
      });
      if (!project) throw new BadRequestException('Invalid projectId');
      activity.project = project;
      activity.type = project.type as ActivityType;
    }

    // Relations
    if (Array.isArray(tagIds) && tagIds.length) {
      await this.orgs.assertTaxonomyIdsVisibleForOrg(activityOrgId, 'tags', tagIds);
      const tags = await this.tagRepository.findBy({ id: In(tagIds) });
      activity.tags = tags;
    }
    if (Array.isArray(staffIds) && staffIds.length) {
      const staff = await this.staffRepository.findBy({ id: In(staffIds) });
      activity.staff = staff;
    }
    if (Array.isArray(categoryIds) && categoryIds.length) {
      await this.orgs.assertTaxonomyIdsVisibleForOrg(activityOrgId, 'categories', categoryIds);
      const categories = await this.categoryRepository.findBy({ id: In(categoryIds) });
      activity.categories = categories;
    }

    // Cohorts: allow two input shapes; normalize to per-gender {cohortId,m,w,d}
    if (Array.isArray(cohorts)) {
      await this.orgs.assertTaxonomyIdsVisibleForOrg(
        activityOrgId,
        'cohorts',
        cohorts
          .map((entry) => ('cohortId' in entry ? entry.cohortId : null))
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      );
      const byId = new Map<string, { cohortId: string; m: number; w: number; d: number }>();
      for (const c of cohorts as Array<
        | { cohortId: string; m?: number; w?: number; d?: number }
        | { cohortId: string; count: number; gender?: 'm' | 'w' | 'd' }
      >) {
        if (!c || !('cohortId' in c) || !c.cohortId) continue;
        const cur = byId.get(c.cohortId) || { cohortId: c.cohortId, m: 0, w: 0, d: 0 };
        if ('m' in c || 'w' in c || 'd' in c) {
          const cm = (c as { m?: number }).m ?? 0;
          const cw = (c as { w?: number }).w ?? 0;
          const cd = (c as { d?: number }).d ?? 0;
          cur.m += cm;
          cur.w += cw;
          cur.d += cd;
        } else if ('count' in c) {
          const g = (c as { gender?: 'm' | 'w' | 'd' }).gender;
          const cnt = (c as { count: number }).count || 0;
          if (g === 'm') cur.m += cnt;
          else if (g === 'w') cur.w += cnt;
          else if (g === 'd') cur.d += cnt;
        }
        byId.set(c.cohortId, cur);
      }
      activity.cohorts = Array.from(byId.values());
      // derive totals
      const totals = Array.from(byId.values()).reduce(
        (acc, e) => {
          acc.m += e.m;
          acc.w += e.w;
          acc.d += e.d;
          return acc;
        },
        { m: 0, w: 0, d: 0 },
      );
      activity.countMale = totals.m;
      activity.countFemale = totals.w;
      activity.countDiverse = totals.d;
      activity.countTotal = totals.m + totals.w + totals.d;
    }

    const saved = await this.activityRepository.save(activity);
    await this.audit.log({
      action: AuditAction.CREATE,
      entityType: 'activity',
      entityId: saved.id,
      entityTitle: saved.title || saved.project?.title || saved.location?.name || null,
      user: user ?? undefined,
      orgId: saved.orgId ?? null,
      details: { date: saved.date, type: saved.type },
    });
    return saved;
  }

  async update(
    id: string,
    data: Partial<Activity> & {
      tagIds?: string[];
      staffIds?: string[];
      categoryIds?: string[];
      cohorts?: Array<
        | { cohortId: string; m?: number; w?: number; d?: number }
        | { cohortId: string; count: number; gender?: string }
      >;
    },
    user?: { id?: string; name?: string | null; orgId?: string | null },
  ): Promise<Activity | null> {
    const existing = await this.activityRepository.findOne({
      where: { id },
      relations: ['tags', 'staff', 'categories', 'project', 'location'],
    });
    if (!existing) return null;
    const beforeActivityForAudit: Partial<Activity> = {
      ...existing,
      categories: Array.isArray(existing.categories) ? [...existing.categories] : [],
      tags: Array.isArray(existing.tags) ? [...existing.tags] : [],
      staff: Array.isArray(existing.staff) ? [...existing.staff] : [],
      cohorts: Array.isArray(existing.cohorts)
        ? existing.cohorts.map((entry) => ({ ...entry }))
        : existing.cohorts,
      project: existing.project ? { ...existing.project } : existing.project,
      location: existing.location ? { ...existing.location } : existing.location,
    };
    const activityOrgId = existing.orgId ?? null;

    const { tagIds, staffIds, categoryIds, cohorts, ...rest } = data as Partial<Activity> & {
      tagIds?: string[];
      staffIds?: string[];
      categoryIds?: string[];
      cohorts?:
        | Array<{ cohortId: string; m?: number; w?: number; d?: number }>
        | Array<{ cohortId: string; count: number; gender?: 'm' | 'w' | 'd' }>;
    };

    Object.assign(existing, rest);

    // If a project is linked (new or existing), ensure the activity type mirrors the project's type
    const restWithProject = rest as Partial<Activity> & { projectId?: string | null };
    const projectId = restWithProject.projectId ?? existing.projectId;
    if (projectId) {
      const project = await this.projectRepository.findOne({ where: { id: projectId as string } });
      if (project) {
        existing.project = project;
        existing.type = project.type as ActivityType;
      }
    }

    // Relations: set arrays (also allow clearing when empty array provided)
    if (Array.isArray(tagIds)) {
      await this.orgs.assertTaxonomyIdsVisibleForOrg(activityOrgId, 'tags', tagIds);
      existing.tags = tagIds.length ? await this.tagRepository.findBy({ id: In(tagIds) }) : [];
    }
    if (Array.isArray(staffIds)) {
      existing.staff = staffIds.length
        ? await this.staffRepository.findBy({ id: In(staffIds) })
        : [];
    }
    if (Array.isArray(categoryIds)) {
      await this.orgs.assertTaxonomyIdsVisibleForOrg(activityOrgId, 'categories', categoryIds);
      existing.categories = categoryIds.length
        ? await this.categoryRepository.findBy({ id: In(categoryIds) })
        : [];
    }

    // Cohorts: normalize to per-gender and recompute totals
    if (Array.isArray(cohorts)) {
      await this.orgs.assertTaxonomyIdsVisibleForOrg(
        activityOrgId,
        'cohorts',
        cohorts
          .map((entry) => ('cohortId' in entry ? entry.cohortId : null))
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      );
      const byId = new Map<string, { cohortId: string; m: number; w: number; d: number }>();
      for (const c of cohorts as Array<
        | { cohortId: string; m?: number; w?: number; d?: number }
        | { cohortId: string; count: number; gender?: 'm' | 'w' | 'd' }
      >) {
        if (!c || !('cohortId' in c) || !c.cohortId) continue;
        const cur = byId.get(c.cohortId) || { cohortId: c.cohortId, m: 0, w: 0, d: 0 };
        if ('m' in c || 'w' in c || 'd' in c) {
          const cm = (c as { m?: number }).m ?? 0;
          const cw = (c as { w?: number }).w ?? 0;
          const cd = (c as { d?: number }).d ?? 0;
          cur.m += cm;
          cur.w += cw;
          cur.d += cd;
        } else if ('count' in c) {
          const g = (c as { gender?: 'm' | 'w' | 'd' }).gender;
          const cnt = (c as { count: number }).count || 0;
          if (g === 'm') cur.m += cnt;
          else if (g === 'w') cur.w += cnt;
          else if (g === 'd') cur.d += cnt;
        }
        byId.set(c.cohortId, cur);
      }
      existing.cohorts = Array.from(byId.values());
      const totals = Array.from(byId.values()).reduce(
        (acc, e) => {
          acc.m += e.m;
          acc.w += e.w;
          acc.d += e.d;
          return acc;
        },
        { m: 0, w: 0, d: 0 },
      );
      existing.countMale = totals.m;
      existing.countFemale = totals.w;
      existing.countDiverse = totals.d;
      existing.countTotal = totals.m + totals.w + totals.d;
    }

    await this.activityRepository.save(existing);
    const updated = await this.findOne(id);
    if (updated) {
      const cohortNamesById = await this.loadCohortNames([
        beforeActivityForAudit.cohorts,
        updated.cohorts,
      ]);
      const diff = this.buildActivityAuditDiff(
        this.toActivityAuditSnapshot(beforeActivityForAudit, cohortNamesById),
        this.toActivityAuditSnapshot(updated, cohortNamesById),
      );
      await this.audit.log({
        action: AuditAction.UPDATE,
        entityType: 'activity',
        entityId: updated.id,
        entityTitle: updated.title || updated.project?.title || updated.location?.name || null,
        orgId: updated.orgId ?? null,
        diff: Object.keys(diff).length > 0 ? diff : null,
        details: { date: updated.date, type: updated.type },
        user,
      });
    }
    return updated;
  }

  async updateScoped(
    id: string,
    data: Partial<Activity>,
    user: { id?: string; role: string; orgId?: string | null; name?: string | null },
  ) {
    const existing = await this.activityRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) {
      throw new ForbiddenException('Not allowed');
    }
    // enforce orgId remains same for non-superadmin
    const patch: Partial<Activity> = { ...data };
    if (user.role !== 'superadmin') patch.orgId = existing.orgId ?? null;
    return this.update(id, patch, {
      id: user.id,
      name: user.name ?? null,
      orgId: user.orgId ?? null,
    });
  }

  async removeScoped(
    id: string,
    user: { id?: string; role: string; orgId?: string | null; name?: string | null },
  ): Promise<void> {
    const existing = await this.activityRepository.findOne({ where: { id } });
    if (!existing) return;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) {
      throw new ForbiddenException('Not allowed');
    }
    await this.activityRepository.delete(id);
    await this.audit.log({
      action: AuditAction.DELETE,
      entityType: 'activity',
      entityId: id,
      entityTitle: existing.title || existing.project?.title || existing.location?.name || null,
      orgId: existing.orgId ?? null,
      user,
    });
  }

  // --- Ack helpers for Daily Log ---
  async getAcks(
    activityIds: string[],
    orgFilter?: { orgId?: string | null; orgIds?: string[] },
  ): Promise<Record<string, boolean>> {
    if (!Array.isArray(activityIds) || activityIds.length === 0) return {};
    const qb = this.activityRepository
      .createQueryBuilder('a')
      .select(['a.id', 'a.ackDone'])
      .where('a.id IN (:...ids)', { ids: activityIds });

    if (Array.isArray(orgFilter?.orgIds) && orgFilter!.orgIds!.length) {
      qb.andWhere('a.orgId IN (:...orgIds)', { orgIds: orgFilter!.orgIds! });
    } else if (typeof orgFilter?.orgId !== 'undefined') {
      if (orgFilter.orgId === null) qb.andWhere('a.orgId IS NULL');
      else qb.andWhere('a.orgId = :orgId', { orgId: orgFilter.orgId });
    }

    const rows = await qb.getMany();
    const map: Record<string, boolean> = {};
    for (const r of rows) {
      map[r.id] = !!(r as { ackDone?: boolean }).ackDone;
    }
    return map;
  }

  async setAckScoped(
    id: string,
    done: boolean,
    user: { id?: string; name?: string | null; role: string; orgId?: string | null },
  ): Promise<Activity | null> {
    const existing = await this.activityRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) {
      throw new ForbiddenException('Not allowed');
    }
    existing.ackDone = !!done;
    await this.activityRepository.save(existing);
    const updated = await this.findOne(id);
    if (updated) {
      await this.audit.log({
        action: AuditAction.UPDATE,
        entityType: 'activity',
        entityId: updated.id,
        entityTitle: updated.title || updated.project?.title || updated.location?.name || null,
        orgId: updated.orgId ?? null,
        details: { ackDone: !!done },
        user: { id: user.id, name: user.name ?? undefined, orgId: user.orgId ?? null },
      });
    }
    return updated;
  }
}
