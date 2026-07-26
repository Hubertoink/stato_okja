import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import Toggle from '@/components/Toggle';
import { FIXED_PALETTE, TAG_PALETTE } from '@/lib/colorPalette';
import { ColorPicker } from '@/components/ui/ColorPicker';
import {
  Project,
  ProjectDocument,
  downloadProjectDocument,
  removeProjectDocument,
  uploadProjectDocument,
  useCreateProject,
  useProjects,
  useUpdateProject,
  useDeleteProject,
  useRemoveProject,
} from '@/lib/projects';
import {
  Layers,
  Pencil,
  Plus,
  Search,
  Save as SaveIcon,
  X as XIcon,
  XCircle,
  Archive as ArchiveIcon,
  ArchiveRestore as ArchiveRestoreIcon,
  Trash2,
  CalendarRange,
  LayoutGrid,
  List,
  Download,
  FileText,
  Paperclip,
  ChevronDown,
  ChevronRight,
  ImagePlus,
} from 'lucide-react';
import { Star, StarOff } from 'lucide-react';
import { getStarredProjectIds, toggleStarredProject } from '@/lib/starred';
import { api } from '@/lib/api';
import { useCategories, useTags, useTaxonomyAccess, useUpdateCategory } from '@/lib/taxonomy';
import { type StaffMember, type StaffRole, useCreateStaff, useStaff } from '@/lib/staff';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import Modal from '@/components/Modal';
import { CategoryFormModal, StaffFormModal, TagFormModal } from '@/components/settings/EntityFormModals';
import { useQueryClient } from '@tanstack/react-query';
import { PROJECT_TEMPLATES, type ProjectTemplate } from '@/lib/projectTemplates';
import { defaultCategoryByName } from '@/lib/defaultCategories';
import { useProjectTemplates, type ProjectTemplateDto } from '@/lib/projectTemplatesApi';
import { MAX_IMAGE_BYTES, processImageForUpload } from '@/lib/imageProcessing';
import ProtectedImage from '@/components/ProtectedImage';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { normalizeUploadPath } from '@/lib/uploadPaths';
import { useEditorShortcuts } from '@/lib/useEditorShortcuts';
import { getSelectableTaxonomyChipStyle } from '@/lib/taxonomyChipStyles';
import { useAuth } from '@/lib/auth';
import RichTextEditor, {
  BtnBold,
  BtnBulletList,
  BtnClearFormatting,
  BtnItalic,
  BtnNumberedList,
  BtnRedo,
  BtnStyles,
  BtnUndo,
  Separator,
  Toolbar,
  type ContentEditableEvent,
} from 'react-simple-wysiwyg';

const PROJECTS_DESKTOP_VIEW_STORAGE_KEY = 'projects:desktop-view';
const PROJECTS_STARRED_FIRST_STORAGE_KEY = 'projects:starred-first';

const PROJECT_TYPE_LABELS: Record<string, string> = {
  open_door: 'Offene Tür',
  project_open: 'Projekt (offen)',
  project_closed: 'Projekt (geschlossen)',
  event: 'Veranstaltung',
  outreach: 'Aufsuchend',
};

const PROJECT_CARD_PALETTE = [
  '#2563eb',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#14b8a6',
  '#22c55e',
  '#eab308',
  '#0ea5e9',
  '#a855f7',
];

const PROJECT_DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.txt';
const MAX_PROJECT_DOCUMENT_BYTES = 15 * 1024 * 1024;

type ProjectsDesktopView = 'grid' | 'list';

type ProjectBadgeCategory = {
  id: string;
  name: string;
  color?: string | null;
};

type ProjectBadgeTag = {
  id: string;
  name: string;
  color?: string | null;
};

type ProjectFormSubmission = {
  values: Partial<Project>;
  pendingDocuments: File[];
  removedDocumentIds: string[];
};

type NamedTaxonomyItem = {
  id: string;
  name: string;
  active?: boolean | null;
};

const normalizeNamedTaxonomyItem = (name: string) => name.trim().toLowerCase();

const findNamedTaxonomyItem = <T extends NamedTaxonomyItem>(
  items: T[] | undefined,
  name: string,
): T | undefined => {
  const needle = normalizeNamedTaxonomyItem(name || '');
  if (!needle) return undefined;
  const list = Array.isArray(items) ? items : [];
  return list.find((item) => normalizeNamedTaxonomyItem(item.name || '') === needle);
};

async function ensureNamedTaxonomyItem<T extends NamedTaxonomyItem>({
  items,
  name,
  createPath,
  listPath,
  createPayload,
  reactivate,
  refresh,
}: {
  items: T[] | undefined;
  name: string;
  createPath: string;
  listPath: string;
  createPayload: Record<string, unknown>;
  reactivate?: (id: string) => Promise<void>;
  refresh?: () => Promise<unknown>;
}): Promise<{ id: string } | null> {
  const normalizedName = normalizeNamedTaxonomyItem(name || '');
  if (!normalizedName) return null;

  const existing = findNamedTaxonomyItem(items, name);
  if (existing?.id) {
    if (existing.active === false && reactivate) {
      try {
        await reactivate(existing.id);
      } catch {
        // If reactivation fails, keep the existing id so the caller can still proceed.
      }
    }
    return { id: existing.id };
  }

  try {
    const created = await api.post(createPath, createPayload);
    await refresh?.();
    const id = created?.data?.id as string | undefined;
    return id ? { id } : null;
  } catch {
    try {
      const res = await api.get(listPath);
      const list = (res.data || []) as NamedTaxonomyItem[];
      const found = list.find((item) => normalizeNamedTaxonomyItem(item.name || '') === normalizedName);
      return found?.id ? { id: found.id } : null;
    } catch {
      return null;
    }
  }
}

function createClientRequestId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const pickBg = (title?: string) => {
  if (!title) return PROJECT_CARD_PALETTE[0];
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return PROJECT_CARD_PALETTE[h % PROJECT_CARD_PALETTE.length];
};

const textColorFor = (bg?: string | null) => {
  const hex = (bg || '').toString().trim();
  if (!hex || !hex.startsWith('#')) return '#ffffff';
  const clean = hex.length === 4 ? '#' + [...hex.slice(1)].map((ch) => ch + ch).join('') : hex;
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 140 ? '#111111' : '#ffffff';
};

const truncateWords = (text?: string | null, words = 20) => {
  if (!text) return '';
  const parts = text.trim().split(/\s+/);
  if (parts.length <= words) return text;
  return parts.slice(0, words).join(' ') + '…';
};

const PROJECT_DESCRIPTION_ALLOWED_TAGS = [
  'a',
  'b',
  'br',
  'div',
  'em',
  'h1',
  'h2',
  'i',
  'li',
  'ol',
  'p',
  'strong',
  'u',
  'ul',
];

const PROJECT_DESCRIPTION_ALLOWED_ATTR = ['href', 'target', 'rel'];
const PROJECT_DESCRIPTION_HTML_PATTERN = /<\/?[a-z][\s\S]*>/i;

const escapeProjectDescriptionText = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeProjectDescriptionHtml = (html?: string | null) =>
  DOMPurify.sanitize(String(html || ''), {
    ALLOWED_TAGS: PROJECT_DESCRIPTION_ALLOWED_TAGS,
    ALLOWED_ATTR: PROJECT_DESCRIPTION_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });

const normalizeProjectDescriptionHtml = (value?: string | null) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const html = PROJECT_DESCRIPTION_HTML_PATTERN.test(text)
    ? text
    : escapeProjectDescriptionText(text).replace(/\r?\n/g, '<br>');
  return sanitizeProjectDescriptionHtml(html);
};

const projectDescriptionToPlainText = (value?: string | null) => {
  const html = normalizeProjectDescriptionHtml(value);
  if (!html) return '';
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};

