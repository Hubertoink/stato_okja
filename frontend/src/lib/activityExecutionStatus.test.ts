import { describe, expect, it, vi, afterEach } from 'vitest';
import { activityStatusForDate, activityToday, normalizeActivityExecutionStatus, normalizeActivityExecutionStatuses } from './activityExecutionStatus';

afterEach(() => vi.useRealTimers());
describe('activity planning dates and filters', () => {
  it('defaults future activities to planned without completing existing plans after their date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T23:30:00Z'));
    expect(activityToday()).toBe('2026-11-02');
    expect(activityStatusForDate(undefined, '2026-11-03')).toBe('planned');
    expect(activityStatusForDate(undefined, '2026-11-02')).toBe('completed');
    expect(activityStatusForDate('planned', '2026-11-01')).toBe('planned');
    expect(activityStatusForDate('cancelled', '2026-11-03')).toBe('cancelled');
  });
  it('preserves planning in filters and keeps statistics defaults completed', () => {
    expect(normalizeActivityExecutionStatus('planned')).toBe('planned');
    expect(normalizeActivityExecutionStatuses(['planned', 'completed', 'planned'])).toEqual(['planned', 'completed']);
    expect(normalizeActivityExecutionStatuses()).toEqual(['completed']);
  });
});
