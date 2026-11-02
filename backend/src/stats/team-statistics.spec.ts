import { aggregateTeamStatistics } from './team-statistics';
import { ActivityExecutionStatus, ActivityType } from '../common/enums';
import type { Activity } from '../activities/entities/activity.entity';
import { StatsService } from './stats.service';

const staff = [
  { id: 'anna', name: 'Anna' },
  { id: 'max', name: 'Max' },
] as Activity['staff'];
describe('team statistics', () => {
  it('counts people separately, keeps zero overrides, and falls back for legacy records', () => {
    const rows = aggregateTeamStatistics([
      {
        type: ActivityType.OPEN_DOOR,
        durationMinutes: 120,
        staff,
        staffTimes: [{ staffId: 'anna', minutes: 45 }],
      },
      {
        type: ActivityType.OPEN_DOOR,
        durationMinutes: 60,
        staff,
        staffTimes: [{ staffId: 'anna', minutes: 0 }],
      },
    ]);
    expect(rows).toEqual([
      {
        staffId: 'anna',
        name: 'Anna',
        type: 'open_door',
        status: 'completed',
        minutes: 45,
        assignments: 2,
      },
      {
        staffId: 'max',
        name: 'Max',
        type: 'open_door',
        status: 'completed',
        minutes: 180,
        assignments: 2,
      },
    ]);
  });
  it('separates types and all statuses without including unassigned activities', () => {
    const rows = aggregateTeamStatistics([
      {
        type: ActivityType.OPEN_DOOR,
        executionStatus: ActivityExecutionStatus.PLANNED,
        durationMinutes: 60,
        staff,
      },
      {
        type: ActivityType.EVENT,
        executionStatus: ActivityExecutionStatus.CANCELLED,
        durationMinutes: 90,
        staff,
      },
      { type: ActivityType.EVENT, durationMinutes: 900, staff: [] },
    ]);
    expect(rows).toHaveLength(4);
    expect(
      rows.filter((row) => row.status === 'planned').reduce((sum, row) => sum + row.minutes, 0),
    ).toBe(120);
    expect(
      rows.filter((row) => row.type === 'event').reduce((sum, row) => sum + row.minutes, 0),
    ).toBe(180);
  });
  it('retains organization, project, date and type filters while including planning', async () => {
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const service = new StatsService(
      { options: { type: 'postgres' } } as never,
      { createQueryBuilder: () => qb } as never,
      {} as never,
      {} as never,
    );
    await service.getTeamStatistics({
      orgId: 'org-a',
      from: '2026-01-01',
      to: '2026-12-31',
      projectId: 'p1',
      type: 'open_door',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('activity.orgId = :orgId', { orgId: 'org-a' });
    expect(qb.andWhere).toHaveBeenCalledWith('activity.projectId = :projectId', {
      projectId: 'p1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('activity.type = :type', { type: 'open_door' });
    expect(qb.andWhere).toHaveBeenCalledWith('activity.date >= :from', { from: '2026-01-01' });
    expect(qb.setParameter).toHaveBeenCalledWith('executionStatuses', [
      'completed',
      'planned',
      'cancelled',
    ]);
  });
});
