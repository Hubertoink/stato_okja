import { BadRequestException } from '@nestjs/common';
import type { Activity } from './entities/activity.entity';

export function validateActivityStaffTimes(activity: Partial<Activity>): void {
  const selected = new Set((activity.staff || []).map((member) => member.id));
  const seen = new Set<string>();
  activity.staffTimes = (activity.staffTimes || []).filter((entry) => selected.has(entry.staffId));
  for (const entry of activity.staffTimes) {
    if (
      seen.has(entry.staffId) ||
      !Number.isInteger(entry.minutes) ||
      entry.minutes < 0 ||
      entry.minutes > (activity.durationMinutes ?? 0)
    ) {
      throw new BadRequestException(
        'Einsatzzeiten müssen zwischen 0 und der Aktivitätsdauer liegen. Bitte Teamzeiten prüfen.',
      );
    }
    seen.add(entry.staffId);
  }
}
