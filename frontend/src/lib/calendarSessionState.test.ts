import { beforeEach, describe, expect, it } from 'vitest';
import {
  CALENDAR_CURSOR_STORAGE_KEY,
  loadCalendarCursor,
  saveCalendarCursor,
} from './calendarSessionState';

describe('calendarSessionState', () => {
  beforeEach(() => {
    window.sessionStorage.removeItem(CALENDAR_CURSOR_STORAGE_KEY);
  });

  it('restores the previously visible local calendar date', () => {
    saveCalendarCursor(new Date(2026, 7, 1, 16, 30));

    expect(loadCalendarCursor(new Date(2026, 0, 1))).toEqual(new Date(2026, 7, 1));
  });

  it('falls back to today for invalid stored dates', () => {
    window.sessionStorage.setItem(CALENDAR_CURSOR_STORAGE_KEY, '2026-02-30');
    const today = new Date(2026, 7, 12);

    expect(loadCalendarCursor(today)).toBe(today);
  });
});
