import { describe, expect, it } from 'vitest';
import { teamTimeSeries } from './teamTimeSeries';

describe('team daily averages', () => {
  it('counts a person-day once across activities and excludes planning, cancellation and zero times', () => {
    const series = teamTimeSeries([
      { date: '2026-11-02', staffId: 'a', status: 'completed', minutes: 60 },
      { date: '2026-11-02', staffId: 'a', status: 'completed', minutes: 120 },
      { date: '2026-11-02', staffId: 'b', status: 'completed', minutes: 60 },
      { date: '2026-11-02', staffId: 'c', status: 'completed', minutes: 0 },
      { date: '2026-11-02', staffId: 'a', status: 'planned', minutes: 600 },
      { date: '2026-11-02', staffId: 'b', status: 'cancelled', minutes: 600 },
    ]);
    expect(series.timeline).toEqual([{ name: '2026-11-02', hours: 2 }]);
    expect(series.weekdays[0]).toEqual({ name: 'Mo', hours: 2 });
    expect(series.weekdays[1].hours).toBe(0);
  });
  it('groups long ranges by month, still dividing by person-days', () => {
    const rows = Array.from({ length: 63 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
      staffId: 'a',
      status: 'completed',
      minutes: 120,
    }));
    const series = teamTimeSeries(rows);
    expect(series.monthly).toBe(true);
    expect(series.timeline).toHaveLength(3);
    expect(series.timeline.every((row) => row.hours === 2)).toBe(true);
  });
});
