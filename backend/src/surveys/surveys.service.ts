import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Survey, type SurveyQuestion, type SurveyStatus } from './entities/survey.entity';
import { SurveyResponse } from './entities/survey-response.entity';
import { AuditService } from '../common/audit.service';
import { AuditAction } from '../common/enums';
import { assertExactOrgScopedEntityAccess, type OrgScopedUser } from '../auth/org-scope-access';
import type { CreateSurveyDto, UpdateSurveyDto } from './dto/survey.dto';

type SurveyActor = OrgScopedUser & { id?: string; name?: string | null };
type AnswerValue = string | string[] | number | null;

@Injectable()
export class SurveysService implements OnModuleInit, OnModuleDestroy {
  private purgeTimer?: NodeJS.Timeout;
  constructor(
    @InjectRepository(Survey) private readonly surveys: Repository<Survey>,
    @InjectRepository(SurveyResponse) private readonly responses: Repository<SurveyResponse>,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    void this.purgeExpiredRawResponses();
    this.purgeTimer = setInterval(() => void this.purgeExpiredRawResponses(), 60 * 60 * 1000);
    this.purgeTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
  }

  private token() {
    return randomBytes(32).toString('base64url');
  }

  private normalizeQuestions(input?: SurveyQuestion[] | null): SurveyQuestion[] {
    const questions = Array.isArray(input) ? input : [];
    const ids = new Set<string>();
    for (const question of questions) {
      if (!question?.id || ids.has(question.id)) throw new BadRequestException('Fragen benötigen eindeutige Kennungen.');
      ids.add(question.id);
      if (!question.label?.trim()) throw new BadRequestException('Jede Frage benötigt einen Text.');
      if (question.type === 'text') continue;
      if (question.type === 'scale') {
        const min = Number(question.scaleMin ?? 1);
        const max = Number(question.scaleMax ?? 5);
        if (!Number.isInteger(min) || !Number.isInteger(max) || min >= max) {
          throw new BadRequestException('Bewertungsskalen benötigen einen gültigen Wertebereich.');
        }
        continue;
      }
      const options = Array.isArray(question.options) ? question.options : [];
      if (options.length < 2 || new Set(options.map((option) => option.id)).size !== options.length) {
        throw new BadRequestException('Auswahlfragen benötigen mindestens zwei eindeutige Antworten.');
      }
    }
    return questions.map((question) => ({ ...question, label: question.label.trim() }));
  }

  private date(value?: string | Date | null): Date | null {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Ungültiges Datum.');
    return parsed;
  }

  private async countResponses(surveyId: string) {
    return this.responses.count({ where: { surveyId } });
  }

  private async staffDto(survey: Survey) {
    const responsesCount = survey.aggregateSnapshot
      ? Number(survey.aggregateSnapshot.responsesCount || 0)
      : await this.countResponses(survey.id);
    return {
      ...survey,
      responsesCount,
      rawResponsesAvailable: !survey.aggregateSnapshot,
    };
  }

  async purgeExpiredRawResponses() {
    const expired = await this.surveys
      .createQueryBuilder('survey')
      .where('survey.rawResponsesPurgeAt IS NOT NULL')
      .andWhere('survey.rawResponsesPurgeAt <= :now', { now: new Date() })
      .andWhere('survey.aggregateSnapshot IS NULL')
      .getMany();
    for (const survey of expired) {
      const liveAnalytics = await this.buildAnalytics(survey, false);
      const snapshot = liveAnalytics.responsesCount >= 5
        ? liveAnalytics
        : { responsesCount: liveAnalytics.responsesCount, expectedParticipants: survey.expectedParticipants, responseRate: liveAnalytics.responseRate, questions: [], suppressed: true, generatedAt: new Date().toISOString() };
      survey.aggregateSnapshot = snapshot;
      await this.surveys.save(survey);
      await this.responses.delete({ surveyId: survey.id });
      await this.audit.log({
        action: AuditAction.PURGE,
        entityType: 'survey_responses',
        entityId: survey.id,
        entityTitle: survey.title,
        orgId: survey.orgId,
        details: { responsesCount: snapshot.responsesCount, reason: '30-day retention reached' },
      });
    }
  }

