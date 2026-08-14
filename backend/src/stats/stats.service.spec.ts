import { StatsService } from './stats.service';
import { ActivityExecutionStatus, ActivityType } from '../common/enums';

describe('StatsService date normalization', () => {
  type TimeseriesRow = {
    date: string | Date;
    totalParticipants?: string;
    totalMale?: string;
    totalFemale?: string;
    totalDiverse?: string;
    activityCount?: string;
    totalDurationMinutes?: string;
  };

  const createQueryBuilder = (rows: TimeseriesRow[]) => ({
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  });

  const createService = (rows: TimeseriesRow[]) => {
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
          totalDurationMinutes: 0,
        },
      ]);
    } finally {
      if (typeof previousTz === 'undefined') delete process.env.TZ;
      else process.env.TZ = previousTz;
    }
  });

  it('uses the normalized persisted participant total', async () => {
    const { service, qb } = createService([
      {
        date: '2026-03-12',
        totalParticipants: '16',
        totalMale: '7',
        totalFemale: '8',
        totalDiverse: '1',
        activityCount: '2',
        totalDurationMinutes: '180',
      },
    ]);

    await expect(service.getParticipantsTimeseries()).resolves.toEqual([
      {
        date: '2026-03-12',
        totalParticipants: 16,
        activityCount: 2,
        totalDurationMinutes: 180,
      },
    ]);
    expect(qb.addSelect).toHaveBeenCalledWith(
      'COALESCE(SUM(activity.countTotal), 0)',
      'totalParticipants',
    );
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

    const result = await service.getSummary();

    expect(qb.andWhere).toHaveBeenCalledWith(
      'activity.executionStatus IN (:...executionStatuses)',
      {
        executionStatuses: [ActivityExecutionStatus.COMPLETED],
      },
    );
    expect(result.totalParticipants).toBe(0);
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

describe('StatsService overview cache', () => {
  it('deduplicates equivalent concurrent overview requests and derives gender from the summary', async () => {
    const service = new StatsService(
      { options: { type: 'postgres' } } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const summary = {
      totalActivities: 2,
      totalParticipants: 10,
      totalMale: 4,
      totalFemale: 5,
      totalDiverse: 1,
      totalDurationMinutes: 120,
      totalHours: 2,
      averageParticipants: 5,
      closureDaysCount: 0,
    };
    const getSummary = jest.spyOn(service, 'getSummary').mockResolvedValue(summary);
    jest.spyOn(service, 'getByType').mockResolvedValue([]);
    const getGender = jest.spyOn(service, 'getGender');
    jest.spyOn(service, 'getParticipantsTimeseries').mockResolvedValue([]);
    jest.spyOn(service, 'getByCategory').mockResolvedValue([]);
    jest.spyOn(service, 'getByCohort').mockResolvedValue([]);
    jest.spyOn(service, 'getTopTags').mockResolvedValue([]);
    jest.spyOn(service, 'getTopProjects').mockResolvedValue([]);
    jest.spyOn(service, 'getAvailableYears').mockResolvedValue([]);
    jest.spyOn(service as any, 'getWeeklyProfile').mockResolvedValue({
      slotMinutes: 30,
      rangeStart: 480,
      rangeEnd: 1320,
      excludedWithoutTime: 0,
      days: [],
      slots: [],
    } as never);

    const [first, second] = await Promise.all([
      service.getOverview({ orgIds: ['org-b', 'org-a'] }),
      service.getOverview({ orgIds: ['org-a', 'org-b'] }),
    ]);

    expect(getSummary).toHaveBeenCalledTimes(1);
    expect(getGender).not.toHaveBeenCalled();
    expect(first.gender).toEqual({ male: 4, female: 5, diverse: 1 });
    expect(second).toEqual(first);
  });

  it('recomputes a completed overview request by default', async () => {
    const previousTtl = process.env.STATS_OVERVIEW_CACHE_TTL_MS;
    delete process.env.STATS_OVERVIEW_CACHE_TTL_MS;

    try {
      const service = new StatsService(
        { options: { type: 'postgres' } } as never,
        {} as never,
        {} as never,
        {} as never,
      );
      const overview = {
        summary: {} as never,
        gender: { male: 0, female: 0, diverse: 0 },
        byType: [],
        timeseries: [],
        byCategory: [],
        byCohort: [],
        topTags: [],
        topProjects: [],
        availableYears: [],
        weeklyProfile: {} as never,
      };
      const buildOverview = jest.spyOn(service as any, 'buildOverview').mockResolvedValue(overview);

      await service.getOverview({ orgId: 'org-1' });
      await service.getOverview({ orgId: 'org-1' });

      expect(buildOverview).toHaveBeenCalledTimes(2);
    } finally {
      if (typeof previousTtl === 'undefined') delete process.env.STATS_OVERVIEW_CACHE_TTL_MS;
      else process.env.STATS_OVERVIEW_CACHE_TTL_MS = previousTtl;
    }
  });
});

describe('StatsService age cohorts', () => {
  it('includes a cohort inherited from a parent organization for a single activity', async () => {
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          id: 'activity-1',
          cohorts: [{ cohortId: 'parent-cohort', m: 1, w: 2, d: 0 }],
        },
      ]),
    };
    const cohortRepository = {
      find: jest.fn().mockResolvedValue([{ id: 'parent-cohort', name: '12–14 Jahre' }]),
    };
    const service = new StatsService(
      { options: { type: 'postgres' } } as never,
      { createQueryBuilder: jest.fn(() => qb) } as never,
      cohortRepository as never,
      { getClosedDatesForOrganizations: jest.fn(async () => []) } as never,
    );

    await expect(service.getByCohort(undefined, undefined, 'child-org')).resolves.toEqual([
      {
        cohortId: 'parent-cohort',
        name: '12–14 Jahre',
        male: 1,
        female: 2,
        diverse: 0,
        total: 3,
        activities: 1,
      },
    ]);
    expect(cohortRepository.find).toHaveBeenCalledWith({
      where: { id: expect.anything() },
      select: { id: true, name: true },
    });
  });
});

describe('StatsService custom KPIs', () => {
  it('uses the gender breakdown for the female share, matching the gender chart', async () => {
    const service = new StatsService(
      { options: { type: 'postgres' } } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    jest.spyOn(service, 'getSummary').mockResolvedValue({
      totalActivities: 7,
      totalParticipants: 156,
      totalMale: 87,
      totalFemale: 63,
      totalDiverse: 3,
      totalDurationMinutes: 0,
      totalHours: 0,
      averageParticipants: 0,
      closureDaysCount: 0,
    });

    await expect(service.calculateCustomKpi({ metric: 'female_share_percent' })).resolves.toEqual({
      value: 41.2,
      unit: 'percent',
      precision: 1,
    });
  });
});
