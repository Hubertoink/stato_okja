import { useProjects, Project } from '@/lib/projects';
import { colorFromStringHash } from '@/lib/colors';
import { useMemo, useState } from 'react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { Link } from 'react-router-dom';
import { Grid2x2, Rows3, Star, X as XIcon } from 'lucide-react';
import { getStarredProjectIds } from '@/lib/starred';
import ProtectedImage from '@/components/ProtectedImage';
import { useTranslation } from 'react-i18next';
import { compareLocalized } from '@/i18n/formatters';
import { useKeyboardOpen } from '@/lib/useKeyboardOpen';
import { useModalHistory } from '@/components/Modal';

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
  const keyboardOpen = useKeyboardOpen();
  const [search, setSearch] = useState('');
  const { data } = useProjects({ archived: false, search });
  const projects = useMemo(() => {
    const list = data || [];
    const starred = new Set(getStarredProjectIds());
    return list.slice().sort((a, b) => {
      const sa = starred.has(a.id) ? 1 : 0;
      const sb = starred.has(b.id) ? 1 : 0;
      if (sa !== sb) return sb - sa; // starred first
      return compareLocalized(a.title, b.title);
    });
  }, [data]);
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
          <button
            className="modal-close-button inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
            onClick={dismiss}
            aria-label={t('actions.close')}
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('actions.search')}
            className="flex-1 border rounded px-3 py-2"
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

        <div className="project-picker-scroll min-h-0 flex-1 overflow-y-auto pb-4">
          {!compact && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPick(p)}
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
                    {getStarredProjectIds().includes(p.id) && (
                      <div className="absolute top-1 right-1 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400 shadow">
                        <Star className="w-3.5 h-3.5 text-gray-900" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="font-medium text-viridian truncate">{p.title}</div>
                  </div>
                </button>
              ))}
              {projects.length === 0 && (
                <div className="col-span-full py-10 md:py-14 text-center">
                  <div className="text-gray-500">{t('projectPicker.empty')}</div>
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
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-3 divide-y md:divide-y-0 border rounded">
              {projects.map((p) => (
                <li key={p.id} className="md:border-b md:last:border-b-0 md:odd:border-r">
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
                    {getStarredProjectIds().includes(p.id) && (
                      <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    )}
                  </button>
                </li>
              ))}
              {projects.length === 0 && (
                <li className="col-span-full px-3 py-10 md:py-14 text-center text-gray-500">
                  {t('projectPicker.empty')}
                </li>
              )}
            </ul>
          )}
        </div>
        {!keyboardOpen && <div className="mt-4 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 px-4 md:px-6 md:border-t md:border-gray-100">
          <div className="text-xs text-gray-600">
            {t('projectPicker.tip')}
          </div>
        </div>}
      </div>
    </div>
  );
}
