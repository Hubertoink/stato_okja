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
      },
      byType: [],
      gender: { male: 0, female: 0, diverse: 0 },
      participantsTimeseries: [],
      byCategory: [],
      byCohort: [],
      topTags: [],
      topProjects: [],
      availableYears: [],
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
    })),
    getByType: jest.fn(async () => []),
  getGender: jest.fn(async () => ({ male: 0, female: 0, diverse: 0 })),
    getParticipantsTimeseries: jest.fn(async () => []),
    getByCategory: jest.fn(async () => []),
    getByCohort: jest.fn(async () => []),
  };
  const orgs: Pick<OrgsService, 'getSubtreeOrgIds'> = {
    getSubtreeOrgIds: jest.fn(async (id: string) => [id, 'child-1']),
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
    expect(service.getSummary).toHaveBeenCalledWith(undefined, undefined, null, undefined, undefined);
  });

  it('by-type: superadmin scoped string expands to subtree', async () => {
    await controller.getByType({ user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' }, undefined, undefined, undefined);
    expect(orgs.getSubtreeOrgIds).toHaveBeenCalledWith('org-1');
    expect(service.getByType).toHaveBeenCalledWith(undefined, undefined, undefined, ['org-1', 'child-1'], undefined);
  });

  it('overview: superadmin scoped string expands to subtree', async () => {
    await controller.getOverview({ user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' }, undefined, undefined, undefined);
    expect(orgs.getSubtreeOrgIds).toHaveBeenCalledWith('org-1');
    expect(service.getOverview).toHaveBeenCalledWith({ from: undefined, to: undefined, orgId: undefined, orgIds: ['org-1', 'child-1'], projectId: undefined });
  });
});
