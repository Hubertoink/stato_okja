import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import {
  createOrgApi,
  createLocalUserApi,
  inviteUserApi,
  listOrgs,
  type OrgDto,
  type OrgMoveImpactItem,
  type OrgMovePreview,
  type OrgTaxonomySettingsSnapshot,
  listUsersByOrg,
  previewMoveOrgApi,
  moveOrgWithConfirmationApi,
  getOrgTaxonomySettings,
  updateOrgTaxonomySettings,
  updateOrgDefaultLocale,
  updateOrgBranding,
  uploadOrganizationBanner,
} from '@/lib/orgs';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOrgScope } from '@/lib/orgScope';
import { canAccessOrgMove } from '@/lib/orgMoveConfig';
import {
  Shield,
  User as UserIcon,
  Building2,
  ChevronDown,
  ChevronRight,
  Users,
  Settings2,
  ArrowRightLeft,
  GitBranch,
  Save as SaveIcon,
  X as XIcon,
  Mail,
  Download,
  FileUp,
  FileText,
  Upload,
  FolderOpen,
  Tag,
  UsersRound,
  ImagePlus,
} from 'lucide-react';
import ProtectedImage, { useResolvedImageSrc } from '@/components/ProtectedImage';
import DeleteOrgModal from '@/components/DeleteOrgModal';
import DemoHoverHint from '@/demo/DemoHoverHint';
import Toggle from '@/components/Toggle';
import { DEFAULT_PUBLIC_CONFIG, fetchPublicConfig, type PublicConfig } from '@/lib/publicConfig';
import PasswordRequirementsHint from '@/components/PasswordRequirementsHint';
import { getPasswordValidationMessage } from '@/lib/passwordPolicy';
import { getEmailValidationMessage } from '@/lib/emailValidation';
import { autoT } from '@/i18n/auto';
import { APP_LOCALES, type AppLocale } from '@/i18n/locales';
import { Button, CreateButton, DeleteIconButton, IconButton } from '@/components/ui/Button';
import { EditorActions } from '@/components/ui/EditorFrame';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { getSelectableTaxonomyChipStyle } from '@/lib/taxonomyChipStyles';
import { extractAccentColorFromImage } from '@/lib/imageAccentColor';
import { Input } from '@/components/ui/Field';
import {
  downloadBlob,
  downloadOrgMasterData,
  downloadOrgMasterDataTemplate,
  importOrgMasterData,
  previewOrgMasterDataImport,
  type OrgMasterDataPreview,
} from '@/lib/orgMasterData';

/** Instant hover tooltip with optional user list */
function Tooltip({
  label,
  names,
  children,
}: {
  label: string;
  names?: string[];
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1.5 rounded bg-gray-800 text-white text-xs shadow-lg z-50 pointer-events-none min-w-max">
          <div className="font-medium mb-0.5">{label}</div>
          {names && names.length > 0 ? (
            <ul className="text-gray-300 text-[11px] space-y-0.5">
              {names.slice(0, 5).map((n, i) => (
                <li key={i}>• {n}</li>
              ))}
              {names.length > 5 && (
                <li className="text-gray-400">
                  … +{names.length - 5} {autoT('ui_4e3936d10c2b')}
                </li>
              )}
            </ul>
          ) : (
            <div className="text-gray-400 text-[11px]">{autoT('ui_3ce60e7427c1')}</div>
          )}
        </span>
      )}
    </span>
  );
}

const taxonomySecondaryTextClass = 'text-[var(--text-secondary)]';
const taxonomyMutedTextClass = 'text-[var(--text-muted)]';
const taxonomyNeutralButtonClass =
  'min-h-11 touch-manipulation rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--interactive-soft)]';
const taxonomySectionCardClass = 'rounded-xl bg-[var(--surface-1)] p-4 space-y-3';
const taxonomyBannerInfoClass = 'taxonomy-config-info-banner rounded-lg px-4 py-3 text-sm';
const taxonomyBannerWarningClass = 'taxonomy-config-warning-banner rounded-lg px-4 py-3 text-sm';
const taxonomyOverrideSoftClass = 'taxonomy-config-warning-soft';
const taxonomyOverrideSurfaceClass = 'taxonomy-config-override-surface';
const taxonomyOverridePillClass =
  'taxonomy-config-override-pill rounded-full px-2 py-0.5 text-[11px] font-medium';

type TaxonomyDraftState =
  OrgTaxonomySettingsSnapshot['settings'] | OrgTaxonomySettingsSnapshot['childDefaults'];
type TaxonomySectionKey = keyof OrgTaxonomySettingsSnapshot['settings'];

