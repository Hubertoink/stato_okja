import type { Contribution, Contributor } from './contributors';

type ContributionActivity = { id: string; date: string; title?: string | null; project?: { title?: string | null } | null; contributions?: Contribution[] | null };

export function buildContributionExport(activities: ContributionActivity[], people: Contributor[], selectedIds?: string[]) {
  const names = new Map(people.map(person => [person.id, person.name]));
  const selected = new Set(selectedIds);
  const byActivity = new Map<string, { names: string; minutes: number }>();
  const rows = activities.flatMap(activity => {
    const entries = (activity.contributions || [])
      .filter(entry => !selected.size || selected.has(entry.contributorId))
      .map(entry => ({ activityId: activity.id, date: activity.date.slice(0, 10), project: activity.project?.title || '', title: activity.title || '', name: names.get(entry.contributorId) || entry.contributorId, minutes: entry.minutes }));
    if (entries.length) {
      byActivity.set(activity.id, {
        names: entries.map(entry => entry.name).join(', '),
        minutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
      });
    }
    return entries;
  });
  return { rows, byActivity };
}
