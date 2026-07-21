import { FormEvent, useEffect, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Edit3,
  Link2,
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
  useArchiveLogbookEntry,
  useCreateLogbookComment,
  useLogbookEntry,
  useRemoveLogbookComment,
  useSetLogbookStatus,
} from '@/lib/logbook';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import ProtectedImage from '@/components/ProtectedImage';
import { logbookStatusLabels, logbookTypeLabels } from '@/lib/logbookLabels';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('de-DE', {
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
}: {
  entryId: string | null;
  onClose: () => void;
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
      showToast(getErrorMessage(error, 'Kommentar konnte nicht gespeichert werden.'), {
        type: 'error',
      });
    }
  };

  const content = (
    <div className="fixed inset-0 z-[60]" role="presentation">
      <button
        type="button"
        aria-label="Detailansicht schließen"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-950/45 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Logbucheintrag"
        className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-gray-200 bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Logbuch</p>
            <h2 className="truncate text-lg font-bold text-gray-800">Eintragsdetails</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManage && !archived && entry && (
              <button
                type="button"
                onClick={() => navigate(`/logbook/${entry.id}/edit`)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Edit3 className="h-4 w-4" />
                <span className="hidden sm:inline">Bearbeiten</span>
              </button>
            )}
            {canManage && !archived && (
              <button
                type="button"
                onClick={() => setArchiveConfirmOpen(true)}
                className="logbook-archive-button inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold"
              >
                <Archive className="h-4 w-4" />
                <span className="hidden sm:inline">Archivieren</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200"
              aria-label="Schließen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {isLoading && <p className="text-sm text-gray-500">Logbucheintrag wird geladen…</p>}
          {!isLoading && !entry && (
            <p className="text-sm text-gray-600">Der Logbucheintrag wurde nicht gefunden.</p>
          )}
          {entry && (
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-700">
                    {logbookTypeLabels[entry.type]}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-semibold ${entry.status === 'discussed' ? 'bg-green-100 text-green-700' : entry.status === 'follow_up' ? 'bg-amber-100 text-amber-800' : entry.status === 'archived' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}
                  >
                    {logbookStatusLabels[entry.status]}
                  </span>
                  {entry.visibility === 'admins' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-700">
                      <LockKeyhole className="h-3 w-3" />
                      Nur Admins
                    </span>
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
                </div>
              </section>
              <section className="border-t border-gray-100 pt-5">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Dokumentation
                </h3>
                <p className="whitespace-pre-wrap leading-7 text-gray-800">{entry.body}</p>
              </section>
              {(entry.highlights || entry.challenges || entry.nextSteps) && (
                <section className="grid gap-3">
                  <DetailNote
                    title="Was lief gut?"
                    value={entry.highlights}
                    className="bg-green-50 text-green-800"
                  />
                  <DetailNote
                    title="Herausforderungen"
                    value={entry.challenges}
                    className="bg-amber-50 text-amber-800"
                  />
                  <DetailNote
                    title="Nächste Schritte"
                    value={entry.nextSteps}
                    className="bg-blue-50 text-blue-800"
                  />
                </section>
              )}
              {(entry.activity || entry.project) && (
                <section className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Link2 className="h-4 w-4" />
                    Verknüpfungen
                  </h3>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {entry.project && (
                      <button
                        type="button"
                        onClick={() => navigate('/projects')}
                        className="rounded-lg bg-white px-3 py-2 text-viridian shadow-sm"
                      >
                        Projekt: {entry.project.title}
                      </button>
                    )}
                    {entry.activity && (
                      <button
                        type="button"
                        onClick={() => navigate(`/activities/${entry.activity!.id}`)}
                        className="rounded-lg bg-white px-3 py-2 text-viridian shadow-sm"
                      >
                        Aktivität: {entry.activity.title || entry.activity.date}
                      </button>
                    )}
                  </div>
                </section>
              )}
              {entry.status === 'discussed' && (
                <p className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-800">
                  <CheckCircle2 className="h-5 w-5" />
                  Besprochen von {entry.discussedByName || '—'} am {formatDate(entry.discussedAt)}.
                </p>
              )}
              {canManage && !archived && (
                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-5">
                  {entry.status !== 'discussed' && (
                    <button
                      type="button"
                      onClick={() => setStatus.mutate({ id: entry.id, status: 'discussed' })}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Als besprochen markieren
                    </button>
                  )}
                  {entry.status === 'discussed' && (
                    <button
                      type="button"
                      onClick={() => setStatus.mutate({ id: entry.id, status: 'open' })}
                      className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
                    >
                      Wieder öffnen
                    </button>
                  )}
                  {entry.status !== 'follow_up' && (
                    <button
                      type="button"
                      onClick={() => setStatus.mutate({ id: entry.id, status: 'follow_up' })}
                      className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800"
                    >
                      Nachverfolgung nötig
                    </button>
                  )}
                </div>
              )}
              <section className="border-t border-gray-100 pt-5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-800">
                  <MessageCircle className="h-5 w-5 text-viridian" />
                  Kommentare ({entry.comments?.length || 0})
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
                            <Trash2 className="h-3.5 w-3.5" />
                            Kommentar löschen
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Noch keine Kommentare.</p>
                  )}
                </div>
                {!archived && (
                  <form onSubmit={addComment} className="mt-5 border-t border-gray-100 pt-5">
                    <label className="block text-sm font-medium text-gray-700">
                      Kommentar hinzufügen
                      <textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        rows={3}
                        maxLength={4000}
                        placeholder="Ergänzung oder Rückmeldung für das Team…"
                        className="mt-1 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5"
                      />
                    </label>
                    <div className="mt-2 flex justify-end">
                      <button
                        disabled={!comment.trim() || createComment.isPending}
                        className="dashboard-accent-solid-button inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                        Kommentar senden
                      </button>
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
        title="Eintrag archivieren"
        message="Der Logbucheintrag bleibt im Archiv erhalten, ist aber in der Standardansicht nicht mehr sichtbar."
        confirmLabel="Archivieren"
        onCancel={() => setArchiveConfirmOpen(false)}
        onConfirm={() => {
          if (!entry) return;
          archive.mutate(entry.id, {
            onSuccess: () => {
              setArchiveConfirmOpen(false);
              showToast('Eintrag archiviert.', { type: 'success' });
              onClose();
            },
            onError: (error) =>
              showToast(getErrorMessage(error, 'Eintrag konnte nicht archiviert werden.'), {
                type: 'error',
              }),
          });
        }}
      />
    </div>
  );

  return createPortal(content, document.body);
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
    <div className={`rounded-xl p-4 ${className}`}>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}
