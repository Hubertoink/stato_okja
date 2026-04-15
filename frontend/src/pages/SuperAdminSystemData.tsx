import { useMemo, useState } from 'react';
import { AlertTriangle, Database, Download, FileArchive, HardDrive, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth';
import { useOrgScope } from '@/lib/orgScope';
import {
  downloadSystemDataExport,
  getApiErrorMessage,
  useExportSystemData,
  usePurgeSystemData,
  useSystemDataSummary,
} from '@/lib/systemData';

function formatBytes(bytes: number) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${accent}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-sm text-gray-500 font-medium">{label}</div>
        <div className="text-2xl font-bold text-gray-900 mt-0.5">{value}</div>
      </div>
    </div>
  );
}

export default function SuperAdminSystemData() {
  const { user } = useAuth();
  const { setScope } = useOrgScope();
  const { showToast } = useToast();
  const summaryQuery = useSystemDataSummary();
  const exportMutation = useExportSystemData();
  const purgeMutation = usePurgeSystemData();

  const [password, setPassword] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [lastPurgeSummary, setLastPurgeSummary] = useState<null | {
    deletedUsers: number;
    deletedUploadFiles: number;
    deletedUploadBytes: number;
    warnings: string[];
  }>(null);

  const summary = summaryQuery.data;
  const tablePreview = useMemo(() => (summary?.tables ?? []).slice().sort((left, right) => right.rowCount - left.rowCount), [summary?.tables]);
  const isConfirmationValid = summary ? confirmationText.trim().toUpperCase() === summary.confirmationText : false;

  if (!user) return null;
  if (user.role !== 'superadmin') {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-viridian">Datenverwaltung</h2>
        <div className="mt-2 text-gray-700">Nicht erlaubt.</div>
      </div>
    );
  }

  const handleExport = async () => {
    try {
      const file = await exportMutation.mutateAsync();
      downloadSystemDataExport(file);
      showToast('Datenexport erstellt.', { type: 'success' });
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Export fehlgeschlagen.'), { type: 'error', durationMs: 4000 });
    }
  };

  const handlePurge = async () => {
    if (!summary) return;

    try {
      const result = await purgeMutation.mutateAsync({ password, confirmationText });
      setPurgeConfirmOpen(false);
      setScope(null);
      setPassword('');
      setConfirmationText('');
      setLastPurgeSummary({
        deletedUsers: result.deletedUsers,
        deletedUploadFiles: result.deletedUploadFiles,
        deletedUploadBytes: result.deletedUploadBytes,
        warnings: result.warnings,
      });
      await summaryQuery.refetch();
      showToast('Alle Nicht-Superadmin-Daten wurden gelöscht.', { type: 'success', durationMs: 4500 });
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Löschen fehlgeschlagen.'), { type: 'error', durationMs: 4500 });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div>
          <h2 className="text-3xl font-bold text-viridian">Datenverwaltung</h2>
          <p className="text-gray-600 mt-1">
            Globaler Superadmin-Bereich für vollständigen Datenexport und irreversible Gesamtlöschung.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900 flex gap-3">
        <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          Diese Funktionen arbeiten immer global und ignorieren den aktuell gewählten Organisations-Scope. Superadmins bleiben erhalten und werden nach einer Gesamtlöschung automatisch aus allen Organisationen gelöst.
        </div>
      </div>

      {summaryQuery.isLoading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
          Lade Datenübersicht…
        </div>
      )}
      {summaryQuery.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {getApiErrorMessage(summaryQuery.error, 'Fehler beim Laden der Datenübersicht.')}
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryCard icon={Database} label="Tabellen" value={summary.totals.managedTables} accent="bg-blue-100 text-blue-600" />
            <SummaryCard icon={FileArchive} label="Datensätze" value={summary.totals.databaseRows} accent="bg-emerald-100 text-emerald-600" />
            <SummaryCard icon={HardDrive} label="Upload-Dateien" value={summary.totals.uploadFiles} accent="bg-amber-100 text-amber-600" />
            <SummaryCard icon={ShieldCheck} label="Superadmins" value={summary.superadmins.length} accent="bg-violet-100 text-violet-600" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-semibold text-gray-900">Vollständiger Export</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    ZIP mit bereinigter Excel-Arbeitsmappe, manifest.json, JSON- und CSV-Dateien je Tabelle sowie allen Upload-Dateien.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-viridian text-white hover:bg-viridian/90 transition-colors disabled:opacity-60"
                  onClick={() => void handleExport()}
                  disabled={exportMutation.isPending}
                >
                  <Download className="w-4 h-4" />
                  {exportMutation.isPending ? 'Export läuft…' : 'ZIP herunterladen'}
                </button>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div className="rounded-xl bg-gray-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Upload-Speicher</div>
                    <div className="text-xl font-semibold text-gray-800 mt-1">{formatBytes(summary.totals.uploadBytes)}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Bestätigung nach Export</div>
                    <div className="text-sm text-gray-700 mt-1">Der Export verändert keine Daten und benötigt keine Passwort-Freigabe.</div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-sm font-medium text-gray-800">
                    Tabellenübersicht
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-gray-500">
                          <th className="text-left px-4 py-3 font-semibold">Tabelle</th>
                          <th className="text-right px-4 py-3 font-semibold">Zeilen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tablePreview.map((table) => (
                          <tr key={table.tableName} className="hover:bg-gray-50/60">
                            <td className="px-4 py-2.5 text-gray-800">{table.tableName}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{table.rowCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-red-100 bg-red-50 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-900">Gesamtlöschung</h3>
                  <p className="text-sm text-red-700 mt-1">
                    Löscht alle Organisations-, Benutzer-, Projekt-, Aktivitäts-, Audit- und Upload-Daten. Erhalten bleiben ausschließlich Superadmins.
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    Irreversibel. Vorher immer den Export ausführen. Nach der Löschung wird der Scope auf den globalen Superadmin-Bereich zurückgesetzt.
                  </div>
                </div>

                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Erhaltene Superadmins</div>
                  <div className="mt-2 space-y-1 text-sm text-gray-700">
                    {summary.superadmins.map((admin) => (
                      <div key={admin.id}>{admin.name || 'Superadmin'} · {admin.email}</div>
                    ))}
                  </div>
                </div>

                <label className="block text-sm text-gray-700">
                  <span className="font-medium">Aktuelles Passwort</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
                    placeholder="Passwort zur Bestätigung eingeben"
                    autoComplete="current-password"
                  />
                </label>

                <label className="block text-sm text-gray-700">
                  <span className="font-medium">Bestätigungstext</span>
                  <span className="block text-xs text-gray-500 mt-1">Bitte exakt {summary.confirmationText} eingeben.</span>
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={(event) => setConfirmationText(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
                    placeholder={summary.confirmationText}
                    spellCheck={false}
                  />
                </label>

                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
                  onClick={() => setPurgeConfirmOpen(true)}
                  disabled={purgeMutation.isPending || !password.trim() || !isConfirmationValid}
                >
                  <Trash2 className="w-4 h-4" />
                  {purgeMutation.isPending ? 'Löschung läuft…' : 'Alle Nicht-Superadmin-Daten löschen'}
                </button>

                {lastPurgeSummary && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 space-y-1">
                    <div>{lastPurgeSummary.deletedUsers} Benutzerkonten gelöscht.</div>
                    <div>{lastPurgeSummary.deletedUploadFiles} Upload-Dateien entfernt ({formatBytes(lastPurgeSummary.deletedUploadBytes)}).</div>
                    {lastPurgeSummary.warnings.length > 0 && (
                      <div className="text-amber-800">
                        Hinweise: {lastPurgeSummary.warnings.join(' | ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      <ConfirmModal
        open={purgeConfirmOpen}
        title="Gesamtlöschung bestätigen"
        message={
          <div className="space-y-3">
            <p>Wirklich alle Nicht-Superadmin-Daten dauerhaft löschen?</p>
            <p className="text-red-700 font-medium">Dieser Vorgang kann nicht rückgängig gemacht werden.</p>
          </div>
        }
        confirmLabel={purgeMutation.isPending ? 'Löschung läuft…' : 'Endgültig löschen'}
        cancelLabel="Abbrechen"
        onConfirm={() => {
          void handlePurge();
        }}
        onCancel={() => {
          if (!purgeMutation.isPending) setPurgeConfirmOpen(false);
        }}
      />
    </div>
  );
}