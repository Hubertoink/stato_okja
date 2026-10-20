import { CalendarSearch } from 'lucide-react';
import { useActivitiesPaged } from '@/lib/activities';
import { IconButton } from './ui/Button';

/** Jump to the newest activity date in the active organization, including past dates. */
export function CalendarLatestActivityAction({ onSelect, view }: {
  onSelect: (date: Date) => void;
  view: 'month' | 'week' | 'three-day' | 'analysis';
}) {
  const query = useActivitiesPaged({ order: 'desc' }, 1, 1);
  const activity = query.isPlaceholderData ? undefined : query.data?.data[0];
  const label = query.isError
    ? 'Aktuellste Aktivität konnte nicht geladen werden – erneut versuchen'
    : query.isPending || query.isPlaceholderData
      ? 'Aktuellste Aktivität wird gesucht'
      : !activity
        ? 'Keine Aktivität vorhanden'
        : view === 'month'
          ? 'Zum Monat der aktuellsten Aktivität'
          : view === 'three-day'
            ? 'Zum Zeitraum der aktuellsten Aktivität'
            : 'Zur Woche der aktuellsten Aktivität';

  return <IconButton
    aria-label={label}
    title={label}
    disabled={!query.isError && !activity}
    onClick={() => {
      if (query.isError) {
        void query.refetch();
        return;
      }
      if (!activity) return;
      const [year, month, day] = activity.date.slice(0, 10).split('-').map(Number);
      onSelect(new Date(year, month - 1, day));
    }}
    variant="secondary"
  ><CalendarSearch aria-hidden="true" /></IconButton>;
}
