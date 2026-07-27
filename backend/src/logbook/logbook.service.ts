import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Activity } from '../activities/entities/activity.entity';
import { AuditService } from '../common/audit.service';
import { AuditAction, LogbookEntryStatus, LogbookEntryType, LogbookVisibility } from '../common/enums';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';
import { LogbookComment } from './entities/logbook-comment.entity';
import { LogbookEntry } from './entities/logbook-entry.entity';

type RequestUser = { id: string; name?: string | null; role: string; orgId?: string | null };
type EntryInput = Partial<Pick<
  LogbookEntry,
  'occurredAt' | 'type' | 'title' | 'body' | 'highlights' | 'challenges' | 'nextSteps' | 'status' | 'visibility' | 'activityId' | 'projectId'
>>;

const allowedTypes = new Set<string>(Object.values(LogbookEntryType));
const allowedStatuses = new Set<string>(Object.values(LogbookEntryStatus));
const allowedVisibility = new Set<string>(Object.values(LogbookVisibility));

@Injectable()
export class LogbookService {
  constructor(
    @InjectRepository(LogbookEntry) private readonly entries: Repository<LogbookEntry>,
    @InjectRepository(LogbookComment) private readonly comments: Repository<LogbookComment>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly audit: AuditService,
  ) {}

  private isAdmin(user: RequestUser) {
    return user.role === 'org_admin' || user.role === 'superadmin';
  }

  private sameOrg(value: string | null | undefined, orgId: string | null) {
    return (value ?? null) === orgId;
  }

  private canManage(entry: LogbookEntry, user: RequestUser) {
    return this.isAdmin(user) || entry.createdByUserId === user.id;
  }

  private cleanText(value: unknown, max: number, field: string, required = false) {
    if (value === null || typeof value === 'undefined') {
      if (required) throw new BadRequestException(`${field} ist erforderlich.`);
      return null;
    }
    if (typeof value !== 'string') throw new BadRequestException(`${field} ist ungültig.`);
    const text = value.trim();
    if (required && !text) throw new BadRequestException(`${field} ist erforderlich.`);
    if (!text) return null;
    if (text.length > max) throw new BadRequestException(`${field} ist zu lang.`);
    return text;
  }

  private parseOccurredAt(value: unknown, required = true) {
    if (!value && !required) return undefined;
    const date = new Date(String(value || ''));
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Zeitpunkt ist ungültig.');
    return date;
  }

  private assertEnum(value: unknown, allowed: Set<string>, field: string) {
    if (typeof value !== 'string' || !allowed.has(value)) {
      throw new BadRequestException(`${field} ist ungültig.`);
    }
    return value;
  }

  private async validateReferences(input: EntryInput, orgId: string | null) {
    if (typeof input.activityId !== 'undefined' && input.activityId) {
      const activity = await this.activities.findOne({ where: { id: input.activityId } });
      if (!activity || !this.sameOrg(activity.orgId, orgId)) {
        throw new BadRequestException('Die verknüpfte Aktivität gehört nicht zur aktiven Organisation.');
      }
    }
    if (typeof input.projectId !== 'undefined' && input.projectId) {
      const project = await this.projects.findOne({ where: { id: input.projectId } });
      if (!project || !this.sameOrg(project.orgId, orgId)) {
        throw new BadRequestException('Das verknüpfte Projekt gehört nicht zur aktiven Organisation.');
      }
    }
  }

  private async getEntry(id: string, orgId: string | null, includeComments = false) {
    const query = this.entries
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.activity', 'activity')
      .leftJoinAndSelect('entry.project', 'project')
      .leftJoinAndSelect('entry.createdByUser', 'createdByUser')
      .where('entry.id = :id', { id })
      .andWhere(orgId === null ? 'entry.orgId IS NULL' : 'entry.orgId = :orgId', { orgId });
    if (includeComments) {
      query
        .leftJoinAndSelect('entry.comments', 'comment')
        .leftJoinAndSelect('comment.createdByUser', 'commentCreatedByUser')
        .orderBy('comment.createdAt', 'ASC');
    }
    const entry = await query.getOne();
    if (!entry) throw new NotFoundException('Logbucheintrag nicht gefunden.');
    return entry;
  }

  /** Only expose the author data that is needed to render an avatar. */
  private withPublicAuthors(entry: LogbookEntry) {
    const toPublicAuthor = (author: User | null) => author
      ? ({ id: author.id, avatarUrl: author.avatarUrl } as User)
      : null;
    entry.createdByUser = toPublicAuthor(entry.createdByUser);
    entry.comments?.forEach((comment) => {
      comment.createdByUser = toPublicAuthor(comment.createdByUser);
    });
    return entry;
  }

