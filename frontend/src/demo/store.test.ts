import { beforeEach, describe, expect, it } from 'vitest';
import { getDemoProcessAccess, getDemoStatsOverview, listDemoProcesses, resetDemoStore } from './store';

describe('demo statistics', () => {
  beforeEach(() => resetDemoStore());

  it('includes weekly-profile slots for the seeded activities', () => {
    const overview = getDemoStatsOverview();

    expect(overview.summary.totalActivities).toBeGreaterThan(0);
    expect(overview.weeklyProfile.slots.length).toBeGreaterThan(0);
    expect(overview.weeklyProfile.days.some((day) => day.activityCount > 0)).toBe(true);
    expect(overview.weeklyProfile.rangeEnd).toBeGreaterThan(overview.weeklyProfile.rangeStart);
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
