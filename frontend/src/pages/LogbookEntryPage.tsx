import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Circle,
  Edit3,

  MessageCircle,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useActivity } from '@/lib/activities';
import {
  type LogbookEntryInput,
  type LogbookEntryStatus,
  type LogbookEntryType,
  useArchiveLogbookEntry,
  useCreateLogbookComment,
  useCreateLogbookEntry,
  useLogbookEntry,
  useRemoveLogbookComment,
  useRestoreLogbookEntry,
  useSetLogbookStatus,
  useUpdateLogbookEntry,
} from '@/lib/logbook';
import { useProjects } from '@/lib/projects';
import { logbookStatusLabels, logbookTypeLabels } from '@/lib/logbookLabels';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { Menu, MenuItem } from '@/components/ui/Menu';
import ProjectPickerModal from './ProjectPickerModal';
import ProtectedImage from '@/components/ProtectedImage';
import LogbookDetailContent from '@/components/LogbookDetailContent';
import LogbookEntryFlyout from '@/components/LogbookEntryFlyout';
import ActivityPickerModal from '@/components/LogbookActivityPicker';

import { getWeekdayLabel } from './activityEditorShared';
import { colorFromStringHash } from '@/lib/colors';
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';
import { EditorActions } from '@/components/ui/EditorFrame';
import { Button, IconButton } from '@/components/ui/Button';
import { useUnsavedChangesGuard } from '@/lib/useUnsavedChangesGuard';
import { useEditorShortcuts } from '@/lib/useEditorShortcuts';
import { useTranslation } from 'react-i18next';
import {
  isValidLogbookDateTime,
  toLogbookDateTimeInput,
} from '@/lib/logbookDate';

type FormState = {
  occurredAt: string;
  type: LogbookEntryType;
  title: string;
  body: string;
  highlights: string;
  challenges: string;
  nextSteps: string;
  status: LogbookEntryStatus;
  visibility: 'team' | 'admins';
  activityId: string;
  projectId: string;
};

function toInputDate(value?: string | null) {
  return toLogbookDateTimeInput(value);
}

