import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Raw, Equal, IsNull } from 'typeorm';
import { Activity } from '../activities/entities/activity.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { Category } from '../taxonomy/entities/category.entity';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Activity)
    private activityRepository: Repository<Activity>,
    @InjectRepository(Cohort)
    private cohortRepository: Repository<Cohort>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  private buildDateWhere(from?: string, to?: string): FindOptionsWhere<Activity> {
    const where: FindOptionsWhere<Activity> = {};
    // Use raw string compare on DATE to avoid TZ conversion issues
    if (from && to) {
      where.date = Raw((alias) => `${alias} >= :from AND ${alias} <= :to`, { from, to });
    } else if (from) {
      where.date = Raw((alias) => `${alias} >= :from`, { from });
    } else if (to) {
      where.date = Raw((alias) => `${alias} <= :to`, { to });
    }
    return where;
  }

  private applyOrg(where: FindOptionsWhere<Activity>, orgId?: string | null): FindOptionsWhere<Activity> {
    // superadmin ohne orgId → keine Einschränkung
    if (typeof orgId === 'undefined') return where;
    const extra: FindOptionsWhere<Activity> = orgId === null
      ? { orgId: IsNull() }
      : { orgId: Equal(orgId) };
    return { ...where, ...extra } as FindOptionsWhere<Activity>;
  }

  async getSummary(from?: string, to?: string, orgId?: string|null) {
    const where = this.applyOrg(this.buildDateWhere(from, to), orgId);
    const activities = await this.activityRepository.find({ where });

    const totalActivities = activities.length;
    const totalParticipants = activities.reduce((sum, a) => sum + (a.countTotal || 0), 0);
    const totalMale = activities.reduce((sum, a) => sum + (a.countMale || 0), 0);
    const totalFemale = activities.reduce((sum, a) => sum + (a.countFemale || 0), 0);
    const totalDiverse = activities.reduce((sum, a) => sum + (a.countDiverse || 0), 0);
    const totalDurationMinutes = activities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);

    return {
      totalActivities,
      totalParticipants,
      totalMale,
      totalFemale,
      totalDiverse,
      totalDurationMinutes,
      totalHours: +(totalDurationMinutes / 60).toFixed(1),
      averageParticipants: totalActivities > 0 ? +(totalParticipants / totalActivities).toFixed(1) : 0,
    };
  }

  async getByType(from?: string, to?: string, orgId?: string|null) {
    const where = this.applyOrg(this.buildDateWhere(from, to), orgId);
    const activities = await this.activityRepository.find({ where });
    const map = new Map<string, number>();
    for (const a of activities) {
      map.set(a.type as unknown as string, (map.get(a.type as unknown as string) || 0) + 1);
    }
    return Array.from(map.entries()).map(([type, count]) => ({ type, count }));
  }

  async getGender(from?: string, to?: string, orgId?: string|null) {
    const where = this.applyOrg(this.buildDateWhere(from, to), orgId);
    const activities = await this.activityRepository.find({ where });
    const male = activities.reduce((s, a) => s + (a.countMale || 0), 0);
    const female = activities.reduce((s, a) => s + (a.countFemale || 0), 0);
    const diverse = activities.reduce((s, a) => s + (a.countDiverse || 0), 0);
    return { male, female, diverse };
  }

  async getParticipantsTimeseries(from?: string, to?: string, orgId?: string|null) {
    const where = this.applyOrg(this.buildDateWhere(from, to), orgId);
    const activities = await this.activityRepository.find({ where });
    const map = new Map<string, number>();
    for (const a of activities) {
      const key = (a.date instanceof Date)
        ? `${a.date.getFullYear()}-${String(a.date.getMonth() + 1).padStart(2, '0')}-${String(a.date.getDate()).padStart(2, '0')}`
        : String(a.date);
      map.set(key, (map.get(key) || 0) + (a.countTotal || 0));
    }
    return Array.from(map.entries())
      .map(([date, total]) => ({ date, totalParticipants: total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getByCategory(from?: string, to?: string, orgId?: string|null) {
    const where = this.applyOrg(this.buildDateWhere(from, to), orgId);
    // Count by the category of the linked project (user-managed categories)
    const activities = await this.activityRepository.find({ where });
    const map = new Map<string, number>();
    for (const a of activities) {
      const catId = a.project?.categoryId || '__uncategorized__';
      map.set(catId, (map.get(catId) || 0) + 1);
    }
  const catQB = this.categoryRepository.createQueryBuilder('c');
    if (typeof orgId !== 'undefined') {
      if (orgId === null) catQB.where('c.orgId IS NULL');
      else catQB.where('c.orgId = :orgId', { orgId });
    }
    const categories = await catQB.getMany();
    const nameMap = new Map<string, string>(categories.map((c) => [c.id, c.name] as const));
    const result = Array.from(map.entries()).map(([id, count]) => ({
      id,
      name: id === '__uncategorized__' ? 'Unkategorisiert' : (nameMap.get(id) || id),
      count,
    }));
    return result.sort((a, b) => b.count - a.count).slice(0, 10);
  }

  async getByCohort(from?: string, to?: string, orgId?: string|null) {
    const where = this.applyOrg(this.buildDateWhere(from, to), orgId);
    const activities = await this.activityRepository.find({ where });
    // Sum cohorts JSON m/w/d by cohortId and count distinct activities per cohort
    const map = new Map<string, { cohortId: string; m: number; w: number; d: number }>();
    const usage = new Map<string, Set<string>>();
    for (const a of activities) {
      for (const ch of a.cohorts || []) {
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
    if (typeof orgId !== 'undefined') {
      if (orgId === null) cohQB.where('h.orgId IS NULL');
      else cohQB.where('h.orgId = :orgId', { orgId });
    }
    const cohorts = await cohQB.getMany();
    const nameMap = new Map(cohorts.map((c) => [c.id, c.name] as const));
    return Array.from(map.values()).map((v) => ({
      cohortId: v.cohortId,
      name: nameMap.get(v.cohortId) || v.cohortId,
      male: v.m,
      female: v.w,
      diverse: v.d,
      total: v.m + v.w + v.d,
      activities: usage.get(v.cohortId)?.size || 0,
    })).sort((a, b) => b.total - a.total);
  }
}
