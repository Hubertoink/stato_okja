export type ContributionTime = { contributorId: string; minutes: number; automatic?: boolean };

/** Resolve editor-only automatic durations to explicit minutes for persistence. */
export function resolveContributionTimes(entries: ContributionTime[], duration?: number | null) {
  return entries.map(entry => ({ contributorId: entry.contributorId, minutes: entry.automatic ? duration ?? 0 : entry.minutes }));
}
