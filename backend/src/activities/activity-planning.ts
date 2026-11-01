import { BadRequestException } from '@nestjs/common';
import { ActivityExecutionStatus } from '../common/enums';

export function activityToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function normalizeExecutionStatus(value?: string | null): ActivityExecutionStatus {
  if (value === ActivityExecutionStatus.PLANNED) return ActivityExecutionStatus.PLANNED;
  if (value === ActivityExecutionStatus.CANCELLED) return ActivityExecutionStatus.CANCELLED;
  return ActivityExecutionStatus.COMPLETED;
}

type PlanningActivity = {
  date?: Date | string;
  executionStatus?: ActivityExecutionStatus;
  countMale?: number;
  countFemale?: number;
  countDiverse?: number;
  countTotal?: number;
  cohorts?: Array<{ m?: number; w?: number; d?: number; count?: number }> | null;
};

/** Validate the final merged record, including partial updates from older clients. */
export function validateActivityPlanning(
  activity: PlanningActivity,
  previousStatus?: ActivityExecutionStatus,
  now = new Date(),
): void {
  const date = activity.date instanceof Date
    ? activity.date.toISOString().slice(0, 10)
    : String(activity.date || '').slice(0, 10);
  const future = date > activityToday(now);
  activity.executionStatus = activity.executionStatus === undefined && future
    ? ActivityExecutionStatus.PLANNED
    : normalizeExecutionStatus(activity.executionStatus);
  if (future && activity.executionStatus === ActivityExecutionStatus.COMPLETED) {
    throw new BadRequestException('Zukünftige Aktivitäten können nur als geplant oder ausgefallen gespeichert werden.');
  }
  if (activity.executionStatus === ActivityExecutionStatus.PLANNED && !future && previousStatus !== ActivityExecutionStatus.PLANNED) {
    throw new BadRequestException('Neue Planungen benötigen ein zukünftiges Datum. Bestehende Planungen können weiterhin nachbearbeitet werden.');
  }
  if (future || activity.executionStatus === ActivityExecutionStatus.PLANNED) {
    const counts = [activity.countMale, activity.countFemale, activity.countDiverse, activity.countTotal,
      ...(activity.cohorts || []).flatMap((entry) => [entry.m, entry.w, entry.d, entry.count])];
    if (counts.some((count) => Number(count || 0) !== 0)) {
      throw new BadRequestException('Besucherzahlen können erst nach der Durchführung erfasst werden. Vor dem Planen vorhandene Zahlen ausdrücklich entfernen.');
    }
  }
}
