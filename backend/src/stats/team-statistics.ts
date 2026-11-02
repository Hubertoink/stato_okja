import type { Activity } from '../activities/entities/activity.entity';

export function aggregateTeamStatistics(activities: Partial<Activity>[]) {
  const rows = new Map<
    string,
    {
      staffId: string;
      name: string;
      type: string;
      status: string;
      minutes: number;
      assignments: number;
    }
  >();
  for (const activity of activities) {
    for (const member of activity.staff || []) {
      const status = activity.executionStatus || 'completed';
      const key = JSON.stringify([member.id, activity.type, status]);
      const row = rows.get(key) || {
        staffId: member.id,
        name: member.name,
        type: activity.type!,
        status,
        minutes: 0,
        assignments: 0,
      };
      row.minutes += Math.min(
        activity.durationMinutes || 0,
        Math.max(
          0,
          activity.staffTimes?.find((e) => e.staffId === member.id)?.minutes ??
            activity.durationMinutes ??
            0,
        ),
      );
      row.assignments += 1;
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}
