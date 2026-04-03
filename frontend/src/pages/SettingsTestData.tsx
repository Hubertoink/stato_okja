import { useMemo, useState } from 'react';
import { AlertTriangle, Database, Trash2, Wand2 } from 'lucide-react';
import { useToast } from '@/components/Toast';
import {
  type GenerateTestDataResult,
  type TestDataPreset,
  useDeleteGeneratedTestData,
  useGenerateTestData,
} from '@/lib/devTools';
import { useAuth } from '@/lib/auth';
import { useOrgScope } from '@/lib/orgScope';

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

export default function SettingsTestData() {
  const { user } = useAuth();
  const { scope } = useOrgScope();
  const { showToast } = useToast();
  const generate = useGenerateTestData();
  const cleanup = useDeleteGeneratedTestData();

  const [preset, setPreset] = useState<TestDataPreset>('realistic');
  const [clearExisting, setClearExisting] = useState(true);
  const [lastResult, setLastResult] = useState<GenerateTestDataResult | null>(null);

  const canUse = user?.role === 'superadmin' || user?.role === 'org_admin';
  const requiresScopedOrg = user?.role === 'superadmin';
  const hasValidScope = typeof scope === 'string' || user?.role === 'org_admin';
  const selectedPreset = useMemo(
    () => PRESETS.find((entry) => entry.id === preset) || PRESETS[1],
    [preset],
  );

  if (!canUse) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-viridian mb-2">Testdaten</h3>
        <p className="text-gray-600">Nur Superadmin und Org-Admin können Testdaten erzeugen.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-viridian">Testdaten</h3>
          <p className="text-sm text-gray-600 mt-1">
            Erzeugt realistische Projekte und Aktivitäten für die offene Kinder- und Jugendarbeit in der aktuell gewählten Organisation.
          </p>
        </div>
        <div className="hidden md:flex items-center justify-center rounded-2xl bg-azure-web text-viridian w-12 h-12">
          <Database className="w-6 h-6" />
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
  );
}