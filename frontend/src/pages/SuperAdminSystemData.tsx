import { Fragment, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckSquare, ChevronDown, ChevronUp, Clock, Copy, Database, Download, ExternalLink, FileArchive, HardDrive, Image as ImageIcon, Search, Server, ShieldAlert, ShieldCheck, Square, Trash2, Upload } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Button, DeleteIconButton, IconButton } from '@/components/ui/Button';
import { api } from '@/lib/api';
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
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';
import { useQueryClient } from '@tanstack/react-query';

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
  return date.toLocaleString(getCurrentIntlLocale());
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
  if (!upload.referenceCount) return autoT('ui_9222dc860dea');
  const parts: string[] = [];
  if (upload.referenceBreakdown.projects) parts.push(autoT('ui_984cf3517a3a', { value0: upload.referenceBreakdown.projects }));
  if (upload.referenceBreakdown.projectDocuments) parts.push(`${upload.referenceBreakdown.projectDocuments} Projektdokumente`);
  if (upload.referenceBreakdown.projectTemplates) parts.push(`${upload.referenceBreakdown.projectTemplates} Vorlagen`);
  if (upload.referenceBreakdown.userAvatars) parts.push(`${upload.referenceBreakdown.userAvatars} Avatare`);
  if (upload.referenceBreakdown.organizationBanners) parts.push(`${upload.referenceBreakdown.organizationBanners} Organisationsbanner`);
  return parts.join(' · ');
}

