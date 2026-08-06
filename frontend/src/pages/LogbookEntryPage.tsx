import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Circle,
  Edit3,
  LockKeyhole,
  MessageCircle,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useActivities } from '@/lib/activities';
import {
  type LogbookEntryInput,
  type LogbookEntryStatus,
  type LogbookEntryType,
  useArchiveLogbookEntry,
  useCreateLogbookComment,
  useCreateLogbookEntry,
  useLogbookEntry,
  useRemoveLogbookComment,
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
import LogbookConnections from '@/components/LogbookConnections';
import { getWeekdayLabel } from './activityEditorShared';
import { colorFromStringHash } from '@/lib/colors';
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';
import { EditorActions } from '@/components/ui/EditorFrame';
import { Button } from '@/components/ui/Button';

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
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
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
  return new Date(value).toLocaleString(getCurrentIntlLocale(), {
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

function ActivityPickerModal({
  open,
  onClose,
  onPick,
  occurredAt,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  occurredAt: string;
}) {
  const [search, setSearch] = useState('');
  const range = useMemo(() => {
    const base = occurredAt ? new Date(occurredAt) : new Date();
    const before = new Date(base);
    before.setDate(before.getDate() - 14);
    const after = new Date(base);
    after.setDate(after.getDate() + 14);
    return { from: before.toISOString().slice(0, 10), to: after.toISOString().slice(0, 10) };
  }, [occurredAt]);
  const { data: activities = [] } = useActivities({ ...range, order: 'desc' });
  const visible = activities.filter((activity) =>
    `${activity.title || ''} ${activity.project?.title || ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <Modal open={open} onClose={onClose} title={autoT('ui_ab6635285bc7')} maxWidth="2xl" variant="form">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 md:px-6 md:pb-6">
        <p className="mb-3 shrink-0 text-sm text-gray-600">{autoT('ui_3c4b1175587b')}</p>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={autoT('ui_cdcd2f758fec')}
          className="mb-3 w-full shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
        />
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {visible.map((activity) => {
          const project = activity.project;
          const projectColor = project
            ? project.color || colorFromStringHash(project.title)
            : undefined;

          return (
            <button
              key={activity.id}
              type="button"
              onClick={() => {
                onPick(activity.id);
                onClose();
              }}
              className="relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-xl border border-gray-100 bg-white p-3 text-left transition hover:border-viridian hover:bg-viridian/5"
            >
              {project?.imageUrl ? (
                <>
                  <ProtectedImage
                    src={project.imageUrl}
                    alt=""
                    aria-hidden
                    className="absolute inset-y-0 right-0 h-full w-1/3 object-cover opacity-85 sm:w-1/4"
                  />
                  <div
                    className="activity-image-fade-mobile absolute inset-y-0 right-0 w-1/3 sm:w-1/4"
                    aria-hidden
                  />
                </>
              ) : projectColor ? (
                <>
                  <div
                    className="absolute inset-y-0 right-0 w-1/3 opacity-80 sm:w-1/4"
                    style={{
                      background: `linear-gradient(135deg, ${projectColor} 0%, color-mix(in srgb, ${projectColor} 68%, white) 100%)`,
                    }}
                    aria-hidden
                  />
                  <div
                    className="activity-image-fade-mobile absolute inset-y-0 right-0 w-1/3 sm:w-1/4"
                    aria-hidden
                  />
                </>
              ) : null}
              <span className="relative z-10 min-w-0">
                <span className="block font-semibold text-gray-800">
                  {activity.title || project?.title || autoT('ui_1c4aaccf808e')}
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  {new Date(`${activity.date}T12:00:00`).toLocaleDateString(getCurrentIntlLocale())} ·{' '}
                  {project?.title || autoT('ui_5b4a4a84148c')}
                </span>
              </span>
              <span className="relative z-10 shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-600">
                {activity.countTotal || 0}{autoT('ui_f79fa2d4a0a2')}</span>
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">{autoT('ui_dfc3488ab197')}</p>
        )}
        </div>
      </div>
    </Modal>
  );
}

export type LogbookEntryPageProps = {
  entryId?: string;
  returnTo?: string;
  onClose?: () => void;
};

export default function LogbookEntryPage(props: unknown = {}) {
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
  const [comment, setComment] = useState('');
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const { data: entry, isLoading } = useLogbookEntry(id);
  const create = useCreateLogbookEntry();
  const update = useUpdateLogbookEntry();
  const archive = useArchiveLogbookEntry();
  const setStatus = useSetLogbookStatus();
  const createComment = useCreateLogbookComment();
  const removeComment = useRemoveLogbookComment();
  const { data: projects = [] } = useProjects({ archived: false });
  const now = new Date();
  const from = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: activities = [] } = useActivities({ from, to, order: 'desc' });
  const selectedProject = projects.find((project) => project.id === form.projectId);
  const selectedActivity =
    activities.find((activity) => activity.id === form.activityId) ||
    (entry?.activityId === form.activityId ? entry.activity : undefined);
  const occurredAtWeekday = useMemo(() => getWeekdayLabel(form.occurredAt), [form.occurredAt]);

  useEffect(() => {
    if (!entry) return;
    setForm({
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
    });
  }, [entry]);

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
    closeEditor(
      isNew || returnTo === '/dashboard'
        ? returnTo
        : `/logbook?entry=${encodeURIComponent(id || '')}`,
    );

  const canManage =
    !!entry &&
    (user?.role === 'superadmin' ||
      user?.role === 'org_admin' ||
      user?.id === entry.createdByUserId);
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
    try {
      if (isNew) {
        const created = await create.mutateAsync(formPayload);
        showToast(autoT('ui_bfeed61d0034'), { type: 'success' });
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

  if (editing)
    return (
      <>
        <Modal
          open
          onClose={closeEditing}
          title={isNew ? autoT('ui_feb9aab49734') : autoT('ui_0b00abd52aba')}
          maxWidth="5xl"
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
            className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-elevated)]"
          >
            <div className="space-y-4 p-4 md:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">{autoT('ui_e2f9e932be0a')}{occurredAtWeekday && (
                    <span className="ml-2 font-normal text-gray-500">{occurredAtWeekday}</span>
                  )}
                  <input
                    required
                    type="datetime-local"
                    value={form.occurredAt}
                    onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">{autoT('ui_f4b0e988965d')}<select
                    value={form.type}
                    onChange={(event) =>
                      setForm({ ...form, type: event.target.value as LogbookEntryType })
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"
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
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">{autoT('ui_b3c8defcacc0')}<textarea
                  required
                  rows={5}
                  maxLength={12000}
                  value={form.body}
                  onChange={(event) => setForm({ ...form, body: event.target.value })}
                  placeholder={autoT('ui_c64d2713db08')}
                  className="mt-1 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5"
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
                      className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-viridian focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    />
                  </label>
                  <label className="block text-sm font-medium text-[var(--text-primary)]">{autoT('ui_24cb5c6fa8e6')}<textarea
                      rows={3}
                      value={form.challenges}
                      onChange={(event) => setForm({ ...form, challenges: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-viridian focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    />
                  </label>
                  <label className="block text-sm font-medium text-[var(--text-primary)]">{autoT('ui_76231e1d047c')}<textarea
                      rows={3}
                      value={form.nextSteps}
                      onChange={(event) => setForm({ ...form, nextSteps: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-viridian focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    />
                  </label>
                </div>
              </details>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                            className="h-8 w-8 overflow-hidden rounded-lg bg-gray-100"
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
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, projectId: '' })}
                        className="inline-flex min-h-12 w-12 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-red-600"
                        aria-label={autoT('ui_0fb18f089b5a')}
                      >
                        <X className="h-4 w-4" />
                      </button>
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
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, activityId: '' })}
                        className="inline-flex min-h-12 w-12 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-red-600"
                        aria-label={autoT('ui_5740ee577fe9')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="hidden sm:block" />
                {isAdmin && (
                  <label className="text-sm font-medium text-gray-700">{autoT('ui_0218eb5cd0e8')}<select
                      value={form.visibility}
                      onChange={(event) =>
                        setForm({ ...form, visibility: event.target.value as 'team' | 'admins' })
                      }
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"
                    >
                      <option value="team">{autoT('ui_adc88eec60e4')}</option>
                      <option value="admins">{autoT('ui_db8e800f08e5')}</option>
                    </select>
                  </label>
                )}
              </div>
            </div>
            <EditorActions
              secondary={<Button variant="ghost" size="lg" onClick={closeEditing}>{autoT('ui_07af7cb30fca')}</Button>}
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
      </>
    );

  if (!entry) return null;
  const archived = entry.status === 'archived';
  return (
    <div className="mx-auto max-w-4xl">
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
            <button
              type="button"
              disabled={archived || archive.isPending}
              onClick={async () => {
                if (!window.confirm(autoT('ui_14cdcb1a47ae'))) return;
                await archive.mutateAsync(id!);
                showToast(autoT('ui_e041a9132c74'), { type: 'success' });
                navigate('/logbook');
              }}
              className="logbook-archive-button inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-40"
            >
              <Archive className="h-4 w-4" />
              <span className="hidden sm:inline">{autoT('ui_b81f3298d960')}</span>
            </button>
          </div>
        )}
      </div>
      <article className="modern-card overflow-hidden">
        <div className="border-b border-gray-100 p-5 sm:p-7">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-700">
              {logbookTypeLabels[entry.type]}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 font-semibold ${entry.status === 'discussed' ? "bg-green-100 text-green-700" : entry.status === 'follow_up' ? "bg-amber-100 text-amber-800" : entry.status === 'archived' ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"}`}
            >
              {logbookStatusLabels[entry.status]}
            </span>
            {entry.visibility === 'admins' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-700">
                <LockKeyhole className="h-3 w-3" />{autoT('ui_db8e800f08e5')}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">{entry.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <UserAvatar
                name={entry.createdByName}
                avatarUrl={
                  entry.createdByUser?.avatarUrl ??
                  (entry.createdByUserId === user?.id ? user?.avatarUrl : null)
                }
              />
              {entry.createdByName}
            </span>
            <span>{formatDate(entry.occurredAt)}</span>
            {entry.documentationUpdatedAt && (
              <span>{autoT('ui_dee2fa0b54d8')}{formatDate(entry.documentationUpdatedAt)}
                {entry.documentationUpdatedByName ? ` von ${entry.documentationUpdatedByName}` : ''}
              </span>
            )}
          </div>
          {entry.status === 'discussed' && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="h-5 w-5" />{autoT('ui_90f8eeda9786')}{' '}{entry.discussedByName || '—'}{' '}{autoT('ui_96e8155732e8')}{' '}{formatDate(entry.discussedAt)}.
            </p>
          )}
        </div>
        <div className="space-y-6 p-5 sm:p-7">
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{autoT('ui_0401e23e6030')}</h2>
            <p className="whitespace-pre-wrap leading-7 text-gray-800">{entry.body}</p>
          </section>
          {(entry.highlights || entry.challenges || entry.nextSteps) && (
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {entry.highlights && (
                <div className="rounded-xl bg-green-50 p-4">
                  <h3 className="mb-2 font-semibold text-green-800">{autoT('ui_ed124d299865')}</h3>
                  <p className="whitespace-pre-wrap text-sm text-green-950">{entry.highlights}</p>
                </div>
              )}
              {entry.challenges && (
                <div className="rounded-xl bg-amber-50 p-4">
                  <h3 className="mb-2 font-semibold text-amber-800">{autoT('ui_24cb5c6fa8e6')}</h3>
                  <p className="whitespace-pre-wrap text-sm text-amber-950">{entry.challenges}</p>
                </div>
              )}
              {entry.nextSteps && (
                <div className="rounded-xl bg-blue-50 p-4">
                  <h3 className="mb-2 font-semibold text-blue-800">{autoT('ui_76231e1d047c')}</h3>
                  <p className="whitespace-pre-wrap text-sm text-blue-950">{entry.nextSteps}</p>
                </div>
              )}
            </section>
          )}
          <LogbookConnections entry={entry} />
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
      <section className="modern-card mt-5 p-5 sm:p-7">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-800">
          <MessageCircle className="h-5 w-5 text-viridian" />{autoT('ui_b9677171d9f7')}{entry.comments?.length || 0})
        </h2>
        <div className="space-y-4">
          {entry.comments?.length ? (
            entry.comments.map((item) => (
              <div key={item.id} className="rounded-xl bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-500">
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
                {(user?.role === 'superadmin' ||
                  user?.role === 'org_admin' ||
                  user?.id === item.createdByUserId) && (
                  <button
                    type="button"
                    onClick={() => removeComment.mutate({ entryId: entry.id, commentId: item.id })}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600"
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
                className="mt-1 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5"
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
