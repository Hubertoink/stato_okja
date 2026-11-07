import { describe, expect, it } from 'vitest';
import { buildActivitySavePayload, getActivityFormStateFromActivity } from '@/pages/activityEditorShared';

describe('automatic contribution duration', () => {
  it('uses times entered after selection and follows subsequent time changes without sending editor metadata', () => {
    const form = { contributions: [{ contributorId: 'lea', minutes: 0, automatic: true }] };
    expect(buildActivitySavePayload({ form: { ...form, start: '15:00', end: '17:00' } }).contributions).toEqual([{ contributorId: 'lea', minutes: 120 }]);
    expect(buildActivitySavePayload({ form: { ...form, start: '15:00', end: '18:00' } }).contributions).toEqual([{ contributorId: 'lea', minutes: 180 }]);
  });
  it('recognizes full duration on reload while preserving custom durations', () => {
    const form = getActivityFormStateFromActivity({ id: 'a', type: 'open_door', date: '2026-11-06', startTime: '15:00', endTime: '17:00', durationMinutes: 120,
      contributions: [{ contributorId: 'lea', minutes: 120 }, { contributorId: 'sam', minutes: 45 }] });
    expect(buildActivitySavePayload({ form: { ...form, end: '18:00' }, durationMinutesOverride: 120 }).contributions).toEqual([{ contributorId: 'lea', minutes: 180 }, { contributorId: 'sam', minutes: 45 }]);
  });
});
