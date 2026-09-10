import { describe, expect, it } from 'vitest';
import { getActivityEditorReturn } from './activityEditorReturn';

describe('activity editor return destination', () => {
  const state = { from: '/activities/a1', activityListKey: 'list-3', returnState: { from: '/activities?projectId=p1', activityListKey: 'list-3' } };
  it('returns to detail with its original list context after closing or saving', () => {
    expect(getActivityEditorReturn(state)).toEqual({ to: '/activities/a1', state: state.returnState });
  });
  it('returns to the list after deleting the activity instead of opening a missing detail', () => {
    expect(getActivityEditorReturn(state, true)).toEqual({ to: '/activities?projectId=p1', state: { activityListKey: 'list-3' } });
  });
  it('preserves direct editor entry and deep-link fallbacks', () => {
    expect(getActivityEditorReturn({ from: '/calendar' }).to).toBe('/calendar');
    expect(getActivityEditorReturn(null).to).toBe('/activities');
  });
});
