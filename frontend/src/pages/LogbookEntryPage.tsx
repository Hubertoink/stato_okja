import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Archive, ArrowLeft, CheckCircle2, Edit3, Link2, LockKeyhole, MessageCircle, Save, Send, Trash2 } from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useActivities } from '@/lib/activities';
import { type LogbookEntryInput, type LogbookEntryStatus, type LogbookEntryType, useArchiveLogbookEntry, useCreateLogbookComment, useCreateLogbookEntry, useLogbookEntry, useRemoveLogbookComment, useSetLogbookStatus, useUpdateLogbookEntry } from '@/lib/logbook';
import { useProjects } from '@/lib/projects';
import { logbookStatusLabels, logbookTypeLabels } from './Logbook';
import { useToast } from '@/components/Toast';

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
  return { occurredAt: toInputDate(), type: 'observation', title: '', body: '', highlights: '', challenges: '', nextSteps: '', status: 'open', visibility: 'team', activityId: search.get('activityId') || '', projectId: search.get('projectId') || '' };
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function LogbookEntryPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isNew = !id;
  const [editing, setEditing] = useState(isNew || location.pathname.endsWith('/edit'));
  const [form, setForm] = useState<FormState>(() => emptyForm(search));
  const [comment, setComment] = useState('');
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

  useEffect(() => {
    if (!entry) return;
    setForm({
      occurredAt: toInputDate(entry.occurredAt), type: entry.type, title: entry.title, body: entry.body,
      highlights: entry.highlights || '', challenges: entry.challenges || '', nextSteps: entry.nextSteps || '',
      status: entry.status, visibility: entry.visibility, activityId: entry.activityId || '', projectId: entry.projectId || '',
    });
  }, [entry]);

  useEffect(() => {
    if (!isNew) setEditing(location.pathname.endsWith('/edit'));
  }, [isNew, location.pathname]);

  const canManage = !!entry && (user?.role === 'superadmin' || user?.role === 'org_admin' || user?.id === entry.createdByUserId);
  const isAdmin = user?.role === 'superadmin' || user?.role === 'org_admin';
  const formPayload = useMemo<LogbookEntryInput>(() => ({
    occurredAt: new Date(form.occurredAt).toISOString(), type: form.type, title: form.title, body: form.body,
    highlights: form.highlights || null, challenges: form.challenges || null, nextSteps: form.nextSteps || null,
    status: form.status, visibility: form.visibility, activityId: form.activityId || null, projectId: form.projectId || null,
  }), [form]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (isNew) {
        const created = await create.mutateAsync(formPayload);
        showToast('Logbucheintrag wurde erstellt.', { type: 'success' });
        navigate(`/logbook/${created.id}`, { replace: true });
      } else if (id) {
        await update.mutateAsync({ id, data: formPayload });
        showToast('Änderungen gespeichert.', { type: 'success' });
        navigate(`/logbook/${id}`, { replace: true });
      }
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Der Eintrag konnte nicht gespeichert werden.', { type: 'error' });
    }
  };

  const addComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !comment.trim()) return;
    try {
      await createComment.mutateAsync({ entryId: id, body: comment });
      setComment('');
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Kommentar konnte nicht gespeichert werden.', { type: 'error' });
    }
  };

  if (!isNew && isLoading) return <div className="p-6 text-sm text-gray-500">Logbucheintrag wird geladen…</div>;
  if (!isNew && !entry) return <div className="modern-card p-6 text-sm text-gray-600">Der Logbucheintrag wurde nicht gefunden.</div>;

  if (editing) return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between gap-3"><button type="button" onClick={() => isNew ? navigate('/logbook') : navigate(`/logbook/${id}`)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-gray-700 hover:bg-white/70"><ArrowLeft className="h-5 w-5" />Zurück</button><span className="text-sm text-gray-500">{isNew ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}</span></div>
      <form onSubmit={save} className="modern-card overflow-hidden">
        <div className="border-b border-gray-100 p-5 sm:p-6"><h2 className="text-2xl font-bold text-gray-800">{isNew ? 'Logbucheintrag erstellen' : 'Logbucheintrag bearbeiten'}</h2><p className="mt-1 text-sm text-gray-600">Dokumentiere prägnant – sensible personenbezogene Angaben bitte vermeiden.</p></div>
        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">Zeitpunkt<input required type="datetime-local" value={form.occurredAt} onChange={(event) => setForm({ ...form, occurredAt: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5" /></label>
            <label className="text-sm font-medium text-gray-700">Eintragsart<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as LogbookEntryType })} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5">{Object.entries(logbookTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <label className="block text-sm font-medium text-gray-700">Titel<input required maxLength={180} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Worum geht es?" className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5" /></label>
          <label className="block text-sm font-medium text-gray-700">Beschreibung<textarea required rows={5} maxLength={12000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Was ist passiert oder was sollte das Team wissen?" className="mt-1 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5" /></label>
          <details className="rounded-xl border border-gray-200 bg-gray-50/60 p-4" open={!!(form.highlights || form.challenges || form.nextSteps)}><summary className="cursor-pointer text-sm font-semibold text-gray-700">Debriefing-Details ergänzen</summary><div className="mt-4 space-y-4"><label className="block text-sm font-medium text-gray-700">Was lief gut?<textarea rows={3} value={form.highlights} onChange={(event) => setForm({ ...form, highlights: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5" /></label><label className="block text-sm font-medium text-gray-700">Herausforderungen<textarea rows={3} value={form.challenges} onChange={(event) => setForm({ ...form, challenges: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5" /></label><label className="block text-sm font-medium text-gray-700">Nächste Schritte<textarea rows={3} value={form.nextSteps} onChange={(event) => setForm({ ...form, nextSteps: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5" /></label></div></details>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">Projekt<select value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"><option value="">Kein Projekt verknüpfen</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
            <label className="text-sm font-medium text-gray-700">Aktivität<select value={form.activityId} onChange={(event) => setForm({ ...form, activityId: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"><option value="">Keine Aktivität verknüpfen</option>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.date} · {activity.title || activity.project?.title || 'Aktivität'}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LogbookEntryStatus })} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5">{Object.entries(logbookStatusLabels).filter(([value]) => value !== 'archived').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{isAdmin && <label className="text-sm font-medium text-gray-700">Sichtbarkeit<select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as 'team' | 'admins' })} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"><option value="team">Ganzes Team</option><option value="admins">Nur Admins</option></select></label>}</div>
        </div>
        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-gray-100 bg-white/95 p-4 pb-safe sm:flex-row sm:justify-end"><button type="button" onClick={() => isNew ? navigate('/logbook') : navigate(`/logbook/${id}`)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-100">Abbrechen</button><button disabled={create.isPending || update.isPending} className="dashboard-accent-solid-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 font-semibold disabled:opacity-60"><Save className="h-4 w-4" />{create.isPending || update.isPending ? 'Wird gespeichert…' : 'Speichern'}</button></div>
      </form>
    </div>
  );

  if (!entry) return null;
  const archived = entry.status === 'archived';
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between gap-3"><button type="button" onClick={() => navigate('/logbook')} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-gray-700 hover:bg-white/70"><ArrowLeft className="h-5 w-5" />Logbuch</button>{canManage && <div className="flex gap-2"><button type="button" onClick={() => navigate(`/logbook/${id}/edit`)} disabled={archived} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 disabled:opacity-40"><Edit3 className="h-4 w-4" /><span className="hidden sm:inline">Bearbeiten</span></button><button type="button" disabled={archived || archive.isPending} onClick={async () => { if (!window.confirm('Diesen Logbucheintrag archivieren?')) return; await archive.mutateAsync(id!); showToast('Eintrag archiviert.', { type: 'success' }); navigate('/logbook'); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-100 bg-white px-3 text-sm font-semibold text-red-600 disabled:opacity-40"><Archive className="h-4 w-4" /><span className="hidden sm:inline">Archivieren</span></button></div>}</div>
      <article className="modern-card overflow-hidden">
        <div className="border-b border-gray-100 p-5 sm:p-7"><div className="mb-3 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-700">{logbookTypeLabels[entry.type]}</span><span className={`rounded-full px-2.5 py-1 font-semibold ${entry.status === 'discussed' ? 'bg-green-100 text-green-700' : entry.status === 'follow_up' ? 'bg-amber-100 text-amber-800' : entry.status === 'archived' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>{logbookStatusLabels[entry.status]}</span>{entry.visibility === 'admins' && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-700"><LockKeyhole className="h-3 w-3" />Nur Admins</span>}</div><h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">{entry.title}</h1><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500"><span className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-viridian/10 font-semibold text-viridian">{initials(entry.createdByName)}</span>{entry.createdByName}</span><span>{formatDate(entry.occurredAt)}</span></div></div>
        <div className="space-y-6 p-5 sm:p-7"><section><h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Dokumentation</h2><p className="whitespace-pre-wrap leading-7 text-gray-800">{entry.body}</p></section>{(entry.highlights || entry.challenges || entry.nextSteps) && <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">{entry.highlights && <div className="rounded-xl bg-green-50 p-4"><h3 className="mb-2 font-semibold text-green-800">Was lief gut?</h3><p className="whitespace-pre-wrap text-sm text-green-950">{entry.highlights}</p></div>}{entry.challenges && <div className="rounded-xl bg-amber-50 p-4"><h3 className="mb-2 font-semibold text-amber-800">Herausforderungen</h3><p className="whitespace-pre-wrap text-sm text-amber-950">{entry.challenges}</p></div>}{entry.nextSteps && <div className="rounded-xl bg-blue-50 p-4"><h3 className="mb-2 font-semibold text-blue-800">Nächste Schritte</h3><p className="whitespace-pre-wrap text-sm text-blue-950">{entry.nextSteps}</p></div>}</section>}{(entry.activity || entry.project) && <section className="rounded-xl border border-gray-100 bg-gray-50 p-4"><h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700"><Link2 className="h-4 w-4" />Verknüpfungen</h2><div className="flex flex-wrap gap-2 text-sm">{entry.project && <button onClick={() => navigate('/projects')} className="rounded-lg bg-white px-3 py-2 text-viridian shadow-sm">Projekt: {entry.project.title}</button>}{entry.activity && <button onClick={() => navigate(`/activities/${entry.activity!.id}`)} className="rounded-lg bg-white px-3 py-2 text-viridian shadow-sm">Aktivität: {entry.activity.title || entry.activity.date}</button>}</div></section>}{entry.status === 'discussed' && <p className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-800"><CheckCircle2 className="h-5 w-5" />Besprochen von {entry.discussedByName || '—'} am {formatDate(entry.discussedAt)}.</p>}{canManage && !archived && <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-5">{entry.status !== 'discussed' && <button onClick={() => setStatus.mutate({ id: entry.id, status: 'discussed' })} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" />Als besprochen markieren</button>}{entry.status === 'discussed' && <button onClick={() => setStatus.mutate({ id: entry.id, status: 'open' })} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700">Wieder öffnen</button>}{entry.status !== 'follow_up' && <button onClick={() => setStatus.mutate({ id: entry.id, status: 'follow_up' })} className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800">Nachverfolgung nötig</button>}</div>}</div>
      </article>
      <section className="modern-card mt-5 p-5 sm:p-7"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-800"><MessageCircle className="h-5 w-5 text-viridian" />Kommentare ({entry.comments?.length || 0})</h2><div className="space-y-4">{entry.comments?.length ? entry.comments.map((item) => <div key={item.id} className="rounded-xl bg-gray-50 p-4"><div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-500"><span className="font-semibold text-gray-700">{item.createdByName}</span><span>{formatDate(item.createdAt)}</span></div><p className="whitespace-pre-wrap text-sm text-gray-800">{item.body}</p>{(user?.role === 'superadmin' || user?.role === 'org_admin' || user?.id === item.createdByUserId) && <button type="button" onClick={() => removeComment.mutate({ entryId: entry.id, commentId: item.id })} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600"><Trash2 className="h-3.5 w-3.5" />Kommentar löschen</button>}</div>) : <p className="text-sm text-gray-500">Noch keine Kommentare.</p>}</div>{!archived && <form onSubmit={addComment} className="mt-5 border-t border-gray-100 pt-5"><label className="block text-sm font-medium text-gray-700">Kommentar hinzufügen<textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} maxLength={4000} placeholder="Ergänzung oder Rückmeldung für das Team…" className="mt-1 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5" /></label><div className="mt-2 flex justify-end"><button disabled={!comment.trim() || createComment.isPending} className="dashboard-accent-solid-button inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"><Send className="h-4 w-4" />Kommentar senden</button></div></form>}</section>
    </div>
  );
}