  async findAll(orgId: string | null, search?: string, archived?: boolean) {
    await this.purgeExpiredRawResponses();
    const qb = this.surveys.createQueryBuilder('survey').where('survey.orgId IS NOT DISTINCT FROM :orgId', { orgId });
    if (typeof archived === 'boolean') qb.andWhere('survey.archived = :archived', { archived });
    if (search?.trim()) qb.andWhere('LOWER(survey.title) LIKE :search', { search: `%${search.trim().toLowerCase()}%` });
    qb.orderBy('survey.updatedAt', 'DESC');
    const rows = await qb.getMany();
    return Promise.all(rows.map((survey) => this.staffDto(survey)));
  }

  async hasArchived(orgId: string | null) {
    const qb = this.surveys.createQueryBuilder('survey').where('survey.archived = :archived', { archived: true });
    if (orgId === null) qb.andWhere('survey.orgId IS NULL');
    else qb.andWhere('survey.orgId = :orgId', { orgId });
    return (await qb.getCount()) > 0;
  }

  async findOneScoped(id: string, user: SurveyActor) {
    await this.purgeExpiredRawResponses();
    const survey = await this.surveys.findOneBy({ id });
    if (!survey) throw new NotFoundException('Umfrage nicht gefunden.');
    assertExactOrgScopedEntityAccess(survey, user);
    return this.staffDto(survey);
  }

  async create(data: CreateSurveyDto, orgId: string | null, user: SurveyActor) {
    const startsAt = this.date(data.startsAt);
    const endsAt = this.date(data.endsAt);
    if (startsAt && endsAt && startsAt > endsAt) throw new BadRequestException('Das Enddatum liegt vor dem Startdatum.');
    const survey = this.surveys.create({
      title: data.title.trim(),
      introduction: data.introduction?.trim() || null,
      projectId: data.projectId || null,
      orgId,
      questions: this.normalizeQuestions(data.questions as SurveyQuestion[] | undefined),
      allowMultiplePerDevice: !!data.allowMultiplePerDevice,
      expectedParticipants: data.expectedParticipants ?? null,
      startsAt,
      endsAt,
      publicToken: this.token(),
      createdById: user.id || null,
      status: 'draft',
      archived: false,
    });
    const saved = await this.surveys.save(survey);
    await this.audit.log({ action: AuditAction.CREATE, entityType: 'survey', entityId: saved.id, entityTitle: saved.title, orgId, user });
    return this.staffDto(saved);
  }

  async update(id: string, data: UpdateSurveyDto, user: SurveyActor) {
    const survey = await this.surveys.findOneBy({ id });
    if (!survey) throw new NotFoundException('Umfrage nicht gefunden.');
    assertExactOrgScopedEntityAccess(survey, user);
    if (survey.status !== 'draft' && typeof data.questions !== 'undefined') {
      throw new BadRequestException('Fragen können nach dem Start nicht mehr verändert werden.');
    }
    const startsAt = typeof data.startsAt !== 'undefined' ? this.date(data.startsAt) : survey.startsAt;
    const endsAt = typeof data.endsAt !== 'undefined' ? this.date(data.endsAt) : survey.endsAt;
    if (startsAt && endsAt && startsAt > endsAt) throw new BadRequestException('Das Enddatum liegt vor dem Startdatum.');
    if (typeof data.title !== 'undefined') survey.title = data.title.trim();
    if (typeof data.introduction !== 'undefined') survey.introduction = data.introduction?.trim() || null;
    if (typeof data.projectId !== 'undefined') survey.projectId = data.projectId || null;
    if (typeof data.questions !== 'undefined') survey.questions = this.normalizeQuestions(data.questions as SurveyQuestion[]);
    if (typeof data.allowMultiplePerDevice !== 'undefined') survey.allowMultiplePerDevice = data.allowMultiplePerDevice;
    if (typeof data.expectedParticipants !== 'undefined') survey.expectedParticipants = data.expectedParticipants ?? null;
    survey.startsAt = startsAt;
    survey.endsAt = endsAt;
    if (typeof data.archived === 'boolean') {
      if (data.archived && survey.status === 'active') {
        throw new BadRequestException('Beende die laufende Umfrage, bevor du sie archivierst.');
      }
      survey.archived = data.archived;
      if (data.archived) survey.status = 'archived';
      else if (survey.status === 'archived') survey.status = survey.closedAt ? 'closed' : 'draft';
    }
    const saved = await this.surveys.save(survey);
    await this.audit.log({ action: AuditAction.UPDATE, entityType: 'survey', entityId: saved.id, entityTitle: saved.title, orgId: saved.orgId, user });
    return this.staffDto(saved);
  }

