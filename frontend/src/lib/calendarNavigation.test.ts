import { describe, expect, it } from 'vitest';
import { nextCalendarPeriodStart } from './calendarNavigation';

describe('next occupied calendar period search boundary', () => {
  it('includes the next month even when its first days appear in the current grid', () => {
    expect(nextCalendarPeriodStart(new Date(2026, 9, 20), 'month')).toBe('2026-11-01');
  });

  it('handles month ends, leap years and year changes without overflowing', () => {
    expect(nextCalendarPeriodStart(new Date(2028, 0, 31), 'month')).toBe('2028-02-01');
    expect(nextCalendarPeriodStart(new Date(2028, 1, 29), 'month')).toBe('2028-03-01');
    expect(nextCalendarPeriodStart(new Date(2026, 11, 31), 'month')).toBe('2027-01-01');
  });

  it.each(['week', 'analysis'] as const)('searches from the next Monday in %s view', (view) => {
    expect(nextCalendarPeriodStart(new Date(2026, 9, 19), view)).toBe('2026-10-26');
    expect(nextCalendarPeriodStart(new Date(2026, 9, 25), view)).toBe('2026-10-26');
    expect(nextCalendarPeriodStart(new Date(2026, 11, 31), view)).toBe('2027-01-04');
  });

  it('skips the entire mobile three-day range across month and year boundaries', () => {
    expect(nextCalendarPeriodStart(new Date(2026, 9, 30), 'three-day')).toBe('2026-11-02');
    expect(nextCalendarPeriodStart(new Date(2026, 11, 30), 'analysis', true)).toBe('2027-01-02');
  });
});
