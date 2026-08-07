export type TimeRangeValidationIssue = 'incomplete' | 'endNotAfterStart';

function toMinutes(value?: string | null): number | undefined {
  if (!value) return undefined;

  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return undefined;
  }

  return hours * 60 + minutes;
}

/**
 * Validates a same-day time range. A range can be omitted entirely, but a
 * supplied start or end time must always be paired and end after the start.
 */
export function getTimeRangeValidationIssue(
  start?: string | null,
  end?: string | null,
): TimeRangeValidationIssue | undefined {
  if (!start && !end) return undefined;
  if (!start || !end) return 'incomplete';

  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === undefined || endMinutes === undefined || endMinutes <= startMinutes) {
    return 'endNotAfterStart';
  }

  return undefined;
}
