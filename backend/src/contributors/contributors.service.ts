import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Like, Repository } from 'typeorm';
import { Activity } from '../activities/entities/activity.entity';
import { Contributor } from './contributor.entity';
import { ContributionReportQuery, CreateContributorDto, UpdateContributorDto } from './contributors.dto';

@Injectable()
export class ContributorsService {
  constructor(
    @InjectRepository(Contributor) private readonly people: Repository<Contributor>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
  ) {}

  list(orgId: string | null) {
    return this.people.find({ where: { orgId: orgId ?? IsNull() }, order: { name: 'ASC', id: 'ASC' } });
  }

  private async assertDistinctName(name: string, orgId: string | null, exceptId?: string) {
    if (!name.trim()) throw new BadRequestException('Bitte einen Anzeigenamen eingeben.');
    const existing = await this.list(orgId);
    if (existing.some(person => person.id !== exceptId && person.name.toLocaleLowerCase('de') === name.trim().toLocaleLowerCase('de'))) {
      throw new ConflictException('Dieser Name ist bereits vorhanden (gegebenenfalls archiviert). Bitte die vorhandene Person verwenden oder einen unterscheidbaren Anzeigenamen wählen.');
    }
  }

  async create(data: CreateContributorDto, orgId: string | null) {
    await this.assertDistinctName(data.name, orgId);
    return this.people.save(this.people.create({ name: data.name.trim(), active: true, color: data.color ?? '#7aa39a', orgId }));
  }

  async update(id: string, data: UpdateContributorDto, orgId: string | null) {
    const person = await this.people.findOne({ where: { id, orgId: orgId ?? IsNull() } });
    if (!person) throw new NotFoundException('Mitwirkende Person nicht gefunden.');
    if (data.name !== undefined) {
      await this.assertDistinctName(data.name, orgId, id);
      person.name = data.name.trim();
    }
    if (data.color !== undefined) person.color = data.color;
    if (data.active !== undefined) person.active = data.active;
    return this.people.save(person);
  }

  private async linkedActivities(id: string, orgId: string | null, repository = this.activities) {
    // simple-json is stored as text on both PostgreSQL and the local SQL.js DB.
    // Narrow by UUID first, then check the parsed ID rather than matching names.
    const candidates = await repository.find({
      where: { orgId: orgId ?? IsNull(), contributions: Like(`%${id}%`) },
      select: { id: true, contributions: true },
    });
    return candidates.filter(activity => activity.contributions?.some(entry => entry.contributorId === id));
  }

  async usage(id: string, orgId: string | null) {
    const person = await this.people.findOne({ where: { id, orgId: orgId ?? IsNull() } });
    if (!person) throw new NotFoundException('Mitwirkende Person nicht gefunden.');
    return { count: (await this.linkedActivities(id, orgId)).length };
  }

  async remove(id: string, orgId: string | null) {
    await this.people.manager.transaction('SERIALIZABLE', async manager => {
      const people = manager.getRepository(Contributor);
      const activities = manager.getRepository(Activity);
      const person = await people.findOne({ where: { id, orgId: orgId ?? IsNull() } });
      if (!person) throw new NotFoundException('Mitwirkende Person nicht gefunden.');
      for (const activity of await this.linkedActivities(id, orgId, activities)) {
        await activities.update(activity.id, {
          contributions: activity.contributions!.filter(entry => entry.contributorId !== id),
        });
      }
      await people.delete({ id, orgId: orgId ?? IsNull() });
    });
  }

  async report(query: ContributionReportQuery, orgId: string | null) {
    const from = query.from.slice(0, 10);
    const to = query.to.slice(0, 10);
    if (from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 366) {
      throw new BadRequestException('Bitte einen Zeitraum von höchstens einem Jahr wählen.');
    }
    const qb = this.activities.createQueryBuilder('activity')
      .select(['activity.id', 'activity.date', 'activity.title', 'activity.projectId', 'activity.contributions'])
      .leftJoin('activity.project', 'project').addSelect(['project.id', 'project.title'])
      .where(orgId === null ? 'activity.orgId IS NULL' : 'activity.orgId = :orgId', { orgId })
      .andWhere('activity.date >= :from AND activity.date <= :to', { from, to })
      .andWhere('activity.executionStatus = :status', { status: 'completed' })
      .orderBy('activity.date', 'DESC').addOrderBy('activity.id', 'ASC');
    if (query.projectId) qb.andWhere('activity.projectId = :projectId', { projectId: query.projectId });
    const people = new Map((await this.list(orgId)).map(person => [person.id, person]));
    const entries = (await qb.getMany()).flatMap(activity => (activity.contributions || []).flatMap(entry => {
      const person = people.get(entry.contributorId);
      if (!person) return [];
      return [{ ...entry, name: person.name, active: person.active, activityId: activity.id,
        date: String(activity.date).slice(0, 10), title: activity.title || activity.project?.title || 'Aktivität',
        projectId: activity.projectId, projectTitle: activity.project?.title || null }];
    }));
    return entries;
  }
}
