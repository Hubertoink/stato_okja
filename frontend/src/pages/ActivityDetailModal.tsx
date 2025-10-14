import {
  X as XIcon,
  Calendar as CalendarIcon,
  Clock3,
  MapPin,
  Users,
  Tag as TagIcon,
  Boxes,
  Pencil,
} from 'lucide-react';
import type { Activity } from '@/lib/activities';

const typeLabel: Record<string, string> = {
  open_door: 'Offene Tür',
  project_open: 'Projekt (offen)',
  project_closed: 'Projekt (geschlossen)',
  event: 'Veranstaltung',
  outreach: 'Aufsuchend',
};

export default function ActivityDetailModal({
  activity,
  onClose,
  onEdit,
}: {
  activity: Activity;
  onClose: () => void;
  onEdit?: (a: Activity) => void;
}) {
  const dateStr = (() => {
    const s = (activity.date || '').slice(0, 10);
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  })();
  const timeStr = [activity.startTime, activity.endTime].filter(Boolean).join(' – ');
  const duration = (() => {
    if (activity.durationMinutes) return `${activity.durationMinutes} min`;
    const parse = (t?: string | null) => {
      if (!t) return undefined;
      const [h, m] = t.split(':').map((v) => parseInt(v, 10));
      if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
      return h * 60 + m;
    };
    const s = parse(activity.startTime);
    const e = parse(activity.endTime);
    return s !== undefined && e !== undefined && e >= s ? `${e - s} min` : '';
  })();

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-2"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[96vh] supports-[height:100dvh]:max-h-[96dvh] overflow-y-auto scrollbar-hide bottom-sheet-animate"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-xl font-semibold text-viridian">
              {activity.title ||
                activity.project?.title ||
                typeLabel[activity.type] ||
                activity.type}
            </h3>
            <div className="text-sm text-gray-600">
              {activity.project?.title
                ? `${activity.project.title} • ${typeLabel[activity.type] || activity.type}`
                : typeLabel[activity.type] || activity.type}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!!activity.id && (
              <button
                onClick={() => {
                  if (onEdit) onEdit(activity);
                  else onClose();
                }}
                aria-label="Bearbeiten"
                title="Bearbeiten"
                className="inline-flex items-center justify-center p-2 rounded-full bg-white border text-viridian"
              >
                <Pencil className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Schließen"
              title="Schließen"
              className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CalendarIcon className="w-4 h-4" /> {dateStr}
          </div>
          {!!timeStr && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Clock3 className="w-4 h-4" /> {timeStr}
              {duration ? ` · ${duration}` : ''}
            </div>
          )}
          {activity.location?.name && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <MapPin className="w-4 h-4" /> {activity.location.name}
            </div>
          )}

          {activity.project && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Boxes className="w-4 h-4" />
              <div>{activity.project.title}</div>
            </div>
          )}

          <div className="text-sm text-gray-700">
            <div className="font-medium mb-1">Teilnehmende</div>
            <div>
              {activity.countTotal ?? 0} (m:{activity.countMale ?? 0}, w:{activity.countFemale ?? 0}
              , d:{activity.countDiverse ?? 0})
            </div>
          </div>

          {activity.categories && activity.categories.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Kategorien</div>
              <div className="flex flex-wrap gap-2">
                {activity.categories.map((c) => (
                  <span
                    key={c.id}
                    className="px-2 py-1 rounded-full text-xs border"
                    style={{
                      backgroundColor: c.color ? `${c.color}26` : undefined,
                      borderColor: c.color || undefined,
                    }}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {activity.tags && activity.tags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <TagIcon className="w-4 h-4" /> Tags
              </div>
              <div className="flex flex-wrap gap-2">
                {activity.tags.map((t) => (
                  <span
                    key={t.id}
                    className="px-2 py-1 rounded-full text-xs border"
                    style={{
                      backgroundColor: t.color || '#fff',
                      color: t.color ? '#fff' : '#374151',
                      borderColor: t.color || '#cbd5e1',
                    }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {activity.staff && activity.staff.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Users className="w-4 h-4" /> Mitarbeitende
              </div>
              <div className="text-sm text-gray-700">
                {activity.staff.map((s) => s.name).join(', ')}
              </div>
            </div>
          )}

          {activity.notes && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Notizen</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{activity.notes}</div>
            </div>
          )}
        </div>

        <div className="mt-4 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe flex items-center justify-end">
          <button
            type="button"
            className="inline-flex items-center justify-center px-3 py-2 rounded bg-viridian text-white"
            onClick={onClose}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
