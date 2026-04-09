import { StatsService } from './stats.service';

describe('StatsService date normalization', () => {
  const createQueryBuilder = (rows: Array<{ date: string | Date; totalParticipants?: string; activityCount?: string }>) => ({
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