function renderUploadReferenceDetails(upload: SystemDataUploadItem) {
  const blocks: React.ReactNode[] = [];

  if (upload.referenceDetails.projects.length) {
    blocks.push(
      <div key="projects" className="space-y-1">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{autoT('ui_3930f79f07e5')}</div>
        {upload.referenceDetails.projects.map((project) => (
          <div key={project.id} className="rounded-lg bg-[var(--surface-1)] px-2.5 py-2 text-xs text-[var(--text-secondary)]">
            <div className="font-medium text-[var(--text-primary)]">{project.title}</div>
            <div className="break-all text-[var(--text-muted)]">{autoT('ui_d789a1e992ad')}{' '}{project.id}</div>
          </div>
        ))}
      </div>,
    );
  }

  if (upload.referenceDetails.projectDocuments.length) {
    blocks.push(
      <div key="project-documents" className="space-y-1">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{autoT('ui_bf0baf670db3')}</div>
        {upload.referenceDetails.projectDocuments.map((document) => (
          <div key={document.id} className="rounded-lg bg-[var(--surface-1)] px-2.5 py-2 text-xs text-[var(--text-secondary)]">
            <div className="font-medium text-[var(--text-primary)]">{document.filename}</div>
            <div className="text-[var(--text-muted)]">{document.projectTitle || autoT('ui_5b4a4a84148c')}</div>
            <div className="break-all text-[var(--text-muted)]">{autoT('ui_17ae70e559aa')}{' '}{document.projectId}</div>
          </div>
        ))}
      </div>,
    );
  }

  if (upload.referenceDetails.projectTemplates.length) {
    blocks.push(
      <div key="templates" className="space-y-1">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{autoT('ui_ab41f3ac9b6f')}</div>
        {upload.referenceDetails.projectTemplates.map((template) => (
          <div key={template.id} className="rounded-lg bg-[var(--surface-1)] px-2.5 py-2 text-xs text-[var(--text-secondary)]">
            <div className="font-medium text-[var(--text-primary)]">{template.title}</div>
            <div className="break-all text-[var(--text-muted)]">{autoT('ui_d789a1e992ad')}{' '}{template.id}</div>
          </div>
        ))}
      </div>,
    );
  }

  if (upload.referenceDetails.userAvatars.length) {
    blocks.push(
      <div key="avatars" className="space-y-1">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{autoT('ui_5b0a6e00f3c3')}</div>
        {upload.referenceDetails.userAvatars.map((user) => (
          <div key={user.id} className="rounded-lg bg-[var(--surface-1)] px-2.5 py-2 text-xs text-[var(--text-secondary)]">
            <div className="font-medium text-[var(--text-primary)]">{user.name || user.email}</div>
            <div className="break-all text-[var(--text-muted)]">{user.email}</div>
          </div>
        ))}
      </div>,
    );
  }
  if (upload.referenceDetails.organizationBanners.length) {
    blocks.push(
      <div key="organization-banners">
        <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Organisationsbanner</div>
        <ul className="space-y-1 text-xs text-[var(--text-muted)]">
          {upload.referenceDetails.organizationBanners.map((organization) => (
            <li key={organization.id}>{organization.name}</li>
          ))}
        </ul>
      </div>,
    );
  }

  return blocks;
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
          title={autoT('ui_46792f87a58b')}
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
  const queryClient = useQueryClient();
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
  const [openingUploadPath, setOpeningUploadPath] = useState<string | null>(null);
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
        <h2 className="text-2xl font-bold text-viridian">{autoT('ui_f76dcf52c14e')}</h2>
        <div className="mt-2 text-gray-700">{autoT('ui_9bac42e57f50')}</div>
      </div>
    );
  }

  const handleExport = async () => {
    try {
      const file = await exportMutation.mutateAsync();
      downloadSystemDataExport(file);
      showToast(autoT('ui_674b13e53f9d'), { type: 'success' });
    } catch (error) {
      showToast(getApiErrorMessage(error, autoT('ui_a9695d3efead')), { type: 'error', durationMs: 4000 });
    }
  };

  const handleCopyCommand = async (command: string, label: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(command);
      showToast(`${label} kopiert.`, { type: 'success' });
    } catch {
      showToast(autoT('ui_480a5c78a233'), { type: 'error', durationMs: 3500 });
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
      showToast(autoT('ui_16de1a991444'), { type: 'success' });
    } catch (error) {
      setRestoreFile(null);
      showToast(getApiErrorMessage(error, autoT('ui_689bfa6cfdf6')), { type: 'error', durationMs: 4500 });
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
      await queryClient.invalidateQueries({ predicate: () => true, refetchType: 'active' });
      showToast(autoT('ui_773edec9f96d'), { type: 'success', durationMs: 5000 });
    } catch (error) {
      showToast(getApiErrorMessage(error, autoT('ui_d0d1813dcc84')), { type: 'error', durationMs: 5000 });
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
      await queryClient.invalidateQueries({ predicate: () => true, refetchType: 'active' });
      showToast(autoT('ui_c9f6169b6b47'), { type: 'success', durationMs: 4500 });
    } catch (error) {
      showToast(getApiErrorMessage(error, autoT('ui_ef3183f1c913')), { type: 'error', durationMs: 4500 });
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
          autoT('ui_d122687ef603', { value0: result.deletedCount, value1: result.failures.length }),
          { type: 'error', durationMs: 5500 },
        );
        return;
      }

      const referenceSuffix = result.clearedReferences > 0 ? autoT('ui_3bdf7311696f', { value0: result.clearedReferences }) : '';
      showToast(autoT('ui_0fa39bb896b6', { value0: result.deletedCount, value1: referenceSuffix }), { type: 'success', durationMs: 4500 });
    } catch (error) {
      showToast(getApiErrorMessage(error, autoT('ui_74bce8319875')), { type: 'error', durationMs: 4500 });
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

  const handleOpenUpload = async (upload: SystemDataUploadItem) => {
    // Open the tab synchronously so browsers retain the user's click gesture;
    // the protected file itself is loaded afterwards with the authenticated API client.
    const previewWindow = window.open('', '_blank');
    if (previewWindow) previewWindow.opener = null;

    setOpeningUploadPath(upload.relativePath);
    try {
      const response = await api.get<Blob>(upload.url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);

      if (previewWindow) {
        previewWindow.location.replace(blobUrl);
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }

      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60_000);
    } catch (error) {
      previewWindow?.close();
      showToast(getApiErrorMessage(error, 'Die Datei konnte nicht geöffnet werden.'), { type: 'error', durationMs: 4000 });
    } finally {
      setOpeningUploadPath(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div>
          <h2 className="text-3xl font-bold text-viridian">{autoT('ui_f76dcf52c14e')}</h2>
          <p className="text-gray-600 mt-1">{autoT('ui_7732f3b2ee0b')}</p>
        </div>
      </div>

      <div className="system-data-banner system-data-banner-info rounded-2xl px-5 py-4 text-sm flex gap-3">
        <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
        <div>{autoT('ui_38834ab67269')}</div>
      </div>

      {summaryQuery.isLoading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">{autoT('ui_18ed7ab75722')}</div>
      )}
      {summaryQuery.error && (
        <div className="system-data-banner system-data-banner-danger rounded-xl p-4">
          {getApiErrorMessage(summaryQuery.error, autoT('ui_8bd1f06b03b3'))}
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryCard icon={Database} label={autoT('ui_9e5124234d89')} value={summary.totals.managedTables} accent="bg-blue-100 text-blue-600" />
            <SummaryCard icon={FileArchive} label={autoT('ui_8649d4bf00f4')} value={summary.totals.databaseRows} accent="bg-emerald-100 text-emerald-600" />
            <SummaryCard icon={HardDrive} label={autoT('ui_33f00eccfdf5')} value={summary.totals.uploadFiles} accent="bg-amber-100 text-amber-600" />
            <SummaryCard icon={ShieldCheck} label={autoT('ui_cdf35a364852')} value={summary.superadmins.length} accent="bg-violet-100 text-violet-600" />
          </div>

          <div className="space-y-6">
              <section className="system-data-panel bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="system-data-panel-header px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="system-data-panel-title font-semibold text-gray-900">{autoT('ui_c9c6393da8da')}</h3>
                    <p className="system-data-panel-copy text-sm text-gray-500 mt-1">{autoT('ui_9479ab856d30')}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setIsUploadsOpen(true)}
                    >
                      <ImageIcon className="w-4 h-4" />{autoT('ui_3bc20ff592c5')}</button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-viridian text-white hover:bg-viridian/90 transition-colors disabled:opacity-60"
                      onClick={() => void handleExport()}
                      disabled={exportMutation.isPending}
                    >
                      <Download className="w-4 h-4" />
                      {exportMutation.isPending ? autoT('ui_05bfaadf5a25') : autoT('ui_593b90e6ae9f')}
                    </button>
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <div className="rounded-xl bg-gray-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_96e5ba918d19')}</div>
                      <div className="text-xl font-semibold text-gray-800 mt-1">{formatBytes(summary.totals.uploadBytes)}</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_4ec326999878')}</div>
                      <div className="text-sm text-gray-700 mt-1">{autoT('ui_7b5aa1f65072')}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-sm font-medium text-gray-800">{autoT('ui_336bcb615f1a')}</div>
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs uppercase tracking-wide text-gray-500">
                            <th className="text-left px-4 py-3 font-semibold">{autoT('ui_13b2e5f4ca0b')}</th>
                            <th className="text-right px-4 py-3 font-semibold">{autoT('ui_eff65c6a4278')}</th>
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
                      <h3 className="font-semibold">{autoT('ui_4bc5e0b95782')}</h3>
                      <p className="text-sm mt-1">{autoT('ui_f14862fcf8ac')}</p>
                    </div>
                  </div>
                  <span className="system-data-collapse-toggle system-data-collapse-toggle-info inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shrink-0">
                    {isBackupOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {isBackupOpen ? autoT('ui_4244f9d32df2') : autoT('ui_94b77e4e53f8')}
                  </span>
                </button>

                {isBackupOpen && (
                  <div className="p-5 space-y-5">
                    <div className="flex justify-start">
                      <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                        <Clock className="w-4 h-4" />{autoT('ui_ec6ea23a910a')}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_5e3e5ab19c0b')}</div>
                        <div className="mt-1 text-sm font-medium text-gray-800">{autoT('ui_aedd223ac97d')}</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_aea7b978f052')}</div>
                        <div className="mt-1 text-sm font-medium text-gray-800">{autoT('ui_9f54fc5f20c3')}</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_b5cbb12dbde1')}</div>
                        <div className="mt-1 text-sm font-medium text-gray-800">{autoT('ui_fa87c21b6066')}</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_85363b18c4d4')}</div>
                        <div className="mt-1 text-sm font-medium text-gray-800">{autoT('ui_ab72b7301ddf')}</div>
                      </div>
                    </div>

                    <div className="system-data-banner system-data-banner-info rounded-xl px-4 py-3 text-sm flex gap-3">
                      <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>{autoT('ui_3e0f3945ca8a')}</div>
                    </div>

                    <div className="space-y-3">
                      <CommandSnippet label={autoT('ui_db682a12e8e1')} command={EASY_BACKUP_COMMAND} onCopy={handleCopyCommand} />
                      <CommandSnippet label={autoT('ui_e6d91c009ff9')} command={EASY_RESTORE_COMMAND} onCopy={handleCopyCommand} />
                      <CommandSnippet label={autoT('ui_8f436819fca0')} command={CONTAINER_BACKUP_COMMAND} onCopy={handleCopyCommand} />
                      <CommandSnippet label={autoT('ui_e7699d891a4e')} command={TECHNICAL_BACKUP_COMMAND} onCopy={handleCopyCommand} />
                      <CommandSnippet label={autoT('ui_8cdb1e27ec83')} command={TECHNICAL_RESTORE_COMMAND} onCopy={handleCopyCommand} />
                      <CommandSnippet label={autoT('ui_c484c7219247')} command={DAILY_OPS_COMMAND} onCopy={handleCopyCommand} />
                      <CommandSnippet label={autoT('ui_f61b0dc08654')} command={TASK_SCHEDULER_XML} onCopy={handleCopyCommand} />
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
                    <h3 className="font-semibold">{autoT('ui_898a7769ec9f')}</h3>
                    <p className="text-sm mt-1">{autoT('ui_e1be8b4aae0d')}</p>
                  </div>
                  <span className="system-data-collapse-toggle system-data-collapse-toggle-import inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shrink-0">
                    {isImportOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {isImportOpen ? autoT('ui_4244f9d32df2') : autoT('ui_94b77e4e53f8')}
                  </span>
                </button>

                {isImportOpen && (
                  <div className="p-5 space-y-4">
                    <div className="system-data-banner system-data-banner-warning rounded-xl px-4 py-3 text-sm flex gap-3">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>{autoT('ui_bedd96388d96')}</div>
                    </div>

                    <div className="flex justify-end">
                      <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />{autoT('ui_5c6e7cf0face')}<input
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
                        <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_4aca1f2407c3')}</div>
                        <div className="mt-1 text-sm font-medium text-gray-800 break-all">{restoreFile?.name || autoT('ui_573141c0c5cd')}</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_89db570b7a2c')}</div>
                        <div className="mt-1 text-sm font-medium text-gray-800">
                          {inspectImportMutation.isPending ? autoT('ui_b1e530ffebdb') : importPreview ? autoT('ui_97010e526cce') : autoT('ui_0f5448773b4a')}
                        </div>
                      </div>
                    </div>

                    {inspectImportMutation.error && (
                      <div className="system-data-banner system-data-banner-danger rounded-xl px-4 py-3 text-sm">
                        {getApiErrorMessage(inspectImportMutation.error, autoT('ui_689bfa6cfdf6'))}
                      </div>
                    )}

                    {importPreview && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="rounded-xl bg-gray-50 px-4 py-3">
                            <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_3fb902f6a06d')}</div>
                            <div className="mt-1 text-sm font-medium text-gray-800">{formatDateTime(importPreview.generatedAt)}</div>
                          </div>
                          <div className="rounded-xl bg-gray-50 px-4 py-3">
                            <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_8649d4bf00f4')}</div>
                            <div className="mt-1 text-sm font-medium text-gray-800">{importPreview.totals.databaseRows}</div>
                          </div>
                          <div className="rounded-xl bg-gray-50 px-4 py-3">
                            <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_227cc640570a')}</div>
                            <div className="mt-1 text-sm font-medium text-gray-800">{importPreview.totals.uploadFiles} · {formatBytes(importPreview.totals.uploadBytes)}</div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-sm font-medium text-gray-800">{autoT('ui_99165b573393')}</div>
                          <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs uppercase tracking-wide text-gray-500">
                                  <th className="text-left px-4 py-3 font-semibold">{autoT('ui_13b2e5f4ca0b')}</th>
                                  <th className="text-right px-4 py-3 font-semibold">{autoT('ui_eff65c6a4278')}</th>
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
                      <span className="font-medium">{autoT('ui_f562caab0113')}</span>
                      <input
                        type="password"
                        value={restorePassword}
                        onChange={(event) => setRestorePassword(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300"
                        placeholder={autoT('ui_ee02f637d645')}
                        autoComplete="current-password"
                      />
                    </label>

                    <label className="block text-sm text-gray-700">
                      <span className="font-medium">{autoT('ui_7ad9424fbbf8')}</span>
                      <span className="block text-xs text-gray-500 mt-1">{autoT('ui_066046320569')}{' '}{restoreConfirmationTarget || 'BACKUP IMPORTIEREN'}{' '}{autoT('ui_17009e659aae')}</span>
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
                      {importMutation.isPending ? autoT('ui_c7a1025df6b2') : autoT('ui_6cf64bf7c7be')}
                    </button>

                    {lastImportSummary && (
                      <div className="system-data-banner system-data-banner-success rounded-xl px-4 py-3 text-sm space-y-1">
                        <div>{lastImportSummary.importedTables}{' '}{autoT('ui_9a3007f40160')}</div>
                        <div>{lastImportSummary.importedUploadFiles}{' '}{autoT('ui_f3f01f5130a2')}{formatBytes(lastImportSummary.importedUploadBytes)}).</div>
                        {lastImportSummary.warnings.length > 0 && (
                          <div className="system-data-warning-copy">{autoT('ui_1ddcdcfe7c82')}{' '}{lastImportSummary.warnings.join(' | ')}</div>
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
                    <h3 className="font-semibold">{autoT('ui_c8494881431f')}</h3>
                    <p className="text-sm mt-1">{autoT('ui_bd8eeddd94d7')}</p>
                  </div>
                </div>
                <span className="system-data-collapse-toggle system-data-collapse-toggle-danger inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shrink-0">
                  {isPurgeOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {isPurgeOpen ? autoT('ui_4244f9d32df2') : autoT('ui_94b77e4e53f8')}
                </span>
              </button>

              {isPurgeOpen && (
              <div className="p-5 space-y-4">
                <div className="system-data-banner system-data-banner-danger rounded-xl px-4 py-3 text-sm flex gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>{autoT('ui_f674d30bba3a')}</div>
                </div>

                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_dbed35d3b261')}</div>
                  <div className="mt-2 space-y-1 text-sm text-gray-700">
                    {summary.superadmins.map((admin) => (
                      <div key={admin.id}>{admin.name || 'Superadmin'} · {admin.email}</div>
                    ))}
                  </div>
                </div>

                <label className="block text-sm text-gray-700">
                  <span className="font-medium">{autoT('ui_f562caab0113')}</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
                    placeholder={autoT('ui_1c6b0f99d34f')}
                    autoComplete="current-password"
                  />
                </label>

                <label className="block text-sm text-gray-700">
                  <span className="font-medium">{autoT('ui_7ad9424fbbf8')}</span>
                  <span className="block text-xs text-gray-500 mt-1">{autoT('ui_066046320569')}{' '}{summary.confirmationText}{' '}{autoT('ui_17009e659aae')}</span>
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={(event) => setConfirmationText(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
                    placeholder={summary.confirmationText}
                    spellCheck={false}
                  />
                </label>

                <Button
                  variant="danger"
                  size="lg"
                  className="w-full"
                  onClick={() => setPurgeConfirmOpen(true)}
                  disabled={purgeMutation.isPending || !password.trim() || !isConfirmationValid}
                >
                  <Trash2 className="w-4 h-4" />
                  {purgeMutation.isPending ? autoT('ui_7f0db1dc1f8e') : autoT('ui_223bdd6ba83d')}
                </Button>

                {lastPurgeSummary && (
                  <div className="system-data-banner system-data-banner-success rounded-xl px-4 py-3 text-sm space-y-1">
                    <div>{lastPurgeSummary.deletedUsers}{' '}{autoT('ui_6b3987082d96')}</div>
                    <div>{lastPurgeSummary.deletedUploadFiles}{' '}{autoT('ui_01fe33a9112c')}{formatBytes(lastPurgeSummary.deletedUploadBytes)}).</div>
                    {lastPurgeSummary.warnings.length > 0 && (
                      <div className="system-data-warning-copy">{autoT('ui_1ddcdcfe7c82')}{lastPurgeSummary.warnings.join(' | ')}
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
        title={uploadsToDelete.length > 1 ? autoT('ui_ce8a18dd748a') : autoT('ui_c2812441c488')}
        message={
          <div className="space-y-3">
            <p>
              {uploadsToDelete.length > 1
                ? autoT('ui_275317a6f9c2', { value0: uploadsToDelete.length })
                : `${uploadsToDelete[0]?.filename || 'Datei'} wird dauerhaft aus dem Upload-Speicher entfernt.`}
            </p>
            {uploadsToDelete.length === 1 && uploadsToDelete[0] && (
              <p className="text-sm text-gray-700">{autoT('ui_c47b9b034c94')}<span className="font-medium">{formatUploadReferenceLabel(uploadsToDelete[0])}</span>
              </p>
            )}
            {uploadsToDelete.some((upload) => upload.referenceCount > 0) ? (
              <p className="text-amber-700 font-medium">{autoT('ui_9c38c2ee7555')}</p>
            ) : (
              <p className="text-gray-600">{autoT('ui_1ac3dda11ed6')}</p>
            )}
          </div>
        }
        confirmLabel={deleteUploadsMutation.isPending ? autoT('ui_2b5a5dd9afbb') : uploadsToDelete.length > 1 ? autoT('ui_e65c67367259') : autoT('ui_4449808ab212')}
        cancelLabel={autoT('ui_07af7cb30fca')}
        onConfirm={() => {
          void handleDeleteUploads();
        }}
        onCancel={() => {
          if (!deleteUploadsMutation.isPending) setUploadsToDelete([]);
        }}
      />

      <ConfirmModal
        open={restoreConfirmOpen}
        title={autoT('ui_76d319d88297')}
        message={
          <div className="space-y-3">
            <p>{autoT('ui_375ba6117b95')}</p>
            <p className="text-amber-700 font-medium">{autoT('ui_551526eae0bd')}</p>
          </div>
        }
        confirmLabel={importMutation.isPending ? autoT('ui_c7a1025df6b2') : autoT('ui_079c5cf6a6d4')}
        cancelLabel={autoT('ui_07af7cb30fca')}
        onConfirm={() => {
          void handleImport();
        }}
        onCancel={() => {
          if (!importMutation.isPending) setRestoreConfirmOpen(false);
        }}
      />

      <ConfirmModal
        open={purgeConfirmOpen}
        title={autoT('ui_e4e382e32cc8')}
        message={
          <div className="space-y-3">
            <p>{autoT('ui_34f615d0bbcc')}</p>
            <p className="text-red-700 font-medium">{autoT('ui_77fa648094e2')}</p>
          </div>
        }
        confirmLabel={purgeMutation.isPending ? autoT('ui_7f0db1dc1f8e') : autoT('ui_9df6718de96c')}
        cancelLabel={autoT('ui_07af7cb30fca')}
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
        title={autoT('ui_85c43bca9767')}
        maxWidth="6xl"
      >
        <div className="space-y-5">
          <div className="system-data-banner system-data-banner-info rounded-xl px-4 py-3 text-sm flex gap-3">
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
            <div>{autoT('ui_0ab6b488b49b')}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_a41c619eeffb')}</div>
              <div className="mt-1 text-xl font-semibold text-gray-800">{filteredUploads.length}</div>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_31c1de18ee51')}</div>
              <div className="mt-1 text-xl font-semibold text-gray-800">{uploadStats.referenced}</div>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_ac91155e0624')}</div>
              <div className="mt-1 text-xl font-semibold text-gray-800">{uploadStats.orphaned}</div>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">{autoT('ui_5f97c6f17eeb')}</div>
              <div className="mt-1 text-xl font-semibold text-gray-800">{formatBytes(uploadStats.bytes)}</div>
            </div>
          </div>

          <label className="block text-sm text-gray-700">
            <span className="font-medium">{autoT('ui_c7ee23bb9cc5')}</span>
            <div className="mt-2 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={uploadSearch}
                onChange={(event) => setUploadSearch(event.target.value)}
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-viridian/20 focus:border-viridian/40"
                placeholder={autoT('ui_228982e1f60e')}
              />
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showOrphanedOnly ? "border-amber-300 bg-amber-50 text-amber-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
              onClick={() => setShowOrphanedOnly((current) => !current)}
            >
              {showOrphanedOnly ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}{autoT('ui_f5c27f457c97')}</button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={toggleAllFilteredUploads}
              disabled={!filteredUploads.length}
            >
              {allFilteredSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {allFilteredSelected ? autoT('ui_8305635fe472') : autoT('ui_590a14424612')}
            </button>
            <Button
              variant="danger"
              size="md"
              onClick={() => setUploadsToDelete(selectedUploads)}
              disabled={!selectedUploads.length || deleteUploadsMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />{autoT('ui_7864577e5ee3')}{selectedUploads.length})
            </Button>
          </div>

          {uploadsQuery.isLoading && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-gray-500">{autoT('ui_1fd1d1ffab6b')}</div>
          )}

          {uploadsQuery.error && (
            <div className="system-data-banner system-data-banner-danger rounded-xl px-4 py-3 text-sm">
              {getApiErrorMessage(uploadsQuery.error, autoT('ui_4daaa1912d91'))}
            </div>
          )}

          {!uploadsQuery.isLoading && !uploadsQuery.error && filteredUploads.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-gray-500">{autoT('ui_67ff223e9782')}</div>
          )}

          {filteredUploads.length > 0 && (
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                  <tr>
                    <th className="w-12 px-4 py-3 text-center font-semibold">
                      <span className="sr-only">{autoT('ui_0177f6dca0b7')}</span>
                    </th>
                    <th className="px-4 py-3 font-semibold">Datei</th>
                    <th className="px-4 py-3 text-right font-semibold">Größe</th>
                    <th className="px-4 py-3 font-semibold">Verknüpfungen</th>
                    <th className="px-4 py-3 text-right font-semibold">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredUploads.map((upload) => {
                    const isSelected = selectedUploadPathSet.has(upload.relativePath);
                    const isExpanded = expandedUploadPathSet.has(upload.relativePath);
                    const details = renderUploadReferenceDetails(upload);
                    const UploadTypeIcon = upload.isImage ? ImageIcon : FileArchive;
                    const openLabel = upload.isImage ? 'Bild öffnen' : 'Datei öffnen';

                    return (
                      <Fragment key={upload.relativePath}>
                        <tr
                          className={`cursor-pointer transition-colors hover:bg-[var(--interactive-soft)] ${isSelected ? 'bg-[var(--interactive-soft)]' : ''}`}
                          aria-selected={isSelected}
                          onClick={(event) => {
                            if ((event.target as HTMLElement).closest('button, input, label, a')) return;
                            toggleUploadSelection(upload.relativePath);
                          }}
                        >
                          <td className="px-4 py-3 text-center align-middle">
                            <label className="inline-flex cursor-pointer items-center justify-center">
                              <input
                                type="checkbox"
                                className="rounded border-[var(--border-strong)] text-viridian focus:ring-[var(--focus-ring)]"
                                checked={isSelected}
                                onChange={() => toggleUploadSelection(upload.relativePath)}
                                aria-label={`${autoT('ui_bc4e896ee3c2')}: ${upload.filename}`}
                              />
                            </label>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)]">
                                <UploadTypeIcon className="h-4 w-4" aria-hidden="true" />
                              </span>
                              <div className="min-w-0">
                                <div className="break-all font-medium leading-5 text-[var(--text-primary)]">{upload.filename}</div>
                                <div className="mt-0.5 break-all text-xs text-[var(--text-muted)]">{upload.relativePath}</div>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right align-top text-[var(--text-secondary)]">
                            {formatBytes(upload.size)}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${upload.referenceCount ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]' : 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'}`}>
                                {upload.referenceCount ? autoT('ui_b7efbd005cd8', { value0: upload.referenceCount }) : autoT('ui_3ae893fbd38a')}
                              </span>
                              {upload.referenceCount > 0 && details.length > 0 ? (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                  onClick={() => toggleExpandedUpload(upload.relativePath)}
                                  aria-expanded={isExpanded}
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                                  {isExpanded ? autoT('ui_ffb39dcd1d39') : autoT('ui_696e24e12eb2')}
                                </button>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">{formatUploadReferenceLabel(upload)}</div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex justify-end gap-2">
                              <IconButton
                                aria-label={openLabel}
                                size="icon-compact"
                                variant="secondary"
                                title={openLabel}
                                onClick={() => void handleOpenUpload(upload)}
                                disabled={openingUploadPath === upload.relativePath}
                              >
                                <ExternalLink aria-hidden="true" />
                              </IconButton>
                              <DeleteIconButton
                                aria-label={`${autoT('ui_6491dcdaf491')}: ${upload.filename}`}
                                size="icon-compact"
                                title={autoT('ui_6491dcdaf491')}
                                onClick={() => setUploadsToDelete([upload])}
                                disabled={deleteUploadsMutation.isPending}
                              />
                            </div>
                          </td>
                        </tr>
                        {isExpanded && details.length > 0 ? (
                          <tr key={`${upload.relativePath}-details`} className="bg-[var(--surface-2)]">
                            <td colSpan={5} className="px-4 py-3">
                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{details}</div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
