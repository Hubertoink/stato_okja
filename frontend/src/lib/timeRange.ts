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
 * Validates a same-day time range. Project defaults may be omitted; activity
 * editors pass required=true. Supplied times must be paired and ordered.
 */
export function getTimeRangeValidationIssue(
  start?: string | null,
  end?: string | null,
  required = false,
): TimeRangeValidationIssue | undefined {
  if (!start && !end) return required ? 'incomplete' : undefined;
  if (!start || !end) return 'incomplete';

  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === undefined || endMinutes === undefined || endMinutes <= startMinutes) {
    return 'endNotAfterStart';
  }

  return undefined;
}
