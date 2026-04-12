import { ActivitiesService } from './activities.service';
import { ActivityType, AuditAction } from '../common/enums';

describe('ActivitiesService audit diff', () => {
  it('joins staff for paged staff filters without selecting the relation', () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    };
    const activityRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const service = new ActivitiesService(
      activityRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    (service as any).buildListQuery(
      { staffIds: ['staff-1'] },
      { includeStaff: false },
    );

    expect(queryBuilder.leftJoin).toHaveBeenCalledWith('a.staff', 'staff');
    expect(queryBuilder.leftJoinAndSelect).not.toHaveBeenCalledWith('a.staff', 'staff');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('staff.id IN (:...staffIds)', {
      staffIds: ['staff-1'],
    });
  });

  it('logs a curated diff for activity updates', async () => {
    const existingActivity = {
      id: 'activity-1',
      orgId: 'org-1',
      title: 'Alt',
      date: new Date('2026-04-12T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:00',
      durationMinutes: 60,
      type: ActivityType.EVENT,
      locationId: 'location-1',
      location: { id: 'location-1', name: 'Raum 1' },
      projectId: 'project-1',
      project: { id: 'project-1', title: 'Altes Projekt' },
      countMale: 1,
      countFemale: 2,
      countDiverse: 0,
      countTotal: 3,
      notes: 'Alt',
      goals: null,
      tags: [],
      categories: [],
      staff: [],
      cohorts: [{ cohortId: 'cohort-a', m: 1, w: 2, d: 0 }],
    };

    const updatedActivity = {
      ...existingActivity,
      title: 'Neu',
      durationMinutes: 90,
      type: ActivityType.PROJECT_OPEN,
      projectId: 'project-2',
      project: { id: 'project-2', title: 'Neues Projekt', type: ActivityType.PROJECT_OPEN },
      categories: [{ id: 'category-1', name: 'Gaming' }],
      tags: [{ id: 'tag-1', name: 'LAN' }],
      staff: [{ id: 'staff-1', name: 'Alex' }],
      notes: 'Neu',
      countMale: 2,
      countFemale: 2,
      countTotal: 4,
      cohorts: [{ cohortId: 'cohort-a', m: 2, w: 2, d: 0 }],
    };

    const activityRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ ...existingActivity })
        .mockResolvedValueOnce({ ...updatedActivity }),
      save: jest.fn().mockResolvedValue(updatedActivity),
    };
    const tagRepository = {
      findBy: jest.fn().mockResolvedValue([{ id: 'tag-1', name: 'LAN' }]),
    };
    const categoryRepository = {
      findBy: jest.fn().mockResolvedValue([{ id: 'category-1', name: 'Gaming' }]),
    };
    const cohortRepository = {
      findBy: jest.fn().mockResolvedValue([{ id: 'cohort-a', name: 'Teenies 12-14' }]),
    };
    const staffRepository = {
      findBy: jest.fn().mockResolvedValue([{ id: 'staff-1', name: 'Alex' }]),
    };
    const projectRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'project-2',
        title: 'Neues Projekt',
        type: ActivityType.PROJECT_OPEN,
      }),
    };
    const orgs = {
      assertTaxonomyIdsVisibleForOrg: jest.fn().mockResolvedValue(undefined),
    };
    const audit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ActivitiesService(
      activityRepository as never,
      tagRepository as never,
      categoryRepository as never,
      cohortRepository as never,
      staffRepository as never,
      projectRepository as never,
      orgs as never,
      audit as never,
    );

    await service.update(
      'activity-1',
      {
        title: 'Neu',
        durationMinutes: 90,
        projectId: 'project-2',
        categoryIds: ['category-1'],
        tagIds: ['tag-1'],
        staffIds: ['staff-1'],
        notes: 'Neu',
        cohorts: [{ cohortId: 'cohort-a', m: 2, w: 2, d: 0 }],
      },
      { id: 'user-1', name: 'Niko', orgId: 'org-1' },
    );

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        entityType: 'activity',
        diff: expect.objectContaining({
          title: { from: 'Alt', to: 'Neu' },
          durationMinutes: { from: 60, to: 90 },
          type: { from: ActivityType.EVENT, to: ActivityType.PROJECT_OPEN },
          project: { from: 'Altes Projekt', to: 'Neues Projekt' },
          notes: { from: 'Alt', to: 'Neu' },
          categories: { from: [], to: ['Gaming'] },
          tags: { from: [], to: ['LAN'] },
          staff: { from: [], to: ['Alex'] },
          countMale: { from: 1, to: 2 },
          countTotal: { from: 3, to: 4 },
          cohorts: {
            from: ['Teenies 12-14 (m:1, w:2, d:0)'],
            to: ['Teenies 12-14 (m:2, w:2, d:0)'],
          },
        }),
      }),
    );
  });
});