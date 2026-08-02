export type ActivityMetricTarget = {
  startTime?: unknown;
  endTime?: unknown;
  durationMinutes?: unknown;
  countMale?: unknown;
  countFemale?: unknown;
  countDiverse?: unknown;
  countTotal?: unknown;
};

function toNonNegativeInteger(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function parseTimeInSeconds(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
}

export function calculateActivityDurationMinutes(
  startTime: unknown,
  endTime: unknown,
): number | null {
  const startSeconds = parseTimeInSeconds(startTime);
  const endSeconds = parseTimeInSeconds(endTime);
  if (startSeconds === null || endSeconds === null) return null;

  let durationSeconds = endSeconds - startSeconds;
  if (durationSeconds < 0) durationSeconds += 24 * 60 * 60;
  return Math.max(0, Math.round(durationSeconds / 60));
}

/**
 * Enforces the persisted activity metric invariants in one place. Times are
 * authoritative for duration; an explicit duration is only used when a time
 * range is incomplete.
 */
export function normalizeActivityMetrics(target: ActivityMetricTarget): void {
  const countMale = toNonNegativeInteger(target.countMale);
  const countFemale = toNonNegativeInteger(target.countFemale);
  const countDiverse = toNonNegativeInteger(target.countDiverse);

  target.countMale = countMale;
  target.countFemale = countFemale;
  target.countDiverse = countDiverse;
  target.countTotal = countMale + countFemale + countDiverse;

  target.durationMinutes =
    calculateActivityDurationMinutes(target.startTime, target.endTime) ??
    toNonNegativeInteger(target.durationMinutes);
}
