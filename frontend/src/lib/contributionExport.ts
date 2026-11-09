import type { Contribution, Contributor } from './contributors';

type ContributionActivity = { id: string; date: string; title?: string | null; project?: { title?: string | null } | null; contributions?: Contribution[] | null };

export function contributionExportRows(activities: ContributionActivity[], people: Contributor[], selectedIds?: string[]) {
  const names = new Map(people.map(person => [person.id, person.name]));
  return activities.flatMap(activity => (activity.contributions || [])
    .filter(entry => !selectedIds?.length || selectedIds.includes(entry.contributorId))
    .map(entry => ({ activityId: activity.id, date: activity.date.slice(0, 10), project: activity.project?.title || '', title: activity.title || '', name: names.get(entry.contributorId) || entry.contributorId, minutes: entry.minutes })));
}
