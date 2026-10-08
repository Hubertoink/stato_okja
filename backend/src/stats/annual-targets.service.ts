import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Activity } from '../activities/entities/activity.entity';
import { Project } from '../projects/entities/project.entity';
import { AnnualTarget, AnnualTargetRevision } from './entities/annual-target.entity';
import { AnnualTargetCommandDto, AnnualTargetDto } from './dto/annual-target.dto';
import { StatsService } from './stats.service';
import { berlinToday, evaluateAnnualTarget } from './annual-target-metrics';

@Injectable()
export class AnnualTargetsService {
  constructor(
    @InjectRepository(AnnualTarget) private readonly targets: Repository<AnnualTarget>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly stats: StatsService,
  ) {}

  private where(orgId: string | null) {
    return { orgId: orgId === null ? IsNull() : orgId };
  }

  async find(orgId: string | null, id: string) {
    const target = await this.targets.findOne({ where: { ...this.where(orgId), id } });
    if (!target) throw new NotFoundException('Jahresziel nicht gefunden');
    return target;
  }

  private async definition(orgId: string | null, dto: AnnualTargetDto) {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Bitte einen Titel angeben');
    if (dto.rule === 'range' && (dto.upperTarget == null || dto.upperTarget < dto.target))
      throw new BadRequestException(
        'Die obere Grenze muss mindestens der unteren Grenze entsprechen',
      );
    if (
      dto.metric.endsWith('_share_percent') &&
      (dto.target > 100 || (dto.rule === 'range' && dto.upperTarget! > 100))
    )
      throw new BadRequestException('Anteile müssen zwischen 0 und 100 % liegen');
    if (
      ['activity_count', 'participant_total'].includes(dto.metric) &&
      (!Number.isInteger(dto.target) ||
        (dto.rule === 'range' && !Number.isInteger(dto.upperTarget)))
    )
      throw new BadRequestException('Anzahlen müssen ganze Zahlen sein');
    const scope = { ...dto.scope };
    if (scope.activityId && (scope.projectId || scope.types?.length))
      throw new BadRequestException(
        'Eine einzelne Aktivität kann nicht mit weiteren Filtern kombiniert werden',
      );
    if (scope.projectId && scope.types?.length)
      throw new BadRequestException('Bitte entweder ein Projekt oder Aktivitätstypen wählen');
    if (
      scope.projectId &&
      !(await this.projects.exists({ where: { ...this.where(orgId), id: scope.projectId } }))
    )
      throw new BadRequestException('Projekt in dieser Einrichtung nicht gefunden');
    if (scope.activityId) {
      const activity = await this.activities.findOne({
        where: { ...this.where(orgId), id: scope.activityId },
      });
      if (!activity)
        throw new BadRequestException('Aktivität in dieser Einrichtung nicht gefunden');
      const date = typeof activity.date === 'string' ? activity.date : activity.date.toISOString();
      if (!date.startsWith(String(dto.year)))
        throw new BadRequestException('Die Aktivität muss im Zieljahr liegen');
    }
    return {
      title,
      year: dto.year,
      metric: dto.metric,
      scope,
      rule: dto.rule,
      target: dto.target,
      upperTarget: dto.rule === 'range' ? dto.upperTarget! : null,
      description: dto.description.trim(),
      showOnDashboard: dto.showOnDashboard,
    };
  }

  private revision(
    target: AnnualTarget,
    actorId: string,
    reason: string,
    actorName?: string,
  ): AnnualTargetRevision {
    const {
      title,
      year,
      metric,
      scope,
      rule,
      target: value,
      upperTarget,
      status,
      description,
      showOnDashboard,
      review,
      snapshot,
    } = target;
    return {
      at: new Date().toISOString(),
      actorId,
      actorName,
      reason,
      definition: {
        title,
        year,
        metric,
        scope,
        rule,
        target: value,
        upperTarget,
        status,
        description,
        showOnDashboard,
        review,
        snapshot,
      },
    };
  }

  async create(orgId: string | null, actorId: string, dto: AnnualTargetDto, actorName?: string) {
    const definition = await this.definition(orgId, dto);
    const target = this.targets.create({
      ...definition,
      orgId,
      status: 'draft',
      review: '',
      snapshot: null,
      version: 1,
      history: [],
    });
    target.history = [
      this.revision(target, actorId, dto.reason?.trim() || 'Ziel angelegt', actorName),
    ];
    return this.targets.save(target);
  }

