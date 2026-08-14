import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { OrgsService } from '../orgs/orgs.service';

describe('StatsController org scoping', () => {
  let controller: StatsController;
  const service: Partial<StatsService> = {
    getOverview: jest.fn(async () => ({
      summary: {
        totalActivities: 0,
        totalParticipants: 0,
        totalMale: 0,
        totalFemale: 0,
        totalDiverse: 0,
        totalDurationMinutes: 0,
        totalHours: 0,
        averageParticipants: 0,
        closureDaysCount: 0,
      },
      byType: [],
      gender: { male: 0, female: 0, diverse: 0 },
      participantsTimeseries: [],
      byCategory: [],
      byCohort: [],
      topTags: [],
      topProjects: [],
      availableYears: [],
      weeklyProfile: { slotMinutes: 30, rangeStart: 480, rangeEnd: 1320, excludedWithoutTime: 0, days: [], slots: [] },
    })),
    getSummary: jest.fn(async () => ({
      totalActivities: 0,
      totalParticipants: 0,
      totalMale: 0,
      totalFemale: 0,
      totalDiverse: 0,
      totalDurationMinutes: 0,
      totalHours: 0,
      averageParticipants: 0,
      closureDaysCount: 0,
    })),
    getByType: jest.fn(async () => []),
  getGender: jest.fn(async () => ({ male: 0, female: 0, diverse: 0 })),
    getParticipantsTimeseries: jest.fn(async () => []),
    getByCategory: jest.fn(async () => []),
    getByCohort: jest.fn(async () => []),
  };
  const orgs: Pick<OrgsService, 'getSubtreeOrgIds'> = {
    getSubtreeOrgIds: jest.fn(),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        { provide: StatsService, useValue: service },
        { provide: OrgsService, useValue: orgs },
      ],
    }).compile();

    controller = module.get(StatsController);
    jest.clearAllMocks();
  });

  it('summary: superadmin without scope uses null orgId', async () => {
    await controller.getSummary({ user: { role: 'superadmin', orgId: null }, effectiveOrgId: undefined }, undefined, undefined, undefined);
    expect(service.getSummary).toHaveBeenCalledWith(undefined, undefined, null, undefined, undefined, undefined, undefined);
  });

  it('by-type: superadmin scoped string stays within the selected organization', async () => {
    await controller.getByType({ user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' }, undefined, undefined, undefined);
    expect(service.getByType).toHaveBeenCalledWith(undefined, undefined, 'org-1', undefined, undefined, undefined, undefined);
  });

  it('overview: superadmin scoped string stays within the selected organization', async () => {
    await controller.getOverview({ user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' }, undefined, undefined, undefined, undefined);
    expect(service.getOverview).toHaveBeenCalledWith({ from: undefined, to: undefined, orgId: 'org-1', orgIds: undefined, projectId: undefined, type: undefined, executionStatuses: undefined, closureState: undefined, weekdays: undefined });
  });

  it('overview: forwards explicit type filter', async () => {
    await controller.getOverview(
      { user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' },
      '2026-01-01',
      '2026-12-31',
      undefined,
      'project_open',
      undefined,
    );
    expect(service.getOverview).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: '2026-12-31',
      orgId: 'org-1',
      orgIds: undefined,
      projectId: undefined,
      type: 'project_open',
      executionStatuses: undefined,
      closureState: undefined,
      weekdays: undefined,
    });
  });

  it('overview: forwards explicit weekday filters', async () => {
    await controller.getOverview(
      { user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' },
      '2026-01-01',
      '2026-12-31',
      undefined,
      undefined,
      undefined,
      undefined,
      '1,3,6',
    );
    expect(service.getOverview).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: '2026-12-31',
      orgId: 'org-1',
      orgIds: undefined,
      projectId: undefined,
      type: undefined,
      executionStatuses: undefined,
      closureState: undefined,
      weekdays: [1, 3, 6],
    });
  });

  it('overview: forwards explicit execution status filters', async () => {
    await controller.getOverview(
      { user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' },
      '2026-01-01',
      '2026-12-31',
      undefined,
      undefined,
      undefined,
      'completed,cancelled',
      undefined,
    );
    expect(service.getOverview).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: '2026-12-31',
      orgId: 'org-1',
      orgIds: undefined,
      projectId: undefined,
      type: undefined,
      executionStatuses: ['completed', 'cancelled'],
      closureState: undefined,
      weekdays: undefined,
    });
  });

  it('overview: forwards explicit closure state filter', async () => {
    await controller.getOverview(
      { user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' },
      '2026-01-01',
      '2026-12-31',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'closed',
    );
    expect(service.getOverview).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: '2026-12-31',
      orgId: 'org-1',
      orgIds: undefined,
      projectId: undefined,
      type: undefined,
      executionStatuses: undefined,
      closureState: 'closed',
      weekdays: undefined,
    });
  });
});
