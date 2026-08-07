import { FormEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  Circle,
  Edit3,
  LockKeyhole,
  MessageCircle,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import {
  type LogbookEntryStatus,
  useArchiveLogbookEntry,
  useCreateLogbookComment,
  useLogbookEntry,
  useRemoveLogbookComment,
  useSetLogbookStatus,
} from '@/lib/logbook';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import { ModalBackdrop } from '@/components/Modal';
import ProtectedImage from '@/components/ProtectedImage';
import LogbookConnections from '@/components/LogbookConnections';
import { logbookStatusLabels, logbookTypeLabels } from '@/lib/logbookLabels';
import LogbookStatusBadge from '@/components/LogbookStatusBadge';
import { Button, IconButton } from '@/components/ui/Button';
import { FieldLabel, Textarea } from '@/components/ui/Field';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';

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

function getErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data
    ?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : fallback;
}

export default function LogbookEntryFlyout({
  entryId,
  onClose,
  onEdit,
  returnTo = '/logbook',
}: {
  entryId: string | null;
  onClose: () => void;
  onEdit?: (entryId: string) => void;
  returnTo?: string;
}) {
  const open = !!entryId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: entry, isLoading } = useLogbookEntry(entryId || undefined);
  const archive = useArchiveLogbookEntry();
  const setStatus = useSetLogbookStatus();
  const createComment = useCreateLogbookComment();
  const removeComment = useRemoveLogbookComment();
  const [comment, setComment] = useState('');
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !archiveConfirmOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [archiveConfirmOpen, onClose, open]);

  useEffect(() => {
    if (!open) setComment('');
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  const archived = entry?.status === 'archived';
  const canManage =
    !!entry &&
    (user?.role === 'superadmin' ||
      user?.role === 'org_admin' ||
      user?.id === entry.createdByUserId);

  const addComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!entry || !comment.trim()) return;
    try {
      await createComment.mutateAsync({ entryId: entry.id, body: comment.trim() });
      setComment('');
    } catch (error) {
      showToast(getErrorMessage(error, autoT('ui_4ce1ddf633ea')), {
        type: 'error',
      });
    }
  };

  const content = (
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center md:items-center md:p-6"
      role="presentation"
    >
      <ModalBackdrop className="bg-slate-950/45 backdrop-blur-[1px]" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={autoT('ui_20cde07dafc6')}
        className="logbook-detail-modal relative flex h-full w-full flex-col bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-2xl md:h-auto md:max-h-[88vh] md:max-w-5xl md:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{autoT('ui_f95da57ad34c')}</p>
            <h2 className="truncate text-lg font-bold text-[var(--text-primary)]">{autoT('ui_73d71268a537')}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManage && !archived && entry && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setStatusMenuOpen((value) => !value)}
                  className={`status-control logbook-status-pill logbook-status-pill--${entry.status}`}
                >
                  <LogbookStatusIcon status={entry.status} />
                  <span className="hidden md:inline">{logbookStatusLabels[entry.status]}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${statusMenuOpen ? "rotate-180" : ''}`} />
                </button>
                {statusMenuOpen && (
                  <Menu className="absolute right-0 top-full z-10 mt-2 min-w-48">
                    <div className="status-menu-label px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em]">{autoT('ui_95706e6c2697')}</div>
                    <StatusMenuItem
                      status="open"
                      active={entry.status === 'open'}
                      onSelect={() => {
                        setStatus.mutate({ id: entry.id, status: 'open' });
                        setStatusMenuOpen(false);
                      }}
                    />
                    <StatusMenuItem
                      status="discussed"
                      active={entry.status === 'discussed'}
                      onSelect={() => {
                        setStatus.mutate({ id: entry.id, status: 'discussed' });
                        setStatusMenuOpen(false);
                      }}
                    />
                    <StatusMenuItem
                      status="follow_up"
                      active={entry.status === 'follow_up'}
                      onSelect={() => {
                        setStatus.mutate({ id: entry.id, status: 'follow_up' });
                        setStatusMenuOpen(false);
                      }}
                    />
                  </Menu>
                )}
              </div>
            )}
            {canManage && !archived && entry && (
                <IconButton
                  variant="secondary"
                  className="logbook-edit-button"
                  onClick={() => {
                    if (onEdit) {
                      onEdit(entry.id);
                    } else {
                      navigate(`/logbook/${entry.id}/edit`, { state: { returnTo } });
                    }
                  }}
                aria-label={autoT('ui_104f3bfdc340')}
                title={autoT('ui_104f3bfdc340')}
              >
                <Edit3 className="h-5 w-5" />
              </IconButton>
            )}
            {canManage && !archived && (
              <button
                type="button"
                onClick={() => setArchiveConfirmOpen(true)}
                className="logbook-archive-button inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold"
              >
                <Archive className="h-4 w-4" />
                <span className="hidden sm:inline">{autoT('ui_b81f3298d960')}</span>
              </button>
            )}
            <IconButton
              variant="secondary"
              onClick={onClose}
              aria-label={autoT('ui_44424b18700e')}
            >
              <X className="h-5 w-5" />
            </IconButton>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {isLoading && <p className="text-sm text-gray-500">{autoT('ui_a7151ad4e39f')}</p>}
          {!isLoading && !entry && (
            <p className="text-sm text-gray-600">{autoT('ui_118fdc8c2826')}</p>
          )}
          {entry && (
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-700">
                    {logbookTypeLabels[entry.type]}
                  </span>
                  <LogbookStatusBadge status={entry.status} />
                  {entry.visibility === 'admins' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-700">
                      <LockKeyhole className="h-3 w-3" />{autoT('ui_db8e800f08e5')}</span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-gray-800">{entry.title}</h1>
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
                      {entry.documentationUpdatedByName
                        ? ` von ${entry.documentationUpdatedByName}`
                        : ''}
                    </span>
                  )}
                </div>
                {entry.status === 'discussed' && (
                  <p className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-800">
                    <CheckCircle2 className="h-5 w-5" />{autoT('ui_90f8eeda9786')}{' '}{entry.discussedByName || '—'}{' '}{autoT('ui_96e8155732e8')}{' '}{formatDate(entry.discussedAt)}.
                  </p>
                )}
              </section>
              <section className="border-t border-gray-100 pt-5">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{autoT('ui_0401e23e6030')}</h3>
                <p className="whitespace-pre-wrap leading-7 text-gray-800">{entry.body}</p>
              </section>
              {(entry.highlights || entry.challenges || entry.nextSteps) && (
                <section className="grid gap-3">
                  <DetailNote
                    title={autoT('ui_ed124d299865')}
                    value={entry.highlights}
                    className="logbook-detail-note--success bg-green-50 text-green-800"
                  />
                  <DetailNote
                    title={autoT('ui_24cb5c6fa8e6')}
                    value={entry.challenges}
                    className="logbook-detail-note--warning bg-amber-50 text-amber-800"
                  />
                  <DetailNote
                    title={autoT('ui_76231e1d047c')}
                    value={entry.nextSteps}
                    className="logbook-detail-note--info bg-blue-50 text-blue-800"
                  />
                </section>
              )}
              <LogbookConnections entry={entry} />
              <section className="border-t border-gray-100 pt-5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-800">
                  <MessageCircle className="h-5 w-5 text-viridian" />{autoT('ui_b9677171d9f7')}{entry.comments?.length || 0})
                </h3>
                <div className="space-y-3">
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
                            onClick={() =>
                              removeComment.mutate({ entryId: entry.id, commentId: item.id })
                            }
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
                  <form onSubmit={addComment} className="mt-5 border-t border-[var(--border-subtle)] pt-5">
                    <FieldLabel>{autoT('ui_dad674bd7da1')}<Textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        rows={3}
                        maxLength={4000}
                        placeholder={autoT('ui_6119b63de1a4')}
                        className="resize-y py-2.5"
                      />
                    </FieldLabel>
                    <div className="mt-2 flex justify-end">
                      <Button
                        disabled={!comment.trim() || createComment.isPending}
                      >
                        <Send className="h-4 w-4" />{autoT('ui_86b530d1039e')}</Button>
                    </div>
                  </form>
                )}
              </section>
            </div>
          )}
        </div>
      </aside>
      <ConfirmModal
        open={archiveConfirmOpen}
        title={autoT('ui_549a1516f520')}
        message={autoT('ui_f6044433ee4d')}
        confirmLabel={autoT('ui_b81f3298d960')}
        onCancel={() => setArchiveConfirmOpen(false)}
        onConfirm={() => {
          if (!entry) return;
          archive.mutate(entry.id, {
            onSuccess: () => {
              setArchiveConfirmOpen(false);
              showToast(autoT('ui_e041a9132c74'), { type: 'success' });
              onClose();
            },
            onError: (error) =>
              showToast(getErrorMessage(error, autoT('ui_a2acb0418a4f')), {
                type: 'error',
              }),
          });
        }}
      />
    </div>
  );

  return createPortal(content, document.body);
}

function LogbookStatusIcon({ status }: { status: LogbookEntryStatus }) {
  if (status === 'discussed') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'follow_up') return <AlertTriangle className="h-4 w-4" />;
  return <Circle className="h-4 w-4" />;
}

function StatusMenuItem({
  status,
  active,
  onSelect,
}: {
  status: 'open' | 'follow_up' | 'discussed';
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <MenuItem
      onClick={onSelect}
      className={active ? "bg-[var(--interactive-soft)] text-viridian" : ''}
    >
      <LogbookStatusIcon status={status} />
      {logbookStatusLabels[status]}
      {active && <CheckCircle2 className="ml-auto h-4 w-4" />}
    </MenuItem>
  );
}

function DetailNote({
  title,
  value,
  className,
}: {
  title: string;
  value?: string | null;
  className: string;
}) {
  if (!value) return null;
  return (
    <div className={`logbook-detail-note rounded-xl p-4 ${className}`}>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}