function emptyForm(search: URLSearchParams): FormState {
  return {
    occurredAt: toInputDate(),
    type: 'observation',
    title: '',
    body: '',
    highlights: '',
    challenges: '',
    nextSteps: '',
    status: 'open',
    visibility: 'team',
    activityId: search.get('activityId') || '',
    projectId: search.get('projectId') || '',
  };
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(getCurrentIntlLocale(), {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data
    ?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : fallback;
}

function LogbookStatusIcon({ status }: { status: LogbookEntryStatus }) {
  if (status === 'discussed') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'follow_up') return <AlertTriangle className="h-4 w-4" />;
  return <Circle className="h-4 w-4" />;
}

function UserAvatar({
  name,
  avatarUrl,
  className = 'h-8 w-8',
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-viridian/10 font-semibold text-viridian ${className}`}
    >
      {avatarUrl ? (
        <ProtectedImage src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export type LogbookEntryPageProps = {
  entryId?: string;
  returnTo?: string;
  onClose?: () => void;
};

export default function LogbookEntryPage(props: unknown = {}) {
  const { id: routeEntryId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { entryId, returnTo, onClose } = (props ?? {}) as LogbookEntryPageProps;
  const id = entryId ?? routeEntryId;
  if (id) return <LogbookEntryFlyout key={id} entryId={id}
    startEditing={!!entryId || location.pathname.endsWith('/edit')}
    onClose={() => {
      if (onClose) onClose();
      else navigate(returnTo ?? ((location.state as { returnTo?: string } | null)?.returnTo === '/dashboard' ? '/dashboard' : '/logbook'), { replace: true });
    }} />;
  return <LogbookEntryForm {...((props ?? {}) as LogbookEntryPageProps)} />;
}

function LogbookEntryForm(props: LogbookEntryPageProps = {}) {
  const { t } = useTranslation('logbook');
  const {
    entryId: embeddedEntryId,
    returnTo: embeddedReturnTo,
    onClose: embeddedOnClose,
  } = (props ?? {}) as LogbookEntryPageProps;
  const { id: routeEntryId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const id = embeddedEntryId ?? routeEntryId;
  const isNew = !id;
  const returnTo = embeddedReturnTo ??
    ((location.state as { returnTo?: unknown } | null)?.returnTo === '/dashboard'
      ? '/dashboard'
      : '/logbook');
  const [editing, setEditing] = useState(
    isNew || !!embeddedEntryId || location.pathname.endsWith('/edit'),
  );
  const [form, setForm] = useState<FormState>(() => emptyForm(search));
  const { discardDialog, requestDiscard, reset } = useUnsavedChangesGuard(form, { enabled: editing });
  const [comment, setComment] = useState('');
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const { data: entry, isLoading } = useLogbookEntry(id);
  const create = useCreateLogbookEntry();
  const update = useUpdateLogbookEntry();
  const archive = useArchiveLogbookEntry();
  const restore = useRestoreLogbookEntry();
  const setStatus = useSetLogbookStatus();
  const createComment = useCreateLogbookComment();
  const removeComment = useRemoveLogbookComment();
  const { data: projects = [] } = useProjects({ archived: false });
  const { data: selectedActivityFromApi } = useActivity(form.activityId || entry?.activityId || undefined);
  const selectedProject = projects.find((project) => project.id === form.projectId);
  const selectedActivity = selectedActivityFromApi ||
    (entry?.activityId === form.activityId ? entry.activity : undefined);
  const occurredAtWeekday = useMemo(() => getWeekdayLabel(form.occurredAt), [form.occurredAt]);
  const occurredAtIsValid = isValidLogbookDateTime(form.occurredAt);

  useEffect(() => {
    if (!entry) return;
    const nextForm = {
      occurredAt: toInputDate(entry.occurredAt),
      type: entry.type,
      title: entry.title,
      body: entry.body,
      highlights: entry.highlights || '',
      challenges: entry.challenges || '',
      nextSteps: entry.nextSteps || '',
      status: entry.status,
      visibility: entry.visibility,
      activityId: entry.activityId || '',
      projectId: entry.projectId || '',
    };
    setForm(nextForm);
    reset(nextForm);
  }, [entry, reset]);

  useEffect(() => {
    if (!isNew) setEditing(!!embeddedEntryId || location.pathname.endsWith('/edit'));
  }, [embeddedEntryId, isNew, location.pathname]);

  const closeEditor = (destination?: string) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (embeddedOnClose) {
      embeddedOnClose();
      return;
    }
    navigate(destination ?? returnTo);
  };
  const closeEditing = () =>
    requestDiscard(() => closeEditor(
      isNew || returnTo === '/dashboard'
        ? returnTo
        : `/logbook?entry=${encodeURIComponent(id || '')}`,
    ));

  useEditorShortcuts({
    enabled: editing,
    onClose: closeEditing,
  });

  const canManage =
    !!entry &&
    !!user && user.id === entry.createdByUserId;
  const isAdmin = user?.role === 'superadmin' || user?.role === 'org_admin';
  const formPayload = useMemo<LogbookEntryInput>(
    () => {
      const occurredAt = new Date(form.occurredAt);
      return {
      occurredAt: Number.isNaN(occurredAt.getTime()) ? '' : occurredAt.toISOString(),
      type: form.type,
      title: form.title,
      body: form.body,
      highlights: form.highlights || null,
      challenges: form.challenges || null,
      nextSteps: form.nextSteps || null,
      status: form.status,
      ...(isAdmin ? { visibility: form.visibility } : {}),
      activityId: form.activityId || null,
      projectId: form.projectId || null,
      };
    },
    [form, isAdmin],
  );

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!isNew && !canManage) return;
    if (!occurredAtIsValid) {
      showToast(t('invalidDate'), { type: 'error' });
      return;
    }
    try {
      if (isNew) {
        const created = await create.mutateAsync(formPayload);
        showToast(autoT('ui_bfeed61d0034'), { type: 'success' });
        reset(form);
        if (embeddedOnClose) {
          embeddedOnClose();
        } else {
          navigate(
            returnTo === '/dashboard'
              ? returnTo
              : `/logbook?entry=${encodeURIComponent(created.id)}`,
            { replace: true },
          );
        }
      } else if (id) {
        await update.mutateAsync({ id, data: formPayload });
        showToast(autoT('ui_e1bd2c4575ee'), { type: 'success' });
        reset(form);
        if (embeddedOnClose) {
          embeddedOnClose();
        } else {
          navigate(
            returnTo === '/dashboard'
              ? returnTo
              : `/logbook?entry=${encodeURIComponent(id)}`,
            { replace: true },
          );
        }
      }
    } catch (error: unknown) {
      showToast(getErrorMessage(error, autoT('ui_81128854f3b0')), {
        type: 'error',
      });
    }
  };

  const addComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !comment.trim()) return;
    try {
      await createComment.mutateAsync({ entryId: id, body: comment });
      setComment('');
    } catch (error: unknown) {
      showToast(getErrorMessage(error, autoT('ui_4ce1ddf633ea')), {
        type: 'error',
      });
    }
  };

  if (!isNew && isLoading)
    return <div className="p-6 text-sm text-gray-500">{autoT('ui_a7151ad4e39f')}</div>;
  if (!isNew && !entry)
    return (
      <div className="modern-card p-6 text-sm text-gray-600">{autoT('ui_118fdc8c2826')}</div>
    );

  if (editing && (isNew || canManage))
    return (
      <>
        <Modal
          open
          onClose={closeEditing}
          title={isNew ? autoT('ui_feb9aab49734') : autoT('ui_0b00abd52aba')}
          maxWidth="4xl"
          variant="form"
          headerActions={
            <div className="relative">
              <button
                type="button"
                onClick={() => setStatusMenuOpen((value) => !value)}
                className={`status-control logbook-status-pill logbook-status-pill--${form.status}`}
              >
                <LogbookStatusIcon status={form.status} />
                <span className="hidden md:inline">{logbookStatusLabels[form.status]}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${statusMenuOpen ? "rotate-180" : ''}`} />
              </button>
              {statusMenuOpen && (
                <Menu className="absolute right-0 top-full z-10 mt-2 min-w-48">
                  <div className="status-menu-label px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em]">{autoT('ui_95706e6c2697')}</div>
                  {(['open', 'discussed', 'follow_up'] as const).map((status) => (
                    <MenuItem
                      key={status}
                      onClick={() => {
                        setForm({ ...form, status });
                        setStatusMenuOpen(false);
                      }}
                      className={form.status === status ? "bg-[var(--interactive-soft)] text-viridian" : ''}
                    >
                      <LogbookStatusIcon status={status} />
                      {logbookStatusLabels[status]}
                      {form.status === status && <CheckCircle2 className="ml-auto h-4 w-4" />}
                    </MenuItem>
                  ))}
                </Menu>
              )}
            </div>
          }
        >
          <form
            onSubmit={save}
            className="modal-editor-body min-h-0 flex-1 overflow-y-auto md:flex md:flex-col md:overflow-hidden"
          >
            <div className="space-y-4 p-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">{autoT('ui_e2f9e932be0a')}{occurredAtWeekday && (
                    <span className="ml-2 font-normal text-gray-500">· {occurredAtWeekday}</span>
                  )}
                  <input
                    required
                    type="datetime-local"
                    min="1000-01-01T00:00"
                    max="9999-12-31T23:59"
                    value={form.occurredAt}
                    onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
                    aria-invalid={!occurredAtIsValid}
                    aria-describedby={!occurredAtIsValid ? 'logbook-occurred-at-error' : undefined}
                    className="editor-field mt-1 w-full border border-gray-200 bg-white px-3 py-2.5"
                  />
                  {!occurredAtIsValid ? (
                    <span id="logbook-occurred-at-error" className="mt-1 block text-xs text-red-700">
                      {t('invalidDate')}
                    </span>
                  ) : null}
                </label>
                <label className="text-sm font-medium text-gray-700">{autoT('ui_f4b0e988965d')}<select
                    value={form.type}
                    onChange={(event) =>
                      setForm({ ...form, type: event.target.value as LogbookEntryType })
                    }
                    className="editor-field mt-1 w-full border border-gray-200 bg-white px-3 py-2.5"
                  >
                    {Object.entries(logbookTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-medium text-gray-700">{autoT('ui_950701e758d1')}<input
                  required
                  maxLength={180}
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder={autoT('ui_b1654f25a69e')}
                  className="editor-field mt-1 w-full border px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">{autoT('ui_b3c8defcacc0')}<textarea
                  required
                  rows={5}
                  maxLength={12000}
                  value={form.body}
                  onChange={(event) => setForm({ ...form, body: event.target.value })}
                  placeholder={autoT('ui_c64d2713db08')}
                  className="editor-field mt-1 w-full resize-y border px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
                />
              </label>
              <details
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 shadow-[var(--card-shadow)]"
                open={!!(form.highlights || form.challenges || form.nextSteps)}
              >
                <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">{autoT('ui_f009ede6baa6')}</summary>
                <div className="mt-4 space-y-4">
                  <label className="block text-sm font-medium text-[var(--text-primary)]">{autoT('ui_ed124d299865')}<textarea
                      rows={3}
                      value={form.highlights}
                      onChange={(event) => setForm({ ...form, highlights: event.target.value })}
                      className="editor-field mt-1 w-full border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-viridian focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    />
                  </label>
                  <label className="block text-sm font-medium text-[var(--text-primary)]">{autoT('ui_24cb5c6fa8e6')}<textarea
                      rows={3}
                      value={form.challenges}
                      onChange={(event) => setForm({ ...form, challenges: event.target.value })}
                      className="editor-field mt-1 w-full border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-viridian focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    />
                  </label>
                  <label className="block text-sm font-medium text-[var(--text-primary)]">{autoT('ui_76231e1d047c')}<textarea
                      rows={3}
                      value={form.nextSteps}
                      onChange={(event) => setForm({ ...form, nextSteps: event.target.value })}
                      className="editor-field mt-1 w-full border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-viridian focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    />
                  </label>
                </div>
              </details>
              <div className={`grid grid-cols-1 gap-4 ${isAdmin ? 'lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <div className="text-sm font-medium text-gray-700">{autoT('ui_20bda6d2e725')}<div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setProjectPickerOpen(true)}
                      className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 text-left hover:border-viridian"
                    >
                      <Plus className="h-5 w-5 shrink-0 text-viridian" />
                      {selectedProject ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-8 w-8 overflow-hidden rounded-lg"
                            style={{ backgroundColor: selectedProject.color || colorFromStringHash(selectedProject.title) }}
                          >
                            {selectedProject.imageUrl && (
                              <ProtectedImage
                                src={selectedProject.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            )}
                          </span>
                          <span className="truncate">{selectedProject.title}</span>
                        </span>
                      ) : (
                        <span className="text-gray-500">{autoT('ui_9302645ead5f')}</span>
                      )}
                    </button>
                    {form.projectId && (
                      <IconButton
                        type="button"
                        onClick={() => setForm({ ...form, projectId: '' })}
                        size="icon-touch"
                        variant="danger-ghost"
                        aria-label={autoT('ui_0fb18f089b5a')}
                      >
                        <X />
                      </IconButton>
                    )}
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-700">{autoT('ui_1c4aaccf808e')}<div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActivityPickerOpen(true)}
                      className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 text-left hover:border-viridian"
                    >
                      <Plus className="h-5 w-5 shrink-0 text-viridian" />
                      {selectedActivity ? (
                        <span className="min-w-0">
                          <span className="block truncate">
                            {selectedActivity.title ||
                              selectedActivity.project?.title ||
                              autoT('ui_1c4aaccf808e')}
                          </span>
                          <span className="block text-xs font-normal text-gray-500">
                            {selectedActivity.date}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-500">{autoT('ui_ab6635285bc7')}</span>
                      )}
                    </button>
                    {form.activityId && (
                      <IconButton
                        type="button"
                        onClick={() => setForm({ ...form, activityId: '' })}
                        size="icon-touch"
                        variant="danger-ghost"
                        aria-label={autoT('ui_5740ee577fe9')}
                      >
                        <X />
                      </IconButton>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <label className="text-sm font-medium text-gray-700">{autoT('ui_0218eb5cd0e8')}<select
                      value={form.visibility}
                      onChange={(event) =>
                        setForm({ ...form, visibility: event.target.value as 'team' | 'admins' })
                      }
                      className="editor-field mt-1 w-full border border-gray-200 bg-white px-3 py-2.5"
                    >
                      <option value="team">{autoT('ui_adc88eec60e4')}</option>
                      <option value="admins">{autoT('ui_db8e800f08e5')}</option>
                    </select>
                  </label>
                )}
              </div>
            </div>
            <EditorActions
              className="shrink-0"
              secondary={<Button variant="secondary" size="lg" onClick={closeEditing}>{autoT('ui_07af7cb30fca')}</Button>}
              primary={(
                <Button type="submit" size="lg" disabled={create.isPending || update.isPending}>
                  <Save className="h-4 w-4" />
                  {create.isPending || update.isPending ? autoT('ui_129ed064a520') : autoT('ui_70b73bbc118d')}
                </Button>
              )}
            />
          </form>
        </Modal>
        {projectPickerOpen && (
          <ProjectPickerModal
            onClose={() => setProjectPickerOpen(false)}
            onPick={(project) => {
              setForm({ ...form, projectId: project.id });
              setProjectPickerOpen(false);
            }}
          />
        )}
        <ActivityPickerModal
          open={activityPickerOpen}
          onClose={() => setActivityPickerOpen(false)}
          onPick={(activityId) => setForm({ ...form, activityId })}
          occurredAt={form.occurredAt}
        />
        {discardDialog}
      </>
    );

  if (!entry) return null;
  const archived = entry.status === 'archived';
  return (
    <div className="logbook-detail-page mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/logbook')}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-gray-700 hover:bg-white/70"
        >
          <ArrowLeft className="h-5 w-5" />{autoT('ui_f95da57ad34c')}</button>
        {canManage && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/logbook/${id}/edit`)}
              disabled={archived}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 disabled:opacity-40"
            >
              <Edit3 className="h-4 w-4" />
              <span className="hidden sm:inline">{autoT('ui_104f3bfdc340')}</span>
            </button>
            {archived ? (
              <Button
                variant="secondary"
                disabled={restore.isPending}
                onClick={async () => {
                  await restore.mutateAsync(id!);
                  showToast(t('restored'), { type: 'success' });
                }}
              >
                <ArchiveRestore className="h-4 w-4" />
                <span className="hidden sm:inline">{t('restore')}</span>
              </Button>
            ) : (
              <Button
                variant="warning"
                disabled={archive.isPending}
                onClick={async () => {
                  if (!window.confirm(autoT('ui_14cdcb1a47ae'))) return;
                  await archive.mutateAsync(id!);
                  showToast(autoT('ui_e041a9132c74'), { type: 'success' });
                  navigate('/logbook');
                }}
              >
                <Archive className="h-4 w-4" />
                <span className="hidden sm:inline">{autoT('ui_b81f3298d960')}</span>
              </Button>
            )}
          </div>
        )}
      </div>
      <article className="logbook-detail-page-main min-w-0">
        <div className="space-y-6 p-3 sm:p-6">
          <LogbookDetailContent entry={entry} />
          {canManage && !archived && (
            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-5">
              {entry.status !== 'discussed' && (
                <button
                  onClick={() => setStatus.mutate({ id: entry.id, status: 'discussed' })}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white"
                >
                  <CheckCircle2 className="h-4 w-4" />{autoT('ui_b2eeedb93d1d')}</button>
              )}
              {entry.status === 'discussed' && (
                <button
                  onClick={() => setStatus.mutate({ id: entry.id, status: 'open' })}
                  className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
                >{autoT('ui_6dd9529dd376')}</button>
              )}
              {entry.status !== 'follow_up' && (
                <button
                  onClick={() => setStatus.mutate({ id: entry.id, status: 'follow_up' })}
                  className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800"
                >{autoT('ui_45329e1b2ada')}</button>
              )}
            </div>
          )}
        </div>
      </article>
      <section className="logbook-detail-page-comments modern-card mt-5 p-5 sm:p-7">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-800">
          <MessageCircle className="h-5 w-5 text-viridian" />{autoT('ui_b9677171d9f7')}{entry.comments?.length || 0})
        </h2>
        <div className="logbook-comment-list">
          {entry.comments?.length ? (
            entry.comments.map((item) => (
              <div key={item.id} className={`logbook-comment ${item.createdByUserId === user?.id ? 'logbook-comment--own' : 'logbook-comment--other'}`}>
                <div className="logbook-comment-meta">
                  <span className="flex items-center gap-2 font-semibold text-gray-700">
                    <UserAvatar
                      name={item.createdByName}
                      avatarUrl={
                        item.createdByUser?.avatarUrl ??
                        (item.createdByUserId === user?.id ? user?.avatarUrl : null)
                      }
                      className="h-7 w-7"
                    />
                    {item.createdByName}
                  </span>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-800">{item.body}</p>
                {(!!user && user.id === item.createdByUserId) && (
                  <button
                    type="button"
                    onClick={() => removeComment.mutate({ entryId: entry.id, commentId: item.id })}
                    className="logbook-comment-delete inline-flex items-center gap-1 text-xs font-medium text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />{autoT('ui_8bb9a7f4f1ff')}</button>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">{autoT('ui_7c5c406d9f7e')}</p>
          )}
        </div>
        {!archived && (
          <form onSubmit={addComment} className="mt-5 border-t border-gray-100 pt-5">
            <label className="block text-sm font-medium text-gray-700">{autoT('ui_dad674bd7da1')}<textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                maxLength={4000}
                placeholder={autoT('ui_6119b63de1a4')}
                className="editor-field mt-1 w-full resize-y border border-gray-200 bg-white px-3 py-2.5"
              />
            </label>
            <div className="mt-2 flex justify-end">
              <button
                disabled={!comment.trim() || createComment.isPending}
                className="dashboard-accent-solid-button inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
              >
                <Send className="h-4 w-4" />{autoT('ui_86b530d1039e')}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