  async start(id: string, user: SurveyActor) {
    const survey = await this.surveys.findOneBy({ id });
    if (!survey) throw new NotFoundException('Umfrage nicht gefunden.');
    assertExactOrgScopedEntityAccess(survey, user);
    if (!survey.questions?.length) throw new BadRequestException('Eine Umfrage benötigt mindestens eine Frage.');
    if (survey.status === 'closed' || survey.status === 'archived') throw new BadRequestException('Diese Umfrage kann nicht gestartet werden.');
    survey.status = 'active';
    survey.archived = false;
    if (!survey.startsAt) survey.startsAt = new Date();
    const saved = await this.surveys.save(survey);
    await this.audit.log({ action: AuditAction.UPDATE, entityType: 'survey', entityId: saved.id, entityTitle: saved.title, orgId: saved.orgId, user, details: { status: 'active' } });
    return this.staffDto(saved);
  }

  async close(id: string, user: SurveyActor) {
    const survey = await this.surveys.findOneBy({ id });
    if (!survey) throw new NotFoundException('Umfrage nicht gefunden.');
    assertExactOrgScopedEntityAccess(survey, user);
    if (survey.status !== 'active') throw new BadRequestException('Nur aktive Umfragen können beendet werden.');
    const now = new Date();
    survey.status = 'closed';
    survey.closedAt = now;
    survey.rawResponsesPurgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const saved = await this.surveys.save(survey);
    await this.audit.log({ action: AuditAction.UPDATE, entityType: 'survey', entityId: saved.id, entityTitle: saved.title, orgId: saved.orgId, user, details: { status: 'closed', rawResponsesPurgeAt: saved.rawResponsesPurgeAt?.toISOString() || null } });
    return this.staffDto(saved);
  }

  private isPubliclyOpen(survey: Survey) {
    const now = new Date();
    return survey.status === 'active' && (!survey.startsAt || survey.startsAt <= now) && (!survey.endsAt || survey.endsAt >= now);
  }

  async findPublic(token: string) {
    await this.purgeExpiredRawResponses();
    const survey = await this.surveys.findOneBy({ publicToken: token });
    if (!survey || !this.isPubliclyOpen(survey)) throw new NotFoundException('Diese Umfrage ist nicht aktiv.');
    return {
      title: survey.title,
      introduction: survey.introduction,
      questions: survey.questions || [],
      allowMultiplePerDevice: survey.allowMultiplePerDevice,
    };
  }

  private validateAnswers(survey: Survey, answers: Record<string, AnswerValue> | undefined) {
    const output: Record<string, AnswerValue> = {};
    const source = answers && typeof answers === 'object' ? answers : {};
    for (const question of survey.questions || []) {
      const value = source[question.id];
      const blank = value === null || typeof value === 'undefined' || value === '' || (Array.isArray(value) && value.length === 0);
      if (question.required && blank) throw new BadRequestException(`Bitte beantworte: ${question.label}`);
      if (blank) { output[question.id] = null; continue; }
      if (question.type === 'text') {
        if (typeof value !== 'string' || value.trim().length > 2000) throw new BadRequestException('Ungültige Textantwort.');
        output[question.id] = value.trim();
      } else if (question.type === 'scale') {
        const number = Number(value);
        const min = question.scaleMin ?? 1; const max = question.scaleMax ?? 5;
        if (!Number.isInteger(number) || number < min || number > max) throw new BadRequestException('Ungültige Skalenantwort.');
        output[question.id] = number;
      } else {
        const allowed = new Set((question.options || []).map((option) => option.id));
        const values = question.type === 'multiple_choice' ? value : [value];
        if (!Array.isArray(values) || values.some((entry) => typeof entry !== 'string' || !allowed.has(entry))) throw new BadRequestException('Ungültige Auswahlantwort.');
        output[question.id] = question.type === 'multiple_choice' ? Array.from(new Set(values as string[])) : values[0] as string;
      }
    }
    return output;
  }

