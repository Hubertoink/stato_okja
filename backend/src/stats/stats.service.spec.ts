import { StatsService } from './stats.service';
import { ActivityExecutionStatus, ActivityType } from '../common/enums';

describe('StatsService date normalization', () => {
  const createQueryBuilder = (rows: Array<{ date: string | Date; totalParticipants?: string; activityCount?: string }>) => ({
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  });

  const createService = (rows: Array<{ date: string | Date; totalParticipants?: string; activityCount?: string }>) => {
    const qb = createQueryBuilder(rows);
    const activityRepository = {
      createQueryBuilder: jest.fn(() => qb),
    };
    const dataSource = {
      options: { type: 'postgres' },
    };

    const service = new StatsService(
      dataSource as never,
      activityRepository as never,
      {} as never,
      { getClosedDatesForOrganizations: jest.fn(async () => []) } as never,
    );

    return { service, qb };
  };

  it('keeps calendar dates stable for timeseries rows represented as Date objects', async () => {
    const previousTz = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';

    try {
      const { service } = createService([
        {
          date: new Date('2026-02-09T00:00:00+01:00'),
          totalParticipants: '18',
          activityCount: '1',
        },
      ]);

      const result = await service.getParticipantsTimeseries();
      expect(result).toEqual([
        {
          date: '2026-02-09',
          totalParticipants: 18,
          activityCount: 1,
        },
      ]);
    } finally {
      if (typeof previousTz === 'undefined') delete process.env.TZ;
      else process.env.TZ = previousTz;
    }
  });

  it('keeps available years stable for date-only rows represented as Date objects', async () => {
    const previousTz = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';

    try {
      const { service } = createService([
        { date: new Date('2026-01-01T00:00:00+01:00') },
        { date: new Date('2025-12-31T00:00:00+01:00') },
      ]);

      await expect(service.getAvailableYears()).resolves.toEqual(['2026', '2025']);
    } finally {
      if (typeof previousTz === 'undefined') delete process.env.TZ;
      else process.env.TZ = previousTz;
    }
  });
});

describe('StatsService category buckets', () => {
  it('maps uncategorized open door activities to an Offene Tür bucket', async () => {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { id: '__open_door__', name: 'Offene Tür', count: '3' },
        { id: '__uncategorized__', name: 'Unkategorisiert', count: '2' },
      ]),
    };

    const activityRepository = {
      createQueryBuilder: jest.fn(() => qb),
    };
    const dataSource = {
      options: { type: 'postgres' },
    };

    const service = new StatsService(
      dataSource as never,
      activityRepository as never,
      {} as never,
      { getClosedDatesForOrganizations: jest.fn(async () => []) } as never,
    );

    const result = await service.getByCategory();

    expect(qb.leftJoin).toHaveBeenCalledWith('activity.categories', 'category');
    expect(qb.leftJoin).toHaveBeenCalledWith('activity.project', 'project');
    expect(qb.select).toHaveBeenCalledWith(
      expect.stringContaining(`activity.type = '${ActivityType.OPEN_DOOR}'`),
      'id',
    );
    expect(qb.addSelect).toHaveBeenCalledWith(
      expect.stringContaining(`activity.type = '${ActivityType.OPEN_DOOR}'`),
      'name',
    );
    expect(result).toEqual([
      { id: '__open_door__', name: 'Offene Tür', count: 3 },
      { id: '__uncategorized__', name: 'Unkategorisiert', count: 2 },
    ]);
  });
});

describe('StatsService execution status filtering', () => {
  it('defaults overview queries to completed activities', async () => {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue({
        totalActivities: '0',
        totalParticipants: '0',
        totalMale: '0',
        totalFemale: '0',
        totalDiverse: '0',
        totalDurationMinutes: '0',
      }),
    };

    const activityRepository = {
      createQueryBuilder: jest.fn(() => qb),
    };
    const dataSource = {
      options: { type: 'postgres' },
    };

    const service = new StatsService(
      dataSource as never,
      activityRepository as never,
      { createQueryBuilder: jest.fn(() => ({ where: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), addSelect: jest.fn().mockReturnThis(), getRawMany: jest.fn().mockResolvedValue([]) })) } as never,
      { getClosedDatesForOrganizations: jest.fn(async () => []) } as never,
    );

    await service.getSummary();

    expect(qb.andWhere).toHaveBeenCalledWith(
      'COALESCE(activity.executionStatus, :defaultExecutionStatus) IN (:...executionStatuses)',
      {
        defaultExecutionStatus: ActivityExecutionStatus.COMPLETED,
        executionStatuses: [ActivityExecutionStatus.COMPLETED],
      },
    );
  });

  it('filters overview queries to closed dates when closureState is closed', async () => {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        totalActivities: '0',
        totalParticipants: '0',
        totalMale: '0',
        totalFemale: '0',
        totalDiverse: '0',
        totalDurationMinutes: '0',
      }),
    };

    const activityRepository = {
      createQueryBuilder: jest.fn(() => qb),
    };
    const dataSource = {
      options: { type: 'postgres' },
    };
    const orgs = {
      getClosedDatesForOrganizations: jest.fn(async () => ['2026-04-10', '2026-04-11']),
    };

    const service = new StatsService(
      dataSource as never,
      activityRepository as never,
      { createQueryBuilder: jest.fn(() => ({ where: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), addSelect: jest.fn().mockReturnThis(), getRawMany: jest.fn().mockResolvedValue([]) })) } as never,
      orgs as never,
    );

    await service.getSummary('2026-04-01', '2026-04-30', undefined, ['org-1'], undefined, undefined, undefined, undefined, 'closed');

    expect(orgs.getClosedDatesForOrganizations).toHaveBeenCalledWith(undefined, ['org-1'], '2026-04-01', '2026-04-30');
    expect(qb.andWhere).toHaveBeenCalledWith('activity.date IN (:...closedDates)', {
      closedDates: ['2026-04-10', '2026-04-11'],
    });
    await expect(
      service.getSummary('2026-04-01', '2026-04-30', undefined, ['org-1'], undefined, undefined, undefined, undefined, 'closed'),
    ).resolves.toMatchObject({ closureDaysCount: 2 });
  });
});