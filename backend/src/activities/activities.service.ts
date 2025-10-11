import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, FindOptionsWhere } from 'typeorm';
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

  async findAll(filters?: { from?: string; to?: string; type?: string; locationId?: string }): Promise<Activity[]> {
    const where: FindOptionsWhere<Activity> = {};

    if (filters?.from && filters?.to) {
      where.date = Between(new Date(filters.from), new Date(filters.to));
    }
    if (filters?.type) {
      // Cast to the ActivityType enum string
      where.type = filters.type as ActivityType;
    }
    if (filters?.locationId) {
      where.locationId = filters.locationId;
    }

    return this.activityRepository.find({
      where,
      order: { date: 'DESC', startTime: 'DESC' },
      relations: ['location', 'categories', 'tags', 'staff', 'attachments', 'project'],
    });
  }

  findOne(id: string): Promise<Activity | null> {
    return this.activityRepository.findOne({
      where: { id },
      relations: ['location', 'categories', 'tags', 'staff', 'attachments', 'createdBy', 'updatedBy', 'project'],
    });
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
      cohorts?: Array<{ cohortId: string; m?: number; w?: number; d?: number } | { cohortId: string; count: number; gender?: string }>;
    };

    if (!rest.locationId) {
      throw new BadRequestException('locationId is required');
    }

    const activity = this.activityRepository.create(rest);

    // If a project is linked, enforce the activity type to match the project's type
    if ((rest as any).projectId) {
      const project = await this.projectRepository.findOne({ where: { id: (rest as any).projectId } });
      if (!project) throw new BadRequestException('Invalid projectId');
      activity.project = project as any;
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
      for (const c of cohorts) {
        if (!c || !('cohortId' in c) || !c.cohortId) continue;
        const cur = byId.get(c.cohortId) || { cohortId: c.cohortId, m: 0, w: 0, d: 0 };
        if ('m' in c || 'w' in c || 'd' in c) {
          cur.m += (c as any).m || 0;
          cur.w += (c as any).w || 0;
          cur.d += (c as any).d || 0;
        } else if ('count' in c) {
          const g = (c as any).gender as string | undefined;
          if (g === 'm') cur.m += (c as any).count || 0;
          else if (g === 'w') cur.w += (c as any).count || 0;
          else if (g === 'd') cur.d += (c as any).count || 0;
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
      cohorts?: Array<{ cohortId: string; count: number; gender?: string }>;
    };

    Object.assign(existing, rest);

    // If a project is linked (new or existing), ensure the activity type mirrors the project's type
    const projectId = (rest as any).projectId ?? existing.projectId;
    if (projectId) {
      const project = await this.projectRepository.findOne({ where: { id: projectId as string } });
      if (project) {
        existing.project = project as any;
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
      for (const c of cohorts) {
        if (!c || !('cohortId' in c) || !c.cohortId) continue;
        const cur = byId.get(c.cohortId) || { cohortId: c.cohortId, m: 0, w: 0, d: 0 };
        if ('m' in c || 'w' in c || 'd' in c) {
          cur.m += (c as any).m || 0;
          cur.w += (c as any).w || 0;
          cur.d += (c as any).d || 0;
        } else if ('count' in c) {
          const g = (c as any).gender as string | undefined;
          if (g === 'm') cur.m += (c as any).count || 0;
          else if (g === 'w') cur.w += (c as any).count || 0;
          else if (g === 'd') cur.d += (c as any).count || 0;
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

  async remove(id: string): Promise<void> {
    await this.activityRepository.delete(id);
  }
}
