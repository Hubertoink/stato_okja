import { describe, expect, it } from 'vitest';
import {
  isValidLogbookDateTime,
  logbookActivityPickerRange,
  toLogbookDateTimeInput,
} from './logbookDate';

describe('logbook date handling', () => {
  it('rejects years outside the datetime-local schema', () => {
    expect(isValidLogbookDateTime('22222-01-01T12:00')).toBe(false);
    expect(isValidLogbookDateTime('2026-02-30T12:00')).toBe(false);
    expect(isValidLogbookDateTime('2026-08-13T12:00')).toBe(true);
  });

  it('falls back safely for invalid values instead of serializing an invalid Date', () => {
    const fallback = new Date(2026, 7, 13, 14, 30);
    expect(toLogbookDateTimeInput('22222-01-01T12:00', fallback)).toBe('2026-08-13T14:30');
    expect(logbookActivityPickerRange('22222-01-01T12:00', fallback)).toEqual({
      from: '2026-07-30',
      to: '2026-08-27',
    });
  });
});
