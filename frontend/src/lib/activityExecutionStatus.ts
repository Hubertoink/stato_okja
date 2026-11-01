export type ActivityExecutionStatus = 'completed' | 'cancelled' | 'planned';

export const DEFAULT_ACTIVITY_EXECUTION_STATUS: ActivityExecutionStatus = 'completed';

export const ACTIVITY_EXECUTION_STATUS_OPTIONS: ActivityExecutionStatus[] = [
  'planned',
  'completed',
  'cancelled',
];

export const ACTIVITY_EXECUTION_STATUS_LABELS: Record<ActivityExecutionStatus, string> = {
  planned: 'Geplant',
  completed: 'Stattgefunden',
  cancelled: 'Ausgefallen',
};

export const ACTIVITY_EXECUTION_STATUS_SHORT_LABELS: Record<ActivityExecutionStatus, string> = {
  planned: 'Geplant',
  completed: 'Stattgefunden',
  cancelled: 'Ausg.',
};

export function normalizeActivityExecutionStatus(
  value?: string | null,
): ActivityExecutionStatus {
  if (value === 'planned') return 'planned';
  return value === 'cancelled' ? 'cancelled' : DEFAULT_ACTIVITY_EXECUTION_STATUS;
}

export function normalizeActivityExecutionStatuses(
  values?: Array<string | null | undefined>,
): ActivityExecutionStatus[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [DEFAULT_ACTIVITY_EXECUTION_STATUS];
  }

  return Array.from(new Set(values.map((value) => normalizeActivityExecutionStatus(value))));
}

export function isDefaultActivityExecutionStatusFilter(
  values?: Array<string | null | undefined>,
): boolean {
  const normalized = normalizeActivityExecutionStatuses(values);
  return normalized.length === 1 && normalized[0] === DEFAULT_ACTIVITY_EXECUTION_STATUS;
}

export function formatActivityExecutionStatusList(
  values?: Array<string | null | undefined>,
): string {
  return normalizeActivityExecutionStatuses(values)
    .map((value) => ACTIVITY_EXECUTION_STATUS_LABELS[value])
    .join(', ');
}

export function isCancelledActivity(value?: string | null): boolean {
  return normalizeActivityExecutionStatus(value) === 'cancelled';
}
/** Date-only activities use the same business day on the client and server. */
export function activityToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function isFutureActivityDate(date?: string, now = new Date()): boolean {
  return Boolean(date && date.slice(0, 10) > activityToday(now));
}

export function isPlannedActivity(status?: string | null): boolean {
  return status === 'planned';
}

export function isCompletedActivity(status?: string | null): boolean {
  return normalizeActivityExecutionStatus(status) === 'completed';
}

export function activityStatusForDate(status?: string | null, date?: string): ActivityExecutionStatus {
  const normalized = normalizeActivityExecutionStatus(status);
  return normalized === 'completed' && isFutureActivityDate(date) ? 'planned' : normalized;
}
