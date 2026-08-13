import type { ActivitiesFilter } from './activities';

/** Returns a date range supplied by a transient navigation URL. */
export function getTemporaryActivityDateFilter(
  search: string,
): Pick<ActivitiesFilter, 'from' | 'to'> | null {
  const params = new URLSearchParams(search);
  const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = (params.get('date') || '').trim();
  const from = (params.get('from') || '').trim();
  const to = (params.get('to') || '').trim();

  if (isIsoDate(date)) return { from: date, to: date };
  if (!isIsoDate(from) && !isIsoDate(to)) return null;
  return { from: isIsoDate(from) ? from : undefined, to: isIsoDate(to) ? to : undefined };
}
