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
                  <h3 className="text-xl font-bold">Tageserfassung</h3>
                  <p className="text-white/80 text-sm">Schnelle Anwesenheitserfassung</p>
                </div>
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
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
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Projekt *</label>
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
                      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Tippen zum Ändern</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-viridian transition-colors" />
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--surface-2)' }}>
                      <Users className="w-8 h-8" style={{ color: 'var(--text-faint)' }} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium" style={{ color: 'var(--text-secondary)' }}>Projekt wählen</div>
                      <div className="text-sm text-gray-400">Tippen zur Auswahl</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-viridian transition-colors" />
                  </div>
                )}
              </button>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Standort</label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-viridian focus:border-viridian transition-colors"
              >
                <option value="">— Standort wählen —</option>
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
                <label className="block text-sm font-medium text-gray-700">Startzeit</label>
                <button
                  type="button"
                  onClick={() => setStartTime(getRoundedCurrentTime())}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-colors"
                  style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                  aria-label="Aktuelle Uhrzeit übernehmen"
                  title="Jetzt setzen"
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
                <div className="mt-1.5 text-xs text-gray-500">
                  Standardzeit aus Projekt: {selectedProject.defaultStartTime}
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
              <Play className="w-5 h-5" />
              Erfassung starten
            </button>
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
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">{sessionProject?.title || 'Tageserfassung'}</h3>
              <p className="text-white/80 text-sm">seit {session.startTime} • {totals.total} Teilnehmende</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onMinimize && (
              <button
                type="button"
                onClick={onMinimize}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                title="Minimieren"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              title="Abbrechen"
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
            <thead className="sticky top-0" style={{ backgroundColor: 'var(--surface-2)' }}>
              <tr className="border-b-2" style={{ borderColor: 'var(--border-strong)' }}>
                <th className="text-left py-3 pr-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Kohorte
                </th>
                <th className="py-3 px-1 text-center" title="Männlich">
                  <span className="text-xl font-semibold lowercase">m</span>
                </th>
                <th className="py-3 px-1 text-center" title="Weiblich">
                  <span className="text-xl font-semibold lowercase">w</span>
                </th>
                <th className="py-3 px-1 text-center" title="Divers">
                  <span className="text-xl font-semibold lowercase">d</span>
                </th>
                <th className="py-3 pl-2 text-right text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Σ
                </th>
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
                        {cohort.minAge}–{cohort.maxAge} Jahre
                      </div>
                    </td>
                    <td className="py-4 px-1 text-center">
                      <QuickTallyButton
                        value={counts.m}
                        onChange={(v) => handleCountChange(cohort.id, 'm', v)}
                        label={`${cohort.name} männlich`}
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
        <div className="max-w-2xl mx-auto p-4">
          {/* Totals */}
          <div className="grid grid-cols-4 gap-2 text-center mb-4">
            <div className="summary-metric-card py-2">
              <div className="summary-metric-label text-xs">♂ Männlich</div>
              <div className="text-2xl font-bold text-viridian">{totals.m}</div>
            </div>
            <div className="summary-metric-card py-2">
              <div className="summary-metric-label text-xs">♀ Weiblich</div>
              <div className="text-2xl font-bold text-viridian">{totals.w}</div>
            </div>
            <div className="summary-metric-card py-2">
              <div className="summary-metric-label text-xs">⚧ Divers</div>
              <div className="text-2xl font-bold text-viridian">{totals.d}</div>
            </div>
            <div className="summary-metric-card-total py-2">
              <div className="summary-metric-label text-xs">Gesamt</div>
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
            <CheckCircle className="w-5 h-5" />
            Abschließen & Speichern
          </button>

          {/* Help hint */}
          <p className="mt-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Tippen = +1 • Lange drücken oder Wischen ↓ = -1 • Rechtsklick = -1
          </p>
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
        title="Session abbrechen?"
        message="Alle Zählungen gehen verloren."
        confirmLabel="Session abbrechen"
        cancelLabel="Weiterzählen"
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
        aria-label="Schnellerfassung fortsetzen"
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
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Direkt weiterzählen
              </p>
            </div>
            <span className="rounded-full bg-[var(--interactive-soft)] px-2.5 py-1 text-sm font-bold text-viridian tabular-nums">
              {totals.total}
            </span>
          </div>

          <div className="max-h-[min(22rem,calc(100vh-12rem))] overflow-x-hidden overflow-y-auto px-3 py-2">
            <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_2.5rem] items-center gap-1 px-1 pb-1 text-center text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              <span className="text-left">Kohorte</span>
              <span title="Männlich">m</span>
              <span title="Weiblich">w</span>
              <span title="Divers">d</span>
            </div>
            {(cohorts || []).map((cohort) => {
              const counts = session.counts[cohort.id] || { m: 0, w: 0, d: 0 };
              return (
                <div key={cohort.id} className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_2.5rem] items-center gap-1 border-t py-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="min-w-0 pr-1">
                    <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{cohort.name}</div>
                    <div className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>Σ {getCohortTotal(cohort.id)}</div>
                  </div>
                  <QuickTallyButton
                    value={counts.m}
                    onChange={(value) => updateCount(cohort.id, 'm', value)}
                    label={`${cohort.name} männlich`}
                    className="!min-h-10 !min-w-10 h-10 w-10 rounded-lg border px-1 py-1 text-sm"
                    valueClassName="text-base"
                  />
                  <QuickTallyButton
                    value={counts.w}
                    onChange={(value) => updateCount(cohort.id, 'w', value)}
                    label={`${cohort.name} weiblich`}
                    className="!min-h-10 !min-w-10 h-10 w-10 rounded-lg border px-1 py-1 text-sm"
                    valueClassName="text-base"
                  />
                  <QuickTallyButton
                    value={counts.d}
                    onChange={(value) => updateCount(cohort.id, 'd', value)}
                    label={`${cohort.name} divers`}
                    className="!min-h-10 !min-w-10 h-10 w-10 rounded-lg border px-1 py-1 text-sm"
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
              className="flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-viridian transition-colors hover:bg-[var(--interactive-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              Vollbild-Erfassung öffnen <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={onRestore}
        className="theme-accent-solid-button flex items-center gap-3 rounded-full py-3 pl-4 pr-5 shadow-lg transition-all hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
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
            {totals.total} Teilnehmende <span className="hidden md:inline">• Hover zum Weiterzählen</span>
            <span className="md:hidden">• Tippen zum Fortsetzen</span>
          </div>
        </div>
      </button>
    </div>
  );

  return createPortal(content, document.body);
}