const formatDocumentSize = (bytes?: number | null) => {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const formatDocumentDate = (value?: string | Date | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE');
};

const isAllowedProjectDocumentFile = (file: File) => {
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase() || ''}` : '';
  return ['.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt'].includes(extension);
};

const splitProjectStaffNames = (value?: string | null): string[] =>
  (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const hasProjectStaffRole = (
  member: Pick<StaffMember, 'role' | 'roles'> | undefined,
  roles: StaffRole[],
): boolean => {
  if (!member) return false;
  if (Array.isArray(member.roles)) return member.roles.some((role) => roles.includes(role));
  if (typeof member.roles === 'string') return roles.includes(member.roles);
  return typeof member.role === 'string' ? roles.includes(member.role) : false;
};

const normalizeProjectStaffAssignments = (
  project: Partial<Project>,
  staff: StaffMember[] | undefined,
  emptyValue: '' | null,
): Partial<Project> => {
  const hasSourceFields =
    Object.prototype.hasOwnProperty.call(project, 'defaultStaff') ||
    Object.prototype.hasOwnProperty.call(project, 'defaultVolunteers');
  if (!hasSourceFields) return project;

  const employeeNames = new Set<string>();
  const volunteerNames = new Set<string>();
  const staffByName = new Map(
    (staff || []).map((member) => [member.name.trim(), member] as const),
  );

  const assignName = (name: string, fallbackGroup: 'employee' | 'volunteer') => {
    const member = staffByName.get(name);
    if (hasProjectStaffRole(member, ['lead', 'employee'])) {
      employeeNames.add(member?.name || name);
      return;
    }
    if (hasProjectStaffRole(member, ['volunteer', 'helper'])) {
      volunteerNames.add(member?.name || name);
      return;
    }
    if (fallbackGroup === 'employee') employeeNames.add(name);
    else volunteerNames.add(name);
  };

  splitProjectStaffNames(project.defaultStaff).forEach((name) => assignName(name, 'employee'));
  splitProjectStaffNames(project.defaultVolunteers).forEach((name) => assignName(name, 'volunteer'));

  const nextDefaultStaff =
    employeeNames.size > 0 ? Array.from(employeeNames).join(', ') : emptyValue;
  const nextDefaultVolunteers =
    volunteerNames.size > 0 ? Array.from(volunteerNames).join(', ') : emptyValue;

  if (
    project.defaultStaff === nextDefaultStaff &&
    project.defaultVolunteers === nextDefaultVolunteers
  ) {
    return project;
  }

  return {
    ...project,
    defaultStaff: nextDefaultStaff,
    defaultVolunteers: nextDefaultVolunteers,
  };
};

const pickStaffNames = (project: Project): string[] => {
  const names1 = splitProjectStaffNames(project.defaultStaff);
  const names2 = splitProjectStaffNames(project.defaultVolunteers);
  const picked = new Set<string>();
  for (const name of names1) {
    if (picked.size < 2) picked.add(name);
  }
  for (const name of names2) {
    if (picked.size < 2) picked.add(name);
  }
  return Array.from(picked).slice(0, 2);
};

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

function ArchiveRestoreControls({
  id,
  archived,
  archiving,
  deleting,
  onArchivingChange,
  onDeletingChange,
  onDeleted,
  onArchivedToggle,
}: {
  id: string;
  archived: boolean;
  archiving: boolean;
  deleting: boolean;
  onArchivingChange: (v: boolean) => void;
  onDeletingChange: (v: boolean) => void;
  onDeleted?: () => void;
  onArchivedToggle?: () => void;
}) {
  const archive = useDeleteProject();
  const remove = useRemoveProject();
  const [confirm, setConfirm] = useState<{ open: boolean; loading?: boolean; count?: number }>({
    open: false,
  });
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  const toggleArchivedState = useCallback(
    (nextArchived: boolean) => {
      onArchivingChange(true);
      archive.mutate(
        { id, archived: nextArchived },
        {
          onSettled: () => onArchivingChange(false),
          onSuccess: () => {
            if (onArchivedToggle) onArchivedToggle();
          },
        },
      );
    },
    [archive, id, onArchivedToggle, onArchivingChange],
  );

  return (
    <div className="flex gap-2 items-center">
      <span className="tooltip-wrapper">
        <button
          type="button"
          className="inline-flex items-center justify-center p-2 rounded-full border border-gray-300 text-gray-700 disabled:opacity-50 bg-white/80"
          title={archived ? 'Wiederherstellen' : 'Archivieren'}
          aria-label={archived ? 'Wiederherstellen' : 'Archivieren'}
          disabled={archiving || archive.isPending}
          onClick={() => {
            if (archived) {
              toggleArchivedState(false);
              return;
            }
            setArchiveConfirmOpen(true);
          }}
        >
          {archived ? (
            <ArchiveRestoreIcon className="w-5 h-5" />
          ) : (
            <ArchiveIcon className="w-5 h-5" />
          )}
        </button>
        <span className="tooltip-bubble">{archived ? 'Wiederherstellen' : 'Archivieren'}</span>
      </span>
      {archived && (
        <span className="tooltip-wrapper">
          <button
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-full border border-red-300 text-red-700 disabled:opacity-50 bg-white/80"
            title="Löschen"
            aria-label="Löschen"
            disabled={deleting || remove.isPending}
            onClick={async () => {
              // Open modal and fetch affected activities count efficiently via paged endpoint
              setConfirm({ open: true, loading: true });
              try {
                const res = await api.get('/activities', {
                  params: { projectIds: id, page: 1, limit: 1 },
                });
                const total =
                  typeof res?.data?.total === 'number'
                    ? res.data.total
                    : Array.isArray(res?.data)
                      ? res.data.length
                      : 0;
                setConfirm({ open: true, loading: false, count: total });
              } catch {
                setConfirm({ open: true, loading: false, count: undefined });
              }
            }}
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <span className="tooltip-bubble">Löschen</span>
        </span>
      )}
      <ConfirmModal
        open={confirm.open}
        title="Projekt löschen?"
        message={
          <div className="space-y-2">
            <p>
              Wenn Sie ein Projekt löschen, verlieren alle Aktivitäten mit diesem Projekt die
              Zuordnung. Historische Auswertungen nach Projekten ändern sich rückwirkend.
            </p>
            {confirm.loading ? (
              <p className="text-sm text-gray-500">Ermittle betroffene Einträge…</p>
            ) : (
              <p className="text-sm text-gray-700">
                Betroffene Aktivitäten:{' '}
                <strong>{typeof confirm.count === 'number' ? confirm.count : 0}</strong>
              </p>
            )}
            <p className="text-sm text-gray-600">
              Tipp: Wenn das Projekt versehentlich archiviert wurde, können Sie es stattdessen
              wiederherstellen.
            </p>
          </div>
        }
        cancelLabel="Abbrechen"
        secondaryLabel={archived ? 'Wiederherstellen' : undefined}
        onSecondaryConfirm={
          archived
            ? () => {
                onArchivingChange(true);
                archive.mutate(
                  { id, archived: false },
                  {
                    onSettled: () => onArchivingChange(false),
                    onSuccess: () => {
                      if (onArchivedToggle) onArchivedToggle();
                    },
                  },
                );
                setConfirm({ open: false });
              }
            : undefined
        }
        confirmLabel="Endgültig löschen"
        onConfirm={() => {
          setConfirm({ open: false });
          onDeletingChange(true);
          remove.mutate(id, {
            onSettled: () => onDeletingChange(false),
            onSuccess: () => {
              if (onDeleted) onDeleted();
            },
          });
        }}
        onCancel={() => setConfirm({ open: false })}
      />
      <ConfirmModal
        open={archiveConfirmOpen}
        title="Projekt archivieren?"
        message={
          <div className="space-y-2">
            <p>
              Archivierte Projekte erscheinen nicht mehr in der aktiven Projektliste und können
              neuen Aktivitäten nicht mehr zugeordnet werden.
            </p>
            <p>
              Bestehende Aktivitäten, Historien und Auswertungen bleiben erhalten.
            </p>
            <p className="text-sm text-gray-600">
              Das Projekt kann später jederzeit wiederhergestellt werden.
            </p>
          </div>
        }
        cancelLabel="Abbrechen"
        confirmLabel="Archivieren"
        onConfirm={() => {
          setArchiveConfirmOpen(false);
          toggleArchivedState(true);
        }}
        onCancel={() => setArchiveConfirmOpen(false)}
      />
    </div>
  );
}

function ProjectGridCard({
  project,
  category,
  staffNames,
  tagList,
  extraTags,
  starred,
  onOpenActivities,
  onToggleStar,
  onEdit,
}: {
  project: Project;
  category?: ProjectBadgeCategory;
  staffNames: string[];
  tagList: ProjectBadgeTag[];
  extraTags: number;
  starred: boolean;
  onOpenActivities: () => void;
  onToggleStar: () => void;
  onEdit: () => void;
}) {
  const prettyType = PROJECT_TYPE_LABELS[project.type] || project.type;
  const hasLongTitle = project.title.trim().length > 28;

  return (
    <div
      className="relative rounded-2xl shadow group min-h-[160px]"
      style={{ backgroundColor: project.imageUrl ? undefined : project.color || pickBg(project.title) }}
    >
      <div className="absolute inset-0 rounded-2xl overflow-hidden z-0 pointer-events-none">
        {project.imageUrl ? (
          <>
            <ProtectedImage
              src={project.imageUrl}
              alt={project.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/70" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute inset-0 flex items-center justify-center text-white/90 text-3xl font-bold drop-shadow">
              {project.title?.charAt(0)}
            </div>
          </>
        )}
      </div>

      <div className="relative z-10 p-4 flex flex-col gap-2 text-white">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <div
              className={`line-clamp-2 break-words font-semibold leading-tight drop-shadow-sm ${
                hasLongTitle ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'
              }`}
            >
              {project.title}
            </div>
            <div className="text-sm opacity-90">{prettyType}</div>
            {Array.isArray(project.documents) && project.documents.length > 0 && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                <Paperclip className="w-3 h-3" />
                {project.documents.length} Unterlagen
              </div>
            )}
            {(category || staffNames.length > 0) && (
              <div className="mt-1 flex items-center flex-wrap gap-2">
                {category && (
                  <div
                    className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: category.color || '#6b7280',
                      color: textColorFor(category.color || '#6b7280'),
                      border: `1px solid ${category.color || '#6b7280'}`,
                    }}
                  >
                    <Layers className="w-3 h-3" />
                    <span>{category.name}</span>
                  </div>
                )}
                {staffNames.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-2 pl-1 pr-2 py-0.5 rounded-full bg-white/90 text-gray-900 border border-white/40 shadow-sm"
                    title={name}
                    aria-label={`Mitarbeitende:r ${name}`}
                  >
                    <span className="w-4 h-4 rounded-full bg-gray-200 text-[10px] font-semibold flex items-center justify-center">
                      {initialsOf(name)}
                    </span>
                    <span className="text-xs font-medium">{name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="relative z-[2] flex shrink-0 items-start gap-2 text-sm sm:gap-3">
            <span className="tooltip-wrapper">
              <button
                type="button"
                onClick={onOpenActivities}
                className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 p-1.5"
                aria-label={`Aktivitäten für ${project.title} anzeigen`}
              >
                <CalendarRange className="w-4 h-4 text-white" />
              </button>
              <span className="tooltip-bubble">Aktivitäten anzeigen</span>
            </span>
            <span className="tooltip-wrapper">
              <button
                type="button"
                onClick={onToggleStar}
                className={`opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full p-1.5 ${
                  starred ? 'bg-yellow-400/90' : 'bg-white/20 hover:bg-white/30'
                }`}
                aria-label={starred ? 'Highlight entfernen' : 'Projekt highlighten'}
              >
                {starred ? (
                  <Star className="w-4 h-4 text-gray-900" />
                ) : (
                  <StarOff className="w-4 h-4 text-white" />
                )}
              </button>
              <span className="tooltip-bubble">{starred ? 'Unstarren' : 'Highlight'}</span>
            </span>
            <span className="tooltip-wrapper">
              <button
                type="button"
                onClick={onEdit}
                className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 p-1.5"
                aria-label={`Projekt ${project.title} bearbeiten`}
              >
                <Pencil className="w-4 h-4 text-white" />
              </button>
              <span className="tooltip-bubble">Bearbeiten</span>
            </span>
          </div>
        </div>

        {project.description && (
          <div className="text-sm opacity-95">
            {truncateWords(projectDescriptionToPlainText(project.description), 20)}
          </div>
        )}

        {tagList.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {tagList.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: tag.color || '#6b7280',
                  color: textColorFor(tag.color || '#6b7280'),
                  border: `1px solid ${tag.color || '#6b7280'}`,
                }}
                title={tag.name}
              >
                <span>{tag.name}</span>
              </span>
            ))}
            {extraTags > 0 && (
              <span
                className="inline-flex items-center justify-center px-2 h-5 rounded-full text-[10px] font-semibold"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#111111',
                  border: '1px solid #e5e7eb',
                }}
                title={`Weitere Tags: ${tagList
                  .slice(3)
                  .map((tag) => tag.name)
                  .join(', ')}`}
                aria-label={`Weitere Tags: +${extraTags}`}
              >
                +{extraTags}
              </span>
            )}
          </div>
        )}

        {project.archived && (
          <div className="mt-1 text-xs inline-block px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-sm">
            Archiviert
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectListRow({
  project,
  category,
  staffNames,
  tagList,
  extraTags,
  starred,
  onOpenActivities,
  onToggleStar,
  onEdit,
}: {
  project: Project;
  category?: ProjectBadgeCategory;
  staffNames: string[];
  tagList: ProjectBadgeTag[];
  extraTags: number;
  starred: boolean;
  onOpenActivities: () => void;
  onToggleStar: () => void;
  onEdit: () => void;
}) {
  const prettyType = PROJECT_TYPE_LABELS[project.type] || project.type;
  const surfaceColor = project.color || pickBg(project.title);

  return (
    <div className="hidden md:grid md:grid-cols-[176px,minmax(0,1fr)] overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm relative">
      <div
        className="relative min-h-[156px] overflow-hidden rounded-l-2xl"
        style={{ backgroundColor: project.imageUrl ? undefined : surfaceColor }}
      >
        {project.imageUrl ? (
          <ProtectedImage
            src={project.imageUrl}
            alt={project.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: surfaceColor }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-black/0 to-black/40" />
        <div className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm shadow-sm">
          {prettyType}
        </div>
        {project.archived && (
          <div className="absolute left-3 bottom-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-800 shadow-sm">
            Archiviert
          </div>
        )}
      </div>

      <div className="min-w-0 p-4 lg:p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onOpenActivities}
              className="text-left text-lg lg:text-xl font-semibold break-words leading-snug text-[color:var(--text-primary)] hover:text-viridian transition-colors"
              title="Aktivitäten dieses Projekts anzeigen"
              aria-label={`Aktivitäten für ${project.title} anzeigen`}
            >
              {project.title}
            </button>
            {project.targetGroup && (
              <div className="mt-1 text-sm font-medium text-gray-700">
                Zielgruppe: <span className="font-normal text-gray-800">{project.targetGroup}</span>
              </div>
            )}
            {Array.isArray(project.documents) && project.documents.length > 0 && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
                <Paperclip className="w-3.5 h-3.5 text-viridian" />
                {project.documents.length} Unterlagen
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 shrink-0">
            <span className="tooltip-wrapper">
              <button
                type="button"
                onClick={onOpenActivities}
                aria-label={`Aktivitäten für ${project.title} anzeigen`}
                className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white p-2 text-gray-700 transition-colors hover:border-viridian hover:text-viridian"
              >
                <CalendarRange className="w-4 h-4" />
              </button>
              <span className="tooltip-bubble">Aktivitäten anzeigen</span>
            </span>
            <span className="tooltip-wrapper">
              <button
                type="button"
                onClick={onToggleStar}
                aria-label={starred ? 'Highlight entfernen' : 'Projekt highlighten'}
                className={`inline-flex items-center justify-center rounded-full border p-2 transition-colors ${
                  starred
                    ? 'border-yellow-400 bg-yellow-100 text-yellow-800'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-yellow-300 hover:text-yellow-700'
                }`}
              >
                {starred ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
              </button>
              <span className="tooltip-bubble">{starred ? 'Highlight entfernen' : 'Highlight setzen'}</span>
            </span>
            <span className="tooltip-wrapper">
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Projekt ${project.title} bearbeiten`}
                className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white p-2 text-gray-700 transition-colors hover:border-viridian hover:text-viridian"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <span className="tooltip-bubble">Bearbeiten</span>
            </span>
          </div>
        </div>

        {(category || staffNames.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {category && (
              <div
                className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-full shadow-sm"
                style={{
                  backgroundColor: category.color || '#6b7280',
                  color: textColorFor(category.color || '#6b7280'),
                  border: `1px solid ${category.color || '#6b7280'}`,
                }}
              >
                <Layers className="w-3 h-3" />
                <span>{category.name}</span>
              </div>
            )}
            {staffNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-gray-100 text-gray-900 border border-gray-200"
                title={name}
                aria-label={`Mitarbeitende:r ${name}`}
              >
                <span className="w-5 h-5 rounded-full bg-white text-[10px] font-semibold flex items-center justify-center border border-gray-200">
                  {initialsOf(name)}
                </span>
                <span className="text-xs font-medium">{name}</span>
              </span>
            ))}
          </div>
        )}

        {tagList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {tagList.slice(0, 4).map((tag) => (
              <span
                key={tag.id}
                className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-full shadow-sm"
                style={{
                  backgroundColor: tag.color || '#6b7280',
                  color: textColorFor(tag.color || '#6b7280'),
                  border: `1px solid ${tag.color || '#6b7280'}`,
                }}
                title={tag.name}
              >
                <span>{tag.name}</span>
              </span>
            ))}
            {extraTags > 0 && (
              <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                +{extraTags} weitere
              </span>
            )}
          </div>
        )}

        {project.description && (
          <p className="text-sm leading-5 text-gray-700">
            {truncateWords(projectDescriptionToPlainText(project.description), 24)}
          </p>
        )}
      </div>
    </div>
  );
}

