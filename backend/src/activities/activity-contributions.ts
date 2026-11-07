import { BadRequestException } from '@nestjs/common';
import type { Activity } from './entities/activity.entity';
import type { Contributor } from '../contributors/contributor.entity';

export async function validateActivityContributions(
  activity: Pick<Activity, 'contributions' | 'orgId' | 'durationMinutes' | 'executionStatus'>,
  loadPeople: (ids: string[]) => Promise<Contributor[]>,
  previous: NonNullable<Activity['contributions']> = [],
) {
  const entries = activity.contributions ?? [];
  if (!Array.isArray(entries) || entries.length > 100) throw new BadRequestException('Ungültige Mitwirkung.');
  if (!entries.length) return;
  if (activity.executionStatus !== 'completed') {
    throw new BadRequestException('Mitwirkung kann nur für durchgeführte Aktivitäten erfasst werden. Vor einem Statuswechsel Einträge ausdrücklich entfernen.');
  }
  const ids = entries.map(entry => entry.contributorId);
  if (new Set(ids).size !== ids.length) throw new BadRequestException('Jede Person kann nur einmal je Aktivität mitwirken.');
  if (entries.some(entry => !Number.isInteger(entry.minutes) || entry.minutes <= 0 || entry.minutes > 1440 ||
    (activity.durationMinutes != null && entry.minutes > activity.durationMinutes))) {
    throw new BadRequestException('Bitte eine positive Dauer bis höchstens zur Aktivitätsdauer eingeben.');
  }
  const people = await loadPeople(ids);
  const previousIds = new Set(previous.map(entry => entry.contributorId));
  if (people.length !== ids.length || people.some(person =>
    (person.orgId ?? null) !== (activity.orgId ?? null) || (!person.active && !previousIds.has(person.id)))) {
    throw new BadRequestException('Mitwirkende müssen zur Einrichtung gehören und aktiv sein.');
  }
}