  async submitPublic(token: string, answers: Record<string, AnswerValue> | undefined, deviceToken?: string) {
    const survey = await this.surveys.findOneBy({ publicToken: token });
    if (!survey || !this.isPubliclyOpen(survey)) throw new NotFoundException('Diese Umfrage ist nicht aktiv.');
    const validated = this.validateAnswers(survey, answers);
    const deviceTokenHash = survey.allowMultiplePerDevice ? null : (deviceToken ? createHash('sha256').update(deviceToken).digest('hex') : null);
    if (!survey.allowMultiplePerDevice && !deviceTokenHash) throw new BadRequestException('Die Teilnahme konnte nicht gesichert werden.');
    if (deviceTokenHash && await this.responses.exist({ where: { surveyId: survey.id, deviceTokenHash } })) {
      throw new ConflictException('Von diesem Gerät wurde bereits teilgenommen.');
    }
    try {
      await this.responses.save(this.responses.create({ surveyId: survey.id, deviceTokenHash, answers: validated }));
    } catch (error: unknown) {
      if (String((error as { code?: string })?.code || '').includes('23505')) throw new ConflictException('Von diesem Gerät wurde bereits teilgenommen.');
      throw error;
    }
    return { ok: true };
  }

  async listResponses(id: string, user: SurveyActor) {
    const survey = await this.surveys.findOneBy({ id });
    if (!survey) throw new NotFoundException('Umfrage nicht gefunden.');
    assertExactOrgScopedEntityAccess(survey, user);
    if (survey.aggregateSnapshot) return { rawResponsesAvailable: false, responses: [] };
    const responses = await this.responses.find({ where: { surveyId: id }, order: { submittedAt: 'DESC' } });
    return { rawResponsesAvailable: true, responses: responses.map((response, index) => ({ ...response, number: responses.length - index })) };
  }

  async deleteResponse(surveyId: string, responseId: string, reason: string, user: SurveyActor) {
    const survey = await this.surveys.findOneBy({ id: surveyId });
    if (!survey) throw new NotFoundException('Umfrage nicht gefunden.');
    assertExactOrgScopedEntityAccess(survey, user);
    if (survey.aggregateSnapshot) throw new BadRequestException('Einzelantworten wurden bereits anonymisiert gelöscht.');
    const response = await this.responses.findOneBy({ id: responseId, surveyId });
    if (!response) throw new NotFoundException('Antwort nicht gefunden.');
    await this.responses.remove(response);
    await this.audit.log({ action: AuditAction.DELETE, entityType: 'survey_response', entityId: responseId, entityTitle: survey.title, orgId: survey.orgId, user, details: { surveyId, reason: reason.trim() } });
    return { ok: true };
  }

  private async buildAnalytics(survey: Survey, includeTexts = true) {
    const responses = await this.responses.find({ where: { surveyId: survey.id }, order: { submittedAt: 'ASC' } });
    const questions = (survey.questions || []).map((question) => {
      const answered = responses.map((response) => response.answers?.[question.id]).filter((value) => value !== null && typeof value !== 'undefined' && value !== '');
      if (question.type === 'text') {
        return { id: question.id, type: question.type, label: question.label, answeredCount: answered.length, ...(includeTexts ? { texts: answered.filter((value): value is string => typeof value === 'string') } : {}) };
      }
      const counts: Record<string, number> = {};
      if (question.type === 'scale') {
        for (let value = question.scaleMin ?? 1; value <= (question.scaleMax ?? 5); value += 1) counts[String(value)] = 0;
        for (const value of answered) counts[String(value)] = (counts[String(value)] || 0) + 1;
        const numbers = answered.filter((value): value is number => typeof value === 'number').sort((a, b) => a - b);
        const median = numbers.length ? numbers[Math.floor((numbers.length - 1) / 2)] : null;
        return { id: question.id, type: question.type, label: question.label, answeredCount: answered.length, counts, median };
      }
      for (const option of question.options || []) counts[option.id] = 0;
      for (const value of answered) {
        const values = Array.isArray(value) ? value : [value];
        for (const entry of values) if (typeof entry === 'string') counts[entry] = (counts[entry] || 0) + 1;
      }
      return { id: question.id, type: question.type, label: question.label, answeredCount: answered.length, counts };
    });
    const expectedParticipants = survey.expectedParticipants || null;
    return {
      responsesCount: responses.length,
      expectedParticipants,
      responseRate: expectedParticipants ? Math.round((responses.length / expectedParticipants) * 1000) / 10 : null,
      questions,
      generatedAt: new Date().toISOString(),
    };
  }

  async analytics(id: string, user: SurveyActor) {
    await this.purgeExpiredRawResponses();
    const survey = await this.surveys.findOneBy({ id });
    if (!survey) throw new NotFoundException('Umfrage nicht gefunden.');
    assertExactOrgScopedEntityAccess(survey, user);
    return survey.aggregateSnapshot || this.buildAnalytics(survey);
  }
}
