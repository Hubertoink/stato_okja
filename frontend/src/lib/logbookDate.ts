const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function isUsableDate(date: Date) {
  return Number.isFinite(date.getTime()) && date.getFullYear() >= 1000 && date.getFullYear() <= 9999;
}

function toLocalDateTimeInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A `datetime-local` value must stay within its four-digit year range. */
export function isValidLogbookDateTime(value: string): boolean {
  const parts = DATETIME_LOCAL_PATTERN.exec(value);
  if (!parts) return false;

  const [year, month, day, hour, minute] = parts.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  return isUsableDate(date)
    && date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date.getHours() === hour
    && date.getMinutes() === minute;
}

export function toLogbookDateTimeInput(value?: string | null, fallback = new Date()) {
  const candidate = value ? new Date(value) : fallback;
  return toLocalDateTimeInputValue(isUsableDate(candidate) ? candidate : fallback);
}

export function logbookActivityPickerRange(value: string, fallback = new Date()) {
  const base = isValidLogbookDateTime(value) ? new Date(value) : fallback;
  const before = new Date(base);
  before.setDate(before.getDate() - 14);
  const after = new Date(base);
  after.setDate(after.getDate() + 14);
  return {
    from: toLocalDateTimeInputValue(before).slice(0, 10),
    to: toLocalDateTimeInputValue(after).slice(0, 10),
  };
}
