import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets } from 'typeorm';
import { Activity } from './entities/activity.entity';
import { ActivityType } from '../common/enums';
import { Tag } from '../taxonomy/entities/tag.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Project } from '../projects/entities/project.entity';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  private buildListQuery(filters?: {
    from?: string; to?: string;
    type?: string; types?: string[];
    locationId?: string; locationIds?: string[];
    projectIds?: string[]; categoryIds?: string[]; tagIds?: string[];
    cohortIds?: string[];
    hasNotes?: boolean;
    participantsMin?: number; participantsMax?: number;
    durationMin?: number; durationMax?: number;
    orgId?: string|null;
  }) {
    const qb = this.activityRepository.createQueryBuilder('a')
      .leftJoinAndSelect('a.location', 'location')
      .leftJoinAndSelect('a.categories', 'categories')
      .leftJoinAndSelect('a.tags', 'tags')
      .leftJoinAndSelect('a.staff', 'staff')
      .leftJoinAndSelect('a.attachments', 'attachments')
      .leftJoinAndSelect('a.project', 'project')
      .leftJoinAndSelect('a.createdBy', 'createdBy')
      .leftJoinAndSelect('a.updatedBy', 'updatedBy')
      .distinct(true);

    if (filters?.from && filters?.to) {
      qb.andWhere('a.date BETWEEN :from AND :to', { from: filters.from, to: filters.to });
    }
    if (typeof filters?.orgId !== 'undefined') {
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
    if (filters?.categoryIds && filters.categoryIds.length) {
      qb.andWhere('categories.id IN (:...categoryIds)', { categoryIds: filters.categoryIds });
    }
    if (filters?.tagIds && filters.tagIds.length) {
      qb.andWhere('tags.id IN (:...tagIds)', { tagIds: filters.tagIds });
    }
    if (filters?.cohortIds && filters.cohortIds.length) {
      qb.andWhere(new Brackets((b) => {
        filters.cohortIds!.forEach((id, i) => {
          const param = `cid${i}`;
          (i === 0 ? b.where : b.orWhere)(`a.cohorts LIKE :${param}`, { [param]: `%"cohortId":"${id}"%` });
        });
      }));
    }
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

    qb.orderBy('a.date', 'DESC').addOrderBy('a.startTime', 'DESC');
    return qb;
  }

  async findAll(filters?: {
    from?: string; to?: string;
    type?: string; types?: string[];
    locationId?: string; locationIds?: string[];
    projectIds?: string[]; categoryIds?: string[]; tagIds?: string[];
    cohortIds?: string[];
    hasNotes?: boolean;
    participantsMin?: number; participantsMax?: number;
    durationMin?: number; durationMax?: number;
    orgId?: string|null;
  }): Promise<Activity[]> {
    const qb = this.buildListQuery(filters);
    return qb.getMany();
  }

  async findAllPaged(filters: {
    from?: string; to?: string;
    type?: string; types?: string[];
    locationId?: string; locationIds?: string[];
    projectIds?: string[]; categoryIds?: string[]; tagIds?: string[];
    cohortIds?: string[];
    hasNotes?: boolean;
    participantsMin?: number; participantsMax?: number;
    durationMin?: number; durationMax?: number;
    orgId?: string|null;
    page: number; limit: number;
  }): Promise<{ data: Activity[]; total: number; page: number; pageSize: number }> {
    const qb = this.buildListQuery(filters);
    const page = Math.max(filters.page || 1, 1);
    const limit = Math.min(Math.max(filters.limit || 50, 1), 50);
    qb.take(limit).skip((page - 1) * limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: rows, total, page, pageSize: limit };
  }

  findOne(id: string): Promise<Activity | null> {
    return this.activityRepository.findOne({
      where: { id },
      relations: ['location', 'categories', 'tags', 'staff', 'attachments', 'createdBy', 'updatedBy', 'project'],
    });
  }

  async findOneScoped(id: string, user: { role: string; orgId?: string|null }) {
    const a = await this.findOne(id);
    if (!a) return null;
    if (user.role !== 'superadmin' && (a.orgId ?? null) !== (user.orgId ?? null)) {
      throw new ForbiddenException('Not allowed');
    }
    return a;
  }

  async create(data: (Partial<Activity> & {
    tagIds?: string[];
    staffIds?: string[];
    categoryIds?: string[];
    cohorts?: Array<{ cohortId: string; m?: number; w?: number; d?: number }>
            | Array<{ cohortId: string; count: number; gender?: string }>;
  })): Promise<Activity> {
    const { tagIds, staffIds, categoryIds, cohorts, ...rest } = data as Partial<Activity> & {
      tagIds?: string[];
      staffIds?: string[];
      categoryIds?: string[];
      cohorts?: Array<{ cohortId: string; m?: number; w?: number; d?: number }> | Array<{ cohortId: string; count: number; gender?: 'm'|'w'|'d' }>;
    };

    if (!rest.locationId) {
      throw new BadRequestException('locationId is required');
    }

  const activity = this.activityRepository.create(rest);

    // If a project is linked, enforce the activity type to match the project's type
    const restWithProject = rest as Partial<Activity> & { projectId?: string | null };
    if (restWithProject.projectId) {
      const project = await this.projectRepository.findOne({ where: { id: restWithProject.projectId } });
      if (!project) throw new BadRequestException('Invalid projectId');
      activity.project = project;
      activity.type = project.type as ActivityType;
    }

    // Relations
    if (Array.isArray(tagIds) && tagIds.length) {
      const tags = await this.tagRepository.findBy({ id: In(tagIds) });
      activity.tags = tags;
    }
    if (Array.isArray(staffIds) && staffIds.length) {
      const staff = await this.staffRepository.findBy({ id: In(staffIds) });
      activity.staff = staff;
    }
    if (Array.isArray(categoryIds) && categoryIds.length) {
      const categories = await this.categoryRepository.findBy({ id: In(categoryIds) });
      activity.categories = categories;
    }

    // Cohorts: allow two input shapes; normalize to per-gender {cohortId,m,w,d}
    if (Array.isArray(cohorts)) {
      const byId = new Map<string, { cohortId: string; m: number; w: number; d: number }>();
      for (const c of cohorts as Array<{ cohortId: string; m?: number; w?: number; d?: number } | { cohortId: string; count: number; gender?: 'm'|'w'|'d' }>) {
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
          const g = (c as { gender?: 'm'|'w'|'d' }).gender;
          const cnt = (c as { count: number }).count || 0;
          if (g === 'm') cur.m += cnt;
          else if (g === 'w') cur.w += cnt;
          else if (g === 'd') cur.d += cnt;
        }
        byId.set(c.cohortId, cur);
      }
      activity.cohorts = Array.from(byId.values());
      // derive totals
      const totals = Array.from(byId.values()).reduce((acc, e) => { acc.m += e.m; acc.w += e.w; acc.d += e.d; return acc; }, { m: 0, w: 0, d: 0 });
      activity.countMale = totals.m;
      activity.countFemale = totals.w;
      activity.countDiverse = totals.d;
      activity.countTotal = totals.m + totals.w + totals.d;
    }

    return this.activityRepository.save(activity);
  }

  async update(id: string, data: Partial<Activity> & {
    tagIds?: string[];
    staffIds?: string[];
    categoryIds?: string[];
    cohorts?: Array<{ cohortId: string; m?: number; w?: number; d?: number } | { cohortId: string; count: number; gender?: string }>;
  }): Promise<Activity | null> {
    const existing = await this.activityRepository.findOne({ where: { id }, relations: ['tags', 'staff', 'categories'] });
    if (!existing) return null;

    const { tagIds, staffIds, categoryIds, cohorts, ...rest } = data as Partial<Activity> & {
      tagIds?: string[];
      staffIds?: string[];
      categoryIds?: string[];
      cohorts?: Array<{ cohortId: string; m?: number; w?: number; d?: number }> | Array<{ cohortId: string; count: number; gender?: 'm'|'w'|'d' }>;
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
      existing.tags = tagIds.length ? await this.tagRepository.findBy({ id: In(tagIds) }) : [];
    }
    if (Array.isArray(staffIds)) {
      existing.staff = staffIds.length ? await this.staffRepository.findBy({ id: In(staffIds) }) : [];
    }
    if (Array.isArray(categoryIds)) {
      existing.categories = categoryIds.length ? await this.categoryRepository.findBy({ id: In(categoryIds) }) : [];
    }

    // Cohorts: normalize to per-gender and recompute totals
    if (Array.isArray(cohorts)) {
      const byId = new Map<string, { cohortId: string; m: number; w: number; d: number }>();
      for (const c of cohorts as Array<{ cohortId: string; m?: number; w?: number; d?: number } | { cohortId: string; count: number; gender?: 'm'|'w'|'d' }>) {
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
          const g = (c as { gender?: 'm'|'w'|'d' }).gender;
          const cnt = (c as { count: number }).count || 0;
          if (g === 'm') cur.m += cnt;
          else if (g === 'w') cur.w += cnt;
          else if (g === 'd') cur.d += cnt;
        }
        byId.set(c.cohortId, cur);
      }
      existing.cohorts = Array.from(byId.values());
      const totals = Array.from(byId.values()).reduce((acc, e) => { acc.m += e.m; acc.w += e.w; acc.d += e.d; return acc; }, { m: 0, w: 0, d: 0 });
      existing.countMale = totals.m;
      existing.countFemale = totals.w;
      existing.countDiverse = totals.d;
      existing.countTotal = totals.m + totals.w + totals.d;
    }

    await this.activityRepository.save(existing);
    return this.findOne(id);
  }

  async updateScoped(id: string, data: Partial<Activity>, user: { role: string; orgId?: string|null }) {
    const existing = await this.activityRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) {
      throw new ForbiddenException('Not allowed');
    }
    // enforce orgId remains same for non-superadmin
    const patch: Partial<Activity> = { ...data };
    if (user.role !== 'superadmin') patch.orgId = existing.orgId ?? null;
    return this.update(id, patch);
  }

  async removeScoped(id: string, user: { role: string; orgId?: string|null }): Promise<void> {
    const existing = await this.activityRepository.findOne({ where: { id } });
    if (!existing) return;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) {
      throw new ForbiddenException('Not allowed');
    }
    await this.activityRepository.delete(id);
  }
}