  private async persist(
    target: AnnualTarget,
    version: number | undefined,
    actorId: string,
    reason: string,
    actorName?: string,
  ) {
    if (version !== target.version)
      throw new ConflictException('Das Ziel wurde inzwischen geändert. Bitte neu laden.');
    target.history = [...target.history, this.revision(target, actorId, reason, actorName)];
    const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...changes } = target;
    void _createdAt;
    void _updatedAt;
    const result = await this.targets.update(
      { id, ...this.where(target.orgId), version },
      { ...changes, version: version + 1 },
    );
    if (result.affected !== 1)
      throw new ConflictException('Das Ziel wurde inzwischen geändert. Bitte neu laden.');
    return this.find(target.orgId, id);
  }

  async update(
    orgId: string | null,
    actorId: string,
    id: string,
    dto: AnnualTargetDto,
    actorName?: string,
  ) {
    const target = await this.find(orgId, id);
    if (target.status === 'closed')
      throw new BadRequestException('Abgeschlossene Ziele müssen zuerst wieder geöffnet werden');
    if (target.status === 'active' && !dto.reason?.trim())
      throw new BadRequestException('Bitte die Änderung des festgelegten Ziels begründen');
    if (target.status === 'active' && dto.year !== target.year)
      throw new BadRequestException('Das Jahr eines festgelegten Ziels kann nicht geändert werden');
    Object.assign(target, await this.definition(orgId, dto));
    return this.persist(
      target,
      dto.version,
      actorId,
      dto.reason?.trim() || 'Entwurf bearbeitet',
      actorName,
    );
  }

  async command(
    orgId: string | null,
    actorId: string,
    id: string,
    dto: AnnualTargetCommandDto,
    actorName?: string,
  ) {
    const target = await this.find(orgId, id);
    if (dto.action === 'activate') {
      if (target.status !== 'draft')
        throw new BadRequestException('Nur Entwürfe können festgelegt werden');
      target.status = 'active';
    } else if (dto.action === 'close') {
      if (target.status !== 'active')
        throw new BadRequestException('Nur festgelegte Ziele können abgeschlossen werden');
      if (berlinToday() <= `${target.year}-12-31`)
        throw new BadRequestException('Der Jahresabschluss ist nach Ende des Zieljahres möglich');
      if (!dto.reason.trim())
        throw new BadRequestException('Bitte eine fachliche Einordnung ergänzen');
      target.snapshot = await this.stats.getAnnualTargetSnapshot(
        orgId,
        target.year,
        target.scope,
        target.metric,
        `${target.year}-12-31`,
      );
      target.review = dto.reason.trim();
      target.status = 'closed';
    } else {
      if (target.status !== 'closed')
        throw new BadRequestException('Nur abgeschlossene Ziele können wieder geöffnet werden');
      if (!dto.reason.trim()) throw new BadRequestException('Bitte die Wiederöffnung begründen');
      target.snapshot = null;
      target.review = '';
      target.status = 'active';
    }
    return this.persist(
      target,
      dto.version,
      actorId,
      dto.reason.trim() || 'Ziel festgelegt',
      actorName,
    );
  }

  async copy(orgId: string | null, actorId: string, id: string, year: number, actorName?: string) {
    const source = await this.find(orgId, id);
    if (source.scope.activityId)
      throw new BadRequestException(
        'Einzeltermine können nicht in ein anderes Zieljahr übernommen werden',
      );
    if (year <= source.year) throw new BadRequestException('Bitte ein späteres Zieljahr wählen');
    return this.create(
      orgId,
      actorId,
      { ...source, year, reason: `Aus Jahresziel ${source.year} übernommen (${source.id})` },
      actorName,
    );
  }

  private asOf(year: number) {
    return [berlinToday(), `${year}-12-31`].sort()[0];
  }

  private async result(target: AnnualTarget) {
    const current = await this.stats.getAnnualTargetSnapshot(
      target.orgId,
      target.year,
      target.scope,
      target.metric,
      this.asOf(target.year),
    );
    const result = target.snapshot ?? current;
    let scopeLabel = 'Gesamte Einrichtung';
    if (target.scope.projectId) {
      const project = await this.projects.findOne({
        where: { ...this.where(target.orgId), id: target.scope.projectId },
      });
      scopeLabel = project?.title ?? 'Gelöschtes Projekt';
    } else if (target.scope.activityId) {
      const activity = await this.activities.findOne({
        where: { ...this.where(target.orgId), id: target.scope.activityId },
      });
      scopeLabel = activity
        ? `${activity.title || 'Aktivität'} · ${String(activity.date).slice(0, 10)}`
        : 'Gelöschte Aktivität';
    }
    return {
      ...target,
      scopeLabel,
      result,
      current,
      dataChanged: !!target.snapshot && JSON.stringify(target.snapshot) !== JSON.stringify(current),
      evaluation: evaluateAnnualTarget(
        result.value,
        target.rule,
        target.target,
        target.upperTarget,
      ),
    };
  }

  async list(orgId: string | null, year: number) {
    const targets = await this.targets.find({
      where: { ...this.where(orgId), year },
      order: { createdAt: 'ASC' },
    });
    return Promise.all(
      targets.map(async (target) => {
        const { history: _history, ...result } = await this.result(target);
        void _history;
        return result;
      }),
    );
  }

  async detail(orgId: string | null, id: string) {
    return this.result(await this.find(orgId, id));
  }

  async activityList(orgId: string | null, id: string, page: number) {
    const target = await this.find(orgId, id);
    return this.stats.getAnnualTargetActivities(
      orgId,
      target.year,
      target.scope,
      this.asOf(target.year),
      page,
    );
  }
}
