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
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';

const PRESETS: Array<{ id: TestDataPreset; label: string; projects: number; activities: number; monthsBack: number; description: string }> = [
  {
    id: 'small',
    label: autoT('ui_0e696640a2f6'),
    projects: 8,
    activities: 250,
    monthsBack: 4,
    description: autoT('ui_143c37fa08bb'),
  },
  {
    id: 'realistic',
    label: autoT('ui_a6644ffb0ab9'),
    projects: 20,
    activities: 1200,
    monthsBack: 12,
    description: autoT('ui_5832775d18ad'),
  },
  {
    id: 'large',
    label: autoT('ui_1528b61e3915'),
    projects: 50,
    activities: 8000,
    monthsBack: 24,
    description: autoT('ui_07d45838f3b7'),
  },
];

function formatResult(result: GenerateTestDataResult) {
  return autoT('ui_6c6379a4c9c9', { value0: result.created.projects, value1: result.created.activities, value2: result.config.monthsBack });
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(getCurrentIntlLocale(), {
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
        <h3 className="text-xl font-semibold text-viridian mb-2">{autoT('ui_90a22a75b20f')}</h3>
        <p className="text-gray-600">{autoT('ui_34bcc331b116')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-viridian">{autoT('ui_90a22a75b20f')}</h3>
          <p className="text-sm text-gray-600 mt-1">{autoT('ui_76f94040820a')}</p>
        </div>
        <div className="hidden md:flex items-center justify-center rounded-2xl bg-azure-web text-viridian w-12 h-12">
          <Database className="w-6 h-6" />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="font-semibold text-gray-800">{autoT('ui_eae92ae88cfd')}</div>
            <div className="text-sm text-gray-600 mt-1">{autoT('ui_ef662c10352d')}</div>
          </div>
          <label className="inline-flex items-center gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={metrics.enabled}
              onChange={(e) => setDevMetricsEnabled(e.target.checked)}
            />{autoT('ui_48058f12fc3b')}</label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_c5497bca5846')}</div>
            <div className="text-2xl font-semibold text-gray-800 mt-1">{metrics.events.length}</div>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_12426551fbb7')}</div>
            <div className="text-2xl font-semibold text-gray-800 mt-1">{metrics.flows.length}</div>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_b9eb6bf70731')}</div>
            <div className="text-2xl font-semibold text-gray-800 mt-1">{errorCount}</div>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_72e9eb7873ff')}</div>
            <div className="text-lg font-semibold text-gray-800 mt-1">{formatTime(metrics.updatedAt)}</div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-300 text-gray-700"
            onClick={() => clearDevMetrics()}
          >
            <Eraser className="w-4 h-4" />{autoT('ui_0083ce76a3aa')}</button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-300 text-gray-700"
            onClick={() => downloadMetricsSnapshot()}
          >
            <Download className="w-4 h-4" />{autoT('ui_632f72361c03')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-2 text-gray-800 font-semibold">
            <Gauge className="w-4 h-4 text-viridian" />{autoT('ui_ec1893f0b5c2')}</div>
          <div className="text-sm text-gray-600">{autoT('ui_4efcaaa24d33')}</div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {recentFlows.length === 0 && (
              <div className="text-sm text-gray-500">{autoT('ui_31a00660c558')}</div>
            )}
            {recentFlows.map((flow) => (
              <div key={flow.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-800">{flow.name}</div>
                    <div className="text-xs text-gray-500">{formatTime(flow.startedAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-medium ${flow.status === 'error' ? "text-red-700" : flow.status === 'success' ? "text-viridian" : flow.status === 'cancelled' ? "text-gray-500" : "text-amber-700"}`}>
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
                          {mark.meta?.fetched === false ? autoT('ui_00cdf6405458') : ''}
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
            <Activity className="w-4 h-4 text-viridian" />{autoT('ui_9f6c79105bbf')}</div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-gray-600">{autoT('ui_acdb897cfeb4')}</div>
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={showCacheHitEvents}
                onChange={(e) => setShowCacheHitEvents(e.target.checked)}
              />{autoT('ui_02997d6c2782')}</label>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {recentEvents.length === 0 && (
              <div className="text-sm text-gray-500">{autoT('ui_e4794cbf3a4b')}</div>
            )}
            {recentEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="uppercase tracking-wide text-[10px] text-gray-500">{event.kind}</span>
                      <span className={`text-[10px] font-medium ${event.status === 'error' ? "text-red-700" : event.status === 'success' ? "text-viridian" : event.status === 'start' ? "text-amber-700" : event.status === 'cancelled' ? "text-gray-500" : "text-gray-500"}`}>
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
          <div className="font-semibold text-gray-800">{autoT('ui_5c436b432f8e')}</div>
          <div className="text-sm text-gray-600 mt-1">{autoT('ui_95d3924fdd5d')}</div>
        </div>

      {requiresScopedOrg && !hasValidScope && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>{autoT('ui_c14627014854')}</div>
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
                ? "border-viridian bg-mint-green/30"
                : "border-gray-200 hover:border-cambridge-blue hover:bg-gray-50"
            }`}
          >
            <div className="font-semibold text-gray-800">{entry.label}</div>
            <div className="text-sm text-gray-600 mt-1">{entry.description}</div>
            <div className="text-xs text-gray-500 mt-3">
              {entry.projects}{' '}{autoT('ui_10cea68cc868')}{' '}{entry.activities}{' '}{autoT('ui_5963f7713a74')}{' '}{entry.monthsBack}{autoT('ui_1c561ae3103f')}</div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div className="text-sm text-gray-700">{autoT('ui_bca788763dd4')}<span className="font-semibold">{selectedPreset.label}</span>: {selectedPreset.projects}{' '}{autoT('ui_ec531cafb0c1')}{' '}{selectedPreset.activities}{' '}{autoT('ui_50b8dfb643b2')}{' '}{selectedPreset.monthsBack}{autoT('ui_02610d17e92c')}</div>
        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={clearExisting}
            onChange={(e) => setClearExisting(e.target.checked)}
          />
          <span>{autoT('ui_4d616dd351ad')}</span>
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
                  showToast(autoT('ui_e77d0dab46ac'), { type: 'success', durationMs: 3000 });
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
          {generate.isPending ? autoT('ui_ad6ab740a177') : autoT('ui_111cc1f884f6')}
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
                  autoT('ui_96825c5cd5fb', { value0: result.deletedProjects, value1: result.deletedActivities }),
                  { type: 'success', durationMs: 3500 },
                );
              },
              onError: (error) => {
                const message =
                  (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message ||
                  autoT('ui_c845c2554514');
                showToast(Array.isArray(message) ? message.join(', ') : String(message), {
                  type: 'error',
                  durationMs: 4500,
                });
              },
            });
          }}
        >
          <Trash2 className="w-4 h-4" />
          {cleanup.isPending ? autoT('ui_4f647d16becc') : autoT('ui_e34d4ce09e95')}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600 space-y-2">
        <div className="font-medium text-gray-800">{autoT('ui_5a3fdb4f3578')}</div>
        <div>{autoT('ui_1240dde481bb')}</div>
        <div>{autoT('ui_d1ddf1f34c0e')}</div>
      </div>

      {lastResult && (
        <div className="rounded-xl border border-mint-green bg-mint-green/20 px-4 py-3 text-sm text-gray-700">
          <div className="font-medium text-gray-800">{autoT('ui_43bc2c80593e')}{' '}{lastResult.orgName}</div>
          <div className="mt-1">{formatResult(lastResult)}</div>
          {(lastResult.cleanedUp.deletedProjects > 0 || lastResult.cleanedUp.deletedActivities > 0) && (
            <div className="mt-1 text-gray-600">{autoT('ui_946ceba0eaba')}{lastResult.cleanedUp.deletedProjects}{' '}{autoT('ui_ec531cafb0c1')}{' '}{lastResult.cleanedUp.deletedActivities}{autoT('ui_a99093373d48')}</div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}