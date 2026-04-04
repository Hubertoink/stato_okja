import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Database, Download, Eraser, Gauge, Trash2, Wand2 } from 'lucide-react';
import { useToast } from '@/components/Toast';
import {
  type GenerateTestDataResult,
  type TestDataPreset,
  useDeleteGeneratedTestData,
  useGenerateTestData,
} from '@/lib/devTools';
import { useAuth } from '@/lib/auth';
import { canAccessDevTools } from '@/lib/devToolsConfig';
import { useOrgScope } from '@/lib/orgScope';
import {
  clearDevMetrics,
  serializeDevMetrics,
  setDevMetricsEnabled,
  useDevMetricsStore,
} from '@/lib/devMetrics';

const PRESETS: Array<{ id: TestDataPreset; label: string; projects: number; activities: number; monthsBack: number; description: string }> = [
  {
    id: 'small',
    label: 'Klein',
    projects: 8,
    activities: 250,
    monthsBack: 4,
    description: 'Für schnellen UI-Test und funktionale Klickpfade.',
  },
  {
    id: 'realistic',
    label: 'Realistisch',
    projects: 20,
    activities: 1200,
    monthsBack: 12,
    description: 'Guter Alltagsmix für Dashboard, Kalender, Statistik und Export.',
  },
  {
    id: 'large',
    label: 'Groß',
    projects: 50,
    activities: 8000,
    monthsBack: 24,
    description: 'Für Lasttest, Scroll-Verhalten und große Auswertungen.',
  },
];

