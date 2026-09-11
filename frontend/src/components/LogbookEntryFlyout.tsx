import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Circle,
  Edit3,

  MessageCircle,
  MoreVertical,
  Send,
  Save,
  Trash2,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import {
  type LogbookEntryStatus,
  useArchiveLogbookEntry,
  useCreateLogbookComment,
  useLogbookEntry,
  useRemoveLogbookComment,
  useRestoreLogbookEntry,
  useSetLogbookStatus,
  useUpdateLogbookEntry,
} from '@/lib/logbook';
import { logbookDraft, logbookDraftPayload, type LogbookDraft } from '@/lib/logbookEdit';
import { isValidLogbookDateTime } from '@/lib/logbookDate';
import { useUnsavedChangesGuard } from '@/lib/useUnsavedChangesGuard';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import { ModalBackdrop, useModalHistory } from '@/components/Modal';
import ProtectedImage from '@/components/ProtectedImage';
import LogbookDetailContent from '@/components/LogbookDetailContent';
import { logbookStatusLabels } from '@/lib/logbookLabels';


import { ArchiveIconButton, Button, CloseButton, IconButton } from '@/components/ui/Button';
import { FieldLabel, Textarea } from '@/components/ui/Field';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';
import { useTranslation } from 'react-i18next';

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
  startEditing = false,
}: {
  entryId: string | null;
  onClose: () => void;
  returnTo?: string;
  startEditing?: boolean;
}) {
  const open = !!entryId;
  const { user } = useAuth();
  const { t } = useTranslation('logbook');
  const { showToast } = useToast();
  const { data: entry, isLoading, refetch } = useLogbookEntry(entryId || undefined);
  const update = useUpdateLogbookEntry();
  const [draft, setDraft] = useState<LogbookDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const editFormId = useId();
  const initialEditRef = useRef<string | null>(null);
  const { requestDiscard, reset, discardDialog } = useUnsavedChangesGuard(draft, { enabled: !!draft });
  const archive = useArchiveLogbookEntry();
  const restore = useRestoreLogbookEntry();
  const setStatus = useSetLogbookStatus();
  const createComment = useCreateLogbookComment();
  const removeComment = useRemoveLogbookComment();
  const [comment, setComment] = useState('');
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  useBodyScrollLock(open);
  const { dismiss } = useModalHistory(() => {
    if (!saving) requestDiscard(() => { setDraft(null); onClose(); });
  }, open);

  const canManage = !!entry && !!user && user.id === entry.createdByUserId;
  const beginEditing = () => {
    if (!entry || !canManage || entry.status === 'archived') return;
    const next = logbookDraft(entry);
    reset(next);
    setDraft(next);
    setStatusMenuOpen(false);
  };
  useEffect(() => {
    setDraft(null);
    initialEditRef.current = null;
  }, [entryId]);
  useEffect(() => {
    if (startEditing && entry && canManage && entry.status !== 'archived' && initialEditRef.current !== entry.id) {
      initialEditRef.current = entry.id;
      const next = logbookDraft(entry);
      reset(next);
      setDraft(next);
    }
  }, [startEditing, entry, canManage, reset]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !archiveConfirmOpen && !draft) dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [archiveConfirmOpen, dismiss, open, draft]);

  useEffect(() => {
    if (!open) setComment('');
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  const archived = entry?.status === 'archived';
  const status = draft?.status || entry?.status || 'open';
  const changeStatus = (next: LogbookEntryStatus) => {
    if (draft) setDraft({ ...draft, status: next });
    else if (entry) setStatus.mutate({ id: entry.id, status: next });
    setStatusMenuOpen(false);
  };
  const saveEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!entry || !draft || saving || !canManage || archived) return;
    if (!draft.title.trim() || !draft.body.trim() || !isValidLogbookDateTime(draft.occurredAt)) {
      showToast(t('inlineValidation'), { type: 'error' });
      return;
    }
    setSaving(true);
    try {
      await update.mutateAsync({ id: entry.id, data: logbookDraftPayload(draft, user?.role === 'superadmin' || user?.role === 'org_admin') });
      await refetch();
      reset(null);
      setDraft(null);
      showToast(autoT('ui_e1bd2c4575ee'), { type: 'success' });
    } catch (error) {
      showToast(getErrorMessage(error, autoT('ui_81128854f3b0')), { type: 'error' });
    } finally { setSaving(false); }
  };

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
      <ModalBackdrop className="bg-slate-950/45 backdrop-blur-[1px]" onClick={dismiss} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={autoT('ui_20cde07dafc6')}
        className="logbook-detail-modal relative flex h-full w-full flex-col bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-2xl md:h-auto md:max-h-[88vh] md:max-w-5xl md:rounded-2xl"
      >
        <header className="logbook-reading-toolbar flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-1">
            <IconButton className="md:hidden" variant="ghost" onClick={dismiss} aria-label={autoT('ui_44424b18700e')}><ArrowLeft /></IconButton>
            <h2 className="truncate text-base font-bold text-[var(--text-primary)] md:text-lg">{autoT('ui_73d71268a537')}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {draft && <IconButton aria-label={autoT('ui_70b73bbc118d')} title={autoT('ui_70b73bbc118d')} type="submit" form={editFormId} disabled={saving}><Save /></IconButton>}
            {canManage && !archived && entry && (
              <div className="relative">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setStatusMenuOpen((value) => !value)}
                  aria-label={logbookStatusLabels[status]}
                  aria-expanded={statusMenuOpen}
                  className={`status-control logbook-status-pill logbook-status-pill--${status}`}
                >
                  <LogbookStatusIcon status={status} />
                  <span className="hidden md:inline">{logbookStatusLabels[status]}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${statusMenuOpen ? "rotate-180" : ''}`} />
                </button>
                {statusMenuOpen && (
                  <Menu className="absolute right-0 top-full z-10 mt-2 min-w-48">
                    <div className="status-menu-label px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em]">{autoT('ui_95706e6c2697')}</div>
                    <StatusMenuItem
                      status="open"
                      active={status === 'open'}
                      onSelect={() => {
                        changeStatus('open');
                        setStatusMenuOpen(false);
                      }}
                    />
                    <StatusMenuItem
                      status="discussed"
                      active={status === 'discussed'}
                      onSelect={() => {
                        changeStatus('discussed');
                        setStatusMenuOpen(false);
                      }}
                    />
                    <StatusMenuItem
                      status="follow_up"
                      active={status === 'follow_up'}
                      onSelect={() => {
                        changeStatus('follow_up');
                        setStatusMenuOpen(false);
                      }}
                    />
                  </Menu>
                )}
              </div>
            )}
            {canManage && !archived && entry && !draft && (
                <IconButton
                  variant="ghost"
                  className="logbook-edit-button"
                  onClick={beginEditing}
                aria-label={autoT('ui_104f3bfdc340')}
                title={autoT('ui_104f3bfdc340')}
              >
                <Edit3 className="h-5 w-5" />
              </IconButton>
            )}
            {canManage && !archived && !draft && <details className="relative md:hidden" onKeyDown={(event) => {
              if (event.key === 'Escape' && event.currentTarget.open) {
                event.stopPropagation();
                event.currentTarget.open = false;
                event.currentTarget.querySelector('summary')?.focus();
              }
            }}>
              <summary className="logbook-more-trigger" aria-label={t('moreActions')}><MoreVertical aria-hidden="true" /></summary>
              <Menu className="absolute right-0 top-full z-20 mt-2 min-w-48">
                <MenuItem onClick={(event) => {
                  const details = event.currentTarget.closest('details');
                  if (details) details.open = false;
                  setArchiveConfirmOpen(true);
                }}><Archive className="h-4 w-4" />{autoT('ui_b81f3298d960')}</MenuItem>
              </Menu>
            </details>}
            {canManage && !archived && !draft && (
              <Button
                className="hidden md:inline-flex"
                variant="warning"
                size="md"
                onClick={() => setArchiveConfirmOpen(true)}
              >
                <Archive className="h-4 w-4" />
                <span className="hidden sm:inline">{autoT('ui_b81f3298d960')}</span>
              </Button>
            )}
            {canManage && archived && entry && (
              <span className="tooltip-wrapper">
                <ArchiveIconButton
                  restore
                  size="icon"
                  title={t('restore')}
                  aria-label={t('restore')}
                  disabled={restore.isPending}
                  onClick={() => {
                    restore.mutate(entry.id, {
                      onSuccess: () => showToast(t('restored'), { type: 'success' }),
                      onError: (error) => showToast(getErrorMessage(error, t('restore')), { type: 'error' }),
                    });
                  }}
                />
                <span className="tooltip-bubble">{t('restore')}</span>
              </span>
            )}
            <CloseButton
              className="hidden md:inline-flex"
              onClick={dismiss}
              aria-label={autoT('ui_44424b18700e')}
            />
          </div>
        </header>

        <div className="logbook-reading-scroll min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
          {isLoading && <p className="text-sm text-gray-500">{autoT('ui_a7151ad4e39f')}</p>}
          {!isLoading && !entry && (
            <p className="text-sm text-gray-600">{autoT('ui_118fdc8c2826')}</p>
          )}
          {entry && (
            <div className="logbook-detail-layout">
              <form id={editFormId} className="logbook-detail-main" onSubmit={saveEntry} onKeyDown={event => {
                if (!draft || saving || (event.target as HTMLElement).closest('[data-logbook-picker]')) return;
                if (event.key === 'Escape') {
                  event.preventDefault(); event.stopPropagation();
                  requestDiscard(() => { reset(null); setDraft(null); });
                }
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                  event.preventDefault(); event.currentTarget.requestSubmit();
                }
              }}>
                <fieldset disabled={saving} className="min-w-0">
                  <LogbookDetailContent entry={entry} editor={draft ? { draft, onChange: setDraft } : undefined} />
                </fieldset>
                {draft && <div className="logbook-inline-actions">
                  <Button variant="secondary" disabled={saving} onClick={() => requestDiscard(() => { reset(null); setDraft(null); })}>{t('discardEdits')}</Button>
                  <Button type="submit" disabled={saving}><Save className="h-4 w-4" />{saving ? autoT('ui_129ed064a520') : autoT('ui_70b73bbc118d')}</Button>
                </div>}
              </form>
              <section className="logbook-detail-comments border-t border-gray-100 pt-5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-800">
                  <MessageCircle className="h-5 w-5 text-viridian" />{autoT('ui_b9677171d9f7')}{entry.comments?.length || 0})
                </h3>
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
                            onClick={() =>
                              removeComment.mutate({ entryId: entry.id, commentId: item.id })
                            }
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
                        type="submit"
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
      {discardDialog}
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
