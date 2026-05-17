import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckSquare, ChevronDown, ChevronUp, Clock, Copy, Database, Download, FileArchive, HardDrive, Image as ImageIcon, Search, Server, ShieldAlert, ShieldCheck, Square, Trash2, Upload } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import Modal from '@/components/Modal';
import ProtectedImage from '@/components/ProtectedImage';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth';
import { useOrgScope } from '@/lib/orgScope';
import {
  downloadSystemDataExport,
  getApiErrorMessage,
  type SystemDataUploadItem,
  useDeleteSystemDataUploads,
  useImportSystemData,
  useInspectSystemDataImport,
  useSystemDataUploads,
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

function formatDateTime(value?: string | null) {
  if (!value) return 'Unbekannt';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('de-DE');
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
    <div className="system-data-summary-card bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${accent}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="system-data-summary-label text-sm text-gray-500 font-medium">{label}</div>
        <div className="system-data-summary-value text-2xl font-bold text-gray-900 mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function formatUploadReferenceLabel(upload: SystemDataUploadItem) {
  if (!upload.referenceCount) return 'Keine Verknüpfung';
  const parts: string[] = [];
  if (upload.referenceBreakdown.projects) parts.push(`${upload.referenceBreakdown.projects} Projekte`);
  if (upload.referenceBreakdown.projectTemplates) parts.push(`${upload.referenceBreakdown.projectTemplates} Vorlagen`);
  if (upload.referenceBreakdown.userAvatars) parts.push(`${upload.referenceBreakdown.userAvatars} Avatare`);
  return parts.join(' · ');
}

function renderUploadReferenceDetails(upload: SystemDataUploadItem) {
  const blocks: React.ReactNode[] = [];

  if (upload.referenceDetails.projects.length) {
    blocks.push(
      <div key="projects" className="space-y-1">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Projekte</div>
        {upload.referenceDetails.projects.map((project) => (
          <div key={project.id} className="text-xs text-gray-700 rounded-lg bg-gray-50 px-2.5 py-2">
            <div className="font-medium text-gray-900">{project.title}</div>
            <div className="text-gray-500 break-all">ID: {project.id}</div>
          </div>
        ))}
      </div>,
    );
  }

  if (upload.referenceDetails.projectTemplates.length) {
    blocks.push(
      <div key="templates" className="space-y-1">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Vorlagen</div>
        {upload.referenceDetails.projectTemplates.map((template) => (
          <div key={template.id} className="text-xs text-gray-700 rounded-lg bg-gray-50 px-2.5 py-2">
            <div className="font-medium text-gray-900">{template.title}</div>
            <div className="text-gray-500 break-all">ID: {template.id}</div>
          </div>
        ))}
      </div>,
    );
  }

  if (upload.referenceDetails.userAvatars.length) {
    blocks.push(
      <div key="avatars" className="space-y-1">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Benutzer-Avatare</div>
        {upload.referenceDetails.userAvatars.map((user) => (
          <div key={user.id} className="text-xs text-gray-700 rounded-lg bg-gray-50 px-2.5 py-2">
            <div className="font-medium text-gray-900">{user.name || user.email}</div>
            <div className="text-gray-500 break-all">{user.email}</div>
          </div>
        ))}
      </div>,
    );
  }

  return blocks;
}

function AuthorizedUploadThumbnail({ upload }: { upload: SystemDataUploadItem }) {
  if (!upload.isImage) {
    return (
      <div className="w-full h-28 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400">
        <FileArchive className="w-7 h-7" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-28 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
        <ImageIcon className="w-7 h-7" />
      </div>
      <ProtectedImage
        src={upload.url}
        alt={upload.filename}
        className="relative z-[1] w-full h-full object-cover"
      />
    </div>
  );
}

const EASY_BACKUP_COMMAND = '.\\scripts\\onprem-backup-easy.ps1 -OpenFolder';
const EASY_RESTORE_COMMAND = '.\\scripts\\onprem-restore-easy.ps1';
const TECHNICAL_BACKUP_COMMAND = '.\\scripts\\onprem-backup.ps1 -ComposeFile docker-compose.onprem.yml -EnvFile .env.onprem -RetentionDays 14';
const TECHNICAL_RESTORE_COMMAND = '.\\scripts\\onprem-restore.ps1 -BackupDir .\\backups\\stato-onprem-YYYYMMDD-HHMMSS -ConfirmText "RESTORE STATO BACKUP"';
const DAILY_OPS_COMMAND = 'powershell.exe -ExecutionPolicy Bypass -File .\\scripts\\onprem-daily-ops.ps1';
const TASK_SCHEDULER_XML = '.\\scripts\\onprem-daily-backup-task.xml';
const CONTAINER_BACKUP_COMMAND = '/usr/local/bin/stato-container-backup';

function CommandSnippet({
  label,
  command,
  onCopy,
}: {
  label: string;
  command: string;
  onCopy: (command: string, label: string) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{label}</div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => onCopy(command, label)}
          title="Befehl kopieren"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
      <pre className="px-4 py-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-all"><code>{command}</code></pre>
    </div>
  );
}

export default function SuperAdminSystemData() {
  const { user } = useAuth();
  const { setScope } = useOrgScope();
  const { showToast } = useToast();
  const summaryQuery = useSystemDataSummary();
  const exportMutation = useExportSystemData();
  const inspectImportMutation = useInspectSystemDataImport();
  const importMutation = useImportSystemData();
  const purgeMutation = usePurgeSystemData();
  const deleteUploadsMutation = useDeleteSystemDataUploads();

  const [password, setPassword] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreConfirmationText, setRestoreConfirmationText] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPurgeOpen, setIsPurgeOpen] = useState(false);
  const [isUploadsOpen, setIsUploadsOpen] = useState(false);
  const [uploadSearch, setUploadSearch] = useState('');
  const [showOrphanedOnly, setShowOrphanedOnly] = useState(false);
  const [selectedUploadPaths, setSelectedUploadPaths] = useState<string[]>([]);
  const [expandedUploadPaths, setExpandedUploadPaths] = useState<string[]>([]);
  const [uploadsToDelete, setUploadsToDelete] = useState<SystemDataUploadItem[]>([]);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [lastImportSummary, setLastImportSummary] = useState<null | {
    importedTables: number;
    importedUploadFiles: number;
    importedUploadBytes: number;
    warnings: string[];
  }>(null);
  const [lastPurgeSummary, setLastPurgeSummary] = useState<null | {
    deletedUsers: number;
    deletedUploadFiles: number;
    deletedUploadBytes: number;
    warnings: string[];
  }>(null);

  const summary = summaryQuery.data;
  const uploadsQuery = useSystemDataUploads(isUploadsOpen);
  const tablePreview = useMemo(() => (summary?.tables ?? []).slice().sort((left, right) => right.rowCount - left.rowCount), [summary?.tables]);
  const deferredUploadSearch = useDeferredValue(uploadSearch.trim().toLowerCase());
  const uploads = uploadsQuery.data?.uploads ?? [];
  const selectedUploadPathSet = useMemo(() => new Set(selectedUploadPaths), [selectedUploadPaths]);
  const expandedUploadPathSet = useMemo(() => new Set(expandedUploadPaths), [expandedUploadPaths]);
  const filteredUploads = useMemo(() => {
    return uploads.filter((upload) => {
      if (showOrphanedOnly && upload.referenceCount > 0) return false;
      if (!deferredUploadSearch) return true;
      const haystack = `${upload.filename} ${upload.relativePath}`.toLowerCase();
      return haystack.includes(deferredUploadSearch);
    });
  }, [deferredUploadSearch, showOrphanedOnly, uploads]);
  const selectedUploads = useMemo(
    () => uploads.filter((upload) => selectedUploadPathSet.has(upload.relativePath)),
    [selectedUploadPathSet, uploads],
  );
  const allFilteredSelected = filteredUploads.length > 0 && filteredUploads.every((upload) => selectedUploadPathSet.has(upload.relativePath));
  const uploadStats = useMemo(() => {
    return filteredUploads.reduce((acc, upload) => {
      acc.bytes += upload.size;
      if (upload.referenceCount > 0) acc.referenced += 1;
      else acc.orphaned += 1;
      return acc;
    }, { bytes: 0, referenced: 0, orphaned: 0 });
  }, [filteredUploads]);
  const isConfirmationValid = summary ? confirmationText.trim().toUpperCase() === summary.confirmationText : false;
  const importPreview = inspectImportMutation.data;
  const restoreConfirmationTarget = importPreview?.confirmationText || summary?.restoreConfirmationText || '';
  const isRestoreConfirmationValid = restoreConfirmationTarget
    ? restoreConfirmationText.trim().toUpperCase() === restoreConfirmationTarget
    : false;

  useEffect(() => {
    const validPaths = new Set(uploads.map((upload) => upload.relativePath));
    setSelectedUploadPaths((current) => current.filter((path) => validPaths.has(path)));
    setExpandedUploadPaths((current) => current.filter((path) => validPaths.has(path)));
    setUploadsToDelete((current) => current.filter((upload) => validPaths.has(upload.relativePath)));
  }, [uploads]);

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

  const handleCopyCommand = async (command: string, label: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(command);
      showToast(`${label} kopiert.`, { type: 'success' });
    } catch {
      showToast('Befehl konnte nicht kopiert werden.', { type: 'error', durationMs: 3500 });
    }
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    setRestoreFile(file);
    setRestoreConfirmationText('');
    setLastImportSummary(null);

    if (!file) {
      inspectImportMutation.reset();
      return;
    }

    try {
      await inspectImportMutation.mutateAsync(file);
      showToast('Backup geprüft. Restore kann gestartet werden.', { type: 'success' });
    } catch (error) {
      setRestoreFile(null);
      showToast(getApiErrorMessage(error, 'ZIP-Prüfung fehlgeschlagen.'), { type: 'error', durationMs: 4500 });
    }
  };

  const handleImport = async () => {
    if (!restoreFile) return;

    try {
      const result = await importMutation.mutateAsync({
        file: restoreFile,
        password: restorePassword,
        confirmationText: restoreConfirmationText,
      });

      setRestoreConfirmOpen(false);
      setScope(null);
      setRestoreFile(null);
      setRestorePassword('');
      setRestoreConfirmationText('');
      inspectImportMutation.reset();
      setLastImportSummary({
        importedTables: result.importedTables.length,
        importedUploadFiles: result.importedUploadFiles,
        importedUploadBytes: result.importedUploadBytes,
        warnings: result.warnings,
      });
      await summaryQuery.refetch();
      showToast('Backup wurde vollständig wiederhergestellt.', { type: 'success', durationMs: 5000 });
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Import fehlgeschlagen.'), { type: 'error', durationMs: 5000 });
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

  const handleDeleteUploads = async () => {
    if (!uploadsToDelete.length) return;

    try {
      const result = await deleteUploadsMutation.mutateAsync(uploadsToDelete.map((upload) => upload.relativePath));
      if (result.deleted.length) {
        const deletedSet = new Set(result.deleted.map((item) => item.relativePath));
        setSelectedUploadPaths((current) => current.filter((path) => !deletedSet.has(path)));
      }
      setUploadsToDelete([]);

      if (result.failures.length) {
        showToast(
          `${result.deletedCount} Uploads gelöscht, ${result.failures.length} fehlgeschlagen.`,
          { type: 'error', durationMs: 5500 },
        );
        return;
      }

      const referenceSuffix = result.clearedReferences > 0 ? ` ${result.clearedReferences} Verknüpfungen entfernt.` : '';
      showToast(`${result.deletedCount} Uploads gelöscht.${referenceSuffix}`, { type: 'success', durationMs: 4500 });
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Uploads konnten nicht gelöscht werden.'), { type: 'error', durationMs: 4500 });
    }
  };

  const toggleUploadSelection = (relativePath: string) => {
    setSelectedUploadPaths((current) => (
      current.includes(relativePath)
        ? current.filter((path) => path !== relativePath)
        : [...current, relativePath]
    ));
  };

  const toggleAllFilteredUploads = () => {
    setSelectedUploadPaths((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filteredUploads.forEach((upload) => next.delete(upload.relativePath));
      } else {
        filteredUploads.forEach((upload) => next.add(upload.relativePath));
      }
      return Array.from(next);
    });
  };

  const toggleExpandedUpload = (relativePath: string) => {
    setExpandedUploadPaths((current) => (
      current.includes(relativePath)
        ? current.filter((path) => path !== relativePath)
        : [...current, relativePath]
    ));
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

      <div className="system-data-banner system-data-banner-info rounded-2xl px-5 py-4 text-sm flex gap-3">
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
        <div className="system-data-banner system-data-banner-danger rounded-xl p-4">
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

          <div className="space-y-6">
              <section className="system-data-panel bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="system-data-panel-header px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="system-data-panel-title font-semibold text-gray-900">Vollständiger Export</h3>
                    <p className="system-data-panel-copy text-sm text-gray-500 mt-1">
                      ZIP mit bereinigter Excel-Arbeitsmappe, manifest.json, JSON- und CSV-Dateien je Tabelle sowie allen Upload-Dateien.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setIsUploadsOpen(true)}
                    >
                      <ImageIcon className="w-4 h-4" />
                      Uploads verwalten
                    </button>
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

              <section className="system-data-panel system-data-panel-info bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden">
                <button
                  type="button"
                  className="system-data-collapse-header system-data-collapse-header-info w-full px-5 py-4 border-b flex items-start justify-between gap-4 text-left"
                  onClick={() => setIsBackupOpen((current) => !current)}
                  aria-expanded={isBackupOpen}
                >
                  <div className="flex items-start gap-3">
                    <Server className="system-data-info-icon w-5 h-5 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-semibold">Betriebsbackup</h3>
                      <p className="text-sm mt-1">
                        Technischer Docker-Backup-Pfad fuer Postgres und Upload-Volume. Fuer Mittwald bevorzugt als Container-Cronjob ueber den Service backup.
                      </p>
                    </div>
                  </div>
                  <span className="system-data-collapse-toggle system-data-collapse-toggle-info inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shrink-0">
                    {isBackupOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {isBackupOpen ? 'Einklappen' : 'Ausklappen'}
                  </span>
                </button>

                {isBackupOpen && (
                  <div className="p-5 space-y-5">
                    <div className="flex justify-start">
                      <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                        <Clock className="w-4 h-4" />
                        Automatisierbar
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Ausfuehrung</div>
                        <div className="mt-1 text-sm font-medium text-gray-800">Backup-Container</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Sicherung</div>
                        <div className="mt-1 text-sm font-medium text-gray-800">Postgres-Dump + Uploads</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Aufbewahrung</div>
                        <div className="mt-1 text-sm font-medium text-gray-800">14 Tage lokal im Beispiel</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Mittwald Cronjob</div>
                        <div className="mt-1 text-sm font-medium text-gray-800">Container backup</div>
                      </div>
                    </div>

                    <div className="system-data-banner system-data-banner-info rounded-xl px-4 py-3 text-sm flex gap-3">
                      <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        Der Webbereich startet keine Docker-Kommandos selbst. Bei Mittwald den Cronjob-Typ Container waehlen, Container backup verknuepfen und das backup-data Volume zusaetzlich per Projektbackup sichern.
                      </div>
                    </div>

                    <div className="space-y-3">
                      <CommandSnippet label="Einfaches Host-Backup" command={EASY_BACKUP_COMMAND} onCopy={handleCopyCommand} />
                      <CommandSnippet label="Einfaches Host-Restore" command={EASY_RESTORE_COMMAND} onCopy={handleCopyCommand} />
                      <CommandSnippet label="Mittwald Container-Cronjob" command={CONTAINER_BACKUP_COMMAND} onCopy={handleCopyCommand} />
                      <CommandSnippet label="Erweitertes Host-Backup" command={TECHNICAL_BACKUP_COMMAND} onCopy={handleCopyCommand} />
                      <CommandSnippet label="Erweitertes Host-Restore" command={TECHNICAL_RESTORE_COMMAND} onCopy={handleCopyCommand} />
                      <CommandSnippet label="Daily Ops / Scheduler" command={DAILY_OPS_COMMAND} onCopy={handleCopyCommand} />
                      <CommandSnippet label="Aufgabenplaner XML" command={TASK_SCHEDULER_XML} onCopy={handleCopyCommand} />
                    </div>
                  </div>
                )}
              </section>

              <section className="system-data-panel system-data-panel-import bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
                <button
                  type="button"
                  className="system-data-collapse-header system-data-collapse-header-import w-full px-5 py-4 border-b flex items-start justify-between gap-4 text-left"
                  onClick={() => setIsImportOpen((current) => !current)}
                  aria-expanded={isImportOpen}
                >
                  <div>
                    <h3 className="font-semibold">Vollständiger Import</h3>
                    <p className="text-sm mt-1">
                      Spielt ein exportiertes ZIP als Voll-Restore ein und ersetzt den aktuellen Datenbestand komplett.
                    </p>
                  </div>
                  <span className="system-data-collapse-toggle system-data-collapse-toggle-import inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shrink-0">
                    {isImportOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {isImportOpen ? 'Einklappen' : 'Ausklappen'}
                  </span>
                </button>

                {isImportOpen && (
                  <div className="p-5 space-y-4">
                    <div className="system-data-banner system-data-banner-warning rounded-xl px-4 py-3 text-sm flex gap-3">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        Replace-All-Restore: Bestehende Organisations-, Benutzer-, Projekt-, Aktivitäts- und Upload-Daten werden vollständig ersetzt.
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />
                        ZIP auswählen
                        <input
                          type="file"
                          accept=".zip,application/zip"
                          className="hidden"
                          onChange={(event) => {
                            void handleImportFileChange(event);
                          }}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Ausgewählte Datei</div>
                        <div className="mt-1 text-sm font-medium text-gray-800 break-all">{restoreFile?.name || 'Noch keine ZIP ausgewählt'}</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Prüfstatus</div>
                        <div className="mt-1 text-sm font-medium text-gray-800">
                          {inspectImportMutation.isPending ? 'ZIP wird geprüft…' : importPreview ? 'ZIP geprüft und restorebereit' : 'Noch nicht geprüft'}
                        </div>
                      </div>
                    </div>

                    {inspectImportMutation.error && (
                      <div className="system-data-banner system-data-banner-danger rounded-xl px-4 py-3 text-sm">
                        {getApiErrorMessage(inspectImportMutation.error, 'ZIP-Prüfung fehlgeschlagen.')}
                      </div>
                    )}

                    {importPreview && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="rounded-xl bg-gray-50 px-4 py-3">
                            <div className="text-xs uppercase tracking-wide text-gray-500">Exportiert am</div>
                            <div className="mt-1 text-sm font-medium text-gray-800">{formatDateTime(importPreview.generatedAt)}</div>
                          </div>
                          <div className="rounded-xl bg-gray-50 px-4 py-3">
                            <div className="text-xs uppercase tracking-wide text-gray-500">Datensätze</div>
                            <div className="mt-1 text-sm font-medium text-gray-800">{importPreview.totals.databaseRows}</div>
                          </div>
                          <div className="rounded-xl bg-gray-50 px-4 py-3">
                            <div className="text-xs uppercase tracking-wide text-gray-500">Uploads</div>
                            <div className="mt-1 text-sm font-medium text-gray-800">{importPreview.totals.uploadFiles} · {formatBytes(importPreview.totals.uploadBytes)}</div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-sm font-medium text-gray-800">
                            Importvorschau
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs uppercase tracking-wide text-gray-500">
                                  <th className="text-left px-4 py-3 font-semibold">Tabelle</th>
                                  <th className="text-right px-4 py-3 font-semibold">Zeilen</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {importPreview.tables.map((table) => (
                                  <tr key={table.tableName} className="hover:bg-gray-50/60">
                                    <td className="px-4 py-2.5 text-gray-800">{table.tableName}</td>
                                    <td className="px-4 py-2.5 text-right text-gray-600">{table.rowCount}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {importPreview.warnings.length > 0 && (
                          <div className="system-data-banner system-data-banner-warning rounded-xl px-4 py-3 text-sm space-y-1">
                            {importPreview.warnings.map((warning) => (
                              <div key={warning}>{warning}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <label className="block text-sm text-gray-700">
                      <span className="font-medium">Aktuelles Passwort</span>
                      <input
                        type="password"
                        value={restorePassword}
                        onChange={(event) => setRestorePassword(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300"
                        placeholder="Passwort zur Restore-Freigabe eingeben"
                        autoComplete="current-password"
                      />
                    </label>

                    <label className="block text-sm text-gray-700">
                      <span className="font-medium">Bestätigungstext</span>
                      <span className="block text-xs text-gray-500 mt-1">Bitte exakt {restoreConfirmationTarget || 'BACKUP IMPORTIEREN'} eingeben.</span>
                      <input
                        type="text"
                        value={restoreConfirmationText}
                        onChange={(event) => setRestoreConfirmationText(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300"
                        placeholder={restoreConfirmationTarget || 'BACKUP IMPORTIEREN'}
                        spellCheck={false}
                      />
                    </label>

                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
                      onClick={() => setRestoreConfirmOpen(true)}
                      disabled={
                        importMutation.isPending
                        || inspectImportMutation.isPending
                        || !restoreFile
                        || !importPreview
                        || !restorePassword.trim()
                        || !isRestoreConfirmationValid
                      }
                    >
                      <Upload className="w-4 h-4" />
                      {importMutation.isPending ? 'Restore läuft…' : 'Backup vollständig wiederherstellen'}
                    </button>

                    {lastImportSummary && (
                      <div className="system-data-banner system-data-banner-success rounded-xl px-4 py-3 text-sm space-y-1">
                        <div>{lastImportSummary.importedTables} Tabellen wiederhergestellt.</div>
                        <div>{lastImportSummary.importedUploadFiles} Upload-Dateien importiert ({formatBytes(lastImportSummary.importedUploadBytes)}).</div>
                        {lastImportSummary.warnings.length > 0 && (
                          <div className="system-data-warning-copy">Hinweise: {lastImportSummary.warnings.join(' | ')}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>

            <section className="system-data-panel system-data-panel-danger bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
              <button
                type="button"
                className="system-data-collapse-header system-data-collapse-header-danger w-full px-5 py-4 border-b flex items-start justify-between gap-4 text-left"
                onClick={() => setIsPurgeOpen((current) => !current)}
                aria-expanded={isPurgeOpen}
              >
                <div className="flex items-start gap-3">
                  <ShieldAlert className="system-data-danger-icon w-5 h-5 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold">Gesamtlöschung</h3>
                    <p className="text-sm mt-1">
                      Löscht alle Organisations-, Benutzer-, Projekt-, Aktivitäts-, Audit- und Upload-Daten. Erhalten bleiben ausschließlich Superadmins.
                    </p>
                  </div>
                </div>
                <span className="system-data-collapse-toggle system-data-collapse-toggle-danger inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shrink-0">
                  {isPurgeOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {isPurgeOpen ? 'Einklappen' : 'Ausklappen'}
                </span>
              </button>

              {isPurgeOpen && (
              <div className="p-5 space-y-4">
                <div className="system-data-banner system-data-banner-danger rounded-xl px-4 py-3 text-sm flex gap-3">
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
                  <div className="system-data-banner system-data-banner-success rounded-xl px-4 py-3 text-sm space-y-1">
                    <div>{lastPurgeSummary.deletedUsers} Benutzerkonten gelöscht.</div>
                    <div>{lastPurgeSummary.deletedUploadFiles} Upload-Dateien entfernt ({formatBytes(lastPurgeSummary.deletedUploadBytes)}).</div>
                    {lastPurgeSummary.warnings.length > 0 && (
                      <div className="system-data-warning-copy">
                        Hinweise: {lastPurgeSummary.warnings.join(' | ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}
            </section>
          </div>
        </>
      )}

      <ConfirmModal
        open={uploadsToDelete.length > 0}
        title={uploadsToDelete.length > 1 ? 'Ausgewählte Uploads wirklich löschen?' : 'Upload wirklich löschen?'}
        message={
          <div className="space-y-3">
            <p>
              {uploadsToDelete.length > 1
                ? `${uploadsToDelete.length} Dateien werden dauerhaft aus dem Upload-Speicher entfernt.`
                : `${uploadsToDelete[0]?.filename || 'Datei'} wird dauerhaft aus dem Upload-Speicher entfernt.`}
            </p>
            {uploadsToDelete.length === 1 && uploadsToDelete[0] && (
              <p className="text-sm text-gray-700">
                Aktuelle Verknüpfungen: <span className="font-medium">{formatUploadReferenceLabel(uploadsToDelete[0])}</span>
              </p>
            )}
            {uploadsToDelete.some((upload) => upload.referenceCount > 0) ? (
              <p className="text-amber-700 font-medium">Bekannte Referenzen in Projekten, Vorlagen und Avataren werden dabei automatisch entfernt.</p>
            ) : (
              <p className="text-gray-600">Es liegen derzeit keine bekannten Verknüpfungen vor.</p>
            )}
          </div>
        }
        confirmLabel={deleteUploadsMutation.isPending ? 'Lösche…' : uploadsToDelete.length > 1 ? 'Auswahl löschen' : 'Upload löschen'}
        cancelLabel="Abbrechen"
        onConfirm={() => {
          void handleDeleteUploads();
        }}
        onCancel={() => {
          if (!deleteUploadsMutation.isPending) setUploadsToDelete([]);
        }}
      />

      <ConfirmModal
        open={restoreConfirmOpen}
        title="Vollständigen Restore bestätigen"
        message={
          <div className="space-y-3">
            <p>Wirklich alle aktuellen Daten durch das ausgewählte Backup ersetzen?</p>
            <p className="text-amber-700 font-medium">Der aktuelle Datenbestand wird vollständig überschrieben.</p>
          </div>
        }
        confirmLabel={importMutation.isPending ? 'Restore läuft…' : 'Restore jetzt ausführen'}
        cancelLabel="Abbrechen"
        onConfirm={() => {
          void handleImport();
        }}
        onCancel={() => {
          if (!importMutation.isPending) setRestoreConfirmOpen(false);
        }}
      />

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

      <Modal
        open={isUploadsOpen}
        onClose={() => {
          if (!deleteUploadsMutation.isPending) setIsUploadsOpen(false);
        }}
        title="Upload-Verwaltung"
        maxWidth="6xl"
      >
        <div className="space-y-5">
          <div className="system-data-banner system-data-banner-info rounded-xl px-4 py-3 text-sm flex gap-3">
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              Sichtbar sind alle Dateien aus dem Upload-Speicher. Die Referenzzahl zählt bekannte Verknüpfungen aus Projekten, Projektvorlagen und Benutzer-Avataren.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Dateien</div>
              <div className="mt-1 text-xl font-semibold text-gray-800">{filteredUploads.length}</div>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Mit Verknüpfung</div>
              <div className="mt-1 text-xl font-semibold text-gray-800">{uploadStats.referenced}</div>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Ohne Verknüpfung</div>
              <div className="mt-1 text-xl font-semibold text-gray-800">{uploadStats.orphaned}</div>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Gefilterter Speicher</div>
              <div className="mt-1 text-xl font-semibold text-gray-800">{formatBytes(uploadStats.bytes)}</div>
            </div>
          </div>

          <label className="block text-sm text-gray-700">
            <span className="font-medium">Dateien filtern</span>
            <div className="mt-2 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={uploadSearch}
                onChange={(event) => setUploadSearch(event.target.value)}
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-viridian/20 focus:border-viridian/40"
                placeholder="Dateiname oder Pfad suchen"
              />
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showOrphanedOnly ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setShowOrphanedOnly((current) => !current)}
            >
              {showOrphanedOnly ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              Nur unverknüpfte Uploads
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={toggleAllFilteredUploads}
              disabled={!filteredUploads.length}
            >
              {allFilteredSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {allFilteredSelected ? 'Gefilterte Auswahl aufheben' : 'Gefilterte auswählen'}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
              onClick={() => setUploadsToDelete(selectedUploads)}
              disabled={!selectedUploads.length || deleteUploadsMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
              Ausgewählte löschen ({selectedUploads.length})
            </button>
          </div>

          {uploadsQuery.isLoading && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-gray-500">
              Upload-Liste wird geladen…
            </div>
          )}

          {uploadsQuery.error && (
            <div className="system-data-banner system-data-banner-danger rounded-xl px-4 py-3 text-sm">
              {getApiErrorMessage(uploadsQuery.error, 'Upload-Liste konnte nicht geladen werden.')}
            </div>
          )}

          {!uploadsQuery.isLoading && !uploadsQuery.error && filteredUploads.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-gray-500">
              Keine Upload-Dateien für den aktuellen Filter gefunden.
            </div>
          )}

          {filteredUploads.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {filteredUploads.map((upload) => {
                const isSelected = selectedUploadPathSet.has(upload.relativePath);
                const isExpanded = expandedUploadPathSet.has(upload.relativePath);
                const details = renderUploadReferenceDetails(upload);
                return (
                  <div key={upload.relativePath} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-viridian focus:ring-viridian/30"
                          checked={isSelected}
                          onChange={() => toggleUploadSelection(upload.relativePath)}
                        />
                        Markieren
                      </label>
                      {upload.referenceCount > 0 && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-medium text-viridian hover:text-viridian/80"
                          onClick={() => toggleExpandedUpload(upload.relativePath)}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {isExpanded ? 'Details ausblenden' : 'Details anzeigen'}
                        </button>
                      )}
                    </div>

                    <AuthorizedUploadThumbnail upload={upload} />

                    <div className="space-y-1">
                      <div className="text-[13px] font-semibold text-gray-900 break-all leading-5">{upload.filename}</div>
                      <div className="text-xs text-gray-500 break-all">{upload.relativePath}</div>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-gray-100 text-gray-700 font-medium text-xs">
                        {formatBytes(upload.size)}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${upload.referenceCount ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {upload.referenceCount ? `${upload.referenceCount} Verknüpfungen` : 'Unverknüpft'}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 min-h-[2rem]">
                      {formatUploadReferenceLabel(upload)}
                    </div>

                    {isExpanded && details.length > 0 && (
                      <div className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-3 max-h-48 overflow-y-auto">
                        {details}
                      </div>
                    )}

                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                      onClick={() => setUploadsToDelete([upload])}
                      disabled={deleteUploadsMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                      Datei löschen
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}