import { BadRequestException } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import type { Survey } from './entities/survey.entity';

const activeSurvey = (): Survey => ({
  id: 'survey-1',
  orgId: 'org-1',
  projectId: null,
  seriesId: 'survey-1',
  roundNumber: 1,
  title: 'Feedback',
  introduction: null,
  status: 'active',
  publicToken: 'public-token',
  allowMultiplePerDevice: false,
  expectedParticipants: null,
  startsAt: null,
  startedAt: null,
  endsAt: null,
  closedAt: null,
  rawResponsesPurgeAt: null,
  aggregateSnapshot: null,
  createdById: null,
  archived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  questions: [
    {
      id: 'q-choice',
      type: 'single_choice',
      label: 'Wie war es?',
      options: [
        { id: 'good', label: 'Gut' },
        { id: 'bad', label: 'Schlecht' },
      ],
    },
    { id: 'q-text', type: 'text', label: 'Kommentar' },
  ],
});

describe('SurveysService', () => {
  const surveyRepository = {
    findOneBy: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const responseRepository = {
    exists: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const projectRepository = { findBy: jest.fn() };
  const organizationRepository = { findOneBy: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new SurveysService(
    surveyRepository as any,
    responseRepository as any,
    projectRepository as any,
    organizationRepository as any,
    audit as any,
  );

  beforeEach(() => jest.clearAllMocks());

  const mockPurgeQuery = () => {
    const query = { where: jest.fn(), andWhere: jest.fn(), getMany: jest.fn() };
    query.where.mockReturnValue(query);
    query.andWhere.mockReturnValue(query);
    query.getMany.mockResolvedValue([]);
    surveyRepository.createQueryBuilder.mockReturnValue(query);
  };

  it('validates public answers and stores only the declared question fields', async () => {
    surveyRepository.findOneBy.mockResolvedValue(activeSurvey());
    responseRepository.exists.mockResolvedValue(false);
    responseRepository.create.mockImplementation((value: unknown) => value);
    responseRepository.save.mockResolvedValue({});

    await expect(
      service.submitPublic(
        'public-token',
        { 'q-choice': 'good', ignored: 'not stored' },
        'browser-token',
      ),
    ).resolves.toEqual({ ok: true });
    expect(responseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyId: 'survey-1',
        answers: { 'q-choice': 'good', 'q-text': null },
        deviceTokenHash: expect.any(String),
      }),
    );
  });

  it('rejects invalid choice values before storing a public response', async () => {
    surveyRepository.findOneBy.mockResolvedValue(activeSurvey());
    await expect(
      service.submitPublic('public-token', { 'q-choice': 'unknown' }, 'browser-token'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(responseRepository.save).not.toHaveBeenCalled();
  });

  it('keeps an active survey publicly available even when its displayed start time is in the future', () => {
    const survey = { ...activeSurvey(), startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000) };
    expect((service as any).isPubliclyOpen(survey)).toBe(true);
    expect((service as any).isPubliclyOpen({ ...survey, status: 'draft' })).toBe(false);
  });

  it('excludes free text from a permanent aggregate calculation', async () => {
    const survey = activeSurvey();
    responseRepository.find.mockResolvedValue([
      { answers: { 'q-choice': 'good', 'q-text': 'Mein Name ist nicht hier' } },
    ]);
    const result = await (service as any).buildAnalytics(survey, false);
    expect(result.questions.find((question: { id: string }) => question.id === 'q-text')).toEqual(
      expect.objectContaining({ answeredCount: 1 }),
    );
    expect(
      result.questions.find((question: { id: string }) => question.id === 'q-text'),
    ).not.toHaveProperty('texts');
  });

  it('creates a fresh, comparable draft for the next survey round', async () => {
    const closedRound = {
      ...activeSurvey(),
      status: 'closed' as const,
      closedAt: new Date(),
      seriesId: 'survey-1',
      roundNumber: 1,
    };
    surveyRepository.findOneBy.mockResolvedValue(closedRound);
    surveyRepository.find.mockResolvedValue([closedRound]);
    surveyRepository.create.mockImplementation((value: Record<string, unknown>) => ({
      ...value,
      id: 'survey-2',
    }));
    surveyRepository.save.mockImplementation((value: unknown) => value);
    responseRepository.count.mockResolvedValue(0);

    const result = await service.createRound('survey-1', {
      id: 'user-1',
      role: 'user',
      orgId: 'org-1',
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'survey-2',
        seriesId: 'survey-1',
        roundNumber: 2,
        status: 'draft',
      }),
    );
    expect(surveyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        publicToken: expect.any(String),
        questions: closedRound.questions,
        startsAt: null,
        startedAt: null,
        closedAt: null,
      }),
    );
  });

  it('lists draft rounds while excluding them from the trend', async () => {
    const closedRound = {
      ...activeSurvey(),
      status: 'closed' as const,
      aggregateSnapshot: { responsesCount: 2, responseRate: 20, questions: [] },
      roundNumber: 1,
    };
    const draftRound = {
      ...activeSurvey(),
      id: 'survey-2',
      status: 'draft' as const,
      aggregateSnapshot: null,
      roundNumber: 2,
    };
    mockPurgeQuery();
    surveyRepository.findOneBy.mockResolvedValue(closedRound);
    surveyRepository.find.mockResolvedValue([closedRound, draftRound]);
    responseRepository.count.mockResolvedValue(0);

    const rounds = await service.listRounds('survey-1', {
      id: 'user-1',
      role: 'user',
      orgId: 'org-1',
    });
    const trend = await service.trend('survey-1', { id: 'user-1', role: 'user', orgId: 'org-1' });

    expect(rounds).toHaveLength(2);
    expect(rounds[1]).toEqual(expect.objectContaining({ id: 'survey-2', status: 'draft' }));
    expect(trend.rounds).toHaveLength(1);
    expect(trend.rounds[0]).toEqual(expect.objectContaining({ id: 'survey-1', status: 'closed' }));
  });

  it('keeps the audit payload intact when deleting a draft round', async () => {
    const seed = { ...activeSurvey(), status: 'closed' as const };
    const draftRound = {
      ...activeSurvey(),
      id: 'survey-5',
      seriesId: 'survey-1',
      roundNumber: 5,
      status: 'draft' as const,
    };
    surveyRepository.findOneBy.mockResolvedValueOnce(seed).mockResolvedValueOnce(draftRound);
    surveyRepository.find.mockResolvedValue([seed]);
    responseRepository.count.mockResolvedValue(0);
    surveyRepository.remove.mockImplementation(async (entry: Survey) => {
      (entry as Partial<Survey>).id = undefined as never;
    });

    await expect(
      service.deleteRound('survey-1', 'survey-5', {
        id: 'user-1',
        role: 'user',
        orgId: 'org-1',
      }),
    ).resolves.toEqual({ id: 'survey-5' });

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'survey-5', entityTitle: 'Feedback' }),
    );
  });

  it('closes the numbering gap after deleting a draft round', async () => {
    const seed = { ...activeSurvey(), status: 'closed' as const, roundNumber: 1 };
    const deletedRound = {
      ...activeSurvey(),
      id: 'survey-3',
      seriesId: 'survey-1',
      roundNumber: 3,
      status: 'draft' as const,
    };
    const followingRound = {
      ...activeSurvey(),
      id: 'survey-4',
      seriesId: 'survey-1',
      roundNumber: 4,
      status: 'draft' as const,
    };
    surveyRepository.findOneBy.mockResolvedValueOnce(seed).mockResolvedValueOnce(deletedRound);
    surveyRepository.find.mockResolvedValue([seed, followingRound]);
    surveyRepository.remove.mockResolvedValue(deletedRound);
    surveyRepository.save.mockImplementation(async (entry: Survey) => entry);
    responseRepository.count.mockResolvedValue(0);

    await service.deleteRound('survey-1', 'survey-3', {
      id: 'user-1',
      role: 'user',
      orgId: 'org-1',
    });

    expect(followingRound.roundNumber).toBe(3);
    expect(surveyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'survey-4', roundNumber: 3 }),
    );
  });

  it('returns at most three active dashboard rounds ordered by urgency and latest response', async () => {
    const surveyQuery = {
      where: jest.fn(),
      andWhere: jest.fn(),
      getMany: jest.fn(),
    };
    surveyQuery.where.mockReturnValue(surveyQuery);
    surveyQuery.andWhere.mockReturnValue(surveyQuery);
    const base = activeSurvey();
    surveyQuery.getMany.mockResolvedValue([
      { ...base, id: 'round-no-end', seriesId: 'series-4', roundNumber: 2, endsAt: null },
      { ...base, id: 'round-later', seriesId: 'series-2', endsAt: new Date('2026-08-20T10:00:00Z') },
      { ...base, id: 'round-first', seriesId: 'series-1', roundNumber: 3, projectId: 'project-1', expectedParticipants: 20, endsAt: new Date('2026-08-10T10:00:00Z') },
      { ...base, id: 'round-tied', seriesId: 'series-3', endsAt: new Date('2026-08-20T10:00:00Z') },
    ]);
    surveyRepository.createQueryBuilder.mockReturnValue(surveyQuery);

    const responseQuery = {
      select: jest.fn(),
      addSelect: jest.fn(),
      where: jest.fn(),
      setParameters: jest.fn(),
      groupBy: jest.fn(),
      getRawMany: jest.fn(),
    };
    responseQuery.select.mockReturnValue(responseQuery);
    responseQuery.addSelect.mockReturnValue(responseQuery);
    responseQuery.where.mockReturnValue(responseQuery);
    responseQuery.setParameters.mockReturnValue(responseQuery);
    responseQuery.groupBy.mockReturnValue(responseQuery);
    responseQuery.getRawMany.mockResolvedValue([
      { surveyId: 'round-first', responsesCount: '25', responsesToday: '2', responsesLast7Days: '9', lastResponseAt: '2026-08-09T08:00:00Z' },
      { surveyId: 'round-later', responsesCount: '4', responsesToday: '1', responsesLast7Days: '4', lastResponseAt: '2026-08-08T08:00:00Z' },
      { surveyId: 'round-tied', responsesCount: '3', responsesToday: '0', responsesLast7Days: '2', lastResponseAt: '2026-08-09T09:00:00Z' },
    ]);
    responseRepository.createQueryBuilder.mockReturnValue(responseQuery);
    projectRepository.findBy.mockResolvedValue([{ id: 'project-1', title: 'Offener Treff', orgId: 'org-1' }]);

    const result = await service.activeDashboard('org-1');

    expect(surveyQuery.where).toHaveBeenCalledWith('survey.status = :status', { status: 'active' });
    expect(surveyQuery.andWhere).toHaveBeenCalledWith('survey.archived = :archived', { archived: false });
    expect(surveyQuery.andWhere).toHaveBeenCalledWith('survey.orgId = :orgId', { orgId: 'org-1' });
    expect(result.map((survey) => survey.id)).toEqual(['round-first', 'round-tied', 'round-later']);
    expect(result[0]).toEqual(expect.objectContaining({
      id: 'round-first',
      roundNumber: 3,
      projectTitle: 'Offener Treff',
      responsesCount: 25,
      responsesToday: 2,
      responsesLast7Days: 9,
      responseRate: 125,
    }));
  });

  it('uses local calendar boundaries and preserves empty dashboard values', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-09T12:34:56+02:00'));
    try {
      const surveyQuery = { where: jest.fn(), andWhere: jest.fn(), getMany: jest.fn() };
      surveyQuery.where.mockReturnValue(surveyQuery);
      surveyQuery.andWhere.mockReturnValue(surveyQuery);
      surveyQuery.getMany.mockResolvedValue([{ ...activeSurvey(), id: 'empty-round', orgId: null }]);
      surveyRepository.createQueryBuilder.mockReturnValue(surveyQuery);

      const responseQuery = {
        select: jest.fn(), addSelect: jest.fn(), where: jest.fn(), setParameters: jest.fn(),
        groupBy: jest.fn(), getRawMany: jest.fn(),
      };
      responseQuery.select.mockReturnValue(responseQuery);
      responseQuery.addSelect.mockReturnValue(responseQuery);
      responseQuery.where.mockReturnValue(responseQuery);
      responseQuery.setParameters.mockReturnValue(responseQuery);
      responseQuery.groupBy.mockReturnValue(responseQuery);
      responseQuery.getRawMany.mockResolvedValue([]);
      responseRepository.createQueryBuilder.mockReturnValue(responseQuery);

      const result = await service.activeDashboard(null);

      expect(surveyQuery.andWhere).toHaveBeenCalledWith('survey.orgId IS NULL');
      const parameters = responseQuery.setParameters.mock.calls[0][0] as {
        todayStart: Date;
        sevenDayStart: Date;
      };
      expect(parameters.todayStart.getHours()).toBe(0);
      expect(parameters.todayStart.getMinutes()).toBe(0);
      expect(parameters.sevenDayStart.getDate()).toBe(parameters.todayStart.getDate() - 6);
      expect(result[0]).toEqual(expect.objectContaining({
        responsesCount: 0,
        responseRate: null,
        lastResponseAt: null,
        projectTitle: null,
        endsAt: null,
      }));
    } finally {
      jest.useRealTimers();
    }
  });
});
