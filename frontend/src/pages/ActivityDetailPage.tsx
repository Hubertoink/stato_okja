import { useNavigate, useParams } from 'react-router-dom';
import { useActivity } from '@/lib/activities';
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
import { getBgClass } from '@/lib/colorPalette';

const typeLabel: Record<string, string> = {
  open_door: 'Offene Tür',
  project_open: 'Projekt (offen)',
  project_closed: 'Projekt (geschlossen)',
  event: 'Veranstaltung',
  outreach: 'Aufsuchend',
};

export default function ActivityDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: activity } = useActivity(id);

  if (!activity) return null;

  const dateStr = (() => {
    const s = (activity.date || '').slice(0, 10);
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  })();
  const fmtHHMM = (t?: string | null) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    if (h == null || m == null) return t || '';
    return `${h}:${m}`; // drop seconds
  };
  const timeStr = [fmtHHMM(activity.startTime), fmtHHMM(activity.endTime)]
    .filter(Boolean)
    .join(' – ');
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
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-viridian">
            {activity.title || activity.project?.title || typeLabel[activity.type] || activity.type}
          </h2>
          <div className="text-sm text-gray-600">
            {activity.project?.title
              ? `${activity.project.title} • ${typeLabel[activity.type] || activity.type}`
              : typeLabel[activity.type] || activity.type}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!!activity.id && (
            <button
              onClick={() => navigate(`/activities/${activity.id}/edit`)}
              aria-label="Bearbeiten"
              title="Bearbeiten"
              className="inline-flex items-center justify-center p-2 rounded-full bg-white border text-viridian"
            >
              <Pencil className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            aria-label="Zurück"
            title="Zurück"
            className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 md:p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <CalendarIcon className="w-4 h-4" /> {dateStr}
        </div>
        {!!timeStr && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Clock3 className="w-4 h-4" /> {timeStr} Uhr
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
            {activity.countTotal ?? 0} (m:{activity.countMale ?? 0}, w:{activity.countFemale ?? 0},
            d:{activity.countDiverse ?? 0})
          </div>
        </div>

        {activity.categories && activity.categories.length > 0 && (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">Kategorien</div>
            <div className="flex flex-wrap gap-2">
              {activity.categories.map((c) => (
                <span
                  key={c.id}
                  className={`px-2 py-1 rounded-full text-xs text-white ${getBgClass(c.color as string, 'bg-slate-400')}`}
                  title={c.name}
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
                  className={`px-2 py-1 rounded-full text-xs text-white ${getBgClass(t.color as string, 'bg-slate-500')}`}
                  title={t.name}
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
    </div>
  );
}
