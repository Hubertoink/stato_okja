import { useState, useMemo } from 'react';
import { X, Play, Users, CheckCircle } from 'lucide-react';
import { useProjects, type Project } from '@/lib/projects';
import { useCohorts } from '@/lib/taxonomy';
import { useLocations } from '@/lib/locations';
import QuickTallyButton from './QuickTallyButton';
import QuickTallyReviewModal from './QuickTallyReviewModal';
import { useQuickTallySession, type TallySession } from './useQuickTallySession';

type GenderKey = 'm' | 'w' | 'd';

interface QuickTallyProps {
  onClose?: () => void;
  fullscreen?: boolean;
}

export default function QuickTally({ onClose, fullscreen = false }: QuickTallyProps) {
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

  const selectedProject = useMemo(
    () => (projects || []).find((p: Project) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const totals = getTotals();

  const handleStartSession = () => {
    if (!selectedProjectId) return;
    startSession(selectedProjectId, selectedLocationId || undefined, startTime);
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

  const handleCancel = () => {
    if (
      session &&
      totals.total > 0 &&
      !window.confirm('Session abbrechen? Alle Zählungen gehen verloren.')
    ) {
      return;
    }
    clearSession();
    onClose?.();
  };

  // Setup view - no active session
  if (!session) {
    return (
      <div
        className={`bg-white rounded-lg shadow-lg ${fullscreen ? 'fixed inset-0 z-50' : 'p-4 md:p-6'}`}
      >
        <div className={fullscreen ? 'p-4 md:p-6 max-w-lg mx-auto' : ''}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-viridian flex items-center gap-2">
              <Users className="w-6 h-6" />
              Tageserfassung starten
            </h3>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Projekt *</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full border rounded-lg px-4 py-3 text-lg"
              >
                <option value="">Projekt wählen…</option>
                {(projects || []).map((p: Project) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Standort</label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full border rounded-lg px-4 py-3 text-lg"
              >
                <option value="">— Standort wählen —</option>
                {(locations || []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Startzeit</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border rounded-lg px-4 py-3 text-lg"
              />
            </div>

            <button
              type="button"
              onClick={handleStartSession}
              disabled={!selectedProjectId}
              className="w-full mt-4 bg-viridian text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-cambridge-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Erfassung starten
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active session - counting view
  return (
    <>
      <div
        className={`bg-white rounded-lg shadow-lg ${fullscreen ? 'fixed inset-0 z-50 overflow-auto' : ''}`}
      >
        <div className={fullscreen ? 'p-4 md:p-6 max-w-2xl mx-auto' : 'p-4 md:p-6'}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-viridian flex items-center gap-2">
                <Users className="w-5 h-5" />
                Tageserfassung
              </h3>
              <p className="text-sm text-gray-600">
                {selectedProject?.title || 'Projekt'} • seit {session.startTime}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="Abbrechen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Counter Grid */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-2 text-sm font-medium text-gray-600">
                    Kohorte
                  </th>
                  <th className="py-2 px-1 text-center" title="Männlich">
                    <span className="text-xl">♂</span>
                  </th>
                  <th className="py-2 px-1 text-center" title="Weiblich">
                    <span className="text-xl">♀</span>
                  </th>
                  <th className="py-2 px-1 text-center" title="Divers">
                    <span className="text-xl">⚧</span>
                  </th>
                  <th className="py-2 pl-2 text-right text-sm font-medium text-gray-600">
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
                      <td className="py-3 pr-2">
                        <div className="font-medium text-sm">{cohort.name}</div>
                        <div className="text-xs text-gray-500">
                          {cohort.minAge}–{cohort.maxAge} Jahre
                        </div>
                      </td>
                      <td className="py-3 px-1 text-center">
                        <QuickTallyButton
                          value={counts.m}
                          onChange={(v) => handleCountChange(cohort.id, 'm', v)}
                          label={`${cohort.name} männlich`}
                        />
                      </td>
                      <td className="py-3 px-1 text-center">
                        <QuickTallyButton
                          value={counts.w}
                          onChange={(v) => handleCountChange(cohort.id, 'w', v)}
                          label={`${cohort.name} weiblich`}
                        />
                      </td>
                      <td className="py-3 px-1 text-center">
                        <QuickTallyButton
                          value={counts.d}
                          onChange={(v) => handleCountChange(cohort.id, 'd', v)}
                          label={`${cohort.name} divers`}
                        />
                      </td>
                      <td className="py-3 pl-2 text-right font-bold text-lg text-viridian tabular-nums">
                        {cohortTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 p-4 bg-mint-green rounded-lg">
            <div className="grid grid-cols-4 gap-2 text-center mb-3">
              <div>
                <div className="text-xs text-gray-600">♂ Männlich</div>
                <div className="text-xl font-bold text-viridian">{totals.m}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">♀ Weiblich</div>
                <div className="text-xl font-bold text-viridian">{totals.w}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">⚧ Divers</div>
                <div className="text-xl font-bold text-viridian">{totals.d}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Gesamt</div>
                <div className="text-2xl font-bold text-viridian">{totals.total}</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleFinish}
              disabled={totals.total === 0}
              className="flex-1 bg-viridian text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-cambridge-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Abschließen & Speichern
            </button>
          </div>

          {/* Help hint */}
          <p className="mt-3 text-xs text-gray-500 text-center">
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
    </>
  );
}
