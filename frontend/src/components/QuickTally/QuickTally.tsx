import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Users, CheckCircle, Minimize2, ChevronRight } from 'lucide-react';
import { useProjects, type Project } from '@/lib/projects';
import { colorFromStringHash } from '@/lib/colors';
import { useCohorts } from '@/lib/taxonomy';
import { useLocations } from '@/lib/locations';
import ConfirmModal from '@/components/ConfirmModal';
import ProjectPickerModal from '@/pages/ProjectPickerModal';
import QuickTallyButton from './QuickTallyButton';
import QuickTallyReviewModal from './QuickTallyReviewModal';
import { useQuickTallySession, type TallySession } from './useQuickTallySession';

type GenderKey = 'm' | 'w' | 'd';

interface QuickTallyProps {
  onClose?: () => void;
  onMinimize?: () => void;
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
    session?.startTime ||
      `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
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
      <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-viridian to-cambridge-blue p-6 text-white">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Projekt *</label>
              <button
                type="button"
                onClick={() => setProjectPickerOpen(true)}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-left hover:border-viridian hover:bg-mint-green/10 transition-all group"
              >
                {selectedProject ? (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-md">
                      {selectedProject.imageUrl ? (
                        <img
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
                      <div className="text-sm text-gray-500">Tippen zum Ändern</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-viridian transition-colors" />
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center">
                      <Users className="w-8 h-8 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-600">Projekt wählen</div>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Startzeit</label>
              <input
                type="time"
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
              className="w-full bg-gradient-to-r from-viridian to-cambridge-blue text-white px-6 py-4 rounded-xl text-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
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
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-viridian to-cambridge-blue text-white px-4 py-3 shadow-md">
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
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-2xl mx-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 pr-2 text-sm font-semibold text-gray-700">
                  Kohorte
                </th>
                <th className="py-3 px-1 text-center" title="Männlich">
                  <span className="text-2xl">♂</span>
                </th>
                <th className="py-3 px-1 text-center" title="Weiblich">
                  <span className="text-2xl">♀</span>
                </th>
                <th className="py-3 px-1 text-center" title="Divers">
                  <span className="text-2xl">⚧</span>
                </th>
                <th className="py-3 pl-2 text-right text-sm font-semibold text-gray-700">
                  Σ
                </th>
              </tr>
            </thead>
            <tbody>
              {(cohorts || []).map((cohort) => {
                const counts = session.counts[cohort.id] || { m: 0, w: 0, d: 0 };
                const cohortTotal = getCohortTotal(cohort.id);
                return (
                  <tr key={cohort.id} className="border-b last:border-b-0">
                    <td className="py-4 pr-2">
                      <div className="font-semibold">{cohort.name}</div>
                      <div className="text-xs text-gray-500">
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
      <div className="bg-mint-green border-t border-cambridge-blue/20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="max-w-2xl mx-auto p-4">
          {/* Totals */}
          <div className="grid grid-cols-4 gap-2 text-center mb-4">
            <div className="bg-white/60 rounded-lg py-2">
              <div className="text-xs text-gray-600">♂ Männlich</div>
              <div className="text-2xl font-bold text-viridian">{totals.m}</div>
            </div>
            <div className="bg-white/60 rounded-lg py-2">
              <div className="text-xs text-gray-600">♀ Weiblich</div>
              <div className="text-2xl font-bold text-viridian">{totals.w}</div>
            </div>
            <div className="bg-white/60 rounded-lg py-2">
              <div className="text-xs text-gray-600">⚧ Divers</div>
              <div className="text-2xl font-bold text-viridian">{totals.d}</div>
            </div>
            <div className="bg-viridian/10 rounded-lg py-2">
              <div className="text-xs text-gray-600">Gesamt</div>
              <div className="text-3xl font-bold text-viridian">{totals.total}</div>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleFinish}
            disabled={totals.total === 0}
            className="w-full bg-gradient-to-r from-viridian to-cambridge-blue text-white px-6 py-4 rounded-xl text-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Abschließen & Speichern
          </button>

          {/* Help hint */}
          <p className="mt-2 text-xs text-gray-500 text-center">
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
  const { session, getTotals } = useQuickTallySession();

  const totals = getTotals();
  const sessionProject = (projects || []).find((p: Project) => p.id === session?.projectId);

  if (!session) return null;

  const content = (
    <button
      onClick={onRestore}
      className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-viridian to-cambridge-blue text-white pl-4 pr-5 py-3 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-3"
      style={{ animation: 'pulse 2s infinite' }}
    >
      <div className="p-1.5 bg-white/20 rounded-full">
        <Users className="w-5 h-5" />
      </div>
      <div className="text-left">
        <div className="font-semibold text-sm leading-tight">
          {sessionProject?.title || 'Tageserfassung'}
        </div>
        <div className="text-white/80 text-xs">
          {totals.total} Teilnehmende • Tippen zum Fortsetzen
        </div>
      </div>
    </button>
  );

  return createPortal(content, document.body);
}
