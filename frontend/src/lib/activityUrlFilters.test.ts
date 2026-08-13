import { describe, expect, it } from 'vitest';
import { getTemporaryActivityDateFilter } from './activityUrlFilters';

describe('getTemporaryActivityDateFilter', () => {
  it('converts a calendar day into an exact date range', () => {
    expect(getTemporaryActivityDateFilter('?date=2026-07-02')).toEqual({
      from: '2026-07-02',
      to: '2026-07-02',
    });
  });

  it('keeps a valid explicit range and ignores malformed dates', () => {
    expect(getTemporaryActivityDateFilter('?from=2026-07-01&to=2026-07-31')).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    });
    expect(getTemporaryActivityDateFilter('?date=not-a-date')).toBeNull();
  });
});
