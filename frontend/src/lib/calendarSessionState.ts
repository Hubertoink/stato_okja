const CALENDAR_CURSOR_STORAGE_KEY = 'stato:calendar-cursor:v1';
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function toLocalISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLocalISODate(value: string): Date | null {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function loadCalendarCursor(now = new Date()): Date {
  try {
    const stored = window.sessionStorage.getItem(CALENDAR_CURSOR_STORAGE_KEY);
    return stored ? parseLocalISODate(stored) ?? now : now;
  } catch {
    return now;
  }
}

export function saveCalendarCursor(cursor: Date) {
  try {
    window.sessionStorage.setItem(CALENDAR_CURSOR_STORAGE_KEY, toLocalISODate(cursor));
  } catch {
    /* Ignore unavailable or full session storage. */
  }
}

export { CALENDAR_CURSOR_STORAGE_KEY };
