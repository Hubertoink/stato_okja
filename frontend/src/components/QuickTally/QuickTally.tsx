import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Clock3, X, Play, Users, CheckCircle, Minimize2, ChevronRight } from 'lucide-react';
import { useProjects, type Project } from '@/lib/projects';
import { colorFromStringHash } from '@/lib/colors';
import { useCohorts } from '@/lib/taxonomy';
import { useLocations } from '@/lib/locations';
import ConfirmModal from '@/components/ConfirmModal';
import ProjectPickerModal from '@/pages/ProjectPickerModal';
import QuickTallyButton from './QuickTallyButton';
import QuickTallyReviewModal from './QuickTallyReviewModal';
import { useQuickTallySession } from './useQuickTallySession';
import ProtectedImage from '@/components/ProtectedImage';
import { autoT } from '@/i18n/auto';

type GenderKey = 'm' | 'w' | 'd';

interface QuickTallyProps {
  onClose?: () => void;
  onMinimize?: () => void;
}

function getRoundedCurrentTime(): string {
  const now = new Date();
  const roundedMinutes = Math.floor(now.getMinutes() / 15) * 15;
  return `${String(now.getHours()).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`;
}

export default function QuickTally({ onClose, onMinimize }: QuickTallyProps) {
  const { data: projects } = useProjects({ archived: false });
  const { data: cohorts } = useCohorts({ active: true });
  const { data: locations } = useLocations({ active: true });
  
  const { session, startSession, updateCount, clearSession, getTotals, getCohortTotal } =
    useQuickTallySession();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(session?.projectId || '');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(session?.locationId || '');
  const [startTime, setStartTime] = useState<string>(
    session?.startTime || getRoundedCurrentTime()
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  const selectedProject = useMemo(
    () => (projects || []).find((p: Project) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const sessionProject = useMemo(
    () => (projects || []).find((p: Project) => p.id === session?.projectId),
    [projects, session?.projectId]
  );

  const projectBg = useMemo(() => {
    if (!selectedProject) return null;
    return selectedProject.color || colorFromStringHash(selectedProject.title);
  }, [selectedProject]);

  const totals = getTotals();

  const handleStartSession = () => {
    if (!selectedProjectId) return;
    startSession(selectedProjectId, selectedLocationId || undefined, startTime);
  };

  const handlePickProject = (p: Project) => {
    setSelectedProjectId(p.id);
    setProjectPickerOpen(false);
    if (p.defaultStartTime) setStartTime(p.defaultStartTime);
  };

  const handleCountChange = (cohortId: string, gender: GenderKey, value: number) => {
    updateCount(cohortId, gender, value);
  };

  const handleFinish = () => {
    setReviewOpen(true);
  };

  const handleSaved = () => {
    clearSession();
    setReviewOpen(false);
    onClose?.();
  };

  const confirmCancel = () => {
    clearSession();
    setCancelConfirmOpen(false);
    onClose?.();
  };

  const handleCancel = () => {
    if (session && totals.total > 0) {
      setCancelConfirmOpen(true);
      return;
    }
    confirmCancel();
  };

  // Setup view - no active session (full modal)
  if (!session) {
    const setupContent = (
      <div
        className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 modal-overlay"
        style={{ backgroundColor: 'var(--overlay-backdrop)' }}
      >
        <div
          className="w-full max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden border bottom-sheet-animate"
          style={{ backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          {/* Header with gradient */}
          <div className="theme-accent-panel p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{autoT('ui_24241c791f18')}</h3>
                  <p className="text-white/80 text-sm">{autoT('ui_9d3b08a654ef')}</p>
                </div>
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full p-2 transition-colors hover:bg-white/20"
                  aria-label={autoT('ui_07af7cb30fca')}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="p-6 space-y-5">
            {/* Project Selection Button */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{autoT('ui_9d1d722dddcb')}</label>
              <button
                type="button"
                onClick={() => setProjectPickerOpen(true)}
                className="w-full border-2 border-dashed rounded-xl p-4 text-left transition-all group"
                style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--surface-1)' }}
              >
                {selectedProject ? (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-md">
                      {selectedProject.imageUrl ? (
                        <ProtectedImage
                          src={selectedProject.imageUrl}
                          alt={selectedProject.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full" style={{ backgroundColor: projectBg || '#ccc' }} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-viridian text-lg truncate">{selectedProject.title}</div>
                      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{autoT('ui_e9655c8d79d0')}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-viridian transition-colors" />
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--surface-2)' }}>
                      <Users className="w-8 h-8" style={{ color: 'var(--text-faint)' }} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium" style={{ color: 'var(--text-secondary)' }}>{autoT('ui_6d8cf02eea43')}</div>
                      <div className="text-sm text-gray-400">{autoT('ui_115be4a395a4')}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-viridian transition-colors" />
                  </div>
                )}
              </button>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{autoT('ui_f06eb42b42fa')}</label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-viridian focus:border-viridian transition-colors"
              >
                <option value="">{autoT('ui_5e092df4790a')}</option>
                {(locations || []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Time */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="block text-sm font-medium text-gray-700">{autoT('ui_4aa533c84189')}</label>
                <button
                  type="button"
                  onClick={() => setStartTime(getRoundedCurrentTime())}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-colors"
                  style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                  aria-label={autoT('ui_126c9c6936b1')}
                  title={autoT('ui_474f2135efbe')}
                >
                  <Clock3 className="w-4 h-4" />
                </button>
              </div>
              <input
                type="time"
                step={900}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-viridian focus:border-viridian transition-colors"
              />
              {selectedProject?.defaultStartTime && (
                <div className="mt-1.5 text-xs text-gray-500">{autoT('ui_b8f9520248af')}{selectedProject.defaultStartTime}
                </div>
              )}
            </div>

            {/* Start Button */}
            <button
              type="button"
              onClick={handleStartSession}
              disabled={!selectedProjectId}
              className="w-full theme-accent-solid-button px-6 py-4 rounded-xl text-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />{autoT('ui_7cef5e428fb1')}</button>
          </div>
        </div>

        {projectPickerOpen && (
          <ProjectPickerModal
            onPick={handlePickProject}
            onClose={() => setProjectPickerOpen(false)}
          />
        )}
      </div>
    );

    return createPortal(setupContent, document.body);
  }

  // Active session - full screen counting view
  const countingContent = (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="theme-accent-panel px-4 py-3 shadow-md">
        <div className="mx-auto flex min-w-0 max-w-2xl items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-bold text-lg">{sessionProject?.title || 'Tageserfassung'}</h3>
              <p className="text-white/80 text-sm">{autoT('ui_af1b4714651b')}{' '}{session.startTime} • {totals.total}{' '}{autoT('ui_a8a4d6b019af')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onMinimize && (
              <button
                type="button"
                onClick={onMinimize}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full p-2 transition-colors hover:bg-white/20"
                title={autoT('ui_209bcbdc731e')}
                aria-label={autoT('ui_209bcbdc731e')}
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full p-2 transition-colors hover:bg-white/20"
              title={autoT('ui_07af7cb30fca')}
              aria-label={autoT('ui_07af7cb30fca')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Counter Grid - Scrollable */}
      <div className="flex-1 overflow-auto p-4" style={{ backgroundColor: 'var(--surface-2)' }}>
        <div className="max-w-2xl mx-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--surface-2)' }}>
              <tr className="border-b-2" style={{ borderColor: 'var(--border-strong)' }}>
                <th className="text-left py-3 pr-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{autoT('ui_b134a27dd6b6')}</th>
                <th className="py-3 px-1 text-center" title={autoT('ui_897ccce3f38f')}>
                  <span className="text-xl font-semibold lowercase">{autoT('ui_6b0d31c0d563')}</span>
                </th>
                <th className="py-3 px-1 text-center" title={autoT('ui_aeff6199c838')}>
                  <span className="text-xl font-semibold lowercase">{autoT('ui_aff024fe4ab0')}</span>
                </th>
                <th className="py-3 px-1 text-center" title={autoT('ui_9a2dd276e60f')}>
                  <span className="text-xl font-semibold lowercase">{autoT('ui_3c363836cf4e')}</span>
                </th>
                <th className="py-3 pl-2 text-right text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{autoT('ui_ccb9fecbb241')}</th>
              </tr>
            </thead>
            <tbody>
              {(cohorts || []).map((cohort) => {
                const counts = session.counts[cohort.id] || { m: 0, w: 0, d: 0 };
                const cohortTotal = getCohortTotal(cohort.id);
                return (
                  <tr key={cohort.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="py-4 pr-2">
                      <div className="font-semibold">{cohort.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {cohort.minAge}–{cohort.maxAge}{' '}{autoT('ui_b0bf2144b683')}</div>
                    </td>
                    <td className="py-4 px-1 text-center">
                      <QuickTallyButton
                        value={counts.m}
                        onChange={(v) => handleCountChange(cohort.id, 'm', v)}
                        label={autoT('ui_fa207fa300e3', { value0: cohort.name })}
                      />
                    </td>
                    <td className="py-4 px-1 text-center">
                      <QuickTallyButton
                        value={counts.w}
                        onChange={(v) => handleCountChange(cohort.id, 'w', v)}
                        label={`${cohort.name} weiblich`}
                      />
                    </td>
                    <td className="py-4 px-1 text-center">
                      <QuickTallyButton
                        value={counts.d}
                        onChange={(v) => handleCountChange(cohort.id, 'd', v)}
                        label={`${cohort.name} divers`}
                      />
                    </td>
                    <td className="py-4 pl-2 text-right font-bold text-xl text-viridian tabular-nums">
                      {cohortTotal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer - Totals and Actions */}
      <div className="border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]" style={{ background: 'var(--footer-surface-bg)', borderColor: 'var(--border-subtle)' }}>
        <div className="mx-auto max-w-2xl p-4 pb-safe">
          {/* Totals */}
          <div className="mb-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="summary-metric-card py-2">
              <div className="summary-metric-label text-xs">{autoT('ui_37c1e4b405c4')}</div>
              <div className="text-2xl font-bold text-viridian">{totals.m}</div>
            </div>
            <div className="summary-metric-card py-2">
              <div className="summary-metric-label text-xs">{autoT('ui_2d18dfa3e9fd')}</div>
              <div className="text-2xl font-bold text-viridian">{totals.w}</div>
            </div>
            <div className="summary-metric-card py-2">
              <div className="summary-metric-label text-xs">{autoT('ui_d4deea2b7d14')}</div>
              <div className="text-2xl font-bold text-viridian">{totals.d}</div>
            </div>
            <div className="summary-metric-card-total py-2">
              <div className="summary-metric-label text-xs">{autoT('ui_2a8a291a83fb')}</div>
              <div className="text-3xl font-bold text-viridian">{totals.total}</div>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleFinish}
            disabled={totals.total === 0}
            className="w-full theme-accent-solid-button px-6 py-4 rounded-xl text-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />{autoT('ui_89ecbd9fe689')}</button>

          {/* Help hint */}
          <p className="mt-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>{autoT('ui_2302d28bb566')}</p>
        </div>
      </div>

      {reviewOpen && session && (
        <QuickTallyReviewModal
          session={session}
          onClose={() => setReviewOpen(false)}
          onSaved={handleSaved}
        />
      )}

      <ConfirmModal
        open={cancelConfirmOpen}
        title={autoT('ui_d7257aae5fc4')}
        message={autoT('ui_d29cc43f20b2')}
        confirmLabel={autoT('ui_49b2ff4fb379')}
        cancelLabel={autoT('ui_65e8581d6b47')}
        onConfirm={confirmCancel}
        onCancel={() => setCancelConfirmOpen(false)}
      />
    </div>
  );

  return createPortal(countingContent, document.body);
}

/** Floating pill to restore minimized session */
export function QuickTallyMinimizedPill({ onRestore }: { onRestore: () => void }) {
  const { data: projects } = useProjects({ archived: false });
  const { data: cohorts } = useCohorts({ active: true });
  const { session, getTotals, getCohortTotal, updateCount } = useQuickTallySession();

  const totals = getTotals();
  const sessionProject = (projects || []).find((p: Project) => p.id === session?.projectId);

  if (!session) return null;

  const content = (
    <div className="group fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-6 right-4 md:right-6 z-50">
      <div
        className="pointer-events-none absolute bottom-full right-0 hidden w-[28rem] max-w-[calc(100vw-2rem)] pb-3 translate-y-2 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 md:block"
        aria-label={autoT('ui_3d43fbbf12d5')}
      >
        <section
          className="overflow-hidden rounded-2xl border shadow-2xl"
          style={{ backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {sessionProject?.title || 'Tageserfassung'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{autoT('ui_0ec2fd1cb1d4')}</p>
            </div>
            <span className="rounded-full bg-[var(--interactive-soft)] px-2.5 py-1 text-sm font-bold text-viridian tabular-nums">
              {totals.total}
            </span>
          </div>

          <div className="max-h-[min(22rem,calc(100vh-12rem))] overflow-x-hidden overflow-y-auto px-3 py-2">
            <div className="grid grid-cols-[minmax(0,1fr)_2.75rem_2.75rem_2.75rem] items-center gap-1 px-1 pb-1 text-center text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              <span className="text-left">{autoT('ui_b134a27dd6b6')}</span>
              <span title={autoT('ui_897ccce3f38f')}>{autoT('ui_6b0d31c0d563')}</span>
              <span title={autoT('ui_aeff6199c838')}>{autoT('ui_aff024fe4ab0')}</span>
              <span title={autoT('ui_9a2dd276e60f')}>{autoT('ui_3c363836cf4e')}</span>
            </div>
            {(cohorts || []).map((cohort) => {
              const counts = session.counts[cohort.id] || { m: 0, w: 0, d: 0 };
              return (
                <div key={cohort.id} className="grid grid-cols-[minmax(0,1fr)_2.75rem_2.75rem_2.75rem] items-center gap-1 border-t py-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="min-w-0 pr-1">
                    <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{cohort.name}</div>
                    <div className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{autoT('ui_ccb9fecbb241')}{' '}{getCohortTotal(cohort.id)}</div>
                  </div>
                  <QuickTallyButton
                    value={counts.m}
                    onChange={(value) => updateCount(cohort.id, 'm', value)}
                    label={autoT('ui_fa207fa300e3', { value0: cohort.name })}
                    className="!min-h-11 !min-w-11 h-11 w-11 rounded-lg border px-1 py-1 text-sm"
                    valueClassName="text-base"
                  />
                  <QuickTallyButton
                    value={counts.w}
                    onChange={(value) => updateCount(cohort.id, 'w', value)}
                    label={`${cohort.name} weiblich`}
                    className="!min-h-11 !min-w-11 h-11 w-11 rounded-lg border px-1 py-1 text-sm"
                    valueClassName="text-base"
                  />
                  <QuickTallyButton
                    value={counts.d}
                    onChange={(value) => updateCount(cohort.id, 'd', value)}
                    label={`${cohort.name} divers`}
                    className="!min-h-11 !min-w-11 h-11 w-11 rounded-lg border px-1 py-1 text-sm"
                    valueClassName="text-base"
                  />
                </div>
              );
            })}
          </div>

          <div className="border-t px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              type="button"
              onClick={onRestore}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-viridian transition-colors hover:bg-[var(--interactive-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >{autoT('ui_474e16d80f82')}<ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={onRestore}
        className="quick-tally-pill theme-accent-solid-button flex items-center gap-3 rounded-full py-3 pl-4 pr-5 shadow-lg transition-all hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        style={{ animation: 'pulse 2s infinite' }}
      >
        <div className="rounded-full bg-white/20 p-1.5">
          <Users className="w-5 h-5" />
        </div>
        <div className="text-left">
          <div className="text-sm font-semibold leading-tight">
            {sessionProject?.title || 'Tageserfassung'}
          </div>
          <div className="text-xs text-white/80">
            {totals.total}{' '}{autoT('ui_a8a4d6b019af')}{' '}<span className="hidden md:inline">{autoT('ui_43962ef3cfd4')}</span>
            <span className="md:hidden">{autoT('ui_183305a4e1a9')}</span>
          </div>
        </div>
      </button>
    </div>
  );

  return createPortal(content, document.body);
}
