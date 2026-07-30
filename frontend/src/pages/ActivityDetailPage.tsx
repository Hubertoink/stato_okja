import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useActivity } from '@/lib/activities';
import ActivityExecutionStatusBadge from '@/components/ActivityExecutionStatusBadge';
import ProtectedImage from '@/components/ProtectedImage';
import {
  X as XIcon,
  Calendar as CalendarIcon,
  Clock3,
  MapPin,
  Users,
  Tag as TagIcon,
  Boxes,
  Pencil,
  BookOpen,
} from 'lucide-react';
import { getBadgeBackgroundColor } from '@/lib/colorPalette';
import { isCancelledActivity } from '@/lib/activityExecutionStatus';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/i18n/formatters';

export default function ActivityDetailPage() {
  const { t } = useTranslation(['activities', 'common']);
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { data: activity } = useActivity(id);

  const from = (() => {
    const raw = (location.state as unknown as { from?: unknown } | null)?.from;
    return typeof raw === 'string' && raw.length > 0 ? raw : '/activities';
  })();

  if (!activity) return null;
  const typeLabel: Record<string, string> = {
    open_door: t('types.open_door'),
    project_open: t('types.project_open'),
    project_closed: t('types.project_closed'),
    event: t('types.event'),
    outreach: t('types.outreach'),
  };

  const dateLabel = (() => {
    const s = (activity.date || '').slice(0, 10);
    const [y, m, d] = s.split('-');
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    const baseDate = `${d}.${m}.${y}`;
    if (!year || !month || !day) return baseDate;
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return baseDate;
    return formatDate(date, { dateStyle: 'full' });
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
    if (activity.durationMinutes) return t('detail.minutes', { count: activity.durationMinutes });
    const parse = (t?: string | null) => {
      if (!t) return undefined;
      const [h, m] = t.split(':').map((v) => parseInt(v, 10));
      if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
      return h * 60 + m;
    };
    const s = parse(activity.startTime);
    const e = parse(activity.endTime);
    return s !== undefined && e !== undefined && e >= s
      ? t('detail.minutes', { count: e - s })
      : '';
  })();

  const roleBadgeClass = (roles?: string[] | null, role?: string | null) => {
    const r = (Array.isArray(roles) ? roles[0] : role) || '';
    if (r === 'lead' || r === 'employee') return 'bg-viridian text-white';
    if (r === 'volunteer') return 'bg-cambridge-blue text-white';
    if (r === 'helper') return 'bg-amber-200 text-gray-900';
    return 'bg-azure-web text-viridian';
  };

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
              onClick={() =>
                navigate(
                  `/logbook/new?activityId=${encodeURIComponent(activity.id)}${activity.projectId ? `&projectId=${encodeURIComponent(activity.projectId)}` : ''}`,
                )
              }
              aria-label={t('detail.documentInLogbook')}
              title={t('detail.documentInLogbook')}
              className="inline-flex items-center justify-center p-2 rounded-full bg-white border text-viridian"
            >
              <BookOpen className="w-5 h-5" />
            </button>
          )}
          {!!activity.id && (
            <button
              onClick={() => navigate(`/activities/${activity.id}/edit`, { state: { from } })}
              aria-label={t('common:actions.edit')}
              title={t('common:actions.edit')}
              className="inline-flex items-center justify-center p-2 rounded-full bg-white border text-viridian"
            >
              <Pencil className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            aria-label={t('common:actions.back')}
            title={t('common:actions.back')}
            className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg bg-white p-4 shadow md:p-6">
        {activity.project?.imageUrl ? (
          <>
            <ProtectedImage
              src={activity.project.imageUrl}
              alt=""
              aria-hidden
              className="absolute inset-y-0 right-0 h-full w-28 object-cover opacity-70 md:hidden"
            />
            <div
              className="activity-image-fade-mobile absolute inset-y-0 right-0 w-28 md:hidden"
              aria-hidden
            />
          </>
        ) : activity.project?.color ? (
          <>
            <div
              className="absolute inset-y-0 right-0 w-28 opacity-40 md:hidden"
              style={{ backgroundColor: activity.project.color }}
              aria-hidden
            />
            <div
              className="activity-image-fade-mobile absolute inset-y-0 right-0 w-28 md:hidden"
              aria-hidden
            />
          </>
        ) : null}
        <div className="relative z-10 space-y-3">
          {isCancelledActivity(activity.executionStatus) && (
            <div className="activity-status-banner rounded-xl px-3 py-2">
              <ActivityExecutionStatusBadge status={activity.executionStatus} compact />
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CalendarIcon className="w-4 h-4" /> {dateLabel}
          </div>
          {!!timeStr && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Clock3 className="w-4 h-4" /> {timeStr}
              {t('detail.clockSuffix') ? ` ${t('detail.clockSuffix')}` : ''}
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
            <div className="font-medium mb-1">{t('detail.participants')}</div>
            {isCancelledActivity(activity.executionStatus) ? (
              <ActivityExecutionStatusBadge status={activity.executionStatus} />
            ) : (
              <div>
                {t('detail.participantBreakdown', {
                  total: activity.countTotal ?? 0,
                  male: activity.countMale ?? 0,
                  female: activity.countFemale ?? 0,
                  diverse: activity.countDiverse ?? 0,
                })}
              </div>
            )}
          </div>

          {activity.categories && activity.categories.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">{t('detail.categories')}</div>
              <div className="flex flex-wrap gap-2">
                {activity.categories.map((c) => (
                  <span
                    key={c.id}
                    className="px-2 py-1 rounded-full text-xs text-white"
                    style={{ backgroundColor: getBadgeBackgroundColor(c.color) }}
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
                <TagIcon className="w-4 h-4" /> {t('detail.tags')}
              </div>
              <div className="flex flex-wrap gap-2">
                {activity.tags.map((t) => (
                  <span
                    key={t.id}
                    className="px-2 py-1 rounded-full text-xs text-white"
                    style={{ backgroundColor: getBadgeBackgroundColor(t.color, '#64748b') }}
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
                <Users className="w-4 h-4" /> {t('detail.staff')}
              </div>
              <div className="flex flex-wrap gap-2">
                {activity.staff.map((s) => {
                  const obj = s as unknown as Record<string, unknown>;
                  const roles = Array.isArray(obj.roles)
                    ? (obj.roles as unknown[]).filter((x): x is string => typeof x === 'string')
                    : undefined;
                  const role = typeof obj.role === 'string' ? (obj.role as string) : undefined;
                  return (
                    <span
                      key={s.id}
                      className={`px-2 py-1 rounded-full text-xs ${roleBadgeClass(roles, role)}`}
                      title={s.name}
                    >
                      {s.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {activity.notes && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">{t('detail.notes')}</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{activity.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
