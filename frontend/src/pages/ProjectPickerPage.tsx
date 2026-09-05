import { useRecentProjectChoices } from '@/lib/useRecentProjectChoices';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProjects, type Project } from '@/lib/projects';
import { ArrowLeft, Grid2x2, Rows3 } from 'lucide-react';
import { getStarredProjectIds } from '@/lib/starred';
import { colorFromStringHash } from '@/lib/colors';
import ProtectedImage from '@/components/ProtectedImage';
import { useTranslation } from 'react-i18next';
import { compareLocalized } from '@/i18n/formatters';
import { IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { ProjectStarIndicator } from '@/components/ui/ProjectStar';

function backgroundColorForProject(project: Project) {
  return project.color || colorFromStringHash(project.title);
}

export default function ProjectPickerPage() {
  const { t } = useTranslation(['common', 'activities']);
  const [params] = useSearchParams();
  const date = params.get('date') || undefined;
  const navigate = useNavigate();
  const { recentIds, remember } = useRecentProjectChoices();
  const [search, setSearch] = useState('');
  const { data } = useProjects({ archived: false, search });
  const starredProjectIds = useMemo(() => new Set(getStarredProjectIds()), [data]);
  const projects = useMemo(() => {
    const list = data || [];
    return list.slice().sort((a, b) => {
      const sa = starredProjectIds.has(a.id) ? 1 : 0;
      const sb = starredProjectIds.has(b.id) ? 1 : 0;
      if (sa !== sb) return sb - sa; // starred first
      const recentA = recentIds.indexOf(a.id);
      const recentB = recentIds.indexOf(b.id);
      const rankA = recentA < 0 ? Infinity : recentA;
      const rankB = recentB < 0 ? Infinity : recentB;
      return (rankA === rankB ? 0 : rankA - rankB) || compareLocalized(a.title, b.title);
    });
  }, [data, starredProjectIds, recentIds]);
  // Lade Kompakt-Einstellung aus localStorage, damit sie beim Wiederkommen erhalten bleibt
  const [compact, setCompact] = useState<boolean>(() => {
    try {
      return localStorage.getItem('projectPickerCompact') === 'true';
    } catch {
      return false;
    }
  });
  const toggleCompact = (val: boolean) => {
    setCompact(val);
    try {
      localStorage.setItem('projectPickerCompact', String(val));
    } catch {
      /* ignore */
    }
  };
  const typeLabel: Record<string, string> = {
    open_door: t('activities:types.open_door'),
    project_open: t('activities:types.project_open'),
    project_closed: t('activities:types.project_closed'),
    event: t('activities:types.event'),
    outreach: t('activities:types.outreach'),
  };
  const compactToggleLabel = compact ? t('projectPicker.normalView') : t('projectPicker.compactView');

  const onPick = (p: Project) => {
    const qp = new URLSearchParams();
    if (date) qp.set('date', date);
    qp.set('projectId', p.id);
    navigate(`/activities/new?${qp.toString()}`, { state: { fromProjectPicker: true } });
  };

  return (
    <div className="min-h-[100dvh] bg-white">
      {/* Simple page header for mobile */}
      <div className="sticky top-0 z-10 bg-viridian text-white px-4 py-3 flex items-center gap-3 shadow">
        <IconButton
          onClick={() => navigate(-1)}
          className="bg-white/15 text-white hover:bg-white/25 hover:text-white"
          aria-label={t('actions.back')}
          size="icon-compact"
          variant="ghost"
        >
          <ArrowLeft className="w-5 h-5" />
        </IconButton>
        <h2 className="text-lg font-semibold">{t('projectPicker.title')}</h2>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('actions.search')}
            className="flex-1"
          />
          <IconButton
            onClick={() => toggleCompact(!compact)}
            className="sm:hidden"
            aria-label={compactToggleLabel}
            title={compactToggleLabel}
            size="icon"
            variant={compact ? "primary" : "secondary"}
          >
            {compact ? <Grid2x2 className="w-4 h-4" /> : <Rows3 className="w-4 h-4" />}
          </IconButton>
          <label className="hidden sm:flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={compact}
              onChange={(e) => toggleCompact(e.target.checked)}
            />
            {t('projectPicker.compact')}
          </label>
        </div>

        {!compact && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(projects || []).map((p) => (
              <button
                key={p.id}
                onClick={() => { remember(p.id); onPick(p); }}
                className="rounded-xl overflow-hidden shadow focus:outline-none focus:ring-2 focus:ring-viridian text-left"
              >
                <div className="relative h-24">
                  {p.imageUrl ? (
                    <ProtectedImage
                      src={p.imageUrl}
                      alt={p.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0" style={{ backgroundColor: backgroundColorForProject(p) }} />
                  )}
                  <div className="absolute top-1 left-1 z-10">
                    <span
                      className={`inline-block text-[11px] leading-4 px-2 py-0.5 rounded ${p.imageUrl ? "bg-black/45 text-white" : "bg-white/80 text-gray-800 border border-white/60"}`}
                    >
                      {typeLabel[p.type] || p.type}
                    </span>
                  </div>
                  {starredProjectIds.has(p.id) && <ProjectStarIndicator className="absolute right-2 top-2 z-10 text-amber-300" size="sm" />}
                </div>
                <div className="p-2">
                  <div className="font-medium text-viridian truncate">{p.title}</div>
                </div>
              </button>
            ))}
            {(projects || []).length === 0 && (
              <div className="col-span-full text-center py-6 text-gray-500">
                {search.trim() ? t('workflow.noResults') : t('projectPicker.empty')}
              </div>
            )}
          </div>
        )}

        {compact && (
          <ul className="grid gap-px overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--border-subtle)]">
            {(projects || []).map((p) => (
              <li key={p.id} className="bg-[var(--surface-1)]">
                <button
                  onClick={() => onPick(p)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-viridian"
                >
                  <div className="w-10 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                    {p.imageUrl ? (
                      <ProtectedImage src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="h-full w-full" style={{ backgroundColor: backgroundColorForProject(p) }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-viridian truncate">{p.title}</div>
                    <div className="text-[11px] text-gray-600">{typeLabel[p.type] || p.type}</div>
                  </div>
                  {starredProjectIds.has(p.id) && <ProjectStarIndicator size="sm" />}
                </button>
              </li>
            ))}
            {(projects || []).length === 0 && (
              <li className="px-3 py-6 text-center text-gray-500">{search.trim() ? t('workflow.noResults') : t('projectPicker.empty')}</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
