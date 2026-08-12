import { beforeEach, describe, expect, it } from 'vitest';
import { getDemoStatsOverview, resetDemoStore } from './store';

describe('demo statistics', () => {
  beforeEach(() => resetDemoStore());

  it('includes weekly-profile slots for the seeded activities', () => {
    const overview = getDemoStatsOverview();

    expect(overview.summary.totalActivities).toBeGreaterThan(0);
    expect(overview.weeklyProfile.slots.length).toBeGreaterThan(0);
    expect(overview.weeklyProfile.days.some((day) => day.activityCount > 0)).toBe(true);
    expect(overview.weeklyProfile.rangeEnd).toBeGreaterThan(overview.weeklyProfile.rangeStart);
  });
});