function formatResult(result: GenerateTestDataResult) {
  return `${result.created.projects} Projekte, ${result.created.activities} Aktivitäten über ${result.config.monthsBack} Monate.`;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(durationMs?: number) {
  if (typeof durationMs !== 'number') return '—';
  if (durationMs < 1) return '<1 ms';
  if (durationMs < 10) return `${durationMs.toFixed(1)} ms`;
  if (durationMs >= 1000) return `${(durationMs / 1000).toFixed(2)} s`;
  return `${Math.round(durationMs)} ms`;
}

function isCacheHitInfoEvent(event: { kind: string; status: string; meta?: Record<string, unknown> }) {
  return event.kind === 'flow' && event.status === 'info' && event.meta?.cacheHit === true;
}

function downloadMetricsSnapshot() {
  const blob = new Blob([serializeDevMetrics()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `stato-dev-metrics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function SettingsTestData() {
  const { user } = useAuth();
  const { scope } = useOrgScope();
  const { showToast } = useToast();
  const metrics = useDevMetricsStore();
  const generate = useGenerateTestData();
  const cleanup = useDeleteGeneratedTestData();

  const [preset, setPreset] = useState<TestDataPreset>('realistic');
  const [clearExisting, setClearExisting] = useState(true);
  const [lastResult, setLastResult] = useState<GenerateTestDataResult | null>(null);
  const [showCacheHitEvents, setShowCacheHitEvents] = useState(false);

  const canUse = canAccessDevTools(user?.role);
  const requiresScopedOrg = user?.role === 'superadmin';
  const hasValidScope = typeof scope === 'string';
  const selectedPreset = useMemo(
    () => PRESETS.find((entry) => entry.id === preset) || PRESETS[1],
    [preset],
  );
  const recentFlows = useMemo(() => metrics.flows.slice(0, 6), [metrics.flows]);
  const recentEvents = useMemo(
    () => metrics.events.filter((event) => showCacheHitEvents || !isCacheHitInfoEvent(event)).slice(0, 40),
    [metrics.events, showCacheHitEvents],
  );
  const errorCount = useMemo(
    () => metrics.events.filter((event) => event.status === 'error').length,
    [metrics.events],
  );

  if (!canUse) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-viridian mb-2">Dev Tools</h3>
        <p className="text-gray-600">Dev Tools sind nur mit aktivem Feature-Flag und als Superadmin sichtbar.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-viridian">Dev Tools</h3>
          <p className="text-sm text-gray-600 mt-1">
            Live-Logs, Flow-Benchmarks und Testdaten für die aktuell gewählte Organisation.
          </p>
        </div>
        <div className="hidden md:flex items-center justify-center rounded-2xl bg-azure-web text-viridian w-12 h-12">
          <Database className="w-6 h-6" />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="font-semibold text-gray-800">Datenlade-Observability</div>
            <div className="text-sm text-gray-600 mt-1">
              Protokolliert HTTP-Requests, Query-Ladezeiten und Prefetch-Flows lokal im Browser.
            </div>
          </div>
          <label className="inline-flex items-center gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={metrics.enabled}
              onChange={(e) => setDevMetricsEnabled(e.target.checked)}
            />
            Logging aktiv
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Events</div>
            <div className="text-2xl font-semibold text-gray-800 mt-1">{metrics.events.length}</div>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Flows</div>
            <div className="text-2xl font-semibold text-gray-800 mt-1">{metrics.flows.length}</div>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Fehler</div>
            <div className="text-2xl font-semibold text-gray-800 mt-1">{errorCount}</div>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Letztes Update</div>
            <div className="text-lg font-semibold text-gray-800 mt-1">{formatTime(metrics.updatedAt)}</div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-300 text-gray-700"
            onClick={() => clearDevMetrics()}
          >
            <Eraser className="w-4 h-4" />
            Logs leeren
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-300 text-gray-700"
            onClick={() => downloadMetricsSnapshot()}
          >
            <Download className="w-4 h-4" />
            JSON exportieren
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-2 text-gray-800 font-semibold">
            <Gauge className="w-4 h-4 text-viridian" />
            Flow-Benchmarks
          </div>
          <div className="text-sm text-gray-600">
            Besonders relevant ist aktuell der automatische Warmup-Flow nach Login oder Scope-Wechsel.
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {recentFlows.length === 0 && (
              <div className="text-sm text-gray-500">Noch keine Flow-Daten vorhanden.</div>
            )}
            {recentFlows.map((flow) => (
              <div key={flow.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-800">{flow.name}</div>
                    <div className="text-xs text-gray-500">{formatTime(flow.startedAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-medium ${flow.status === 'error' ? 'text-red-700' : flow.status === 'success' ? 'text-viridian' : 'text-amber-700'}`}>
                      {flow.status}
                    </div>
                    <div className="text-sm text-gray-700">{formatDuration(flow.durationMs)}</div>
                  </div>
                </div>
                {flow.marks.length > 0 && (
                  <div className="space-y-1">
                    {flow.marks.map((mark, index) => (
                      <div key={`${flow.id}-${index}`} className="text-xs text-gray-600 flex items-center justify-between gap-3">
                        <span>
                          {mark.label}
                          {mark.meta?.fetched === false ? ' · cache' : ''}
                        </span>
                        <span>{formatDuration(mark.sinceStartMs)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-2 text-gray-800 font-semibold">
            <Activity className="w-4 h-4 text-viridian" />
            Live-Datenladelog
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-gray-600">
              Enthält HTTP-Requests, Query-Ladephasen und Flow-Events aus der aktuellen Browser-Session.
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={showCacheHitEvents}
                onChange={(e) => setShowCacheHitEvents(e.target.checked)}
              />
              Cache-Hits anzeigen
            </label>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {recentEvents.length === 0 && (
              <div className="text-sm text-gray-500">Keine sichtbaren Events vorhanden.</div>
            )}
            {recentEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="uppercase tracking-wide text-[10px] text-gray-500">{event.kind}</span>
                      <span className={`text-[10px] font-medium ${event.status === 'error' ? 'text-red-700' : event.status === 'success' ? 'text-viridian' : event.status === 'start' ? 'text-amber-700' : 'text-gray-500'}`}>
                        {event.status}
                      </span>
                    </div>
                    <div className="font-medium text-gray-800 mt-1 break-words">{event.name}</div>
                    {event.message && <div className="text-xs text-gray-600 mt-1">{event.message}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-500">{formatTime(event.timestamp)}</div>
                    <div className="text-xs text-gray-700 mt-1">{formatDuration(event.durationMs)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 p-4 space-y-4">
        <div>
          <div className="font-semibold text-gray-800">Testdaten</div>
          <div className="text-sm text-gray-600 mt-1">
            Erzeugt realistische Projekte und Aktivitäten für funktionale und Performance-Tests.
          </div>
        </div>

      {requiresScopedOrg && !hasValidScope && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            Für Superadmin ist ein konkreter Org-Scope nötig. Bitte oben zuerst eine Organisation auswählen und danach hier die Testdaten starten.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {PRESETS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setPreset(entry.id)}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              preset === entry.id
                ? 'border-viridian bg-mint-green/30'
                : 'border-gray-200 hover:border-cambridge-blue hover:bg-gray-50'
            }`}
          >
            <div className="font-semibold text-gray-800">{entry.label}</div>
            <div className="text-sm text-gray-600 mt-1">{entry.description}</div>
            <div className="text-xs text-gray-500 mt-3">
              {entry.projects} Projekte · {entry.activities} Aktivitäten · {entry.monthsBack} Monate
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div className="text-sm text-gray-700">
          Preset <span className="font-semibold">{selectedPreset.label}</span>: {selectedPreset.projects} Projekte, {selectedPreset.activities} Aktivitäten, Zeitraum {selectedPreset.monthsBack} Monate.
        </div>
        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={clearExisting}
            onChange={(e) => setClearExisting(e.target.checked)}
          />
          <span>
            Zuvor erzeugte Testdaten dieser Organisation vor dem neuen Lauf löschen.
          </span>
        </label>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <button
          type="button"
          disabled={!hasValidScope || generate.isPending || cleanup.isPending}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-viridian text-white disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={() => {
            generate.mutate(
              { preset, clearExisting },
              {
                onSuccess: (result) => {
                  setLastResult(result);
                  showToast('Testdaten wurden erzeugt.', { type: 'success', durationMs: 3000 });
                },
                onError: (error) => {
                  const message =
                    (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message ||
                    'Erzeugen der Testdaten fehlgeschlagen.';
                  showToast(Array.isArray(message) ? message.join(', ') : String(message), {
                    type: 'error',
                    durationMs: 4500,
                  });
                },
              },
            );
          }}
        >
          <Wand2 className="w-4 h-4" />
          {generate.isPending ? 'Erzeuge Testdaten...' : 'Testdaten erzeugen'}
        </button>

        <button
          type="button"
          disabled={!hasValidScope || generate.isPending || cleanup.isPending}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={() => {
            cleanup.mutate(undefined, {
              onSuccess: (result) => {
                setLastResult(null);
                showToast(
                  `${result.deletedProjects} Projekte und ${result.deletedActivities} Aktivitäten entfernt.`,
                  { type: 'success', durationMs: 3500 },
                );
              },
              onError: (error) => {
                const message =
                  (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message ||
                  'Aufräumen der Testdaten fehlgeschlagen.';
                showToast(Array.isArray(message) ? message.join(', ') : String(message), {
                  type: 'error',
                  durationMs: 4500,
                });
              },
            });
          }}
        >
          <Trash2 className="w-4 h-4" />
          {cleanup.isPending ? 'Entferne Testdaten...' : 'Erzeugte Testdaten löschen'}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600 space-y-2">
        <div className="font-medium text-gray-800">Hinweise</div>
        <div>Die Funktion ergänzt bei Bedarf automatisch Kategorien, Tags, Orte, Kohorten und ein kleines Test-Team in der gewählten Organisation.</div>
        <div>Gelöscht werden nur zuvor erzeugte Testdaten mit interner Markierung, keine normalen Bestandsdaten.</div>
      </div>

      {lastResult && (
        <div className="rounded-xl border border-mint-green bg-mint-green/20 px-4 py-3 text-sm text-gray-700">
          <div className="font-medium text-gray-800">Letzter Lauf für {lastResult.orgName}</div>
          <div className="mt-1">{formatResult(lastResult)}</div>
          {(lastResult.cleanedUp.deletedProjects > 0 || lastResult.cleanedUp.deletedActivities > 0) && (
            <div className="mt-1 text-gray-600">
              Vorher entfernt: {lastResult.cleanedUp.deletedProjects} Projekte, {lastResult.cleanedUp.deletedActivities} Aktivitäten.
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}