export type ActivityExecutionStatus = 'completed' | 'cancelled';

export const DEFAULT_ACTIVITY_EXECUTION_STATUS: ActivityExecutionStatus = 'completed';

export const ACTIVITY_EXECUTION_STATUS_OPTIONS: ActivityExecutionStatus[] = [
  'completed',
  'cancelled',
];

export const ACTIVITY_EXECUTION_STATUS_LABELS: Record<ActivityExecutionStatus, string> = {
  completed: 'Stattgefunden',
  cancelled: 'Ausgefallen',
};

export const ACTIVITY_EXECUTION_STATUS_SHORT_LABELS: Record<ActivityExecutionStatus, string> = {
  completed: 'Stattgefunden',
  cancelled: 'Ausg.',
};

export function normalizeActivityExecutionStatus(
  value?: string | null,
): ActivityExecutionStatus {
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