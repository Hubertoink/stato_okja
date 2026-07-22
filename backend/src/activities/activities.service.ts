import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
import { Activity } from './entities/activity.entity';
import { ActivityExecutionStatus, ActivityType } from '../common/enums';
import { AuditService } from '../common/audit.service';
import { AuditAction } from '../common/enums';
import { Tag } from '../taxonomy/entities/tag.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Project } from '../projects/entities/project.entity';
import { OrgsService } from '../orgs/orgs.service';
import { assertOrgScopedEntityAccess, preserveOrgIdForNonSuperadmin } from '../auth/org-scope-access';
import { ActivityListQuery, type ActivityListFilters } from './activity-list-query';

type ActivityAuditSnapshot = {
  title: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  executionStatus: string | null;
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

type ActivityCohortGender = 'm' | 'w' | 'd';
type ActivityCohortInput =
  | { cohortId: string; m?: number; w?: number; d?: number }
  | { cohortId: string; count: number; gender?: ActivityCohortGender | string };
type NormalizedActivityCohort = { cohortId: string; m: number; w: number; d: number };
type ActivityCohortTarget = Pick<
  Activity,
  'cohorts' | 'countMale' | 'countFemale' | 'countDiverse' | 'countTotal'
>;
type ActivityFilterAvailability = {
  categoryIds: string[];
  tagIds: string[];
  executionStatuses: ActivityExecutionStatus[];
  hasUncategorized: boolean;
  availableYears: string[];
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

  private normalizeAuditText(value?: string | null): string | null {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeAuditNumber(value?: number | null): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private normalizeExecutionStatus(
    value?: string | null,
  ): ActivityExecutionStatus {
    return value === ActivityExecutionStatus.CANCELLED
      ? ActivityExecutionStatus.CANCELLED
      : ActivityExecutionStatus.COMPLETED;
  }

  private assertUserCanAccessActivity(
    activity: Pick<Activity, 'orgId'>,
    user: { role: string; orgId?: string | null },
  ) {
    assertOrgScopedEntityAccess(activity, user);
  }

  private getCohortIds(cohorts: Array<ActivityCohortInput | null | undefined>): string[] {
    return cohorts
      .map((entry) => (entry && 'cohortId' in entry ? entry.cohortId : null))
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
  }

  private normalizeActivityCohorts(
    cohorts: Array<ActivityCohortInput | null | undefined>,
  ): { cohorts: NormalizedActivityCohort[]; totals: { m: number; w: number; d: number } } {
    const byId = new Map<string, NormalizedActivityCohort>();
    for (const cohort of cohorts) {
      if (!cohort || !('cohortId' in cohort) || !cohort.cohortId) continue;
      const current = byId.get(cohort.cohortId) || { cohortId: cohort.cohortId, m: 0, w: 0, d: 0 };
      if ('m' in cohort || 'w' in cohort || 'd' in cohort) {
        current.m += (cohort as { m?: number }).m ?? 0;
        current.w += (cohort as { w?: number }).w ?? 0;
        current.d += (cohort as { d?: number }).d ?? 0;
      } else if ('count' in cohort) {
        const gender = (cohort as { gender?: ActivityCohortGender }).gender;
        const count = (cohort as { count: number }).count || 0;
        if (gender === 'm') current.m += count;
        else if (gender === 'w') current.w += count;
        else if (gender === 'd') current.d += count;
      }
      byId.set(cohort.cohortId, current);
    }

    const normalizedCohorts = Array.from(byId.values());
    const totals = normalizedCohorts.reduce(
      (acc, entry) => {
        acc.m += entry.m;
        acc.w += entry.w;
        acc.d += entry.d;
        return acc;
      },
      { m: 0, w: 0, d: 0 },
    );

    return { cohorts: normalizedCohorts, totals };
  }

  private async applyActivityCohorts(
    target: ActivityCohortTarget,
    activityOrgId: string | null,
    cohorts: Array<ActivityCohortInput | null | undefined>,
  ) {
    await this.orgs.assertTaxonomyIdsVisibleForOrg(
      activityOrgId,
      'cohorts',
      this.getCohortIds(cohorts),
    );
    const normalized = this.normalizeActivityCohorts(cohorts);
    target.cohorts = normalized.cohorts;
    target.countMale = normalized.totals.m;
    target.countFemale = normalized.totals.w;
    target.countDiverse = normalized.totals.d;
    target.countTotal = normalized.totals.m + normalized.totals.w + normalized.totals.d;
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
      executionStatus: this.normalizeAuditText(activity?.executionStatus ?? null),
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
      'executionStatus',
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

  private activityListQuery() {
    return new ActivityListQuery(this.activityRepository, this.orgs);
  }

  async findAll(filters?: ActivityListFilters): Promise<Activity[]> {
    return this.activityListQuery().findAll(filters);
  }

  async findAllPaged(
    filters: ActivityListFilters & { page: number; limit: number },
  ): Promise<{ data: Activity[]; total: number; page: number; pageSize: number }> {
    return this.activityListQuery().findPaged(filters);
  }

  async getFilterAvailability(
    orgFilter?: Pick<ActivityListFilters, 'orgId' | 'orgIds'>,
  ): Promise<ActivityFilterAvailability> {
    const applyOrgScope = (query: SelectQueryBuilder<Activity>) => {
      if (Array.isArray(orgFilter?.orgIds) && orgFilter.orgIds.length > 0) {
        query.andWhere('a.orgId IN (:...orgIds)', { orgIds: orgFilter.orgIds });
      } else if (typeof orgFilter?.orgId !== 'undefined') {
        if (orgFilter.orgId === null) query.andWhere('a.orgId IS NULL');
        else query.andWhere('a.orgId = :orgId', { orgId: orgFilter.orgId });
      }
      return query;
    };

    const yearExpression = ['postgres', 'postgresql'].includes(
      String(this.activityRepository.manager.connection.options.type).toLowerCase(),
    )
      ? "TO_CHAR(a.date, 'YYYY')"
      : "strftime('%Y', a.date)";

    const categoryIdsQuery = applyOrgScope(
      this.activityRepository
        .createQueryBuilder('a')
        .leftJoin('a.categories', 'category')
        .select('DISTINCT category.id', 'id')
        .where('category.id IS NOT NULL'),
    ).getRawMany<{ id: string }>();
    const tagIdsQuery = applyOrgScope(
      this.activityRepository
        .createQueryBuilder('a')
        .leftJoin('a.tags', 'tag')
        .select('DISTINCT tag.id', 'id')
        .where('tag.id IS NOT NULL'),
    ).getRawMany<{ id: string }>();
    const executionStatusesQuery = applyOrgScope(
      this.activityRepository
        .createQueryBuilder('a')
        .select('DISTINCT a.executionStatus', 'executionStatus'),
    ).getRawMany<{ executionStatus: ActivityExecutionStatus }>();
    const yearsQuery = applyOrgScope(
      this.activityRepository
        .createQueryBuilder('a')
        .select(`DISTINCT ${yearExpression}`, 'year'),
    ).getRawMany<{ year: string }>();
    const uncategorizedQuery = applyOrgScope(
      this.activityRepository
        .createQueryBuilder('a')
        .leftJoin('a.categories', 'category')
        .select('1', 'matched')
        .where('category.id IS NULL')
        .limit(1),
    ).getRawOne<{ matched: number }>();

    const [categoryRows, tagRows, statusRows, yearRows, uncategorizedRow] = await Promise.all([
      categoryIdsQuery,
      tagIdsQuery,
      executionStatusesQuery,
      yearsQuery,
      uncategorizedQuery,
    ]);

    return {
      categoryIds: categoryRows.map((row) => row.id).filter(Boolean),
      tagIds: tagRows.map((row) => row.id).filter(Boolean),
      executionStatuses: statusRows
        .map((row) => row.executionStatus)
        .filter(
          (status): status is ActivityExecutionStatus =>
            status === ActivityExecutionStatus.COMPLETED || status === ActivityExecutionStatus.CANCELLED,
        ),
      hasUncategorized: Boolean(uncategorizedRow),
      availableYears: yearRows
        .map((row) => String(row.year || ''))
        .filter((year) => /^\d{4}$/.test(year))
        .sort((left, right) => right.localeCompare(left)),
    };
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
    this.assertUserCanAccessActivity(a, user);
    return a;
  }

  async create(
    data: Partial<Activity> & {
      tagIds?: string[];
      staffIds?: string[];
      categoryIds?: string[];
      cohorts?: ActivityCohortInput[];
    },
    user?: { id?: string; name?: string; orgId?: string | null },
  ): Promise<Activity> {
    const { tagIds, staffIds, categoryIds, cohorts, ...rest } = data as Partial<Activity> & {
      tagIds?: string[];
      staffIds?: string[];
      categoryIds?: string[];
      cohorts?: ActivityCohortInput[];
    };

    // locationId is optional; if omitted, activity can still be created

    const activity = this.activityRepository.create(rest);
    activity.executionStatus = this.normalizeExecutionStatus(rest.executionStatus);
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

    if (Array.isArray(cohorts)) {
      await this.applyActivityCohorts(activity, activityOrgId, cohorts);
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
      cohorts?: ActivityCohortInput[];
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
      cohorts?: ActivityCohortInput[];
    };

    Object.assign(existing, rest);
    existing.executionStatus = this.normalizeExecutionStatus(rest.executionStatus ?? existing.executionStatus);

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

    if (Array.isArray(cohorts)) {
      await this.applyActivityCohorts(existing, activityOrgId, cohorts);
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
    this.assertUserCanAccessActivity(existing, user);
    // enforce orgId remains same for non-superadmin
    const patch = preserveOrgIdForNonSuperadmin<Partial<Activity>>(data, user, existing.orgId ?? null);
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
    this.assertUserCanAccessActivity(existing, user);
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
    this.assertUserCanAccessActivity(existing, user);
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
