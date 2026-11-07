import { describe, expect, it } from 'vitest';
import { contributionExportRows } from './contributionExport';
import { buildActivityQueryParams } from './activities';
describe('contributor activity filtering and export', () => {
  it('serializes person filters and preserves numeric per-person durations for Excel', () => {
    expect(buildActivityQueryParams({ contributorIds: ['a', 'b'], hasContributions: true })).toMatchObject({ contributorIds: 'a,b', hasContributions: true });
    const rows = contributionExportRows([{ id: 'activity', date: '2026-11-06', title: 'Theke', contributions: [{ contributorId: 'a', minutes: 45 }, { contributorId: 'b', minutes: 90 }] }], [{ id: 'a', name: 'Lea', active: false }, { id: 'b', name: 'Sam', active: true }], ['a']);
    expect(rows).toEqual([{ activityId: 'activity', date: '2026-11-06', title: 'Theke', project: '', name: 'Lea', minutes: 45 }]);
  });
});