function MasterDataTransferModal({
  org,
  open,
  onClose,
  onImported,
}: {
  org: OrgDto | null;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { t } = useTranslation('common');
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<OrgMasterDataPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState<'export' | 'template' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setContent('');
    setPreview(null);
    setPreviewing(false);
    setImporting(false);
    setDownloading(null);
    setError(null);
  }, [open]);

  const updateContent = (value: string) => {
    setContent(value);
    setPreview(null);
    setError(null);
  };

  const readError = (err: unknown) => {
    const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data
      ?.message;
    return Array.isArray(message)
      ? message.join(' ')
      : String(message || t('masterData.errorGeneric'));
  };

  const inspect = async () => {
    if (!org || !content.trim()) {
      setError(t('masterData.noContent'));
      return;
    }
    try {
      setPreviewing(true);
      setError(null);
      setPreview(await previewOrgMasterDataImport(org.id, content));
    } catch (err) {
      setPreview(null);
      setError(readError(err));
    } finally {
      setPreviewing(false);
    }
  };

  const itemLabels: Record<keyof OrgMasterDataPreview['counts'], string> = {
    categories: t('masterData.categories'),
    tags: t('masterData.tags'),
    cohorts: t('masterData.cohorts'),
    locations: t('masterData.locations'),
  };
  const createdTotal = preview
    ? Object.values(preview.counts).reduce((sum, count) => sum + count.create, 0)
    : 0;
  const blockedSections = preview
    ? Object.entries(preview.counts).filter(([, count]) => count.blocked)
    : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('masterData.title', { name: org?.name || '' })}
      maxWidth="2xl"
      variant="information"
    >
      <div className="space-y-5 pt-5">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-viridian" />
            <div>
              <h4 className="font-semibold text-[var(--text-primary)]">
                {t('masterData.exportTitle')}
              </h4>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {t('masterData.exportDescription')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={downloading !== null}
                  className={taxonomyNeutralButtonClass}
                  onClick={async () => {
                    if (!org) return;
                    try {
                      setDownloading('export');
                      const exported = await downloadOrgMasterData(org.id);
                      downloadBlob(exported.blob, exported.filename);
                    } catch (err) {
                      showToast(readError(err), { type: 'error' });
                    } finally {
                      setDownloading(null);
                    }
                  }}
                >
                  <Download className="h-4 w-4" />{' '}
                  {downloading === 'export' ? t('masterData.downloading') : t('masterData.export')}
                </button>
                <button
                  type="button"
                  disabled={downloading !== null}
                  className={taxonomyNeutralButtonClass}
                  onClick={async () => {
                    try {
                      setDownloading('template');
                      const template = await downloadOrgMasterDataTemplate();
                      downloadBlob(template.blob, template.filename);
                    } catch (err) {
                      showToast(readError(err), { type: 'error' });
                    } finally {
                      setDownloading(null);
                    }
                  }}
                >
                  <FileText className="h-4 w-4" />{' '}
                  {downloading === 'template'
                    ? t('masterData.downloading')
                    : t('masterData.template')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-[var(--text-primary)]">
              {t('masterData.importTitle')}
            </h4>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {t('masterData.importDescription')}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml,text/yaml,application/x-yaml"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              void file
                .text()
                .then(updateContent)
                .catch(() => setError(t('masterData.fileReadError')));
            }}
          />
          <button
            type="button"
            className={taxonomyNeutralButtonClass}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> {t('masterData.selectFile')}
          </button>
          <label
            className="block text-sm font-medium text-[var(--text-primary)]"
            htmlFor="master-data-yaml"
          >
            {t('masterData.pasteLabel')}
          </label>
          <textarea
            id="master-data-yaml"
            value={content}
            onChange={(event) => updateContent(event.target.value)}
            placeholder={t('masterData.placeholder')}
            className="min-h-52 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-3 font-mono text-xs text-[var(--text-primary)] outline-none focus:border-viridian focus:ring-2 focus:ring-viridian/20"
            spellCheck={false}
          />
          <button
            type="button"
            disabled={previewing || !content.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-viridian px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void inspect()}
          >
            <FileUp className="h-4 w-4" />{' '}
            {previewing ? t('masterData.inspecting') : t('masterData.preview')}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {preview && (
          <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
            <div>
              <h4 className="font-semibold text-[var(--text-primary)]">
                {t('masterData.previewTitle')}
              </h4>
              {preview.sourceOrganization && (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {t('masterData.source', { name: preview.sourceOrganization })}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(preview.counts).map(([kind, count]) => (
                <div
                  key={kind}
                  className={`rounded-lg border px-3 py-2 ${count.blocked ? 'border-[var(--status-danger-text)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]' : 'border-[var(--border-subtle)] bg-[var(--surface-1)]'}`}
                >
                  <div
                    className={`text-xs font-medium ${count.blocked ? 'text-[var(--status-danger-text)]' : 'text-[var(--text-muted)]'}`}
                  >
                    {itemLabels[kind as keyof OrgMasterDataPreview['counts']]}
                  </div>
                  {count.blocked ? (
                    <div className="mt-1 text-sm font-semibold">{t('masterData.blocked')}</div>
                  ) : (
                    <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                      +{count.create}{' '}
                      <span className="font-normal text-[var(--text-muted)]">
                        · {count.existing} {t('masterData.existing')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {blockedSections.length > 0 && (
              <div className="rounded-lg border border-[var(--status-danger-text)] bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
                {blockedSections.map(([kind, count]) => (
                  <p key={kind}>
                    {t('masterData.blockedHint', {
                      count: count.total,
                      label: itemLabels[kind as keyof OrgMasterDataPreview['counts']],
                    })}
                  </p>
                ))}
              </div>
            )}
            {preview.errors.length > 0 && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                <div className="font-semibold">{t('masterData.errorsTitle')}</div>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {preview.errors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {preview.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <ul className="list-disc space-y-1 pl-5">
                  {preview.warnings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-3">
              <button
                type="button"
                className={taxonomyNeutralButtonClass}
                onClick={() => setPreview(null)}
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                disabled={!preview.valid || createdTotal === 0 || importing}
                className="inline-flex items-center gap-2 rounded-lg bg-viridian px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                onClick={async () => {
                  if (!org) return;
                  try {
                    setImporting(true);
                    const result = await importOrgMasterData(org.id, content);
                    const total = Object.values(result.created).reduce(
                      (sum, count) => sum + count,
                      0,
                    );
                    showToast(t('masterData.success', { count: total }), { type: 'success' });
                    onImported();
                    onClose();
                  } catch (err) {
                    setError(readError(err));
                  } finally {
                    setImporting(false);
                  }
                }}
              >
                <FileUp className="h-4 w-4" />{' '}
                {importing
                  ? t('masterData.importing')
                  : t('masterData.confirmImport', { count: createdTotal })}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function OrgTaxonomySettingsModal({
  org,
  open,
  onClose,
  onSaved,
}: {
  org: OrgDto | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation('common');
  const { showToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState<OrgTaxonomySettingsSnapshot | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<
    OrgTaxonomySettingsSnapshot['settings'] | null
  >(null);
  const [childDefaultsDraft, setChildDefaultsDraft] = useState<
    OrgTaxonomySettingsSnapshot['childDefaults'] | null
  >(null);
  const [activePanel, setActivePanel] = useState<'self' | 'children'>('self');
  const [clearOwnSettings, setClearOwnSettings] = useState(false);
  const [clearChildDefaults, setClearChildDefaults] = useState(false);
  const [masterDataOpen, setMasterDataOpen] = useState(false);
  const canTransferMasterData = user?.role === 'superadmin' || user?.role === 'org_admin';

  useEffect(() => {
    if (!open || !org) return;
    let mounted = true;
    setLoading(true);
    void getOrgTaxonomySettings(org.id)
      .then((data) => {
        if (!mounted) return;
        setSnapshot(data);
        setSettingsDraft(data.settings);
        setChildDefaultsDraft(data.childDefaults);
        setActivePanel('self');
        setClearOwnSettings(false);
        setClearChildDefaults(false);
      })
      .catch((error: unknown) => {
        const message =
          (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message ||
          'Vererbungsregeln konnten nicht geladen werden.';
        showToast(String(message), { type: 'error' });
        if (mounted) onClose();
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open, org, onClose, showToast]);

  const updateInherited = (
    target: 'self' | 'children',
    key: keyof OrgTaxonomySettingsSnapshot['settings'],
    id: string,
  ) => {
    if (target === 'self') setClearOwnSettings(false);
    else setClearChildDefaults(false);
    if (target === 'self') {
      setSettingsDraft((current) => {
        if (!current) return current;
        const nextIds = new Set(current[key].inheritedIds || []);
        if (nextIds.has(id)) nextIds.delete(id);
        else nextIds.add(id);
        return {
          ...current,
          [key]: { ...current[key], inheritedIds: Array.from(nextIds) },
        };
      });
      return;
    }
    setChildDefaultsDraft((current) => {
      if (!current) return current;
      const nextIds = new Set(current[key].inheritedIds || []);
      if (nextIds.has(id)) nextIds.delete(id);
      else nextIds.add(id);
      return {
        ...current,
        [key]: { ...current[key], inheritedIds: Array.from(nextIds) },
      };
    });
  };

  const updateAllowOwn = (
    target: 'self' | 'children',
    key: keyof OrgTaxonomySettingsSnapshot['settings'],
    allowOwn: boolean,
  ) => {
    if (target === 'self') setClearOwnSettings(false);
    else setClearChildDefaults(false);
    if (target === 'self') {
      setSettingsDraft((current) =>
        current ? { ...current, [key]: { ...current[key], allowOwn } } : current,
      );
      return;
    }
    setChildDefaultsDraft((current) =>
      current ? { ...current, [key]: { ...current[key], allowOwn } } : current,
    );
  };

  const updateAllowChildAdminOverrides = (allowChildAdminOverrides: boolean) => {
    setClearChildDefaults(false);
    setChildDefaultsDraft((current) =>
      current ? { ...current, allowChildAdminOverrides } : current,
    );
  };

  const updateInheritAll = (
    target: 'self' | 'children',
    key: keyof OrgTaxonomySettingsSnapshot['settings'],
    inheritAll: boolean,
  ) => {
    if (target === 'self') setClearOwnSettings(false);
    else setClearChildDefaults(false);
    if (target === 'self') {
      setSettingsDraft((current) =>
        current ? { ...current, [key]: { ...current[key], inheritAll } } : current,
      );
      return;
    }
    setChildDefaultsDraft((current) =>
      current ? { ...current, [key]: { ...current[key], inheritAll } } : current,
    );
  };

  const sections = [
    {
      key: 'categories' as const,
      title: autoT('ui_4e1e15e17610'),
      inheritAllLabel: autoT('ui_e10f2f99a057'),
      allowLabel: 'Eigene Kategorien erlauben',
      renderItem: (item: OrgTaxonomySettingsSnapshot['parentOptions']['categories'][number]) =>
        item.name,
    },
    {
      key: 'tags' as const,
      title: autoT('ui_848eed0fbd54'),
      inheritAllLabel: autoT('ui_e1da640c8be7'),
      allowLabel: 'Eigene Tags erlauben',
      renderItem: (item: OrgTaxonomySettingsSnapshot['parentOptions']['tags'][number]) => item.name,
    },
    {
      key: 'cohorts' as const,
      title: autoT('ui_5ee833a989b0'),
      inheritAllLabel: autoT('ui_eb378040c8fa'),
      allowLabel: 'Eigene Kohorten erlauben',
      renderItem: (item: OrgTaxonomySettingsSnapshot['parentOptions']['cohorts'][number]) =>
        `${item.name}${typeof item.minAge === 'number' && typeof item.maxAge === 'number' ? ` (${item.minAge}–${item.maxAge})` : ''}`,
    },
  ];

  const settingsEqual = (left: TaxonomyDraftState, right: TaxonomyDraftState) =>
    sections.every((section) => {
      const leftEntry = left[section.key];
      const rightEntry = right[section.key];
      if (
        leftEntry.allowOwn !== rightEntry.allowOwn ||
        leftEntry.inheritAll !== rightEntry.inheritAll
      )
        return false;
      if (leftEntry.inheritedIds.length !== rightEntry.inheritedIds.length) return false;
      return leftEntry.inheritedIds.every((id, index) => id === rightEntry.inheritedIds[index]);
    });

  const childDefaultsEqual = (
    left: OrgTaxonomySettingsSnapshot['childDefaults'],
    right: OrgTaxonomySettingsSnapshot['childDefaults'],
  ) =>
    settingsEqual(left, right) && left.allowChildAdminOverrides === right.allowChildAdminOverrides;

  const isSectionItemSelected = (
    settings: TaxonomyDraftState,
    key: TaxonomySectionKey,
    id: string,
  ) => settings[key].inheritAll || settings[key].inheritedIds.includes(id);

  const allowOwnLabel = (title: string, allowOwn: boolean) =>
    allowOwn ? `Eigene ${title} erlaubt` : `Eigene ${title} gesperrt`;

  const inheritanceModeLabel = (
    entry: TaxonomyDraftState[TaxonomySectionKey],
    selectedCount: number,
    showInheritedContentRules: boolean,
  ) => {
    if (!showInheritedContentRules) return autoT('ui_b702ccfc141d');
    if (entry.inheritAll) return autoT('ui_5456924a21e1');
    if (selectedCount === 0) return autoT('ui_e48689c9cbcd');
    return autoT('ui_fb6131c21c05', {
      value0: selectedCount,
      value1: selectedCount === 1 ? '' : 'e',
    });
  };

  const renderRuleSummary = ({
    draft,
    target,
    options,
    baseline,
    showInheritedContentRules,
    readOnly,
  }: {
    draft: TaxonomyDraftState;
    target: 'self' | 'children';
    options:
      | OrgTaxonomySettingsSnapshot['parentOptions']
      | OrgTaxonomySettingsSnapshot['childDefaultOptions'];
    baseline?: TaxonomyDraftState;
    showInheritedContentRules: boolean;
    readOnly: boolean;
  }) => {
    const sectionIcons = {
      categories: FolderOpen,
      tags: Tag,
      cohorts: UsersRound,
    } as const;

    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = sectionIcons[section.key];
          const entry = draft[section.key];
          const sectionOptions = options[section.key];
          const selectedCount = entry.inheritAll ? sectionOptions.length : entry.inheritedIds.length;
          const baselineEntry = baseline?.[section.key];
          const hasDiff =
            !!baselineEntry &&
            (entry.allowOwn !== baselineEntry.allowOwn ||
              entry.inheritAll !== baselineEntry.inheritAll ||
              sectionOptions.some(
                (item) =>
                  isSectionItemSelected(draft, section.key, item.id) !==
                  isSectionItemSelected(baseline, section.key, item.id),
              ));

          return (
            <section
              key={`${target}-${section.key}-rules`}
              className={`taxonomy-rule-card ${hasDiff ? taxonomyOverrideSoftClass : ''}`}
            >
              <div className="taxonomy-rule-card-header">
                <span className="taxonomy-overview-rule-icon" aria-hidden="true">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className={`block text-xs ${taxonomyMutedTextClass}`}>{section.title}</span>
                  <span className="mt-1 block font-semibold text-[var(--text-primary)]">
                    {allowOwnLabel(section.title, entry.allowOwn)}
                  </span>
                  <span className={`mt-1 block text-xs ${taxonomyMutedTextClass}`}>
                    {inheritanceModeLabel(entry, selectedCount, showInheritedContentRules)}
                  </span>
                </div>
                <Toggle
                  className={readOnly ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
                  checked={entry.allowOwn}
                  onChange={(checked) => updateAllowOwn(target, section.key, checked)}
                  ariaLabel={allowOwnLabel(section.title, entry.allowOwn)}
                  disabled={readOnly}
                />
              </div>

              {showInheritedContentRules ? (
                <div className="taxonomy-rule-card-content">
                  <div
                    className={`taxonomy-rule-control ${readOnly ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                  >
                    <Toggle
                      checked={entry.inheritAll}
                      onChange={(checked) => updateInheritAll(target, section.key, checked)}
                      ariaLabel={section.inheritAllLabel}
                      disabled={readOnly}
                      className="shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-[var(--text-primary)]">
                        {section.inheritAllLabel}
                      </span>
                      <span className={`block text-xs ${taxonomyMutedTextClass}`}>
                        {target === 'self' ? autoT('ui_d66a910a42dd') : autoT('ui_0d8a51190a5d')}
                      </span>
                    </span>
                  </div>

                  {entry.inheritAll ? (
                    <p className={`text-xs ${taxonomyMutedTextClass}`}>
                      {target === 'self' ? autoT('ui_a48f2d872641') : autoT('ui_3a54690f5745')}
                    </p>
                  ) : sectionOptions.length > 0 ? (
                    <div>
                      <p className={`mb-2 text-xs font-medium ${taxonomyMutedTextClass}`}>
                        Individuelle Auswahl
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {sectionOptions.map((item) => {
                          const selected = entry.inheritedIds.includes(item.id);
                          return (
                            <button
                              key={`${target}-${section.key}-${item.id}`}
                              type="button"
                              onClick={() => updateInherited(target, section.key, item.id)}
                              disabled={readOnly}
                              aria-pressed={selected}
                              className="taxonomy-selection-chip px-2 py-1 rounded-full text-xs border"
                              style={getSelectableTaxonomyChipStyle(selected, item.color)}
                            >
                              {section.renderItem(item as never)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className={`text-xs ${taxonomyMutedTextClass}`}>
                      {target === 'self' ? autoT('ui_6c738d1a3631') : autoT('ui_aab49b639dd5')}
                    </p>
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    );
  };

  const renderDiffRows = ({
    sectionTitle,
    draftEntry,
    baselineEntry,
    changedItemCount,
    showInheritedContentRules,
  }: {
    sectionTitle: string;
    draftEntry: TaxonomyDraftState[TaxonomySectionKey];
    baselineEntry?: TaxonomyDraftState[TaxonomySectionKey];
    changedItemCount: number;
    showInheritedContentRules: boolean;
  }) => {
    if (!baselineEntry) return null;

    const rows: Array<{ label: string; before: string; after: string }> = [];
    if (draftEntry.allowOwn !== baselineEntry.allowOwn) {
      rows.push({
        label: autoT('ui_be719edc9e4f'),
        before: allowOwnLabel(sectionTitle, baselineEntry.allowOwn),
        after: allowOwnLabel(sectionTitle, draftEntry.allowOwn),
      });
    }
    if (showInheritedContentRules && draftEntry.inheritAll !== baselineEntry.inheritAll) {
      rows.push({
        label: autoT('ui_0c8050464fd9'),
        before: baselineEntry.inheritAll ? autoT('ui_5456924a21e1') : autoT('ui_fa86c6c248e6'),
        after: draftEntry.inheritAll ? autoT('ui_5456924a21e1') : autoT('ui_fa86c6c248e6'),
      });
    }
    if (showInheritedContentRules && changedItemCount > 0) {
      rows.push({
        label: autoT('ui_0177f6dca0b7'),
        before: 'Standardauswahl',
        after: autoT('ui_05dd7aa3fb32', {
          value0: changedItemCount,
          value1: changedItemCount === 1 ? '' : 'en',
        }),
      });
    }

    if (rows.length === 0) return null;

    return (
      <div className="taxonomy-config-diff-list rounded-lg px-3 py-2 text-xs">
        <div className="mb-1 font-semibold text-[var(--text-primary)]">
          {autoT('ui_80beaa4a186a')}
        </div>
        <div className="space-y-1">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-1 sm:grid-cols-[9rem_1fr]">
              <span className="font-medium text-[var(--text-muted)]">{row.label}</span>
              <span className="text-[var(--text-secondary)]">
                <span>{row.before}</span>
                <span className="mx-1 text-[var(--text-muted)]">→</span>
                <strong className="text-[var(--text-primary)]">{row.after}</strong>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSettingsEditor = ({
    draft,
    target,
    options,
    baseline,
    intro,
    reset,
    readOnly,
  }: {
    draft: TaxonomyDraftState;
    target: 'self' | 'children';
    options:
      | OrgTaxonomySettingsSnapshot['parentOptions']
      | OrgTaxonomySettingsSnapshot['childDefaultOptions'];
    baseline?: TaxonomyDraftState;
    intro: React.ReactNode;
    reset?: React.ReactNode;
    readOnly: boolean;
  }) => {
    const hasParentSource = target === 'self' && !!snapshot?.parentId;
    const showInheritedContentRules = target === 'children' || hasParentSource;

    return (
      <div className="space-y-5">
        {intro}
        {renderRuleSummary({ draft, target, options, baseline, showInheritedContentRules, readOnly })}
        {reset}
      </div>
    );

    if (target === 'self' && !hasParentSource) {
      const sectionIcons = {
        categories: FolderOpen,
        tags: Tag,
        cohorts: UsersRound,
      } as const;

      return (
        <div className="space-y-5">
          {intro}
          <div className="grid gap-4 lg:grid-cols-3">
            {sections.map((section) => {
              const Icon = sectionIcons[section.key];
              const hasOverride = baseline
                ? draft[section.key].allowOwn !== baseline[section.key].allowOwn
                : false;
              return (
                <label
                  key={`${target}-${section.key}`}
                  className={`taxonomy-overview-rule-card ${hasOverride ? taxonomyOverrideSoftClass : ''} ${readOnly ? 'cursor-not-allowed opacity-75' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={draft[section.key].allowOwn}
                    onChange={(event) => updateAllowOwn(target, section.key, event.target.checked)}
                    disabled={readOnly}
                    className="sr-only"
                  />
                  <span className="taxonomy-overview-rule-icon" aria-hidden="true">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs ${taxonomyMutedTextClass}`}>{section.title}</span>
                    <span className="mt-1 block font-semibold text-[var(--text-primary)]">
                      {section.allowLabel}
                    </span>
                    <span className={`mt-1 block text-xs ${taxonomyMutedTextClass}`}>
                      {autoT('ui_5d8b574b50b4')}
                    </span>
                  </span>
                  <span
                    className={`taxonomy-rule-switch ${draft[section.key].allowOwn ? 'taxonomy-rule-switch-on' : ''}`}
                    aria-hidden="true"
                  >
                    <span />
                  </span>
                </label>
              );
            })}
          </div>
          {reset}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {intro}
        {renderRuleSummary({ draft, target, options, baseline, showInheritedContentRules, readOnly })}
        {reset}
        {sections.map((section) => {
          const sectionOptions = options[section.key];
          const source = target === 'self' ? snapshot?.settingsSource[section.key] : null;
          const baselineEntry = baseline?.[section.key];
          const hasAllowOwnDiff =
            !!baselineEntry && draft[section.key].allowOwn !== baselineEntry.allowOwn;
          const hasInheritAllDiff =
            !!baselineEntry && draft[section.key].inheritAll !== baselineEntry.inheritAll;
          const changedItemCount = baselineEntry
            ? sectionOptions.filter(
                (item) =>
                  isSectionItemSelected(draft, section.key, item.id) !==
                  isSectionItemSelected(baseline, section.key, item.id),
              ).length
            : 0;
          const hasSectionDiff = hasAllowOwnDiff || hasInheritAllDiff || changedItemCount > 0;
          return (
            <div
              key={`${target}-${section.key}`}
              className={`${taxonomySectionCardClass} ${hasSectionDiff ? taxonomyOverrideSurfaceClass : ''}`}
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-[var(--text-primary)]">{section.title}</h4>
                  {hasSectionDiff ? (
                    <span className={taxonomyOverridePillClass}>{autoT('ui_58a869567bf1')}</span>
                  ) : null}
                </div>
                <p className={`text-xs ${taxonomyMutedTextClass}`}>
                  {target === 'self'
                    ? hasParentSource
                      ? autoT('ui_cb006cc6637b')
                      : autoT('ui_15d2a37bed98')
                    : autoT('ui_75f29b7250d2')}
                </p>
              </div>
              {hasParentSource && source && source.mode !== 'explicit' ? (
                <div className={`${taxonomyBannerInfoClass} text-xs`}>
                  {autoT('ui_6be9a46fee06')}
                  {source.mode === 'default'
                    ? t('organization.standardFrom', {
                        name: source.sourceOrgName || t('organization.parent'),
                      })
                    : autoT('ui_4f8f3a0bf2a3')}
                  .
                </div>
              ) : null}
              {renderDiffRows({
                sectionTitle: section.title,
                draftEntry: draft[section.key],
                baselineEntry,
                changedItemCount,
                showInheritedContentRules,
              })}
              <div className="space-y-2 p-3">
                {showInheritedContentRules ? (
                  <label
                    className={`taxonomy-rule-control ${hasInheritAllDiff ? taxonomyOverrideSoftClass : ''} ${readOnly ? 'cursor-not-allowed opacity-75' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={draft[section.key].inheritAll}
                      onChange={(event) =>
                        updateInheritAll(target, section.key, event.target.checked)
                      }
                      disabled={readOnly}
                      className="sr-only"
                    />
                    <span
                      className={`taxonomy-rule-switch ${draft[section.key].inheritAll ? 'taxonomy-rule-switch-on' : ''}`}
                      aria-hidden="true"
                    >
                      <span />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-[var(--text-primary)]">
                        {section.inheritAllLabel}
                      </span>
                      <span className={`block text-xs ${taxonomyMutedTextClass}`}>
                        {target === 'self' ? autoT('ui_d66a910a42dd') : autoT('ui_0d8a51190a5d')}
                      </span>
                    </span>
                  </label>
                ) : null}
                <label
                  className={`taxonomy-rule-control ${hasAllowOwnDiff ? taxonomyOverrideSoftClass : ''} ${readOnly ? 'cursor-not-allowed opacity-75' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={draft[section.key].allowOwn}
                    onChange={(event) => updateAllowOwn(target, section.key, event.target.checked)}
                    disabled={readOnly}
                    className="sr-only"
                  />
                  <span
                    className={`taxonomy-rule-switch ${draft[section.key].allowOwn ? 'taxonomy-rule-switch-on' : ''}`}
                    aria-hidden="true"
                  >
                    <span />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-[var(--text-primary)]">
                      {section.allowLabel}
                    </span>
                    <span className={`block text-xs ${taxonomyMutedTextClass}`}>
                      {target === 'self' ? autoT('ui_5d8b574b50b4') : autoT('ui_11062ebc4bcf')}
                    </span>
                  </span>
                </label>
              </div>
              {showInheritedContentRules && sectionOptions.length > 0 ? (
                <>
                  {draft[section.key].inheritAll && (
                    <div className="rounded-lg border border-viridian/20 bg-viridian/5 px-3 py-2 text-xs text-viridian">
                      {target === 'self' ? autoT('ui_a48f2d872641') : autoT('ui_3a54690f5745')}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {sectionOptions.map((item) => {
                      const selected =
                        draft[section.key].inheritAll ||
                        draft[section.key].inheritedIds.includes(item.id);
                      const differsFromBaseline = baselineEntry
                        ? isSectionItemSelected(draft, section.key, item.id) !==
                          isSectionItemSelected(baseline, section.key, item.id)
                        : false;
                      return (
                        <label
                          key={`${target}-${section.key}-${item.id}`}
                          className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${draft[section.key].inheritAll || readOnly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${differsFromBaseline ? taxonomyOverrideSoftClass : selected ? 'border-viridian bg-viridian/5' : 'border-[var(--border-subtle)] bg-[var(--surface-1)]'}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => updateInherited(target, section.key, item.id)}
                            disabled={draft[section.key].inheritAll || readOnly}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-viridian focus:ring-viridian"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-[var(--text-primary)]">
                              {section.renderItem(item as never)}
                            </span>
                            {item.sourceOrgName &&
                              target === 'self' &&
                              item.sourceOrgName !== snapshot?.parentName && (
                                <span className={`block text-xs ${taxonomyMutedTextClass}`}>
                                  {autoT('ui_058914a524bc')} {item.sourceOrgName}
                                </span>
                              )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className={`text-sm ${taxonomyMutedTextClass}`}>
                  {!showInheritedContentRules
                    ? autoT('ui_a080abd398bd')
                    : draft[section.key].inheritAll
                      ? autoT('ui_b6ea868adc5a')
                      : target === 'self'
                        ? autoT('ui_6c738d1a3631')
                        : autoT('ui_aab49b639dd5')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={org ? autoT('ui_5b2a4f8af741', { value0: org.name }) : autoT('ui_73a0104df5e5')}
        maxWidth="5xl"
        variant="form"
      >
        {loading && (
          <div className="py-8 text-center text-gray-500">{autoT('ui_2c9d36fbce1b')}</div>
        )}
        {!loading && snapshot && settingsDraft && childDefaultsDraft && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
              <div className="space-y-5">
            <div className="taxonomy-modal-hero pb-1">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase text-[var(--text-muted)]">
                    {autoT('ui_90f3c2de38c3')}
                  </div>
                  <div className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                    {snapshot.orgName}
                  </div>
                </div>
                {canTransferMasterData && (
                  <button
                    type="button"
                    className={`${taxonomyNeutralButtonClass} inline-flex items-center gap-2 lg:shrink-0`}
                    onClick={() => setMasterDataOpen(true)}
                  >
                    <Download className="h-4 w-4" /> {t('masterData.button')}
                  </button>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <div className="taxonomy-context-status">
                  {snapshot.parentId ? <GitBranch className="taxonomy-context-status-icon" /> : <Building2 className="taxonomy-context-status-icon" />}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-[var(--text-primary)]">
                      {snapshot.parentId ? 'Unterorganisation' : autoT('ui_056cf317078e')}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--text-muted)]">
                      {snapshot.parentName || 'Keine übergeordnete Organisation'}
                    </span>
                  </span>
                </div>
                <div className="taxonomy-context-status">
                  <Users className="taxonomy-context-status-icon" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-[var(--text-primary)]">
                      {snapshot.directChildCount > 0 ? `${snapshot.directChildCount} Unterorganisationen` : 'Keine Unterorganisationen'}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--text-muted)]">
                      {snapshot.hasChildDefaults ? autoT('ui_319a962a610a') : autoT('ui_0a82238fcc70')}
                    </span>
                  </span>
                </div>
                <div className="taxonomy-context-stat rounded-lg px-3 py-2 text-center">
                  <div className="text-lg font-bold text-[var(--text-primary)]">{snapshot.directChildCount}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{autoT('ui_5be3b245eac6')}</div>
                </div>
                <div className="taxonomy-context-stat rounded-lg px-3 py-2 text-center">
                  <div className="text-lg font-bold text-[var(--text-primary)]">{snapshot.descendantCount}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{autoT('ui_d25cfca669ed')}</div>
                </div>
              </div>
            </div>
            <SegmentedControl<'self' | 'children'>
              ariaLabel={autoT('ui_90f3c2de38c3')}
              className="w-fit max-w-full"
              onChange={setActivePanel}
              options={[
                { value: 'self', label: 'Organisation' },
                { value: 'children', label: 'Unterorganisationen' },
              ]}
              value={activePanel}
            />
            {activePanel === 'self'
              ? renderSettingsEditor({
                  draft: settingsDraft,
                  target: 'self',
                  options: snapshot.parentOptions,
                  baseline: snapshot.fallbackSettings,
                  intro: (
                    <div className={`text-sm ${taxonomySecondaryTextClass}`}>
                      {snapshot.parentId ? (
                        <>
                          {autoT('ui_8a4951c9ecf0')}{' '}
                          <strong>{snapshot.orgName}</strong>
                          {autoT('ui_eb47130d07a4')}
                        </>
                      ) : (
                        <>
                          {autoT('ui_6dcb477a5344')}
                          <strong>{snapshot.orgName}</strong>
                          {autoT('ui_9c3e30e3abbe')}
                        </>
                      )}
                      {snapshot.hasExplicitSettings ? (
                        <div className={`mt-1 text-xs ${taxonomyMutedTextClass}`}>
                          {autoT('ui_bdc434b247a3')}
                          {snapshot.fallbackSource.categories.sourceOrgName ||
                            snapshot.fallbackSource.tags.sourceOrgName ||
                            snapshot.fallbackSource.cohorts.sourceOrgName ||
                            (snapshot.parentId
                              ? autoT('ui_3d072e66015a')
                              : 'systemweite Standardregel')}
                        </div>
                      ) : null}
                      {!snapshot.ownAdminPolicy.allowChildAdminOverrides ? (
                        <div className={`${taxonomyBannerInfoClass} mt-3`}>
                          {autoT('ui_c6546b04a3cb')}{' '}
                          {snapshot.ownAdminPolicy.sourceOrgName || autoT('ui_4f4a56a66165')}.
                        </div>
                      ) : null}
                      {!snapshot.permissions.canEditSelf ? (
                        <div className={`${taxonomyBannerWarningClass} mt-3`}>
                          {autoT('ui_390766826850')}
                        </div>
                      ) : null}
                    </div>
                  ),
                  reset:
                    snapshot.hasExplicitSettings || clearOwnSettings ? (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className={taxonomyNeutralButtonClass}
                          disabled={!snapshot.permissions.canEditSelf}
                          onClick={() => {
                            if (clearOwnSettings) {
                              setClearOwnSettings(false);
                              setSettingsDraft(snapshot.settings);
                              return;
                            }
                            setClearOwnSettings(true);
                            setSettingsDraft(snapshot.fallbackSettings);
                          }}
                        >
                          {clearOwnSettings ? autoT('ui_920b76c43617') : autoT('ui_ab5deb17f39f')}
                        </button>
                      </div>
                    ) : clearOwnSettings ? (
                      <div className={taxonomyBannerWarningClass}>
                        {autoT('ui_45949baad5d6')}
                        {snapshot.parentId ? autoT('ui_284ea55a27d4') : autoT('ui_2358864656a2')}.
                      </div>
                    ) : null,
                  readOnly: !snapshot.permissions.canEditSelf,
                })
              : renderSettingsEditor({
                  draft: childDefaultsDraft,
                  target: 'children',
                  options: snapshot.childDefaultOptions,
                  intro: (
                    <div className="space-y-3">
                      <div className={`text-sm ${taxonomySecondaryTextClass}`}>
                        {autoT('ui_05fd6084bff8')}{' '}
                        <strong className="break-words">{snapshot.orgName}</strong>
                        {autoT('ui_0b390ca81ab3')}
                        <div className={`mt-1 text-xs ${taxonomyMutedTextClass}`}>
                          {autoT('ui_b4fb63cb8125')}
                          {snapshot.directChildCount} {autoT('ui_48ebb798ee34')}{' '}
                          {snapshot.descendantCount}
                        </div>
                      </div>
                      <div className="space-y-2 p-3">
                        <label
                          className={`taxonomy-rule-control ${childDefaultsDraft.allowChildAdminOverrides !== snapshot.childDefaults.allowChildAdminOverrides ? taxonomyOverrideSoftClass : ''} ${!snapshot.permissions.canEditChildDefaults ? 'cursor-not-allowed opacity-75' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={childDefaultsDraft.allowChildAdminOverrides}
                            onChange={(event) =>
                              updateAllowChildAdminOverrides(event.target.checked)
                            }
                            disabled={!snapshot.permissions.canEditChildDefaults}
                            className="sr-only"
                          />
                          <span
                            className={`taxonomy-rule-switch ${childDefaultsDraft.allowChildAdminOverrides ? 'taxonomy-rule-switch-on' : ''}`}
                            aria-hidden="true"
                          >
                            <span />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium text-[var(--text-primary)]">
                              {autoT('ui_3760fc0b0d6a')}
                            </span>
                            <span className={`block text-xs ${taxonomyMutedTextClass}`}>
                              {autoT('ui_8c085486e9ab')}
                            </span>
                          </span>
                        </label>
                        {!snapshot.permissions.canEditChildDefaults ? (
                          <div className={taxonomyBannerWarningClass}>
                            {autoT('ui_5abcb50fbc00')}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ),
                  reset: snapshot.hasChildDefaults ? (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className={taxonomyNeutralButtonClass}
                        disabled={!snapshot.permissions.canEditChildDefaults}
                        onClick={() => {
                          setClearChildDefaults(true);
                          setChildDefaultsDraft(snapshot.childDefaults);
                        }}
                      >
                        {autoT('ui_a648fa1c79fa')}
                      </button>
                    </div>
                  ) : clearChildDefaults ? (
                    <div className={taxonomyBannerWarningClass}>{autoT('ui_07cb81ef2ec1')}</div>
                  ) : null,
                  readOnly: !snapshot.permissions.canEditChildDefaults,
                })}
              </div>
            </div>
            <EditorActions
              secondary={(
                <Button variant="secondary" size="lg" onClick={onClose}>
                  <XIcon className="h-4 w-4" />
                  {autoT('ui_07af7cb30fca')}
                </Button>
              )}
              primary={(
                <Button
                  size="lg"
                  disabled={
                    saving ||
                    (activePanel === 'self'
                      ? !snapshot.permissions.canEditSelf
                      : !snapshot.permissions.canEditChildDefaults)
                  }
                  aria-label={saving ? autoT('ui_b28e5e6d9ac7') : autoT('ui_70b73bbc118d')}
                  title={saving ? autoT('ui_b28e5e6d9ac7') : autoT('ui_70b73bbc118d')}
                  onClick={async () => {
                  if (!org || !settingsDraft || !childDefaultsDraft) return;
                  try {
                    setSaving(true);
                    const payload = {
                      settings: clearOwnSettings
                        ? null
                        : settingsEqual(settingsDraft, snapshot.settings)
                          ? undefined
                          : settingsDraft,
                      childDefaults: clearChildDefaults
                        ? null
                        : childDefaultsEqual(childDefaultsDraft, snapshot.childDefaults)
                          ? undefined
                          : childDefaultsDraft,
                    };
                    const saved = await updateOrgTaxonomySettings(org.id, {
                      settings: payload.settings,
                      childDefaults: payload.childDefaults,
                    });
                    setSnapshot(saved);
                    setSettingsDraft(saved.settings);
                    setChildDefaultsDraft(saved.childDefaults);
                    setClearOwnSettings(false);
                    setClearChildDefaults(false);
                    showToast(autoT('ui_1a66f2dda092'), { type: 'success' });
                    onSaved();
                    onClose();
                  } catch (error: unknown) {
                    const message =
                      (error as { response?: { data?: { message?: unknown } } })?.response?.data
                        ?.message || autoT('ui_892c38bb9803');
                    showToast(String(message), { type: 'error' });
                  } finally {
                    setSaving(false);
                  }
                  }}
                >
                  {saving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <SaveIcon className="h-4 w-4" />
                  )}
                  {saving ? autoT('ui_b28e5e6d9ac7') : autoT('ui_70b73bbc118d')}
                </Button>
              )}
            />
          </div>
        )}
      </Modal>
      <MasterDataTransferModal
        org={org}
        open={masterDataOpen}
        onClose={() => setMasterDataOpen(false)}
        onImported={onSaved}
      />
    </>
  );
}

function MoveImpactList({ title, items }: { title: string; items: OrgMoveImpactItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h5 className="text-sm font-medium text-gray-800 mb-1">{title}</h5>
      <ul className="space-y-1 text-sm text-gray-700">
        {items.slice(0, 6).map((item) => (
          <li key={item.id}>
            {item.name}
            {item.sourceOrgName ? ` (${item.sourceOrgName})` : ''}
          </li>
        ))}
        {items.length > 6 && (
          <li className="text-gray-500">
            {autoT('ui_12023cf943b2')} {items.length - 6} {autoT('ui_4e3936d10c2b')}
          </li>
        )}
      </ul>
    </div>
  );
}

export default function AdminOrgSetup() {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const { scope } = useOrgScope();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [orgs, setOrgs] = useState<OrgDto[]>([]);
  const [taxonomyPermissions, setTaxonomyPermissions] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);
  const isSuperadmin = user?.role === 'superadmin';
  const [settingsOrg, setSettingsOrg] = useState<OrgDto | null>(null);
  const [brandingOrg, setBrandingOrg] = useState<OrgDto | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [savingDefaultLocale, setSavingDefaultLocale] = useState(false);

  // Create org modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [parentId, setParentId] = useState<string | 'root' | ''>('root');
  const [withAdmin, setWithAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminTemporaryPassword, setAdminTemporaryPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [publicConfig, setPublicConfig] = useState<PublicConfig>(DEFAULT_PUBLIC_CONFIG);
  const adminEmailValidationMessage = getEmailValidationMessage(adminEmail);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicConfig()
      .then((config) => {
        if (!cancelled) setPublicConfig(config);
      })
      .catch(() => {
        /* Keep the secure email-invitation default when config loading fails. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadOrgs() {
    setLoading(true);
    try {
      let nextOrgs: OrgDto[];
      if (user?.role === 'superadmin') {
        nextOrgs = await listOrgs();
      } else if (user?.orgId) {
        const res = await api.get<OrgDto[]>('/orgs/subtree');
        nextOrgs = res.data;
      } else {
        nextOrgs = [];
      }
      setOrgs(nextOrgs);

      if (user?.role === 'org_admin' && user.orgId) {
        const configurableOrgs = nextOrgs.filter(
          (org) => org.id === user.orgId || org.parentId === user.orgId,
        );
        const permissionEntries = await Promise.all(
          configurableOrgs.map(async (org) => {
            try {
              const snapshot = await getOrgTaxonomySettings(org.id);
              return [
                org.id,
                snapshot.permissions.canEditSelf || snapshot.permissions.canEditChildDefaults,
              ] as const;
            } catch {
              return [org.id, false] as const;
            }
          }),
        );
        setTaxonomyPermissions(Object.fromEntries(permissionEntries));
      } else {
        setTaxonomyPermissions(null);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reloadOrgs();
  }, [user?.id, user?.role, user?.orgId]);

  useEffect(() => {
    setSelectedOrgId((current) => {
      if (current && orgs.some((org) => org.id === current)) return current;
      if (typeof scope === 'string' && orgs.some((org) => org.id === scope)) return scope;
      if (user?.orgId && orgs.some((org) => org.id === user.orgId)) return user.orgId;
      return orgs[0]?.id ?? null;
    });
  }, [orgs, scope, user?.orgId]);

  async function invalidateTaxonomyQueriesForOrgTree(rootOrgId: string) {
    const rootOrg = orgs.find((candidate) => candidate.id === rootOrgId);
    const affectedScopeKeys = new Set<string>([rootOrgId]);

    if (rootOrg?.path) {
      for (const candidate of orgs) {
        if (candidate.id === rootOrgId) continue;
        if ((candidate.path || '').startsWith(`${rootOrg.path}/`)) {
          affectedScopeKeys.add(candidate.id);
        }
      }
    } else {
      const childrenByParent = new Map<string, string[]>();
      for (const candidate of orgs) {
        if (!candidate.parentId) continue;
        const siblings = childrenByParent.get(candidate.parentId) || [];
        siblings.push(candidate.id);
        childrenByParent.set(candidate.parentId, siblings);
      }
      const queue = [rootOrgId];
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;
        for (const childId of childrenByParent.get(current) || []) {
          if (affectedScopeKeys.has(childId)) continue;
          affectedScopeKeys.add(childId);
          queue.push(childId);
        }
      }
    }

    await Promise.all(
      Array.from(affectedScopeKeys).flatMap((scopeKey) => [
        qc.invalidateQueries({ queryKey: ['categories', scopeKey] }),
        qc.invalidateQueries({ queryKey: ['tags', scopeKey] }),
        qc.invalidateQueries({ queryKey: ['cohorts', scopeKey] }),
        qc.invalidateQueries({ queryKey: ['taxonomy-access', scopeKey] }),
      ]),
    );
  }

  // Build a simple org tree and helpers for indentation
  type OrgNode = { org: OrgDto; children: OrgNode[] };
  const tree = useMemo<OrgNode[]>(() => {
    const byId = new Map(orgs.map((o) => [o.id, { org: o, children: [] as OrgNode[] }]));
    const roots: OrgNode[] = [];
    for (const n of byId.values()) {
      const p = n.org.parentId ? byId.get(n.org.parentId) : undefined;
      if (p) p.children.push(n);
      else roots.push(n);
    }
    // Sort children by name for consistent display
    const sortRec = (nodes: OrgNode[]) => {
      nodes.sort((a, b) => a.org.name.localeCompare(b.org.name, 'de'));
      nodes.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
  }, [orgs]);
  const fixedParentName = useMemo(() => {
    if (!user?.orgId) return user?.orgName || autoT('ui_89e32a6a5474');
    return orgs.find((o) => o.id === user.orgId)?.name || user.orgName || autoT('ui_89e32a6a5474');
  }, [orgs, user?.orgId, user?.orgName]);
  const selectedOrg = useMemo(
    () => orgs.find((candidate) => candidate.id === selectedOrgId) || orgs[0] || null,
    [orgs, selectedOrgId],
  );
  const highlightedOrgId = useMemo(() => {
    if (typeof scope === 'string' && orgs.some((candidate) => candidate.id === scope)) return scope;
    if (user?.orgId && orgs.some((candidate) => candidate.id === user.orgId)) return user.orgId;
    return selectedOrg?.id ?? null;
  }, [orgs, scope, selectedOrg?.id, user?.orgId]);

  const handleDefaultLocaleChange = async (locale: AppLocale) => {
    if (!selectedOrg || savingDefaultLocale || selectedOrg.defaultLocale === locale) return;
    setSavingDefaultLocale(true);
    try {
      const updated = await updateOrgDefaultLocale(selectedOrg.id, locale);
      setOrgs((current) =>
        current.map((org) =>
          org.id === updated.id ? { ...org, defaultLocale: updated.defaultLocale } : org,
        ),
      );
      showToast(t('language.organizationSaved'), { type: 'success' });
    } catch {
      showToast(t('language.organizationError'), { type: 'error' });
    } finally {
      setSavingDefaultLocale(false);
    }
  };

  const resetCreateForm = () => {
    setOrgName('');
    setParentId(isSuperadmin ? 'root' : (user?.orgId ?? 'root'));
    setWithAdmin(false);
    setAdminEmail('');
    setAdminName('');
    setAdminTemporaryPassword('');
  };

  const handleCreate = async () => {
    if (!orgName.trim()) return;
    if (withAdmin && !adminEmail.trim()) return;
    if (withAdmin && adminEmailValidationMessage) return;
    const localProvisioning = publicConfig.userProvisioningMode === 'local';
    if (
      withAdmin &&
      localProvisioning &&
      (!adminTemporaryPassword || getPasswordValidationMessage(adminTemporaryPassword))
    )
      return;

    setCreating(true);
    try {
      const effectiveParentId = isSuperadmin
        ? parentId === 'root'
          ? null
          : parentId || null
        : (user?.orgId ?? null);
      const org = await createOrgApi(orgName.trim(), effectiveParentId);

      if (withAdmin && adminEmail.trim()) {
        if (localProvisioning) {
          await createLocalUserApi({
            email: adminEmail.trim(),
            name: adminName.trim() || adminEmail.split('@')[0],
            role: 'org_admin',
            orgId: org.id,
            temporaryPassword: adminTemporaryPassword,
          });
        } else {
          await inviteUserApi({
            email: adminEmail.trim(),
            name: adminName.trim() || adminEmail.split('@')[0],
            role: 'org_admin',
            orgId: org.id,
          });
        }
      }

      resetCreateForm();
      setCreateModalOpen(false);
      await reloadOrgs();
      showToast(
        withAdmin
          ? localProvisioning
            ? autoT('ui_382a758a5739', { value0: org.name })
            : autoT('ui_d1e50e86b092', { value0: org.name })
          : autoT('ui_cd9e04bd6469', { value0: org.name }),
        { type: 'success' },
      );
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message ||
        autoT('ui_23277c7f6107');
      showToast(String(msg), { type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4">
      {/* Header */}
      <DemoHoverHint
        title={autoT('ui_4048d8ed39f2')}
        description={autoT('ui_cc1f1be5005f')}
        placement="bottom"
      >
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-3xl font-bold text-viridian">{autoT('ui_4048d8ed39f2')}</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{autoT('ui_7344d9db4825')}</p>
          </div>
          <CreateButton
            onClick={() => {
              resetCreateForm();
              setCreateModalOpen(true);
            }}
          >
            {autoT('ui_e769bc597b64')}
          </CreateButton>
        </div>
      </DemoHoverHint>

      <DemoHoverHint title={autoT('ui_d215130fe3a4')} description={autoT('ui_d390d709c7cd')}>
        <div className="grid grid-cols-1 gap-4">
          {/* Organisations-Liste */}
          <div className="org-admin-card rounded-lg shadow">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-[var(--text-primary)]">
                  {autoT('ui_be050db539ba')}
                </h3>
                <span className="text-xs text-[var(--text-muted)]">
                  {orgs.length} {autoT('ui_6e99c1d3b150')}
                  {orgs.length !== 1 ? autoT('ui_094b0fe0e302') : ''}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">{autoT('ui_c33477720509')}</p>
              {selectedOrg && (
                <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <label
                    htmlFor="organization-default-locale"
                    className="text-sm font-medium text-[var(--text-secondary)]"
                  >
                    {t('language.organizationDefault')}
                  </label>
                  <select
                    id="organization-default-locale"
                    value={selectedOrg.defaultLocale || 'de'}
                    disabled={savingDefaultLocale}
                    onChange={(event) =>
                      void handleDefaultLocaleChange(event.target.value as AppLocale)
                    }
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-60"
                  >
                    {APP_LOCALES.map((locale) => (
                      <option key={locale} value={locale}>
                        {t(`language.options.${locale}`)}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-[var(--text-muted)]">
                    {savingDefaultLocale ? t('language.saving') : t('language.organizationHelp')}
                  </span>
                </div>
              )}
            </div>

            <div className="p-2">
              {loading && (
                <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-viridian mr-2"></div>
                  {autoT('ui_240c23fcdd31')}
                </div>
              )}

              {!loading && orgs.length === 0 && (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3" />
                  <p className="text-[var(--text-muted)] mb-4">{autoT('ui_e7c1e646423c')}</p>
                  <CreateButton
                    onClick={() => {
                      resetCreateForm();
                      setCreateModalOpen(true);
                    }}
                  >
                    {autoT('ui_d2d6d3930079')}
                  </CreateButton>
                </div>
              )}
              {!loading && orgs.length > 0 && (
                <ul className="space-y-2">
                  {tree.map((n) => (
                    <OrgTree
                      key={n.org.id}
                      node={n}
                      depth={0}
                      allOrgs={orgs}
                      taxonomyPermissions={taxonomyPermissions}
                      selectedOrgId={highlightedOrgId}
                      onSelectOrg={(nextOrg) => setSelectedOrgId(nextOrg.id)}
                      onMoved={reloadOrgs}
                      onOpenSettings={(nextOrg) => {
                        setSelectedOrgId(nextOrg.id);
                        setSettingsOrg(nextOrg);
                      }}
                      onOpenBranding={(nextOrg) => {
                        setSelectedOrgId(nextOrg.id);
                        setBrandingOrg(nextOrg);
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </DemoHoverHint>

      {/* Neues einheitliches Create Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={autoT('ui_2e3d756e557a')}
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Organisation Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {autoT('ui_1e4cd494c5fd')}
            </label>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
              placeholder={autoT('ui_c07736c0505f')}
              autoFocus
            />
          </div>

          {/* Übergeordnete Organisation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {autoT('ui_ff5ba4d2f6c1')}
            </label>
            {isSuperadmin ? (
              <>
                <select
                  value={parentId}
                  onChange={(e) => setParentId((e.target.value || 'root') as 'root' | string)}
                  className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
                >
                  <option value="root">{autoT('ui_95da21abcbab')}</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">{autoT('ui_79f38132024b')}</p>
              </>
            ) : (
              <>
                <input
                  value={fixedParentName}
                  disabled
                  className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">{autoT('ui_264e18d56e8f')}</p>
              </>
            )}
          </div>

          {/* Admin gleich mit anlegen? */}
          <div className="border-t pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={withAdmin}
                onChange={(e) => setWithAdmin(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-viridian focus:ring-viridian"
              />
              <div>
                <span className="font-medium text-gray-700">
                  {publicConfig.userProvisioningMode === 'local'
                    ? autoT('ui_de759568dc3f')
                    : autoT('ui_458c8eb542fa')}
                </span>
                <p className="text-xs text-gray-500">
                  {publicConfig.userProvisioningMode === 'local'
                    ? autoT('ui_689b09c840d6')
                    : autoT('ui_70300220d9a4')}
                </p>
              </div>
            </label>
          </div>

          {/* Admin-Felder (nur wenn Checkbox aktiv) */}
          {withAdmin && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {autoT('ui_3103d22b6bd6')}
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className={`border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian ${adminEmailValidationMessage ? 'border-red-500' : ''}`}
                  placeholder={autoT('ui_11834f2e879a')}
                  aria-invalid={Boolean(adminEmailValidationMessage)}
                />
                {adminEmailValidationMessage && (
                  <p className="text-xs text-red-600 mt-1">{adminEmailValidationMessage}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {autoT('ui_0ec96e88bad2')}
                </label>
                <input
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
                  placeholder={autoT('ui_57d950a48336')}
                />
                <p className="text-xs text-gray-500 mt-1">{autoT('ui_14c8987e027b')}</p>
              </div>
              {publicConfig.userProvisioningMode === 'local' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {autoT('ui_c07dc032f12a')}
                  </label>
                  <input
                    type="password"
                    value={adminTemporaryPassword}
                    onChange={(event) => setAdminTemporaryPassword(event.target.value)}
                    className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
                    autoComplete="new-password"
                  />
                  <PasswordRequirementsHint password={adminTemporaryPassword} className="mt-2" />
                  <p className="text-xs text-gray-600 mt-2">{autoT('ui_198d169e7342')}</p>
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <button
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={() => setCreateModalOpen(false)}
            >
              {autoT('ui_07af7cb30fca')}
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              disabled={
                !orgName.trim() ||
                (withAdmin &&
                  (!adminEmail.trim() ||
                    Boolean(adminEmailValidationMessage) ||
                    (publicConfig.userProvisioningMode === 'local' &&
                      (!adminTemporaryPassword ||
                        Boolean(getPasswordValidationMessage(adminTemporaryPassword)))))) ||
                creating ||
                (!isSuperadmin && !user?.orgId)
              }
              onClick={handleCreate}
            >
              {creating && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {withAdmin ? autoT('ui_6d62972efc1b') : autoT('ui_bf524c1f1672')}
            </button>
          </div>
        </div>
      </Modal>

      <OrgTaxonomySettingsModal
        org={settingsOrg}
        open={!!settingsOrg}
        onClose={() => setSettingsOrg(null)}
        onSaved={() => {
          if (!settingsOrg) return;
          void Promise.all([reloadOrgs(), invalidateTaxonomyQueriesForOrgTree(settingsOrg.id)]);
        }}
      />
      <OrganizationBrandingModal
        org={brandingOrg}
        open={!!brandingOrg}
        onClose={() => setBrandingOrg(null)}
        onSaved={(updated) => {
          setOrgs((current) => current.map((org) => (org.id === updated.id ? updated : org)));
          window.dispatchEvent(
            new CustomEvent<OrgDto>('stato:organization-branding-changed', { detail: updated }),
          );
          setBrandingOrg(null);
        }}
      />
    </div>
  );
}

type OrgTreeNode = { org: OrgDto; children: OrgTreeNode[] };
function OrgTree({
  node,
  depth,
  allOrgs,
  taxonomyPermissions,
  selectedOrgId,
  onSelectOrg,
  onMoved,
  onOpenSettings,
  onOpenBranding,
}: {
  node: OrgTreeNode;
  depth: number;
  allOrgs: OrgDto[];
  taxonomyPermissions: Record<string, boolean> | null;
  selectedOrgId: string | null;
  onSelectOrg: (org: OrgDto) => void;
  onMoved: () => void;
  onOpenSettings: (org: OrgDto) => void;
  onOpenBranding: (org: OrgDto) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <OrgRow
        org={node.org}
        depth={depth}
        allOrgs={allOrgs}
        taxonomyPermissions={taxonomyPermissions}
        onMoved={onMoved}
        onOpenSettings={onOpenSettings}
        onOpenBranding={onOpenBranding}
        hasChildren={hasChildren}
        childCount={node.children.length}
        expanded={expanded}
        selected={node.org.id === selectedOrgId}
        onSelectOrg={onSelectOrg}
        onToggleExpand={() => setExpanded(!expanded)}
      />
      {expanded &&
        node.children.map((c) => (
          <OrgTree
            key={c.org.id}
            node={c}
            depth={depth + 1}
            allOrgs={allOrgs}
            taxonomyPermissions={taxonomyPermissions}
            selectedOrgId={selectedOrgId}
            onSelectOrg={onSelectOrg}
            onMoved={onMoved}
            onOpenSettings={onOpenSettings}
            onOpenBranding={onOpenBranding}
          />
        ))}
    </>
  );
}

function OrganizationBannerIconButton({
  org,
  onClick,
}: {
  org: OrgDto;
  onClick: () => void;
}) {
  const bannerSrc = useResolvedImageSrc(org.bannerUrl);
  const label = org.bannerUrl
    ? 'Organisationsbanner bearbeiten (Banner gesetzt)'
    : 'Organisationsbanner bearbeiten';

  return (
    <IconButton
      size="icon-compact"
      variant="secondary"
      className="org-tree-icon-button relative overflow-hidden"
      aria-label={label}
      title={label}
      style={org.bannerUrl && org.brandColor ? { backgroundColor: `${org.brandColor}2b` } : undefined}
      onClick={onClick}
    >
      {bannerSrc ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url("${bannerSrc}")` }}
        />
      ) : null}
      {org.bannerUrl ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full shadow-sm"
          style={{ backgroundColor: org.brandColor || 'var(--viridian)' }}
        />
      ) : null}
      <ImagePlus aria-hidden="true" className="relative z-10" />
    </IconButton>
  );
}

function OrgRow({
  org,
  depth,
  allOrgs,
  taxonomyPermissions,
  onMoved,
  onOpenSettings,
  onOpenBranding,
  hasChildren,
  childCount,
  expanded,
  selected,
  onSelectOrg,
  onToggleExpand,
}: {
  org: OrgDto;
  depth: number;
  allOrgs: OrgDto[];
  taxonomyPermissions: Record<string, boolean> | null;
  onMoved: () => void;
  onOpenSettings: (org: OrgDto) => void;
  onOpenBranding: (org: OrgDto) => void;
  hasChildren: boolean;
  childCount: number;
  expanded: boolean;
  selected: boolean;
  onSelectOrg: (org: OrgDto) => void;
  onToggleExpand: () => void;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canConfigureTaxonomy =
    !!user &&
    (user.role === 'superadmin' ||
      (user.role === 'org_admin' &&
        taxonomyPermissions?.[org.id] === true &&
        (org.id === user.orgId || org.parentId === user.orgId)));
  const canConfigureBranding =
    !!user && (user.role === 'superadmin' || (user.role === 'org_admin' && org.id === user.orgId));
  const [orgUsers, setOrgUsers] = useState<{
    admins: { name: string }[];
    users: { name: string }[];
  } | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Array<{
    id: string;
    email: string;
    name: string;
    role: string;
  }> | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [movePicker, setMovePicker] = useState<{ open: boolean; targetParentId: string | null }>({
    open: false,
    targetParentId: org.parentId ?? null,
  });
  const [moveDialog, setMoveDialog] = useState<{
    open: boolean;
    loading: boolean;
    preview: OrgMovePreview | null;
    targetParentId: string | null;
  }>({
    open: false,
    loading: false,
    preview: null,
    targetParentId: null,
  });
  const byId = useMemo(() => Object.fromEntries(allOrgs.map((o) => [o.id, o] as const)), [allOrgs]);

  // Compute valid parents (exclude self and descendants)
  const validParents = useMemo(() => {
    const currentPath = org.path || '';
    const isDescendant = (candidate: OrgDto) => {
      if (!currentPath || !candidate.path) return candidate.id !== org.id;
      return candidate.id !== org.id && !candidate.path.startsWith(currentPath + '/');
    };
    const withDepth = allOrgs
      .filter((candidate) => candidate.id !== (org.parentId ?? ''))
      .filter(isDescendant)
      .map((o) => ({
        o,
        depth: o.path ? Math.max(0, o.path.split('/').length - 1) : getDepthByChain(o, byId),
      }));
    withDepth.sort((a, b) => a.depth - b.depth || a.o.name.localeCompare(b.o.name, 'de'));
    return withDepth;
  }, [allOrgs, byId, org.id, org.path]);

  const canMoveOrg = canAccessOrgMove(user?.role) && validParents.length > 0;
  const defaultMoveTargetId = validParents[0]?.o.id ?? null;

  function getDepthByChain(o: OrgDto, map: Record<string, OrgDto>): number {
    let d = 0;
    let cur: OrgDto | undefined = o;
    const safe = new Set<string>();
    while (cur?.parentId && !safe.has(cur.parentId)) {
      d++;
      safe.add(cur.parentId);
      cur = map[cur.parentId];
    }
    return d;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Use listUsersByOrg to fetch users for this specific org, ignoring scope
        const list = await listUsersByOrg(org.id, false);
        const admins = list
          .filter((u: { role: string; name?: string; email?: string }) => u.role === 'org_admin')
          .map((u: { name?: string; email?: string }) => ({ name: u.name || u.email || '' }));
        const users = list
          // The tree's person badge represents all regular organisation members.
          // Editors are displayed as "Benutzer" in the members dialog as well,
          // so excluding them here made the badge disagree with that dialog.
          .filter(
            (u: { role: string; name?: string; email?: string }) =>
              u.role !== 'org_admin' && u.role !== 'superadmin',
          )
          .map((u: { name?: string; email?: string }) => ({ name: u.name || u.email || '' }));
        if (mounted) setOrgUsers({ admins, users });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [org.id]);

  useEffect(() => {
    const isEmail = (t: string) => /[^\s@]+@[^\s@]+\.[^\s@]+/.test(t);
    if (!open) return;
    (async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && isEmail(text.trim()) && !inviteEmail) setInviteEmail(text.trim());
      } catch {
        /* ignore */
      }
    })();
  }, [open, inviteEmail]);

  const targetParentName = moveDialog.targetParentId
    ? allOrgs.find((candidate) => candidate.id === moveDialog.targetParentId)?.name ||
      'Zielorganisation'
    : 'Obere Ebene';

  const selectedMoveParentName = movePicker.targetParentId
    ? allOrgs.find((candidate) => candidate.id === movePicker.targetParentId)?.name ||
      'Zielorganisation'
    : 'Obere Ebene';

  const openMembers = async () => {
    setMembers(null);
    setOpen(true);
    try {
      setMembers(await listUsersByOrg(org.id, false));
    } catch {
      setMembers([]);
      showToast(autoT('ui_c41069f95501'), { type: 'error' });
    }
  };

  const openMovePicker = () => {
    if (!canMoveOrg) return;
    setMovePicker({ open: true, targetParentId: defaultMoveTargetId });
  };

  const openMovePreview = async (parentId: string | null) => {
    try {
      setMoveDialog({ open: true, loading: true, preview: null, targetParentId: parentId });
      const preview = await previewMoveOrgApi(org.id, parentId);
      setMoveDialog({ open: true, loading: false, preview, targetParentId: parentId });
    } catch (error: unknown) {
      setMoveDialog({ open: false, loading: false, preview: null, targetParentId: null });
      const message =
        (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message ||
        'Verschiebe-Vorschau konnte nicht geladen werden.';
      showToast(String(message), { type: 'error' });
    }
  };

  return (
    <li
      className={`org-tree-item rounded-lg transition-colors ${selected ? 'org-tree-item-selected' : ''}`}
      style={{ marginLeft: depth * 12 }}
    >
      {/* Mobile: Stacked layout */}
      <div className="flex flex-col gap-1.5 px-3 py-2 sm:hidden">
        {/* Row 1: Toggle + Org Name (full width) */}
        <div className="flex items-center gap-2">
          <button
            className={`org-tree-toggle w-5 h-5 flex-shrink-0 flex items-center justify-center rounded transition-colors ${!hasChildren ? 'invisible' : ''}`}
            onClick={onToggleExpand}
          >
            {hasChildren &&
              (expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              ))}
          </button>
          <div className="min-w-0 flex-1">
            <button
              className="block w-full truncate text-left font-semibold text-[var(--text-primary)] transition-colors hover:text-viridian"
              onClick={openMembers}
              title={autoT('ui_4424bfed8ec2')}
            >
              {org.name}
            </button>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span
                className={`org-tree-level-badge ${depth === 0 ? 'org-tree-level-badge-root' : 'org-tree-level-badge-child'}`}
              >
                {depth === 0 ? (
                  <Building2 className="h-3.5 w-3.5" />
                ) : (
                  <GitBranch className="h-3.5 w-3.5" />
                )}
                {depth === 0 ? autoT('ui_e96857c58f71') : `Ebene ${depth}`}
              </span>
              <span className="org-tree-child-badge">
                <Users className="h-3.5 w-3.5" />
                {childCount} {autoT('ui_5be3b245eac6')}
              </span>
            </div>
          </div>
        </div>
        {/* Row 2: Counts + Actions */}
        <div className="flex items-center gap-2 pl-7">
          <Tooltip label={autoT('ui_52a675eed361')} names={orgUsers?.admins.map((a) => a.name)}>
            <span className="org-tree-count-pill inline-flex items-center gap-1 rounded px-2 py-1 text-xs cursor-default">
              <Shield className="w-3.5 h-3.5" /> {orgUsers?.admins.length ?? '–'}
            </span>
          </Tooltip>
          <Tooltip label={autoT('ui_bd26f3d230af')} names={orgUsers?.users.map((u) => u.name)}>
            <span className="org-tree-count-pill inline-flex items-center gap-1 rounded px-2 py-1 text-xs cursor-default">
              <UserIcon className="w-3.5 h-3.5" /> {orgUsers?.users.length ?? '–'}
            </span>
          </Tooltip>
          {canConfigureTaxonomy && (
            <button
              className="org-tree-icon-button org-tree-settings-button inline-flex items-center justify-center w-8 h-8 rounded"
              title={autoT('ui_645f55452cd1')}
              onClick={() => {
                onSelectOrg(org);
                onOpenSettings(org);
              }}
            >
              <Settings2 className="w-4 h-4" />
            </button>
          )}
          {canConfigureBranding && (
            <OrganizationBannerIconButton
              org={org}
              onClick={() => {
                onSelectOrg(org);
                onOpenBranding(org);
              }}
            />
          )}
          {canMoveOrg && (
            <button
              className="org-tree-icon-button inline-flex items-center justify-center w-8 h-8 rounded"
              title={autoT('ui_fc30edb15ff7')}
              onClick={() => {
                onSelectOrg(org);
                openMovePicker();
              }}
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          )}
          {user?.role === 'superadmin' && (
            <DeleteIconButton
              size="icon-compact"
              className="shrink-0"
              aria-label={autoT('ui_3974dc710086')}
              title={autoT('ui_3974dc710086')}
              onClick={() => {
                onSelectOrg(org);
                setDeleteModalOpen(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Desktop: Single row layout */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-2">
        {/* Expand/Collapse Toggle */}
        <button
          className={`org-tree-toggle w-5 h-5 flex items-center justify-center rounded transition-colors ${!hasChildren ? 'invisible' : ''}`}
          onClick={onToggleExpand}
        >
          {hasChildren &&
            (expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
        </button>

        {/* Org Name */}
        <button
          className="min-w-0 flex-1 text-left transition-colors hover:text-viridian"
          onClick={openMembers}
          title={autoT('ui_4424bfed8ec2')}
        >
          <span className="block truncate font-semibold text-[var(--text-primary)]">
            {org.name}
          </span>
        </button>

        <div className="hidden min-w-[12rem] flex-wrap justify-end gap-1.5 lg:flex">
          <span
            className={`org-tree-level-badge ${depth === 0 ? 'org-tree-level-badge-root' : 'org-tree-level-badge-child'}`}
          >
            {depth === 0 ? (
              <Building2 className="h-3.5 w-3.5" />
            ) : (
              <GitBranch className="h-3.5 w-3.5" />
            )}
            {depth === 0 ? autoT('ui_e96857c58f71') : `Ebene ${depth}`}
          </span>
          <span className="org-tree-child-badge">
            <Users className="h-3.5 w-3.5" />
            {childCount} {autoT('ui_5be3b245eac6')}
          </span>
        </div>

        {/* User Counts */}
        <div className="flex items-center gap-2 text-xs">
          <Tooltip label={autoT('ui_52a675eed361')} names={orgUsers?.admins.map((a) => a.name)}>
            <span className="org-tree-count-pill inline-flex items-center gap-1 rounded px-2 py-1 cursor-default">
              <Shield className="w-3.5 h-3.5" /> {orgUsers?.admins.length ?? '–'}
            </span>
          </Tooltip>
          <Tooltip label={autoT('ui_bd26f3d230af')} names={orgUsers?.users.map((u) => u.name)}>
            <span className="org-tree-count-pill inline-flex items-center gap-1 rounded px-2 py-1 cursor-default">
              <UserIcon className="w-3.5 h-3.5" /> {orgUsers?.users.length ?? '–'}
            </span>
          </Tooltip>
        </div>

        {canConfigureTaxonomy && (
          <button
            className="org-tree-action-button org-tree-settings-button inline-flex items-center justify-center gap-2 rounded px-2.5 py-2 text-xs font-medium"
            title={autoT('ui_645f55452cd1')}
            onClick={() => {
              onSelectOrg(org);
              onOpenSettings(org);
            }}
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden xl:inline">{autoT('ui_53b85ac95f23')}</span>
          </button>
        )}

        {canConfigureBranding && (
          <OrganizationBannerIconButton
            org={org}
            onClick={() => {
              onSelectOrg(org);
              onOpenBranding(org);
            }}
          />
        )}

        {/* Move Dropdown */}
        {canMoveOrg && (
          <button
            className="org-tree-action-button inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
            title={autoT('ui_fc30edb15ff7')}
            onClick={() => {
              onSelectOrg(org);
              openMovePicker();
            }}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>{autoT('ui_af0e56812bc6')}</span>
          </button>
        )}

        {/* Delete Button (nur für Superadmin) */}
        {user?.role === 'superadmin' && (
          <DeleteIconButton
            size="icon-compact"
            aria-label={autoT('ui_3974dc710086')}
            title={autoT('ui_3974dc710086')}
            onClick={() => {
              onSelectOrg(org);
              setDeleteModalOpen(true);
            }}
          />
        )}
      </div>

      {/* Benutzer Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={autoT('ui_82d8ea07df8e', { value0: org.name })}
        maxWidth="md"
      >
        {!members && <div className="text-gray-500">{autoT('ui_fdfb01fa6df9')}</div>}
        {members && members.length === 0 && (
          <div className="text-center py-6">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">{autoT('ui_2a0f2de1cbae')}</p>
          </div>
        )}
        {members && members.length > 0 && (
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {m.name} <span className="text-gray-500 font-normal">({m.email})</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {m.role === 'org_admin' ? (
                      <span className="inline-flex items-center gap-1">
                        <Shield className="w-3 h-3" /> {autoT('ui_4e7afebcfbae')}
                      </span>
                    ) : m.role === 'superadmin' ? (
                      <span className="text-viridian font-medium">{autoT('ui_8fc2130c51bf')}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <UserIcon className="w-3 h-3" /> {autoT('ui_bd26f3d230af')}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            {autoT('ui_be454fe3dbfd')}
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              inputMode="email"
              placeholder={autoT('ui_ce8fdbcbfea8')}
              className="border rounded-lg px-3 py-2 text-sm flex-1"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <button
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-viridian text-white disabled:opacity-60 text-sm"
              title={autoT('ui_18ababb1960c')}
              disabled={inviteBusy || !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(inviteEmail)}
              onClick={async () => {
                try {
                  setInviteBusy(true);
                  const invitation = await inviteUserApi({
                    email: inviteEmail.trim(),
                    role: 'user',
                    orgId: org.id,
                  });
                  const message = invitation.emailQueued
                    ? autoT('ui_b90214965611')
                    : autoT('ui_4fb8125a11b1');
                  setCopyMsg(message);
                  setTimeout(() => setCopyMsg(null), 1500);
                  showToast(`${message}.`, { type: invitation.emailQueued ? 'success' : 'error' });
                } catch {
                  showToast(autoT('ui_cc6688313c0a'), { type: 'error' });
                } finally {
                  setInviteBusy(false);
                }
              }}
            >
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">{autoT('ui_871d0f64660b')}</span>
            </button>
          </div>
          {copyMsg && <div className="text-xs text-viridian mt-1">{copyMsg}</div>}
        </div>
      </Modal>

      <Modal
        open={movePicker.open}
        onClose={() => setMovePicker({ open: false, targetParentId: defaultMoveTargetId })}
        title={autoT('ui_97aaf31a81b5', { value0: org.name })}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            {autoT('ui_aa75557c36cd')}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {autoT('ui_a8f567062b93')}
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 bg-white"
              value={movePicker.targetParentId ?? ''}
              onChange={(event) => {
                const nextValue = event.target.value;
                setMovePicker({ open: true, targetParentId: nextValue || null });
              }}
            >
              {validParents.map(({ o, depth: d }) => (
                <option key={o.id} value={o.id}>{`${'  '.repeat(d)}${o.name}`}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              {autoT('ui_ef3870c3c5d7')}
              <strong>
                {org.parentId
                  ? allOrgs.find((candidate) => candidate.id === org.parentId)?.name || 'Unbekannt'
                  : autoT('ui_83096f5737aa')}
              </strong>
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {autoT('ui_394a0aa3d4e3')}
            <strong>{selectedMoveParentName}</strong>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <button
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              onClick={() => setMovePicker({ open: false, targetParentId: defaultMoveTargetId })}
            >
              {autoT('ui_07af7cb30fca')}
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue"
              disabled={!movePicker.targetParentId}
              onClick={async () => {
                if (!movePicker.targetParentId) return;
                setMovePicker({ open: false, targetParentId: movePicker.targetParentId });
                await openMovePreview(movePicker.targetParentId);
              }}
            >
              {autoT('ui_44f6292fbe78')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={moveDialog.open}
        onClose={() =>
          setMoveDialog({ open: false, loading: false, preview: null, targetParentId: null })
        }
        title={autoT('ui_97aaf31a81b5', { value0: org.name })}
        maxWidth="lg"
      >
        {moveDialog.loading && (
          <div className="py-8 text-center text-gray-500">{autoT('ui_c498228ed2ae')}</div>
        )}
        {!moveDialog.loading && moveDialog.preview && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {autoT('ui_d608664b9f54')}
              <strong>{targetParentName}</strong>
              <div className="mt-1 text-xs text-gray-500">
                {autoT('ui_416e2e25af82')} {moveDialog.preview.affectedOrgs}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MoveImpactList
                title={autoT('ui_09e00d28d76d')}
                items={moveDialog.preview.lost.categories}
              />
              <MoveImpactList
                title={autoT('ui_dd8592c2e725')}
                items={moveDialog.preview.gained.categories}
              />
              <MoveImpactList
                title={autoT('ui_92c91f3f9745')}
                items={moveDialog.preview.lost.tags}
              />
              <MoveImpactList
                title={autoT('ui_aca7bec981bf')}
                items={moveDialog.preview.gained.tags}
              />
              <MoveImpactList
                title={autoT('ui_85a40fe4849e')}
                items={moveDialog.preview.lost.cohorts}
              />
              <MoveImpactList
                title={autoT('ui_34e44512beaa')}
                items={moveDialog.preview.gained.cohorts}
              />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {moveDialog.preview.resetNotice}
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              <div>
                {autoT('ui_e8de5044fdc1')}{' '}
                <strong>{moveDialog.preview.activityConflicts.categories.activities}</strong>
              </div>
              <div>
                {autoT('ui_032ec008590c')}{' '}
                <strong>{moveDialog.preview.activityConflicts.tags.activities}</strong>
              </div>
              <div>
                {autoT('ui_326edcb1f44e')}{' '}
                <strong>{moveDialog.preview.activityConflicts.cohorts.activities}</strong>
              </div>
              <div>
                {autoT('ui_9bec8c0d2012')}{' '}
                <strong>{moveDialog.preview.projectConflicts.categories.projects}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MoveImpactList
                title={autoT('ui_432dba66d4d1')}
                items={moveDialog.preview.activityConflicts.categories.items}
              />
              <MoveImpactList
                title={autoT('ui_72af3a336c6a')}
                items={moveDialog.preview.activityConflicts.tags.items}
              />
              <MoveImpactList
                title={autoT('ui_d18f4a6126e7')}
                items={moveDialog.preview.activityConflicts.cohorts.items}
              />
              <MoveImpactList
                title={autoT('ui_ea80ef79974c')}
                items={moveDialog.preview.projectConflicts.categories.items}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                onClick={() =>
                  setMoveDialog({
                    open: false,
                    loading: false,
                    preview: null,
                    targetParentId: null,
                  })
                }
              >
                {autoT('ui_07af7cb30fca')}
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue"
                onClick={async () => {
                  try {
                    await moveOrgWithConfirmationApi(org.id, moveDialog.targetParentId, true);
                    showToast(autoT('ui_51f8f87907b0'), { type: 'success' });
                    setMoveDialog({
                      open: false,
                      loading: false,
                      preview: null,
                      targetParentId: null,
                    });
                    onMoved();
                  } catch (error: unknown) {
                    const message =
                      (error as { response?: { data?: { message?: unknown } } })?.response?.data
                        ?.message || 'Verschieben fehlgeschlagen.';
                    showToast(String(message), { type: 'error' });
                  }
                }}
              >
                {autoT('ui_7168eaa1dc95')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {user?.role === 'superadmin' && (
        <DeleteOrgModal
          orgId={org.id}
          orgName={org.name}
          open={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onDeleted={() => {
            setDeleteModalOpen(false);
            onMoved();
          }}
            />
        )}
    </li>
  );
}

function OrganizationBrandingModal({
  org,
  open,
  onClose,
  onSaved,
}: {
  org: OrgDto | null;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: OrgDto) => void;
}) {
  const { showToast } = useToast();
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState<string>('#4f46e5');
  const [bannerPosition, setBannerPosition] = useState(50);
  const [uploading, setUploading] = useState(false);
  const [extractingColor, setExtractingColor] = useState(false);
  const [saving, setSaving] = useState(false);
  const resolvedBannerSrc = useResolvedImageSrc(bannerUrl);

  useEffect(() => {
    if (!open || !org) return;
    setBannerUrl(org.bannerUrl ?? null);
    setBrandColor(org.brandColor ?? '#4f46e5');
    setBannerPosition(org.bannerPosition ?? 50);
  }, [open, org?.id, org?.bannerUrl, org?.brandColor, org?.bannerPosition]);

  const uploadBanner = async (file: File) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      showToast('Bitte ein PNG-, JPG- oder WebP-Bild auswählen.', { type: 'error' });
      return;
    }
    setUploading(true);
    try {
      const [uploadedUrl, extractedColor] = await Promise.all([
        uploadOrganizationBanner(file),
        extractAccentColorFromImage(file),
      ]);
      setBannerUrl(uploadedUrl);
      if (extractedColor) setBrandColor(extractedColor);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message ||
        'Das Banner konnte nicht hochgeladen werden.';
      showToast(String(message), { type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const applyAccentColorFromBanner = async () => {
    if (!resolvedBannerSrc || extractingColor) return;
    setExtractingColor(true);
    try {
      const extractedColor = await extractAccentColorFromImage(resolvedBannerSrc);
      if (!extractedColor) {
        showToast('Aus dem Banner konnte keine Akzentfarbe bestimmt werden.', { type: 'error' });
        return;
      }
      setBrandColor(extractedColor);
      showToast('Akzentfarbe aus dem Banner übernommen.', { type: 'success' });
    } finally {
      setExtractingColor(false);
    }
  };

  const save = async () => {
    if (!org || saving || uploading) return;
    setSaving(true);
    try {
      const updated = await updateOrgBranding(org.id, {
        bannerUrl,
        brandColor,
        bannerPosition,
      });
      showToast('Organisationsbanner gespeichert.', { type: 'success' });
      onSaved(updated);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message ||
        'Das Organisationsbanner konnte nicht gespeichert werden.';
      showToast(String(message), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={org ? `Organisationsbanner · ${org.name}` : 'Organisationsbanner'}
      maxWidth="md"
    >
      <div className="space-y-5">
        <p className="text-sm text-[var(--text-secondary)]">
          Das Banner erscheint im Kopfbereich, sobald diese Organisation aktiv ist.
        </p>

        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]">
          {bannerUrl ? (
            <div className="relative h-36">
              <ProtectedImage
                src={bannerUrl}
                alt="Vorschau des Organisationsbanners"
                className="h-full w-full object-cover"
                style={{ objectPosition: `center ${bannerPosition}%` }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: brandColor }}
              />
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center text-sm text-[var(--text-muted)]">
              Noch kein Banner ausgewählt
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--interactive-soft)]">
            <Upload className="h-4 w-4" aria-hidden="true" />
            {uploading ? 'Banner wird hochgeladen…' : 'Banner auswählen'}
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={uploading || saving}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                if (file) void uploadBanner(file);
              }}
            />
          </label>
          {bannerUrl ? (
            <Button variant="danger-ghost" onClick={() => setBannerUrl(null)} disabled={uploading || saving}>
              Banner entfernen
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block text-sm font-medium text-[var(--text-secondary)]">
            Akzentfarbe
            <span className="mt-1 flex h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3">
              <Input
                type="color"
                value={brandColor}
                aria-label="Akzentfarbe auswählen"
                className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                disabled={saving}
                onChange={(event) => setBrandColor(event.target.value)}
              />
              <span className="font-mono text-xs uppercase text-[var(--text-muted)]">{brandColor}</span>
            </span>
          </label>
          <div className="text-xs text-[var(--text-muted)]">Die Farbe markiert auch Banner ohne Bild.</div>
        </div>

        {bannerUrl ? (
          <div className="flex justify-start">
            <Button
              variant="secondary"
              onClick={() => void applyAccentColorFromBanner()}
              disabled={!resolvedBannerSrc || extractingColor || saving}
            >
              {extractingColor ? 'Farbe wird bestimmt…' : 'Farbe aus Bild übernehmen'}
            </Button>
          </div>
        ) : null}

        {bannerUrl ? (
          <label className="block text-sm font-medium text-[var(--text-secondary)]">
            Bildausschnitt vertikal
            <Input
              type="range"
              min="0"
              max="100"
              value={bannerPosition}
              className="mt-3 w-full accent-viridian"
              disabled={saving}
              onChange={(event) => setBannerPosition(Number(event.target.value))}
            />
          </label>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={() => void save()} disabled={saving || uploading}>
            {saving ? 'Speichert…' : 'Speichern'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