  private assertVisible(entry: LogbookEntry, user: RequestUser) {
    if (entry.visibility === LogbookVisibility.ADMINS && !this.isAdmin(user) && entry.createdByUserId !== user.id) {
      throw new ForbiddenException('Dieser Logbucheintrag ist nur für Admins sichtbar.');
    }
  }

  async list(
    orgId: string | null,
    user: RequestUser,
    filters: {
      search?: string;
      from?: string;
      to?: string;
      type?: string;
      status?: string;
      authorId?: string;
      activityId?: string;
      projectId?: string;
      includeArchived?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(filters.page || 1, 1);
    const limit = Math.min(Math.max(filters.limit || 30, 1), 100);
    const qb = this.entries
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.activity', 'activity')
      .leftJoinAndSelect('entry.project', 'project')
      .leftJoinAndSelect('entry.createdByUser', 'createdByUser')
      // The list uses joins and pagination, so TypeORM wraps it in SELECT DISTINCT.
      // Select the priority explicitly; ordering by a raw expression alone breaks the
      // outer DISTINCT query on PostgreSQL (and results in a 500 response).
      .addSelect(
        `CASE entry.status
          WHEN '${LogbookEntryStatus.OPEN}' THEN 0
          WHEN '${LogbookEntryStatus.FOLLOW_UP}' THEN 1
          WHEN '${LogbookEntryStatus.DISCUSSED}' THEN 2
          ELSE 3
        END`,
        'logbook_status_priority',
      )
      .orderBy('logbook_status_priority', 'ASC')
      .addOrderBy('entry.occurredAt', 'DESC')
      .addOrderBy('entry.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    qb.where(orgId === null ? 'entry.orgId IS NULL' : 'entry.orgId = :orgId', { orgId });
    if (!this.isAdmin(user)) {
      qb.andWhere(new Brackets((visibility) => {
        visibility.where('entry.visibility = :teamVisibility', { teamVisibility: LogbookVisibility.TEAM })
          .orWhere('entry.createdByUserId = :userId', { userId: user.id });
      }));
    }
    if (!filters.includeArchived) qb.andWhere('entry.status != :archived', { archived: LogbookEntryStatus.ARCHIVED });
    if (filters.search?.trim()) {
      qb.andWhere('(LOWER(entry.title) LIKE :search OR LOWER(entry.body) LIKE :search)', {
        search: `%${filters.search.trim().toLowerCase()}%`,
      });
    }
    if (filters.from) qb.andWhere('entry.occurredAt >= :from', { from: new Date(`${filters.from}T00:00:00`) });
    if (filters.to) qb.andWhere('entry.occurredAt <= :to', { to: new Date(`${filters.to}T23:59:59.999`) });
    if (filters.type && allowedTypes.has(filters.type)) qb.andWhere('entry.type = :type', { type: filters.type });
    if (filters.status && allowedStatuses.has(filters.status)) qb.andWhere('entry.status = :status', { status: filters.status });
    if (filters.authorId) qb.andWhere('entry.createdByUserId = :authorId', { authorId: filters.authorId });
    if (filters.activityId) qb.andWhere('entry.activityId = :activityId', { activityId: filters.activityId });
    if (filters.projectId) qb.andWhere('entry.projectId = :projectId', { projectId: filters.projectId });

    const [data, total] = await qb.getManyAndCount();
    return { data: data.map((entry) => this.withPublicAuthors(entry)), total, page, pageSize: limit };
  }

  async findOne(id: string, orgId: string | null, user: RequestUser) {
    const entry = await this.getEntry(id, orgId, true);
    this.assertVisible(entry, user);
    return this.withPublicAuthors(entry);
  }

  async create(input: EntryInput, orgId: string | null, user: RequestUser) {
    await this.validateReferences(input, orgId);
    const type = this.assertEnum(input.type || LogbookEntryType.OBSERVATION, allowedTypes, 'Eintragsart') as LogbookEntryType;
    const requestedVisibility = input.visibility || LogbookVisibility.TEAM;
    const visibility = this.isAdmin(user)
      ? (this.assertEnum(requestedVisibility, allowedVisibility, 'Sichtbarkeit') as LogbookVisibility)
      : LogbookVisibility.TEAM;
    const status = this.assertEnum(input.status || LogbookEntryStatus.OPEN, allowedStatuses, 'Status') as LogbookEntryStatus;
    const entry = this.entries.create({
      orgId,
      occurredAt: this.parseOccurredAt(input.occurredAt),
      type,
      title: this.cleanText(input.title, 180, 'Titel', true)!,
      body: this.cleanText(input.body, 12000, 'Beschreibung', true)!,
      highlights: this.cleanText(input.highlights, 6000, 'Erfolge'),
      challenges: this.cleanText(input.challenges, 6000, 'Herausforderungen'),
      nextSteps: this.cleanText(input.nextSteps, 6000, 'Nächste Schritte'),
      status,
      visibility,
      activityId: input.activityId || null,
      projectId: input.projectId || null,
      createdByUserId: user.id,
      createdByName: user.name?.trim() || 'Unbekannt',
      updatedByUserId: user.id,
      updatedByName: user.name?.trim() || 'Unbekannt',
    });
    if (status === LogbookEntryStatus.DISCUSSED) {
      entry.discussedAt = new Date();
      entry.discussedByUserId = user.id;
      entry.discussedByName = user.name?.trim() || 'Unbekannt';
    }
    const saved = await this.entries.save(entry);
    await this.audit.log({
      action: AuditAction.CREATE,
      entityType: 'logbook_entry',
      entityId: saved.id,
      entityTitle: saved.title,
      user,
      orgId,
      details: { type: saved.type, status: saved.status },
    });
    return this.findOne(saved.id, orgId, user);
  }

  async update(id: string, input: EntryInput, orgId: string | null, user: RequestUser) {
    const entry = await this.getEntry(id, orgId);
    this.assertVisible(entry, user);
    if (!this.canManage(entry, user)) throw new ForbiddenException('Nur eigene Einträge können bearbeitet werden.');
    if (entry.status === LogbookEntryStatus.ARCHIVED) throw new BadRequestException('Archivierte Einträge müssen zuerst wiederhergestellt werden.');
    await this.validateReferences(input, orgId);
    const changed: string[] = [];
    const setText = (key: 'title' | 'body' | 'highlights' | 'challenges' | 'nextSteps', label: string, max: number, required = false) => {
      if (typeof input[key] === 'undefined') return;
      const value = this.cleanText(input[key], max, label, required);
      if (entry[key] !== value) {
        (entry as unknown as Record<string, unknown>)[key] = value;
        changed.push(key);
      }
    };
    setText('title', 'Titel', 180, true);
    setText('body', 'Beschreibung', 12000, true);
    setText('highlights', 'Erfolge', 6000);
    setText('challenges', 'Herausforderungen', 6000);
    setText('nextSteps', 'Nächste Schritte', 6000);
    if (typeof input.occurredAt !== 'undefined') {
      const value = this.parseOccurredAt(input.occurredAt)!;
      if (entry.occurredAt.getTime() !== value.getTime()) { entry.occurredAt = value; changed.push('occurredAt'); }
    }
    if (typeof input.type !== 'undefined') {
      const type = this.assertEnum(input.type, allowedTypes, 'Eintragsart') as LogbookEntryType;
      if (entry.type !== type) { entry.type = type; changed.push('type'); }
    }
    if (typeof input.status !== 'undefined') {
      const status = this.assertEnum(input.status, allowedStatuses, 'Status') as LogbookEntryStatus;
      if (status !== LogbookEntryStatus.ARCHIVED && entry.status !== status) {
        entry.status = status;
        if (status === LogbookEntryStatus.DISCUSSED) {
          entry.discussedAt = new Date();
          entry.discussedByUserId = user.id;
          entry.discussedByName = user.name?.trim() || 'Unbekannt';
        } else {
          entry.discussedAt = null;
          entry.discussedByUserId = null;
          entry.discussedByName = null;
        }
        changed.push('status');
      }
    }
    if (typeof input.activityId !== 'undefined') {
      const activityId = input.activityId || null;
      if (entry.activityId !== activityId) { entry.activityId = activityId; changed.push('activityId'); }
    }
    if (typeof input.projectId !== 'undefined') {
      const projectId = input.projectId || null;
      if (entry.projectId !== projectId) { entry.projectId = projectId; changed.push('projectId'); }
    }
    if (typeof input.visibility !== 'undefined') {
      if (!this.isAdmin(user)) throw new ForbiddenException('Nur Admins können die Sichtbarkeit ändern.');
      const visibility = this.assertEnum(input.visibility, allowedVisibility, 'Sichtbarkeit') as LogbookVisibility;
      if (entry.visibility !== visibility) { entry.visibility = visibility; changed.push('visibility'); }
    }
    if (changed.length === 0) return this.findOne(id, orgId, user);
    const documentationChanged = changed.some((field) => field !== 'status');
    entry.updatedByUserId = user.id;
    entry.updatedByName = user.name?.trim() || 'Unbekannt';
    if (documentationChanged) {
      entry.documentationUpdatedByUserId = user.id;
      entry.documentationUpdatedByName = user.name?.trim() || 'Unbekannt';
      entry.documentationUpdatedAt = new Date();
    }
    const saved = await this.entries.save(entry);
    if (changed.length > 0) {
      await this.audit.log({ action: AuditAction.UPDATE, entityType: 'logbook_entry', entityId: id, entityTitle: saved.title, user, orgId, details: { fields: changed } });
    }
    return this.findOne(id, orgId, user);
  }

  async setStatus(id: string, statusInput: unknown, orgId: string | null, user: RequestUser) {
    const entry = await this.getEntry(id, orgId);
    this.assertVisible(entry, user);
    if (!this.canManage(entry, user)) throw new ForbiddenException('Nur eigene Einträge können aktualisiert werden.');
    const status = this.assertEnum(statusInput, allowedStatuses, 'Status') as LogbookEntryStatus;
    entry.status = status;
    if (status === LogbookEntryStatus.DISCUSSED) {
      entry.discussedAt = new Date();
      entry.discussedByUserId = user.id;
      entry.discussedByName = user.name?.trim() || 'Unbekannt';
    } else {
      entry.discussedAt = null;
      entry.discussedByUserId = null;
      entry.discussedByName = null;
    }
    entry.updatedByUserId = user.id;
    entry.updatedByName = user.name?.trim() || 'Unbekannt';
    const saved = await this.entries.save(entry);
    await this.audit.log({ action: AuditAction.UPDATE, entityType: 'logbook_entry', entityId: id, entityTitle: saved.title, user, orgId, details: { status } });
    return this.findOne(id, orgId, user);
  }

  async archive(id: string, orgId: string | null, user: RequestUser) {
    const entry = await this.getEntry(id, orgId);
    this.assertVisible(entry, user);
    if (!this.canManage(entry, user)) throw new ForbiddenException('Nur eigene Einträge können archiviert werden.');
    entry.status = LogbookEntryStatus.ARCHIVED;
    entry.archivedAt = new Date();
    entry.archivedByUserId = user.id;
    entry.updatedByUserId = user.id;
    entry.updatedByName = user.name?.trim() || 'Unbekannt';
    const saved = await this.entries.save(entry);
    await this.audit.log({ action: AuditAction.DELETE, entityType: 'logbook_entry', entityId: id, entityTitle: saved.title, user, orgId, details: { archived: true } });
    return { id, archived: true };
  }

  async createComment(id: string, body: unknown, orgId: string | null, user: RequestUser) {
    const entry = await this.getEntry(id, orgId);
    this.assertVisible(entry, user);
    if (entry.status === LogbookEntryStatus.ARCHIVED) throw new BadRequestException('Zu archivierten Einträgen können keine Kommentare erstellt werden.');
    const comment = await this.comments.save(this.comments.create({
      entryId: entry.id,
      orgId,
      body: this.cleanText(body, 4000, 'Kommentar', true)!,
      createdByUserId: user.id,
      createdByName: user.name?.trim() || 'Unbekannt',
    }));
    await this.audit.log({ action: AuditAction.CREATE, entityType: 'logbook_comment', entityId: comment.id, entityTitle: entry.title, user, orgId, details: { entryId: entry.id } });
    return comment;
  }

  async removeComment(id: string, commentId: string, orgId: string | null, user: RequestUser) {
    const entry = await this.getEntry(id, orgId);
    this.assertVisible(entry, user);
    const comment = await this.comments.findOne({ where: { id: commentId, entryId: entry.id } });
    if (!comment) throw new NotFoundException('Kommentar nicht gefunden.');
    if (!this.isAdmin(user) && comment.createdByUserId !== user.id) throw new ForbiddenException('Nur eigene Kommentare können gelöscht werden.');
    await this.comments.remove(comment);
    await this.audit.log({ action: AuditAction.DELETE, entityType: 'logbook_comment', entityId: commentId, entityTitle: entry.title, user, orgId, details: { entryId: entry.id } });
    return { id: commentId, deleted: true };
  }
}
