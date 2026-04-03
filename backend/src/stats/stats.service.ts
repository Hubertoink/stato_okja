import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity } from '../activities/entities/activity.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Activity)
    private activityRepository: Repository<Activity>,
    @InjectRepository(Cohort)
    private cohortRepository: Repository<Cohort>,
  ) {}

  private createFilteredActivityQuery(
    from?: string,
    to?: string,
    orgId?: string | null,
    orgIds?: string[],
    projectId?: string,
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

    return qb;
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value) || 0;
    return 0;
  }

  async getSummary(from?: string, to?: string, orgId?: string|null, orgIds?: string[], projectId?: string) {
    const raw = await this.createFilteredActivityQuery(from, to, orgId, orgIds, projectId)
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
    };
  }

  async getByType(from?: string, to?: string, orgId?: string|null, orgIds?: string[], projectId?: string) {
    const rows = await this.createFilteredActivityQuery(from, to, orgId, orgIds, projectId)
      .select('activity.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('activity.type')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany<{ type: string; count: string }>();

    return rows.map((row) => ({ type: row.type, count: this.toNumber(row.count) }));
  }

  async getGender(from?: string, to?: string, orgId?: string|null, orgIds?: string[], projectId?: string) {
    const raw = await this.createFilteredActivityQuery(from, to, orgId, orgIds, projectId)
      .select('COALESCE(SUM(activity.countMale), 0)', 'male')
      .addSelect('COALESCE(SUM(activity.countFemale), 0)', 'female')
      .addSelect('COALESCE(SUM(activity.countDiverse), 0)', 'diverse')
      .getRawOne<{ male: string; female: string; diverse: string }>();

    const male = this.toNumber(raw?.male);
    const female = this.toNumber(raw?.female);
    const diverse = this.toNumber(raw?.diverse);
    return { male, female, diverse };
  }

  async getParticipantsTimeseries(from?: string, to?: string, orgId?: string|null, orgIds?: string[], projectId?: string) {
    const rows = await this.createFilteredActivityQuery(from, to, orgId, orgIds, projectId)
      .select('activity.date', 'date')
      .addSelect('COALESCE(SUM(activity.countTotal), 0)', 'totalParticipants')
      .groupBy('activity.date')
      .orderBy('activity.date', 'ASC')
      .getRawMany<{ date: string | Date; totalParticipants: string }>();

    return rows.map((row) => ({
      date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
      totalParticipants: this.toNumber(row.totalParticipants),
    }));
  }

  async getByCategory(from?: string, to?: string, orgId?: string|null, orgIds?: string[], projectId?: string) {
    const baseQuery = this.createFilteredActivityQuery(from, to, orgId, orgIds, projectId);
    const categorized = await baseQuery
      .clone()
      .innerJoin('activity.categories', 'category')
      .select('category.id', 'id')
      .addSelect('category.name', 'name')
      .addSelect('COUNT(DISTINCT activity.id)', 'count')
      .groupBy('category.id')
      .addGroupBy('category.name')
      .orderBy('COUNT(DISTINCT activity.id)', 'DESC')
      .getRawMany<{ id: string; name: string; count: string }>();

    const uncategorized = await baseQuery
      .clone()
      .leftJoin('activity.categories', 'category')
      .andWhere('category.id IS NULL')
      .select('COUNT(DISTINCT activity.id)', 'count')
      .getRawOne<{ count: string }>();

    const rows = categorized.map((row) => ({
      id: row.id,
      name: row.name,
      count: this.toNumber(row.count),
    }));

    const uncategorizedCount = this.toNumber(uncategorized?.count);
    if (uncategorizedCount > 0) {
      rows.push({
        id: '__uncategorized__',
        name: 'Unkategorisiert',
        count: uncategorizedCount,
      });
    }

    return rows.sort((a, b) => b.count - a.count).slice(0, 10);
  }

  async getByCohort(from?: string, to?: string, orgId?: string|null, orgIds?: string[], projectId?: string) {
    const activities = await this.createFilteredActivityQuery(from, to, orgId, orgIds, projectId)
      .select(['activity.id', 'activity.cohorts'])
      .getMany();

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
    if (Array.isArray(orgIds) && orgIds.length) {
      cohQB.where('h.orgId IN (:...orgIds)', { orgIds });
    } else if (typeof orgId !== 'undefined') {
      if (orgId === null) cohQB.where('h.orgId IS NULL');
      else cohQB.where('h.orgId = :orgId', { orgId });
    }
    const cohorts = await cohQB.getMany();
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
