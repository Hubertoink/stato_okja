import { useRecentProjectChoices } from '@/lib/useRecentProjectChoices';
import { useProjects, Project } from '@/lib/projects';
import { colorFromStringHash } from '@/lib/colors';
import { useMemo, useState } from 'react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { Link } from 'react-router-dom';
import { Grid2x2, Rows3 } from 'lucide-react';
import { getStarredProjectIds } from '@/lib/starred';
import ProtectedImage from '@/components/ProtectedImage';
import { useTranslation } from 'react-i18next';
import { compareLocalized } from '@/i18n/formatters';
import { useModalHistory } from '@/components/Modal';
import { CloseButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { ProjectStarIndicator } from '@/components/ui/ProjectStar';

function backgroundColorForProject(project: Project) {
  return project.color || colorFromStringHash(project.title);
}

export default function ProjectPickerModal({
  onPick,
  onClose,
}: {
  onPick: (p: Project) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(['common', 'activities']);
  const { dismiss } = useModalHistory(onClose);
  // This component mounts only when open – lock body scroll while mounted
  useBodyScrollLock(true);
  const { recentIds, remember } = useRecentProjectChoices();
  const [search, setSearch] = useState('');
  const { data } = useProjects({ archived: false, search });
  const projects = useMemo(() => {
    const list = data || [];
    const starred = new Set(getStarredProjectIds());
    return list.slice().sort((a, b) => {
      const sa = starred.has(a.id) ? 1 : 0;
      const sb = starred.has(b.id) ? 1 : 0;
      if (sa !== sb) return sb - sa; // starred first
      const recentA = recentIds.indexOf(a.id);
      const recentB = recentIds.indexOf(b.id);
      const rankA = recentA < 0 ? Infinity : recentA;
      const rankB = recentB < 0 ? Infinity : recentB;
      return (rankA === rankB ? 0 : rankA - rankB) || compareLocalized(a.title, b.title);
    });
  }, [data, recentIds]);
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

  return (
    <div
      className="visual-viewport-fixed z-[80] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6 modal-overlay"
      onWheel={(e) => e.stopPropagation()}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div className="modal-panel-roomy bg-white w-full md:max-w-4xl rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 flex flex-col overflow-hidden bottom-sheet-animate">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-viridian">{t('projectPicker.title')}</h3>
          <CloseButton
            onClick={dismiss}
            aria-label={t('actions.close')}
          />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('actions.search')}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => toggleCompact(!compact)}
            className={`inline-flex md:hidden items-center justify-center h-10 w-10 rounded border transition-colors ${compact ? "border-viridian bg-viridian text-white" : "border-gray-300 bg-white text-gray-700"}`}
            aria-label={compactToggleLabel}
            title={compactToggleLabel}
          >
            {compact ? <Grid2x2 className="w-4 h-4" /> : <Rows3 className="w-4 h-4" />}
          </button>
          <label className="hidden md:flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={compact}
              onChange={(e) => toggleCompact(e.target.checked)}
            />
            {t('projectPicker.compact')}
          </label>
        </div>

        <p className="mb-3 text-xs text-[var(--text-secondary)]">{t('workflow.recentOffers')}</p>
        <div className="project-picker-scroll min-h-0 flex-1 overflow-y-auto pb-4">
          {!compact && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {projects.map((p) => (
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
                        className={`inline-block text-[11px] leading-4 px-2 py-0.5 rounded ${
                          p.imageUrl
                            ? "bg-black/45 text-white"
                            : "bg-white/80 text-gray-800 border border-white/60"
                        }`}
                      >
                        {typeLabel[p.type] || p.type}
                      </span>
                    </div>
                    {getStarredProjectIds().includes(p.id) && <ProjectStarIndicator className="absolute right-2 top-2 z-10 text-amber-300" size="sm" />}
                  </div>
                  <div className="p-2">
                    <div className="font-medium text-viridian truncate">{p.title}</div>
                  </div>
                </button>
              ))}
              {projects.length === 0 && (
                <div className="col-span-full py-10 md:py-14 text-center">
                  <div className="text-gray-500">{search.trim() ? t('workflow.noResults') : t('projectPicker.empty')}</div>
                  <div className="mt-2 text-xs text-gray-600">
                    {t('projectPicker.emptyHint')}
                    <Link
                      to="/projects"
                      className="text-viridian hover:underline ml-1"
                      onClick={dismiss}
                    >
                      {t('projectPicker.projectsPage')}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {compact && (
            <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--border-subtle)] md:grid-cols-2">
              {projects.map((p) => (
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
                    {getStarredProjectIds().includes(p.id) && <ProjectStarIndicator size="sm" />}
                  </button>
                </li>
              ))}
              {projects.length === 0 && (
                <li className="col-span-full px-3 py-10 md:py-14 text-center text-gray-500">
                  {search.trim() ? t('workflow.noResults') : t('projectPicker.empty')}
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
