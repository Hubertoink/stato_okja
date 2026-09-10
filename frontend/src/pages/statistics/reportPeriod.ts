import { formatDate } from '@/i18n/formatters';
import { autoT } from '@/i18n/auto';

/** Empty bounds mean an unrestricted period, not an invalid date. */
export function formatStatisticsReportPeriod(from: string, to: string) {
  if (!from && !to) return autoT('ui_eb3ab8ef013a');
  const start = from ? formatDate(`${from}T12:00:00`) : '…';
  const end = to ? formatDate(`${to}T12:00:00`) : '…';
  return `${start} – ${end}`;
}