function ProjectForm({
  initial,
  onSubmit,
  onCancel,
  saving = false,
}: {
  initial?: Partial<Project>;
  onSubmit: (submission: ProjectFormSubmission) => void | Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}) {
  useBodyScrollLock(true);
  const { user } = useAuth();
  const { showToast } = useToast();
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const submitLockedRef = useRef(false);
  const [form, setForm] = useState<Partial<Project>>(() => {
    const base: Partial<Project> = {
      title: '',
      // Default to a valid enum value in backend (lowercase)
      type: 'project_open',
      ...(initial || {}),
    };
    // Postgres returns bigint columns as strings; coerce for later PATCH validation.
    const anyBase = base as Partial<Project> & { categories?: Array<{ id: string }> };
    const imageSizeRaw: unknown = (base as unknown as { imageSize?: unknown }).imageSize;
    if (typeof imageSizeRaw === 'string' && imageSizeRaw.trim() !== '') {
      const n = Number(imageSizeRaw);
      if (Number.isFinite(n)) base.imageSize = n;
    }
    // Backward compatibility: if legacy data has categories[] but no categoryId, pick the first
    if (!base.categoryId && Array.isArray(anyBase.categories) && anyBase.categories.length) {
      base.categoryId = anyBase.categories[0].id;
    }
    return base;
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const templateRunIdRef = useRef(0);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('');
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageIssue, setImageIssue] = useState<{ open: boolean; title: string; message: string }>(
    { open: false, title: '', message: '' },
  );
  const [documentIssue, setDocumentIssue] = useState<{ open: boolean; title: string; message: string }>(
    { open: false, title: '', message: '' },
  );
  const [documentsExpanded, setDocumentsExpanded] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState<File[]>([]);
  const [removedDocumentIds, setRemovedDocumentIds] = useState<string[]>([]);
  const [showTitleValidation, setShowTitleValidation] = useState(false);
  const [tagCreateOpen, setTagCreateOpen] = useState(false);
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false);
  const [staffCreateState, setStaffCreateState] = useState<{
    open: boolean;
    field: 'defaultStaff' | 'defaultVolunteers';
    role: StaffRole;
  }>({ open: false, field: 'defaultStaff', role: 'employee' });
  const { data: categories } = useCategories({ active: true });
  const { data: allCategories } = useCategories();
  const { data: allTags } = useTags();
  const { data: taxonomyAccess } = useTaxonomyAccess();
  const { data: orgTemplates } = useProjectTemplates();
  const createStaff = useCreateStaff();
  const updateCategory = useUpdateCategory();
  const qc = useQueryClient();
  const { data: tags } = useTags({ active: true });
  const { data: staff } = useStaff({ active: true });
  const existingDocuments = Array.isArray(initial?.documents)
    ? (initial.documents as ProjectDocument[])
    : [];
  const removedDocumentIdSet = new Set(removedDocumentIds);
  const projectFieldClassName = 'project-form-field w-full rounded px-3 py-2';
  const projectSectionClassName = 'rounded-xl border p-4 md:p-5';
  const projectInnerCardClassName = 'rounded-xl border p-4';
  const projectSectionStyle = {
    background: 'var(--project-form-section-bg, color-mix(in srgb, var(--surface-2) 88%, transparent))',
    borderColor: 'var(--border-subtle)',
  } as const;
  const projectInnerCardStyle = {
    background: 'var(--project-form-inner-card-bg, var(--surface-1))',
    borderColor: 'var(--border-subtle)',
  } as const;
  const projectSecondaryButtonClassName = 'inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm';
  const projectAddActionButtonClassName =
    'inline-flex items-center gap-1 text-sm font-medium text-viridian transition-colors hover:text-viridian/80';
  const canCreateOwnTags = Boolean(taxonomyAccess?.tags.canCreateOwn);
  const canCreateOwnCategories = Boolean(taxonomyAccess?.categories.canCreateOwn);
  const canManageStaff = Boolean(user && (user.role === 'superadmin' || user.role === 'org_admin'));

  const uploadImage = useCallback(async (file: File) => {
    try {
      const processed = await processImageForUpload(file);
      const fd = new FormData();
      fd.append('file', processed.file);
      const res = await api.post('/uploads/images', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.url as string;
      const sizeRaw = res.data?.size as unknown;
      const size = typeof sizeRaw === 'number' ? sizeRaw : typeof sizeRaw === 'string' ? Number(sizeRaw) : undefined;
      if (url) setForm((f) => ({ ...f, imageUrl: url, imageSize: Number.isFinite(size as number) ? (size as number) : null }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bild konnte nicht verarbeitet werden.';
      setImageIssue({
        open: true,
        title: 'Bild zu groß oder nicht unterstützt',
        message: `${msg} (Max ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB, wird auf ${600}px Breite reduziert)`,
      });
    }
  }, []);

  const ensureCategoryByName = useCallback(
    async (name: string, overrides?: Record<string, unknown>): Promise<{ id: string } | null> => {
      const def = defaultCategoryByName(name);
      const color = typeof overrides?.color === 'string' ? overrides.color : def?.color;
      return ensureNamedTaxonomyItem({
        items: allCategories,
        name,
        createPath: '/taxonomy/categories',
        listPath: '/taxonomy/categories',
        createPayload: {
          name,
          active: true,
          ...overrides,
          ...(color ? { color } : {}),
        },
        reactivate: async (id) => {
          await updateCategory.mutateAsync({
            id,
            data: { active: true, ...overrides, ...(color ? { color } : {}) },
          });
          await qc.invalidateQueries({ queryKey: ['categories'] });
        },
        refresh: () => qc.invalidateQueries({ queryKey: ['categories'] }),
      });
    },
    [allCategories, qc, updateCategory],
  );

  const ensureTagByName = useCallback(
    async (name: string, overrides?: Record<string, unknown>): Promise<{ id: string } | null> => {
      const color = typeof overrides?.color === 'string' ? overrides.color : undefined;
      return ensureNamedTaxonomyItem({
        items: allTags,
        name,
        createPath: '/taxonomy/tags',
        listPath: '/taxonomy/tags',
        createPayload: {
          name,
          active: true,
          ...overrides,
          ...(color ? { color } : {}),
        },
        reactivate: async (id) => {
          await api.patch(`/taxonomy/tags/${id}`, { active: true, ...overrides, ...(color ? { color } : {}) });
          await qc.invalidateQueries({ queryKey: ['tags'] });
        },
        refresh: () => qc.invalidateQueries({ queryKey: ['tags'] }),
      });
    },
    [allTags, qc],
  );

  const applyTemplate = useCallback(
    async (tpl: ProjectTemplate | ProjectTemplateDto) => {
      // Only for create mode
      if (initial?.id) return;
      const runId = ++templateRunIdRef.current;
      setApplyingTemplate(true);
      const key = 'key' in tpl ? tpl.key : `org:${tpl.id}`;
      setSelectedTemplateKey(key);
      try {
        if ('project' in tpl) {
          // Built-in template
          setForm((f) => ({
            ...f,
            title: tpl.project.title,
            type: tpl.project.type,
            targetGroup: tpl.project.targetGroup || '',
            description: tpl.project.description || '',
          }));

          if (tpl.project.type !== 'open_door' && tpl.project.categoryName) {
            const ensured = await ensureCategoryByName(tpl.project.categoryName);
            if (templateRunIdRef.current === runId && ensured?.id) {
              setForm((f) => ({ ...f, categoryId: ensured.id }));
            }
          }

          // Upload template image into backend so stored URL remains stable across frontend deploys
          try {
            const resp = await fetch(tpl.image.fetchUrl);
            const blob = await resp.blob();
            const file = new File([blob], tpl.image.filename, { type: blob.type || 'image/jpeg' });
            if (templateRunIdRef.current === runId) {
              await uploadImage(file);
            }
          } catch {
            if (templateRunIdRef.current === runId) {
              setForm((f) => ({ ...f, imageUrl: tpl.image.previewUrl }));
            }
          }
        } else {
          // Org/inherited template from backend
          setForm((f) => ({
            ...f,
            title: tpl.title,
            type: tpl.type,
            targetGroup: tpl.targetGroup || '',
            description: tpl.description || '',
            ...(tpl.color ? { color: tpl.color } : {}),
            ...(tpl.imageUrl ? { imageUrl: tpl.imageUrl } : {}),
          }));

          // Ensure category exists (with color if provided)
          if (tpl.type !== 'open_door' && tpl.categoryName) {
            const ensured = await ensureCategoryByName(tpl.categoryName);
            if (templateRunIdRef.current === runId && ensured?.id) {
              setForm((f) => ({ ...f, categoryId: ensured.id }));
            }
          }

          // Parse and ensure tags from template (format: "name:color,name:color")
          if (tpl.tags) {
            const tagPairs = tpl.tags
              .split(',')
              .map((s) => {
                const colonIdx = s.lastIndexOf(':');
                if (colonIdx !== -1) {
                  return {
                    name: s.slice(0, colonIdx).trim(),
                    color: s.slice(colonIdx + 1).trim() || '#7aa39a',
                  };
                }
                return { name: s.trim(), color: '#7aa39a' };
              })
              .filter((t) => t.name);

            // Ensure each tag exists in org (create if missing)
            for (const tag of tagPairs) {
              await ensureTagByName(tag.name, { color: tag.color });
            }

            // Set tags on form
            if (templateRunIdRef.current === runId) {
              setForm((f) => ({ ...f, tag: tagPairs.map((t) => t.name).join(', ') }));
            }
          }
        }
      } finally {
        if (templateRunIdRef.current === runId) setApplyingTemplate(false);
      }
    },
    [ensureCategoryByName, ensureTagByName, initial?.id, uploadImage],
  );

  // Global paste handler to support Ctrl+V for screenshots anywhere while the modal is open
  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      // Prefer items API
      if (items && items.length > 0) {
        for (const item of items) {
          if (item.type && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              await uploadImage(file);
              return;
            }
          }
        }
      }
      // Fallback to files API
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file && file.type.startsWith('image/')) {
          e.preventDefault();
          await uploadImage(file);
          return;
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [uploadImage]);

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        await uploadImage(file);
      }
    },
    [uploadImage],
  );

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await uploadImage(file);
    },
    [uploadImage],
  );

  const addDocuments = useCallback((files: FileList | File[]) => {
    const nextFiles = Array.from(files || []);
    if (!nextFiles.length) return;

    const invalidType = nextFiles.find((file) => !isAllowedProjectDocumentFile(file));
    if (invalidType) {
      setDocumentIssue({
        open: true,
        title: 'Dateityp nicht unterstützt',
        message: 'Erlaubt sind PDF, DOC, DOCX, ODT, RTF und TXT.',
      });
      return;
    }

    const tooLarge = nextFiles.find((file) => file.size > MAX_PROJECT_DOCUMENT_BYTES);
    if (tooLarge) {
      setDocumentIssue({
        open: true,
        title: 'Datei zu groß',
        message: `${tooLarge.name} ist größer als ${Math.round(MAX_PROJECT_DOCUMENT_BYTES / (1024 * 1024))} MB.`,
      });
      return;
    }

    setPendingDocuments((current) => {
      const known = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      const merged = [...current];
      for (const file of nextFiles) {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!known.has(key)) {
          merged.push(file);
          known.add(key);
        }
      }
      return merged;
    });
    setDocumentsExpanded(true);
  }, []);

  const onDocumentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addDocuments(e.target.files);
    e.target.value = '';
  }, [addDocuments]);

  const onDocumentDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files?.length) addDocuments(e.dataTransfer.files);
  }, [addDocuments]);

  const visibleExistingDocuments = existingDocuments.filter(
    (document) => !removedDocumentIdSet.has(document.id),
  );
  const visibleDocumentCount = visibleExistingDocuments.length;
  const pendingDocumentCount = pendingDocuments.length;
  const removedDocumentCount = removedDocumentIds.length;
  const documentSummary = [
    visibleDocumentCount > 0 ? `${visibleDocumentCount} hinterlegt` : null,
    pendingDocumentCount > 0 ? `${pendingDocumentCount} neu` : null,
    removedDocumentCount > 0 ? `${removedDocumentCount} entfernt` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const update = <K extends keyof Project>(k: K, v: Project[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const handleDescriptionChange = useCallback((event: ContentEditableEvent) => {
    update('description', sanitizeProjectDescriptionHtml(event.target.value) as Project['description']);
  }, []);
  const isTitleMissing = String(form.title || '').trim().length === 0;
  const selectedTags = new Set(
    (form.tag || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const mergeNameIntoField = useCallback(
    (field: 'defaultStaff' | 'defaultVolunteers', name: string) => {
      const next = new Set(
        String(form[field] || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      );
      next.add(name);
      update(field, Array.from(next).join(', ') as Project[typeof field]);
    },
    [form],
  );

  const handleClose = useCallback(() => {
    if (imageIssue.open) {
      setImageIssue((state) => ({ ...state, open: false }));
      return;
    }
    if (documentIssue.open) {
      setDocumentIssue((state) => ({ ...state, open: false }));
      return;
    }
    onCancel();
  }, [documentIssue.open, imageIssue.open, onCancel]);

  const handleSave = useCallback(() => {
    if (saving || submitLockedRef.current) return;

    if (isTitleMissing) {
      setShowTitleValidation(true);
      titleInputRef.current?.focus();
      return;
    }

    const allowed: (keyof Project)[] = [
      'title',
      'type',
      'categoryId',
      'targetGroup',
      'imageUrl',
      'imageSize',
      'color',
      'defaultStartTime',
      'defaultEndTime',
      'defaultStaff',
      'defaultVolunteers',
      'tag',
      'activityField',
      'description',
      'archived',
    ];
    const clearable = new Set<keyof Project>([
      'categoryId',
      'targetGroup',
      'imageUrl',
      'imageSize',
      'color',
      'defaultStartTime',
      'defaultEndTime',
      'defaultStaff',
      'defaultVolunteers',
      'tag',
      'activityField',
      'description',
    ]);
    const cleaned = allowed.reduce((acc, k) => {
      const v = form[k as keyof Project] as unknown;
      if (v === '') {
        if (clearable.has(k)) (acc as Record<string, unknown>)[k as string] = null;
      } else if (v !== undefined) {
        if (k === 'imageUrl' && typeof v === 'string') {
          (acc as Record<string, unknown>)[k as string] = normalizeUploadPath(v) ?? null;
        } else if (k === 'description' && typeof v === 'string') {
          const descriptionHtml = normalizeProjectDescriptionHtml(v);
          (acc as Record<string, unknown>)[k as string] = projectDescriptionToPlainText(descriptionHtml)
            ? descriptionHtml
            : null;
        } else if (k === 'imageSize' && typeof v === 'string' && v.trim() !== '') {
          const n = Number(v);
          if (Number.isFinite(n)) (acc as Record<string, unknown>)[k as string] = n;
        } else {
          (acc as Record<string, unknown>)[k as string] = v as unknown;
        }
      }
      return acc;
    }, {} as Partial<Project>);
    const normalized = normalizeProjectStaffAssignments(cleaned, staff, null);
    const imgSize = (cleaned as Partial<Project> & { imageSize?: unknown }).imageSize;
    const bytes =
      typeof imgSize === 'number'
        ? imgSize
        : typeof imgSize === 'string'
          ? Number(imgSize)
          : undefined;
    if (typeof bytes === 'number' && Number.isFinite(bytes) && bytes > MAX_IMAGE_BYTES) {
      setImageIssue({
        open: true,
        title: 'Bild zu groß',
        message: `Das Projektbild ist größer als ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB. Bitte ein kleineres Bild hochladen (wird automatisch auf 600px reduziert).`,
      });
      return;
    }

    submitLockedRef.current = true;
    void onSubmit({
      values: normalized,
      pendingDocuments,
      removedDocumentIds,
    });
  }, [form, isTitleMissing, onSubmit, pendingDocuments, removedDocumentIds, saving, staff]);

  useEffect(() => {
    if (!staff?.length) return;
    setForm((current) => normalizeProjectStaffAssignments(current, staff, ''));
  }, [staff]);

  useEffect(() => {
    if (!saving) submitLockedRef.current = false;
  }, [saving]);

  useEditorShortcuts({
    onClose: handleClose,
    onSave:
      applyingTemplate || archiving || deleting || imageIssue.open || documentIssue.open || saving ? undefined : handleSave,
  });

  const renderDocumentManager = () => (
    <div
      className={`rounded-xl border ${documentsExpanded ? 'p-4' : 'px-3 py-2'}`}
      style={{
        background: 'color-mix(in srgb, var(--surface-2) 86%, transparent)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className={`flex justify-between gap-3 ${documentsExpanded ? 'items-start' : 'items-center'}`}>
        <button
          type="button"
          onClick={() => setDocumentsExpanded((current) => !current)}
          className={`min-w-0 flex flex-1 text-left ${documentsExpanded ? 'items-start gap-3' : 'items-center gap-2'}`}
          aria-expanded={documentsExpanded}
          aria-label={documentsExpanded ? 'Unterlagen einklappen' : 'Unterlagen ausklappen'}
        >
          <span
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${documentsExpanded ? 'mt-0.5' : ''}`}
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'color-mix(in srgb, var(--interactive-soft) 54%, var(--surface-1))',
              color: 'var(--viridian)',
            }}
          >
            {documentsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              <Paperclip className="w-4 h-4" style={{ color: 'var(--viridian)' }} />
              Konzeption / Unterlagen
            </span>
            {documentsExpanded && (
              <span className="mt-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
                {documentSummary || 'Noch keine Unterlagen hinterlegt.'}
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setDocumentsExpanded(true);
            documentInputRef.current?.click();
          }}
          className="shrink-0 rounded border px-3 py-1.5 text-sm"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          Dateien wählen…
        </button>
        <input
          ref={documentInputRef}
          type="file"
          accept={PROJECT_DOCUMENT_ACCEPT}
          multiple
          className="hidden"
          onChange={onDocumentChange}
        />
      </div>

      {documentsExpanded && (
        <div className="mt-3 space-y-3">
          <div
            className="rounded-xl border border-dashed p-4"
            style={{
              background: 'var(--surface-1)',
              borderColor: 'var(--border-subtle)',
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={onDocumentDrop}
          >
            <div className="flex items-start gap-3">
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--interactive-soft) 54%, var(--surface-1))',
                  color: 'var(--viridian)',
                }}
              >
                <Paperclip className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Unterlagen hier ablegen oder direkt ausw e4hlen
                  </div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    PDF, DOC, DOCX, ODT, RTF oder TXT. Max. {Math.round(MAX_PROJECT_DOCUMENT_BYTES / (1024 * 1024))} MB pro Datei.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => documentInputRef.current?.click()}
                  className={projectSecondaryButtonClassName}
                  style={{
                    background: 'var(--surface-1)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Paperclip className="h-4 w-4" />
                  Dateien ausw e4hlen
                </button>
              </div>
            </div>
          </div>

          {visibleExistingDocuments.length === 0 && pendingDocuments.length === 0 ? (
            <div
              className="rounded-lg border border-dashed px-3 py-4 text-sm"
              style={{
                background: 'var(--surface-1)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              Noch keine Unterlagen hinterlegt.
              {!initial?.id ? ' Ausgewählte Dateien werden nach dem ersten Speichern hochgeladen.' : ''}
            </div>
          ) : null}

          {existingDocuments.length > 0 && (
            <div className="space-y-2">
              {existingDocuments.map((document) => {
                const markedForRemoval = removedDocumentIdSet.has(document.id);
                return (
                  <div
                    key={document.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                    style={
                      markedForRemoval
                        ? {
                            borderColor: 'color-mix(in srgb, var(--accent-pink) 42%, var(--border-subtle))',
                            background: 'color-mix(in srgb, var(--accent-pink) 10%, var(--surface-1))',
                            color: 'color-mix(in srgb, var(--accent-pink) 82%, var(--text-primary))',
                          }
                        : {
                            borderColor: 'var(--border-subtle)',
                            background: 'var(--surface-1)',
                            color: 'var(--text-primary)',
                          }
                    }
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <FileText className="w-4 h-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{document.filename}</div>
                        <div
                          className="text-xs"
                          style={{ color: markedForRemoval ? 'inherit' : 'var(--text-muted)' }}
                        >
                          {formatDocumentSize(document.size)}
                          {formatDocumentDate(document.createdAt) ? ` · ${formatDocumentDate(document.createdAt)}` : ''}
                          {markedForRemoval ? ' · Wird beim Speichern entfernt' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!markedForRemoval && (
                        <button
                          type="button"
                          onClick={() => void downloadProjectDocument(initial?.id as string, document)}
                          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                          style={{
                            borderColor: 'var(--border-subtle)',
                            background: 'var(--surface-1)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setRemovedDocumentIds((current) =>
                            current.includes(document.id)
                              ? current.filter((id) => id !== document.id)
                              : [...current, document.id],
                          )
                        }
                        className="inline-flex items-center rounded border px-2 py-1 text-xs"
                        style={
                          markedForRemoval
                            ? {
                                background: 'var(--surface-1)',
                                borderColor: 'color-mix(in srgb, var(--accent-pink) 42%, var(--border-subtle))',
                                color: 'color-mix(in srgb, var(--accent-pink) 82%, var(--text-primary))',
                              }
                            : {
                                background: 'color-mix(in srgb, var(--accent-pink) 10%, var(--surface-1))',
                                borderColor: 'color-mix(in srgb, var(--accent-pink) 32%, var(--border-subtle))',
                                color: 'color-mix(in srgb, var(--accent-pink) 82%, var(--text-primary))',
                              }
                        }
                      >
                        {markedForRemoval ? 'Behalten' : 'Entfernen'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pendingDocuments.length > 0 && (
            <div className="space-y-2">
              {pendingDocuments.map((document, index) => (
                <div
                  key={`${document.name}:${document.size}:${document.lastModified}`}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--accent-orange) 32%, var(--border-subtle))',
                    background: 'color-mix(in srgb, var(--accent-orange) 10%, var(--surface-1))',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <FileText className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{document.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatDocumentSize(document.size)} · Wird beim Speichern hochgeladen
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingDocuments((current) => current.filter((_, currentIndex) => currentIndex !== index))
                    }
                    className="inline-flex items-center rounded border px-2 py-1 text-xs"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--accent-orange) 32%, var(--border-subtle))',
                      background: 'var(--surface-1)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderTagSelector = () => (
    <div>
      <label className="block text-sm font-medium mb-1">Tags (mehrfach)</label>
      <div className="flex flex-wrap gap-2">
        {(tags || []).map((t) => {
          const active = selectedTags.has(t.name);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                const next = new Set(selectedTags);
                if (active) next.delete(t.name);
                else next.add(t.name);
                update('tag', Array.from(next).join(', '));
              }}
              className="px-2 py-1 rounded-full text-xs border"
              style={getSelectableTaxonomyChipStyle(active, t.color)}
              aria-pressed={active}
            >
              {t.name}
            </button>
          );
        })}
      </div>
      {canCreateOwnTags ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setTagCreateOpen(true)}
            className={projectAddActionButtonClassName}
          >
            <Plus className="h-4 w-4" />
            Hinzufügen
          </button>
        </div>
      ) : null}
    </div>
  );

  const renderCategorySelector = () => (
    <div>
      <label className="block text-sm font-medium mb-1">Kategorie</label>
      <div className="flex flex-wrap gap-2">
        {(categories || []).map((c) => {
          const active = String(form.categoryId || '') === c.id;
          const color = c.color || '#7aa39a';
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => update('categoryId', active ? null : c.id)}
              className="px-2 py-1 rounded-full text-xs border"
              style={getSelectableTaxonomyChipStyle(active, color)}
              title={c.name}
              aria-pressed={active}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      {canCreateOwnCategories ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setCategoryCreateOpen(true)}
            className={projectAddActionButtonClassName}
          >
            <Plus className="h-4 w-4" />
            Hinzufügen
          </button>
        </div>
      ) : null}
    </div>
  );

  const renderImageManager = () => (
    <div>
      <label className="block text-sm font-medium mb-1">Bild</label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
      {form.imageUrl ? (
        <div className="space-y-2">
          <ProtectedImage
            src={form.imageUrl}
            alt="Projektbild"
            className="w-full h-40 object-cover rounded border"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, imageUrl: '', imageSize: null }))}
              className="px-3 py-1 rounded bg-gray-200 text-gray-700"
            >
              Entfernen
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 rounded bg-viridian text-white"
            >
              Ersetzen...
            </button>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl border-2 border-dashed p-4 text-sm"
          style={{
            background: 'color-mix(in srgb, var(--surface-2) 78%, var(--surface-3))',
            borderColor: 'var(--border-strong)',
            color: 'var(--text-secondary)',
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--interactive-soft) 54%, var(--surface-1))',
                color: 'var(--viridian)',
              }}
            >
              <ImagePlus className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                Bild hierher ziehen, klicken oder per Strg+V einfuegen
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`${projectSecondaryButtonClassName} project-form-field`}
                >
                  <ImagePlus className="h-4 w-4" />
                  Datei waehlen
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            Unterstuetzt JPG/PNG/WEBP. Wird auf max. 600px Breite reduziert. Max. 3MB.
          </div>
        </div>
      )}
    </div>
  );

  const renderSectionHeader = (title: string) => (
    <div className="mb-4">
      <h4 className="text-sm font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--viridian)' }}>
        {title}
      </h4>
    </div>
  );

  const renderStaffSelectorCard = ({
    label,
    field,
    roles,
    emptyLabel,
    createRole,
  }: {
    label: string;
    field: 'defaultStaff' | 'defaultVolunteers';
    roles: StaffRole[];
    emptyLabel: string;
    createRole: StaffRole;
  }) => {
    const selectedNames = new Set(
      String(form[field] || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    const availablePeople = (staff || []).filter((person) =>
      Array.isArray(person.roles)
        ? person.roles.some((role) => roles.includes(role))
        : person.role
          ? roles.includes(person.role)
          : false,
    );

    return (
      <div className={projectInnerCardClassName} style={projectInnerCardStyle}>
        <div className="mb-3">
          <label className="text-sm font-medium">{label}</label>
        </div>
        {availablePeople.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {availablePeople.map((person) => {
              const active = selectedNames.has(person.name);
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => {
                    const next = new Set(selectedNames);
                    if (active) next.delete(person.name);
                    else next.add(person.name);
                    update(field, Array.from(next).join(', ') as Project[typeof field]);
                  }}
                  className="px-2 py-1 rounded-full text-xs border"
                  style={getSelectableTaxonomyChipStyle(active, '#7aa39a')}
                  aria-pressed={active}
                >
                  {person.name}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {emptyLabel}
          </div>
        )}
        {canManageStaff ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                setStaffCreateState({ open: true, field, role: createRole });
              }}
              className={projectAddActionButtonClassName}
            >
              <Plus className="h-4 w-4" />
              Hinzufügen
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-end md:items-center justify-center p-0 md:p-6">
      <div
        className="modal-panel-roomy bg-white w-full md:max-w-4xl lg:max-w-5xl rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 bottom-sheet-animate flex flex-col overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="shrink-0 flex items-start justify-between gap-3 mb-4">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-viridian">
              {initial?.id ? 'Projekt bearbeiten' : 'Neues Projekt'}
            </h3>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                background: initial?.archived
                  ? 'color-mix(in srgb, var(--accent-pink) 14%, var(--surface-1))'
                  : 'color-mix(in srgb, var(--interactive-soft) 54%, var(--surface-1))',
                color: initial?.archived
                  ? 'color-mix(in srgb, var(--accent-pink) 80%, var(--text-primary))'
                  : 'var(--viridian)',
              }}
            >
              Status: {initial?.archived ? 'Archiviert' : 'Aktiv'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="hidden md:inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
            title="Schließen"
            aria-label="Schließen"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4 md:pb-6">

        {!initial?.id && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowTemplates((s) => !s)}
              className="flex items-center gap-2 text-sm font-medium text-viridian hover:underline"
            >
              <Layers className="w-4 h-4" />
              {showTemplates ? 'Vorlagen ausblenden' : 'Vorlage auswählen'}
              <span className="text-xs text-gray-500">
                {selectedTemplateKey ? '(Vorlage ausgewählt)' : ''}
              </span>
            </button>
            {showTemplates && (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-xs text-gray-600">
                    Wähle eine Vorlage, um Felder vorzubelegen.
                  </div>
                  {applyingTemplate && (
                    <div className="text-xs text-gray-500">Übernehme Vorlage…</div>
                  )}
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplateKey('');
                      // Reset form to initial empty values
                      setForm({
                        title: '',
                        type: 'project_open',
                        targetGroup: '',
                        description: '',
                        imageUrl: '',
                        categoryId: null,
                        tag: '',
                        color: '#7aa39a',
                      });
                    }}
                    className={`min-w-[160px] h-[96px] rounded-xl border overflow-hidden flex items-center justify-center text-sm px-3 ${
                      selectedTemplateKey === '' ? 'border-viridian ring-2 ring-viridian/30' : 'border-gray-200'
                    }`}
                    disabled={applyingTemplate}
                    title="Ohne Vorlage"
                  >
                    Ohne Vorlage
                  </button>
                  {PROJECT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => void applyTemplate(tpl)}
                      className={`min-w-[160px] h-[96px] rounded-xl border overflow-hidden relative ${
                        selectedTemplateKey === tpl.key ? 'border-viridian ring-2 ring-viridian/30' : 'border-gray-200'
                      }`}
                      disabled={applyingTemplate}
                      title={tpl.label}
                >
                  <img
                    src={tpl.image.previewUrl}
                    alt={tpl.label}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/10" />
                  <div className="absolute bottom-2 left-2 right-2 text-left">
                    <div className="text-white text-sm font-semibold drop-shadow">{tpl.label}</div>
                    <div className="text-white/90 text-[11px] leading-tight drop-shadow">
                      {tpl.description}
                    </div>
                  </div>
                </button>
              ))}

              {(orgTemplates || [])
                .filter((t) => !t.archived)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void applyTemplate(t)}
                    className={`min-w-[160px] h-[96px] rounded-xl border overflow-hidden relative ${
                      selectedTemplateKey === `org:${t.id}`
                        ? 'border-viridian ring-2 ring-viridian/30'
                        : 'border-gray-200'
                    }`}
                    disabled={applyingTemplate}
                    title={t.title}
                  >
                    {t.imageUrl ? (
                      <ProtectedImage
                        src={t.imageUrl}
                        alt={t.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 w-full h-full bg-gray-100" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/10" />
                    <div className="absolute bottom-2 left-2 right-2 text-left">
                      <div className="text-white text-sm font-semibold drop-shadow truncate">
                        {t.title}
                      </div>
                      <div className="text-white/90 text-[11px] leading-tight drop-shadow line-clamp-2">
                        {t.categoryName ? `Kategorie: ${t.categoryName}` : 'Vorlage'}
                        {t.org?.name ? ` · ${t.org.name}` : ''}
                      </div>
                    </div>
                  </button>
                ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr),minmax(280px,0.75fr)] gap-5 items-start">
            <section className={projectSectionClassName} style={projectSectionStyle}>
              {renderSectionHeader('Basisinformationen')}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Titel *</label>
                    <input
                      ref={titleInputRef}
                      value={form.title || ''}
                      onChange={(e) => {
                        update('title', e.target.value);
                        if (showTitleValidation && e.target.value.trim()) setShowTitleValidation(false);
                      }}
                      onBlur={() => {
                        if (String(form.title || '').trim().length === 0) setShowTitleValidation(true);
                      }}
                      required
                      className={`${projectFieldClassName} ${
                        showTitleValidation && isTitleMissing ? 'project-form-field-invalid' : ''
                      }`}
                    />
                    {showTitleValidation && isTitleMissing ? (
                      <p className="mt-1 text-xs text-red-600">Bitte einen Projekttitel eingeben.</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Typ *</label>
                    <select
                      value={form.type || 'project_open'}
                      onChange={(e) => {
                        const val = e.target.value as Project['type'];
                        setForm((f) => ({
                          ...f,
                          type: val,
                          ...(val === 'open_door' ? { categoryId: null } : {}),
                        }));
                      }}
                      required
                      className={projectFieldClassName}
                    >
                      <option value="open_door">Offene Tür</option>
                      <option value="project_open">Projekt (offen)</option>
                      <option value="project_closed">Projekt (geschlossen)</option>
                      <option value="event">Veranstaltung</option>
                      <option value="outreach">Aufsuchend</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Zielgruppe</label>
                  <input
                    value={form.targetGroup || ''}
                    onChange={(e) => update('targetGroup', e.target.value)}
                    className={projectFieldClassName}
                  />
                </div>
                {form.type !== 'open_door' ? renderCategorySelector() : null}
                {renderTagSelector()}
              </div>
            </section>

            <section className={projectSectionClassName} style={projectSectionStyle}>
              {renderSectionHeader('Zeit')}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Startzeit</label>
                  <input
                    type="time"
                    value={form.defaultStartTime || ''}
                    onChange={(e) => update('defaultStartTime', e.target.value)}
                    className={projectFieldClassName}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Endzeit</label>
                  <input
                    type="time"
                    value={form.defaultEndTime || ''}
                    onChange={(e) => update('defaultEndTime', e.target.value)}
                    className={projectFieldClassName}
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <section className={projectSectionClassName} style={projectSectionStyle}>
              {renderSectionHeader('Bild & Farbe')}
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr),20rem] gap-4 items-start">
                {renderImageManager()}
                <div className={projectInnerCardClassName} style={projectInnerCardStyle}>
                  <label className="block text-sm font-medium mb-2" htmlFor="project-color">Farbe</label>
                  <ColorPicker
                    id="project-color"
                    value={(form.color as string) || '#7aa39a'}
                    onChange={(color) => update('color', color)}
                  />
                </div>
              </div>
            </section>

            <section className={projectSectionClassName} style={projectSectionStyle}>
              {renderSectionHeader('Team & Rollen')}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {renderStaffSelectorCard({
                  label: 'Mitarbeitende',
                  field: 'defaultStaff',
                  roles: ['lead', 'employee'],
                  emptyLabel: 'Keine Mitarbeitenden verfügbar.',
                  createRole: 'employee',
                })}
                {renderStaffSelectorCard({
                  label: 'Ehrenamtliche & Helfer',
                  field: 'defaultVolunteers',
                  roles: ['volunteer', 'helper'],
                  emptyLabel: 'Keine Ehrenamtlichen oder Helfer verfügbar.',
                  createRole: 'volunteer',
                })}
              </div>
            </section>
          </div>

          <section className={projectSectionClassName} style={projectSectionStyle}>
            {renderSectionHeader('Dokumente')}
            {renderDocumentManager()}
          </section>

          <section className={projectSectionClassName} style={projectSectionStyle}>
            {renderSectionHeader('Beschreibung')}
            <div>
              <label className="block text-sm font-medium mb-1">Beschreibung</label>
              <RichTextEditor
                value={normalizeProjectDescriptionHtml(form.description)}
                onChange={handleDescriptionChange}
                placeholder="Beschreibung eingeben..."
                containerProps={{ className: 'project-rich-text-editor' }}
              >
                <Toolbar>
                  <BtnUndo title="Rückgängig" />
                  <BtnRedo title="Wiederholen" />
                  <Separator />
                  <BtnStyles title="Format" />
                  <Separator />
                  <BtnBold title="Fett" />
                  <BtnItalic title="Kursiv" />
                  <Separator />
                  <BtnBulletList title="Liste" />
                  <BtnNumberedList title="Nummerierte Liste" />
                  <Separator />
                  <BtnClearFormatting title="Formatierung entfernen" />
                </Toolbar>
              </RichTextEditor>
            </div>
          </section>
        </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 px-4 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <span className="tooltip-wrapper">
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex md:hidden items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
                title="Abbrechen"
                aria-label="Abbrechen"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <span className="tooltip-bubble">Abbrechen</span>
            </span>
            {initial?.id && (
              <ArchiveRestoreControls
                id={initial.id as string}
                archived={Boolean(initial.archived)}
                archiving={archiving}
                deleting={deleting}
                onArchivingChange={setArchiving}
                onDeletingChange={setDeleting}
                onDeleted={onCancel}
                onArchivedToggle={onCancel}
              />
            )}
            <span className="tooltip-wrapper">
              <button
                type="button"
                onClick={handleSave}
                disabled={isTitleMissing || saving || applyingTemplate || archiving || deleting}
                className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white disabled:cursor-not-allowed disabled:opacity-50"
                title="Speichern"
                aria-label="Speichern"
              >
                <SaveIcon className="w-5 h-5" />
              </button>
              <span className="tooltip-bubble">Speichern</span>
            </span>
          </div>
        </div>
      </div>

      {tagCreateOpen ? (
        <TagFormModal
          initial={{ color: TAG_PALETTE[0] }}
          onCancel={() => setTagCreateOpen(false)}
          onSubmit={async (values) => {
            const name = String(values.name || '').trim();
            if (!name) return;
            const existing = findNamedTaxonomyItem(allTags, name);
            try {
              await ensureTagByName(name, {
                description: values.description,
                color: values.color || TAG_PALETTE[0],
              });
              const next = new Set(selectedTags);
              next.add(name);
              update('tag', Array.from(next).join(', '));
              showToast(
                existing?.id ? `Tag "${name}" wurde zugeordnet.` : `Tag "${name}" hinzugefügt.`,
                existing?.id ? { type: 'info' } : undefined,
              );
              setTagCreateOpen(false);
            } catch {
              showToast('Tag konnte nicht angelegt werden.', { type: 'error' });
            }
          }}
        />
      ) : null}

      {categoryCreateOpen ? (
        <CategoryFormModal
          initial={{ color: FIXED_PALETTE[0] }}
          onCancel={() => setCategoryCreateOpen(false)}
          onSubmit={async (values) => {
            const name = String(values.name || '').trim();
            if (!name) return;
            const existing = findNamedTaxonomyItem(allCategories, name);
            try {
              const ensured = await ensureCategoryByName(name, {
                description: values.description,
                standardRef: values.standardRef,
                color: values.color || FIXED_PALETTE[0],
              });
              if (!ensured?.id) throw new Error('missing-category-id');
              update('categoryId', ensured.id);
              showToast(
                existing?.id
                  ? `Kategorie "${name}" wurde zugeordnet.`
                  : `Kategorie "${name}" hinzugefügt.`,
                existing?.id ? { type: 'info' } : undefined,
              );
              setCategoryCreateOpen(false);
            } catch {
              showToast('Kategorie konnte nicht angelegt werden.', { type: 'error' });
            }
          }}
        />
      ) : null}

      {staffCreateState.open ? (
        <StaffFormModal
          initial={{ roles: [staffCreateState.role] }}
          onCancel={() => setStaffCreateState((current) => ({ ...current, open: false }))}
          onSubmit={async (values) => {
            const name = String(values.name || '').trim();
            if (!name) return;
            const existing = (staff || []).find(
              (person) => person.name.trim().toLowerCase() === name.toLowerCase(),
            );
            if (existing) {
              mergeNameIntoField(staffCreateState.field, existing.name);
              showToast(`Teammitglied "${existing.name}" wurde zugeordnet.`, { type: 'info' });
              setStaffCreateState((current) => ({ ...current, open: false }));
              return;
            }

            try {
              const created = await createStaff.mutateAsync({
                ...values,
                roles:
                  Array.isArray(values.roles) && values.roles.length > 0
                    ? values.roles
                    : [staffCreateState.role],
              });
              mergeNameIntoField(staffCreateState.field, created.name);
              showToast(`Teammitglied "${created.name}" hinzugefügt.`);
              setStaffCreateState((current) => ({ ...current, open: false }));
            } catch {
              showToast('Teammitglied konnte nicht angelegt werden.', { type: 'error' });
            }
          }}
        />
      ) : null}

      <Modal
        open={imageIssue.open}
        onClose={() => setImageIssue((s) => ({ ...s, open: false }))}
        title={imageIssue.title}
        maxWidth="sm"
      >
        <div className="text-sm text-gray-700 space-y-4">
          <div>{imageIssue.message}</div>
          <div className="flex justify-end">
            <button
              type="button"
              className="px-3 py-2 rounded bg-viridian text-white"
              onClick={() => setImageIssue((s) => ({ ...s, open: false }))}
            >
              Ok
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={documentIssue.open}
        onClose={() => setDocumentIssue((s) => ({ ...s, open: false }))}
        title={documentIssue.title}
        maxWidth="sm"
      >
        <div className="text-sm text-gray-700 space-y-4">
          <div>{documentIssue.message}</div>
          <div className="flex justify-end">
            <button
              type="button"
              className="px-3 py-2 rounded bg-viridian text-white"
              onClick={() => setDocumentIssue((s) => ({ ...s, open: false }))}
            >
              Ok
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function toProjectUpsertPayload(values: Partial<Project> | undefined): Partial<Project> {
  const v = (values || {}) as Record<string, unknown>;
  const allowed = [
    'title',
    'type',
    'categoryId',
    'categoryIds',
    'targetGroup',
    'imageUrl',
    'imageSize',
    'color',
    'defaultStartTime',
    'defaultEndTime',
    'defaultStaff',
    'defaultVolunteers',
    'tag',
    'activityField',
    'description',
    'archived',
  ] as const;

  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(v, key)) continue;
    const val = v[key];
    if (key === 'imageUrl') {
      out[key] = typeof val === 'string' ? normalizeUploadPath(val) ?? '' : val;
      continue;
    }
    if (key === 'imageSize') {
      if (typeof val === 'number' && Number.isFinite(val)) out[key] = val;
      else if (typeof val === 'string' && val.trim() !== '') {
        const n = Number(val);
        if (Number.isFinite(n)) out[key] = n;
      } else if (val === null) {
        out[key] = null;
      }
      continue;
    }
    out[key] = val;
  }
  return out as Partial<Project>;
}

export default function Projects() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  // Debounce the search to prevent firing a request for every keystroke on first usage
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);
  const [showArchived, setShowArchived] = useState(false);
  const [desktopView, setDesktopView] = useState<ProjectsDesktopView>(() => {
    try {
      return localStorage.getItem(PROJECTS_DESKTOP_VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_DESKTOP_VIEW_STORAGE_KEY, desktopView);
    } catch {
      /* ignore */
    }
  }, [desktopView]);
  const [modal, setModal] = useState<{
    mode: 'create' | 'edit';
    project?: Project;
    requestId?: string;
  } | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const { showToast } = useToast();
  const [starredFirst, setStarredFirst] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PROJECTS_STARRED_FIRST_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  // Archivierte Projekte nur anzeigen, wenn Checkbox aktiv ist.
  // Wenn nicht aktiv, filtern wir auf archived=false. Wenn aktiv, keinen Filter (zeigt alle an).
  const { data, isLoading } = useProjects({
    search: debounced,
    archived: showArchived ? undefined : false,
  });
  // Fetch archived count to decide whether to show/enable the toggle
  const { data: archivedOnly } = useProjects({ search: debounced, archived: true });
  const archivedCount = (archivedOnly || []).length;
  const create = useCreateProject();
  const update = useUpdateProject();

  const projects = data || [];
  const isDesktopListView = desktopView === 'list';
  const [starred, setStarred] = useState<string[]>(() => getStarredProjectIds());
  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_STARRED_FIRST_STORAGE_KEY, starredFirst ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [starredFirst]);
  const { data: categoriesList } = useCategories({ active: true });
  const { data: tagsList } = useTags({ active: true });
  const categoryMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color?: string | null }>();
    (categoriesList || []).forEach((c) => m.set(c.id, { id: c.id, name: c.name, color: c.color }));
    return m;
  }, [categoriesList]);
  const tagMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color?: string | null }>();
    (tagsList || []).forEach((t) => m.set(t.name, { id: t.id, name: t.name, color: t.color }));
    return m;
  }, [tagsList]);
  const sortedProjects = useMemo(() => {
    if (!starredFirst || projects.length < 2 || starred.length === 0) return projects;
    const starredIds = new Set(starred);
    return [...projects].sort((left, right) => {
      const leftStarred = starredIds.has(left.id);
      const rightStarred = starredIds.has(right.id);
      if (leftStarred === rightStarred) return 0;
      return leftStarred ? -1 : 1;
    });
  }, [projects, starred, starredFirst]);

  const openProjectActivities = useCallback(
    (projectId: string) => {
      navigate(`/activities?projectId=${encodeURIComponent(projectId)}`);
    },
    [navigate],
  );

  const syncProjectDocuments = useCallback(
    async (projectId: string, submission: Pick<ProjectFormSubmission, 'pendingDocuments' | 'removedDocumentIds'>) => {
      const removedResults = await Promise.allSettled(
        submission.removedDocumentIds.map((documentId) => removeProjectDocument(projectId, documentId)),
      );
      const uploadResults = await Promise.allSettled(
        submission.pendingDocuments.map((file) => uploadProjectDocument(projectId, file)),
      );

      await qc.invalidateQueries({ queryKey: ['projects'] });

      const removedSuccess = removedResults.filter((result) => result.status === 'fulfilled').length;
      const removedFailed = removedResults.length - removedSuccess;
      const uploadedSuccess = uploadResults.filter((result) => result.status === 'fulfilled').length;
      const uploadedFailed = uploadResults.length - uploadedSuccess;

      return { removedSuccess, removedFailed, uploadedSuccess, uploadedFailed };
    },
    [qc],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6 mt-1">
        <h2 className="text-3xl font-bold text-viridian">Angebote & Projekte</h2>
        <button
          onClick={() => setModal({ mode: 'create', requestId: createClientRequestId() })}
          className="bg-viridian text-white px-4 py-2 rounded hover:bg-cambridge-blue"
        >
          Neues Projekt
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 md:w-80 md:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen…"
              className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-10"
            />
            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Suche löschen"
                title="Suche löschen"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setStarredFirst((current) => !current)}
            aria-pressed={starredFirst}
            aria-label={starredFirst ? 'Highlights zuerst deaktivieren' : 'Highlights zuerst aktivieren'}
            title={starredFirst ? 'Highlights zuerst deaktivieren' : 'Highlights zuerst aktivieren'}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
              starredFirst
                ? 'border-yellow-300 bg-yellow-100 text-yellow-700 shadow-sm'
                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            {starredFirst ? <Star className="h-4 w-4" /> : <StarOff className="h-4 w-4" />}
          </button>
          {archivedCount > 0 && (
            <Toggle
              checked={showArchived}
              onChange={setShowArchived}
              label={
                <span>
                  Archiv <span className="text-xs text-gray-500">({archivedCount})</span>
                </span>
              }
            />
          )}
        </div>

        <div className="hidden md:flex items-center gap-3 self-start md:self-auto">
          <span className="text-sm font-medium text-gray-700">Ansicht</span>
          <div className="inline-flex items-center rounded-xl border border-gray-300 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setDesktopView('grid')}
              aria-pressed={desktopView === 'grid'}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                desktopView === 'grid'
                  ? 'bg-viridian text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Karten
            </button>
            <button
              type="button"
              onClick={() => setDesktopView('list')}
              aria-pressed={desktopView === 'list'}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                desktopView === 'list'
                  ? 'bg-viridian text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <List className="w-4 h-4" />
              Liste
            </button>
          </div>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="text-gray-500">Lade…</div>
      ) : (
        <div
          className={`grid gap-4 grid-cols-1 sm:grid-cols-2 ${
            isDesktopListView ? 'md:grid-cols-1' : 'lg:grid-cols-3'
          }`}
        >
          {sortedProjects.map((p) => {
            let cat = p.categoryId ? categoryMap.get(p.categoryId) : undefined;
            if (!cat && Array.isArray(p.categories) && p.categories.length) {
              const first = p.categories[0];
              cat = categoryMap.get(first.id);
            }
            const staffNames = pickStaffNames(p);
            const tagList = (p.tag || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((name) => tagMap.get(name))
              .filter(Boolean) as ProjectBadgeTag[];
            const extraTags = Math.max(0, tagList.length - 3);
            const starredNow = starred.includes(p.id);
            if (isDesktopListView) {
              return (
                <Fragment key={p.id}>
                  <div className="md:hidden">
                    <ProjectGridCard
                      project={p}
                      category={cat}
                      staffNames={staffNames}
                      tagList={tagList}
                      extraTags={extraTags}
                      starred={starredNow}
                      onOpenActivities={() => openProjectActivities(p.id)}
                      onToggleStar={() => setStarred(toggleStarredProject(p.id))}
                      onEdit={() => setModal({ mode: 'edit', project: p })}
                    />
                  </div>
                  <ProjectListRow
                    project={p}
                    category={cat}
                    staffNames={staffNames}
                    tagList={tagList}
                    extraTags={Math.max(0, tagList.length - 4)}
                    starred={starredNow}
                    onOpenActivities={() => openProjectActivities(p.id)}
                    onToggleStar={() => setStarred(toggleStarredProject(p.id))}
                    onEdit={() => setModal({ mode: 'edit', project: p })}
                  />
                </Fragment>
              );
            }

            return (
              <ProjectGridCard
                key={p.id}
                project={p}
                category={cat}
                staffNames={staffNames}
                tagList={tagList}
                extraTags={extraTags}
                starred={starredNow}
                onOpenActivities={() => openProjectActivities(p.id)}
                onToggleStar={() => setStarred(toggleStarredProject(p.id))}
                onEdit={() => setModal({ mode: 'edit', project: p })}
              />
            );
          })}
          {sortedProjects.length === 0 && <div className="text-gray-500">Keine Projekte gefunden.</div>}
        </div>
      )}

      {modal && (
        <ProjectForm
          initial={modal.mode === 'edit' ? modal.project : undefined}
          saving={modalBusy || create.isPending || update.isPending}
          onSubmit={async (submission) => {
            setModalBusy(true);
            try {
              let savedProject: Project | null = null;

              if (modal.mode === 'create') {
                savedProject = await create.mutateAsync({
                  ...toProjectUpsertPayload(submission.values),
                  clientRequestId: modal.requestId || createClientRequestId(),
                });
              } else if (modal.project?.id) {
                savedProject = await update.mutateAsync({
                  id: modal.project.id,
                  data: toProjectUpsertPayload(submission.values),
                });
              }

              if (!savedProject?.id) {
                throw new Error('Projekt konnte nicht gespeichert werden.');
              }

              const documentResult = await syncProjectDocuments(savedProject.id, submission);
              setModal(null);

              if (documentResult.removedFailed || documentResult.uploadedFailed) {
                showToast(
                  `${modal.mode === 'create' ? 'Projekt erstellt' : 'Projekt aktualisiert'}. ${documentResult.uploadedSuccess} Dateien hochgeladen, ${documentResult.removedSuccess} entfernt. Einige Dokumentaktionen sind fehlgeschlagen.`,
                  { type: 'error', durationMs: 5500 },
                );
              } else if (documentResult.uploadedSuccess || documentResult.removedSuccess) {
                showToast(
                  `${modal.mode === 'create' ? 'Projekt erstellt' : 'Projekt aktualisiert'}. ${documentResult.uploadedSuccess} Dateien hochgeladen, ${documentResult.removedSuccess} entfernt.`,
                  { type: 'success' },
                );
              } else {
                showToast(modal.mode === 'create' ? 'Projekt erstellt' : 'Projekt aktualisiert');
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Projekt konnte nicht gespeichert werden.';
              showToast(message, { type: 'error', durationMs: 5000 });
            } finally {
              setModalBusy(false);
            }
          }}
          onCancel={() => {
            if (!modalBusy) setModal(null);
          }}
        />
      )}
    </div>
  );
}
