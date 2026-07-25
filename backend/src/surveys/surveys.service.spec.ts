import { BadRequestException } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import type { Survey } from './entities/survey.entity';

const activeSurvey = (): Survey => ({
  id: 'survey-1', orgId: 'org-1', projectId: null, title: 'Feedback', introduction: null,
  status: 'active', publicToken: 'public-token', allowMultiplePerDevice: false, expectedParticipants: null,
  startsAt: null, endsAt: null, closedAt: null, rawResponsesPurgeAt: null, aggregateSnapshot: null,
  createdById: null, archived: false, createdAt: new Date(), updatedAt: new Date(),
  questions: [
    { id: 'q-choice', type: 'single_choice', label: 'Wie war es?', options: [{ id: 'good', label: 'Gut' }, { id: 'bad', label: 'Schlecht' }] },
    { id: 'q-text', type: 'text', label: 'Kommentar' },
  ],
});

describe('SurveysService', () => {
  const surveyRepository = { findOneBy: jest.fn(), find: jest.fn(), count: jest.fn(), create: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() };
  const responseRepository = { exist: jest.fn(), create: jest.fn(), save: jest.fn(), find: jest.fn(), count: jest.fn(), delete: jest.fn(), remove: jest.fn(), findOneBy: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new SurveysService(surveyRepository as any, responseRepository as any, audit as any);

  beforeEach(() => jest.clearAllMocks());

  it('validates public answers and stores only the declared question fields', async () => {
    surveyRepository.findOneBy.mockResolvedValue(activeSurvey());
    responseRepository.exist.mockResolvedValue(false);
    responseRepository.create.mockImplementation((value: unknown) => value);
    responseRepository.save.mockResolvedValue({});

    await expect(service.submitPublic('public-token', { 'q-choice': 'good', ignored: 'not stored' }, 'browser-token')).resolves.toEqual({ ok: true });
    expect(responseRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      surveyId: 'survey-1',
      answers: { 'q-choice': 'good', 'q-text': null },
      deviceTokenHash: expect.any(String),
    }));
  });

  it('rejects invalid choice values before storing a public response', async () => {
    surveyRepository.findOneBy.mockResolvedValue(activeSurvey());
    await expect(service.submitPublic('public-token', { 'q-choice': 'unknown' }, 'browser-token')).rejects.toBeInstanceOf(BadRequestException);
    expect(responseRepository.save).not.toHaveBeenCalled();
  });

  it('excludes free text from a permanent aggregate calculation', async () => {
    const survey = activeSurvey();
    responseRepository.find.mockResolvedValue([{ answers: { 'q-choice': 'good', 'q-text': 'Mein Name ist nicht hier' } }]);
    const result = await (service as any).buildAnalytics(survey, false);
    expect(result.questions.find((question: { id: string }) => question.id === 'q-text')).toEqual(expect.objectContaining({ answeredCount: 1 }));
    expect(result.questions.find((question: { id: string }) => question.id === 'q-text')).not.toHaveProperty('texts');
  });
});
