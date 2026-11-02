import { ActivityExecutionStatus as Status } from '../common/enums';
import { activityToday, validateActivityPlanning } from './activity-planning';
import { ActivitiesService } from './activities.service';
import { Activity } from './entities/activity.entity';

describe('activity planning rules', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  it('uses the Berlin calendar date, including the UTC midnight boundary', () => {
    expect(activityToday(new Date('2026-11-01T23:30:00Z'))).toBe('2026-11-02');
    expect(activityToday(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02');
  });
  it('defaults future dates to planned and rejects premature completion', () => {
    const future = { date: '2026-11-03', executionStatus: undefined as Status | undefined };
    validateActivityPlanning(future, undefined, now);
    expect(future.executionStatus).toBe(Status.PLANNED);
    expect(() => validateActivityPlanning({ ...future, executionStatus: Status.COMPLETED }, undefined, now)).toThrow('Zukünftige');
  });
  it.each([
    { countMale: 1 }, { countFemale: 1 }, { countDiverse: 1 }, { countTotal: 1 },
    { cohorts: [{ m: 1 }] }, { cohorts: [{ w: 1 }] }, { cohorts: [{ d: 1 }] }, { cohorts: [{ count: 1 }] },
  ])('rejects actual visitor counts on a plan: %j', (counts) => {
    expect(() => validateActivityPlanning({ date: '2026-11-03', executionStatus: Status.PLANNED, ...counts }, undefined, now)).toThrow('Besucherzahlen');
  });
  it('keeps overdue plans pending and allows documenting or cancelling them', () => {
    const plan = { date: '2026-11-01', executionStatus: Status.PLANNED };
    validateActivityPlanning(plan, Status.PLANNED, now);
    expect(plan.executionStatus).toBe(Status.PLANNED);
    expect(() => validateActivityPlanning({ ...plan, executionStatus: Status.COMPLETED, countFemale: 8 }, Status.PLANNED, now)).not.toThrow();
    expect(() => validateActivityPlanning({ ...plan, executionStatus: Status.CANCELLED }, Status.PLANNED, now)).not.toThrow();
    expect(() => validateActivityPlanning(plan, undefined, now)).toThrow('zukünftiges Datum');
  });
});

describe('planning through activity writes', () => {
  let record: Partial<Activity>;
  const repo = {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(async (data) => { record = { ...data }; return record; }),
    findOne: jest.fn(async () => ({ ...record })),
    update: jest.fn(async () => ({ affected: 1 })),
    manager: { transaction: jest.fn() },
  };
  const service = new ActivitiesService(repo as never, {} as never, {} as never,
    { findBy: jest.fn(async () => []) } as never, {} as never, {} as never, {} as never,
    { assertTaxonomyIdsVisibleForOrg: jest.fn() } as never, { log: jest.fn() } as never);
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-02T12:00:00Z'));
    jest.clearAllMocks();
    record = { id: 'a1', version: 1, date: new Date('2026-11-01'), executionStatus: Status.PLANNED, countTotal: 0, countMale: 0, countFemale: 0, countDiverse: 0, cohorts: [] };
    repo.manager.transaction.mockImplementation(async (operation) => operation({ getRepository: () => repo }));
  });
  afterEach(() => jest.useRealTimers());
  it('persists an implicit plan for a new future date', async () => {
    const created = await service.create({ date: new Date('2026-11-03') });
    expect(created.executionStatus).toBe(Status.PLANNED);
  });
  it('rejects counts on partial updates without losing the saved plan', async () => {
    await expect(service.update('a1', { countMale: 4 })).rejects.toThrow('Besucherzahlen');
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('keeps an overdue plan planned on a notes-only edit', async () => {
    const updated = await service.update('a1', { notes: 'Still to document' });
    expect(updated?.executionStatus).toBe(Status.PLANNED);
  });
  it('documents the same record with real cohorts and totals', async () => {
    const updated = await service.update('a1', { executionStatus: Status.COMPLETED, cohorts: [{ cohortId: 'young', m: 2, w: 5, d: 1 }] });
    expect(updated).toMatchObject({ id: 'a1', executionStatus: Status.COMPLETED, countTotal: 8, version: 2 });
  });
});
