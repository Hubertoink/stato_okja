import { describe, expect, it } from 'vitest';
import { getTimeRangeValidationIssue } from './timeRange';

describe('getTimeRangeValidationIssue', () => {
  it('allows an omitted range and a positive same-day range', () => {
    expect(getTimeRangeValidationIssue()).toBeUndefined();
    expect(getTimeRangeValidationIssue('14:15', '15:45')).toBeUndefined();
  });

  it('requires start and end together', () => {
    expect(getTimeRangeValidationIssue('14:15', '')).toBe('incomplete');
    expect(getTimeRangeValidationIssue('', '15:45')).toBe('incomplete');
  });

  it('requires the end to be after the start', () => {
    expect(getTimeRangeValidationIssue('14:15', '14:15')).toBe('endNotAfterStart');
    expect(getTimeRangeValidationIssue('14:15', '13:45')).toBe('endNotAfterStart');
  });
});
