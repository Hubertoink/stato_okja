import { describe, expect, it } from 'vitest';
import { summarizeContributions, type ContributionEntry } from './contributors';
import { buildActivitySavePayload, getActivityFormSnapshot, getActivityFormStateFromActivity } from '@/pages/activityEditorShared';

describe('contribution reporting and activity editing', () => {
  it('aggregates by identity across days and projects, including archived people', () => {
    const entry: ContributionEntry = { contributorId: 'a', name: 'Lea', minutes: 60, active: false, date: '2026-11-01', activityId: 'one', title: 'Theke', projectId: 'project', projectTitle: 'Theke' };
    const rows = summarizeContributions([entry, { ...entry, minutes: 30, activityId: 'two', projectId: 'other' }, { ...entry, contributorId: 'b', minutes: 45, name: 'Lea M.' }]);
    expect(rows.map(row => [row.name, row.assignments, row.minutes])).toEqual([['Lea', 2, 90], ['Lea M.', 1, 45]]);
  });
  it('preserves contributions through edit/save and includes them in unsaved-change detection', () => {
    const form = getActivityFormStateFromActivity({ id: 'activity', date: '2026-11-01', type: 'open_door', contributions: [{ contributorId: 'lea', minutes: 45 }] });
    expect(buildActivitySavePayload({ form }).contributions).toEqual([{ contributorId: 'lea', minutes: 45 }]);
    expect(getActivityFormSnapshot(form)).not.toBe(getActivityFormSnapshot({ ...form, contributions: [] }));
    expect(buildActivitySavePayload({ form }).countTotal).toBe(0);
    expect(buildActivitySavePayload({ form }).staffIds).toEqual([]);
  });
});
