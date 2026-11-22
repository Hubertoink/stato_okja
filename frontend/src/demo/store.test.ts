import { beforeEach, describe, expect, it } from 'vitest';
import { getDemoTeamStats, listDemoStaff, updateDemoActivity, createDemoActivity, getDemoProcessAccess, getDemoStatsOverview, listDemoProcesses, resetDemoStore } from './store';

describe('demo statistics', () => {
  beforeEach(() => resetDemoStore());

  it('includes weekly-profile slots for the seeded activities', () => {
    const overview = getDemoStatsOverview();

    expect(overview.summary.totalActivities).toBeGreaterThan(0);
    expect(overview.weeklyProfile.slots.length).toBeGreaterThan(0);
    expect(overview.weeklyProfile.days.some((day) => day.activityCount > 0)).toBe(true);
    expect(overview.weeklyProfile.rangeEnd).toBeGreaterThan(overview.weeklyProfile.rangeStart);
  });

  it('preserves a recorded total without an age or gender breakdown during a notes edit', () => {
    const activity = createDemoActivity({ date: '2001-01-15', countTotal: 12, cohorts: [] });
    expect(updateDemoActivity(activity.id, { notes: 'Added notes' })).toMatchObject({ countTotal: 12, cohorts: [] });
    expect(updateDemoActivity(activity.id, { countMale: 3 })).toMatchObject({ countTotal: 3, countMale: 3 });
  });

  it('persists explicit empty editor selections and leaves omitted ones alone', () => {
    const created = createDemoActivity({ date: '2001-01-15', locationId: 'loc-house', staffIds: [listDemoStaff()[0].id] });
    expect(created.staff).toHaveLength(1);
    expect(updateDemoActivity(created.id, { notes: 'Test' })?.staff).toEqual(created.staff);
    const cleared = updateDemoActivity(created.id, { locationId: null, staffIds: [], categoryIds: [], tagIds: [] });
    expect(cleared).toMatchObject({ locationId: null, staff: [], categories: [], tags: [] });
  });

  it('retains a plan without counting it in actual statistics', () => {
    const before = getDemoStatsOverview().summary;
    const planned = createDemoActivity({ date: '2099-11-19', startTime: '15:00', endTime: '18:00', executionStatus: 'planned' });
    expect(planned.executionStatus).toBe('planned');
    expect(getDemoStatsOverview().summary).toEqual(before);
  });

  it('provides editable seeded ProcessO examples', () => {
    const access = getDemoProcessAccess();
    const processes = listDemoProcesses();

    expect(access).toEqual({ enabled: true, canEdit: true, orgId: 'demo-org' });
    expect(processes).toHaveLength(3);
    expect(processes.some((process) => process.title === 'Veranstaltung planen')).toBe(true);
    const eventProcess = processes.find((process) => process.id === 'demo-process-event');
    const planningStep = eventProcess?.definition.nodes.find((node) => node.id === 'event-plan');
    expect(eventProcess?.definition.edges.length).toBeGreaterThan(0);
    expect(planningStep?.data.resources).toContain('Raumbuchung');
    expect(planningStep?.data.checklist).toHaveLength(2);
    expect(planningStep?.data.startCondition).toBeTruthy();
    expect(planningStep?.data.completionCriterion).toBeTruthy();
  });
});

it('provides filtered team statistics and retains individual staff times', () => {
  resetDemoStore();
  const member = listDemoStaff()[0];
  const activity = createDemoActivity({ date: '2001-01-15', type: 'event', startTime: '10:00', endTime: '12:00', staffIds: [member.id], staffTimes: [{ staffId: member.id, minutes: 45 }] });
  const params = { from: '2001-01-15', to: '2001-01-15', type: 'event', projectId: activity.projectId };
  expect(activity.staffTimes).toEqual([{ staffId: member.id, minutes: 45 }]);
  expect(getDemoTeamStats(params)).toEqual([expect.objectContaining({ staffId: member.id, minutes: 45, assignments: 1, status: 'completed' })]);
  expect(getDemoTeamStats({ ...params, type: 'open_door' })).toEqual([]);
  updateDemoActivity(activity.id, { type: 'event', staffTimes: [{ staffId: member.id, minutes: 120 }] });
  expect(getDemoTeamStats(params)[0].minutes).toBe(120);
  updateDemoActivity(activity.id, { type: 'event', executionStatus: 'cancelled' });
  expect(getDemoTeamStats(params)[0].status).toBe('cancelled');
  const planned = createDemoActivity({ date: '2099-11-19', type: 'event', startTime: '10:00', endTime: '12:00', executionStatus: 'planned', staffIds: [member.id] });
  expect(getDemoTeamStats({ from: planned.date, to: planned.date })[0]).toEqual(expect.objectContaining({ status: 'planned', minutes: 120 }));
});
