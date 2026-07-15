import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronRight, Filter, MessageCircle, Plus, RotateCcw, Search, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { type LogbookEntry, type LogbookEntryStatus, type LogbookEntryType, useLogbookEntries, useSetLogbookStatus } from '@/lib/logbook';
import ProtectedImage from '@/components/ProtectedImage';

const typeLabels: Record<LogbookEntryType, string> = {
  observation: 'Beobachtung', incident: 'Besonderes Vorkommnis', success: 'Erfolg', handover: 'Übergabe', debrief: 'Debriefing', other: 'Sonstiges',
};
const statusLabels: Record<LogbookEntryStatus, string> = {
  open: 'Offen', follow_up: 'Nachverfolgung', discussed: 'Besprochen', archived: 'Archiviert',
};
export const logbookTypeLabels = typeLabels;
export const logbookStatusLabels = statusLabels;

function formatDate(value: string) {
  return new Date(value).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusClass(status: LogbookEntryStatus) {
  return status === 'discussed' ? 'bg-green-100 text-green-700' : status === 'follow_up' ? 'bg-amber-100 text-amber-800' : status === 'archived' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700';
}

function AuthorBadge({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  return <span className="flex min-w-0 items-center gap-1.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-viridian/10 font-semibold text-viridian">{avatarUrl ? <ProtectedImage src={avatarUrl} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}</span><span className="truncate">{name}</span></span>;
}

function LogbookCard({ entry }: { entry: LogbookEntry }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const status = useSetLogbookStatus();
  const canManage = user?.role === 'superadmin' || user?.role === 'org_admin' || user?.id === entry.createdByUserId;
  const wasUpdated = new Date(entry.updatedAt).getTime() > new Date(entry.createdAt).getTime();
  return (
    <article
      className="modern-card cursor-pointer p-4 transition-transform hover:-translate-y-0.5 sm:p-5"
      onClick={() => navigate(`/logbook/${entry.id}`)}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{formatDate(entry.occurredAt)}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">{typeLabels[entry.type]}</span>
            {entry.visibility === 'admins' && <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-700">Intern</span>}
          </div>
          <h3 className="truncate text-base font-semibold text-gray-800 sm:text-lg">{entry.title}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(entry.status)}`}>{statusLabels[entry.status]}</span>
      </div>
      <p className="mb-4 line-clamp-3 whitespace-pre-wrap text-sm text-gray-700">{entry.body}</p>
      {(entry.project?.title || entry.activity?.title) && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {entry.project?.title && <span className="rounded bg-gray-100 px-2 py-1 text-gray-700">Projekt: {entry.project.title}</span>}
          {entry.activity?.title && <span className="rounded bg-gray-100 px-2 py-1 text-gray-700">Aktivität: {entry.activity.title}</span>}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <div className="min-w-0">
          <AuthorBadge name={entry.createdByName} avatarUrl={entry.createdByUser?.avatarUrl ?? (entry.createdByUserId === user?.id ? user?.avatarUrl : null)} />
          {wasUpdated && <span className="mt-1 block text-[11px] text-gray-400">Geändert am {formatDate(entry.updatedAt)}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{entry.commentCount || 0}</span>
          {canManage && entry.status !== 'discussed' && entry.status !== 'archived' && (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); status.mutate({ id: entry.id, status: 'discussed' }); }}
              className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-green-700 hover:bg-green-50"
              title="Als besprochen markieren"
            ><CheckCircle2 className="h-4 w-4" />Besprochen</button>
          )}
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </article>
  );
}

export default function Logbook() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [type, setType] = useState<LogbookEntryType | ''>('');
  const [status, setStatus] = useState<LogbookEntryStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filters = useMemo(() => ({ search: search || undefined, type: type || undefined, status: status || undefined, from: from || undefined, to: to || undefined }), [search, type, status, from, to]);
  const { data, isLoading } = useLogbookEntries(filters, 1, 100);
  const entries = data?.data || [];
  const hasFilters = Boolean(search || type || status || from || to);
  const resetFilters = () => { setSearch(''); setType(''); setStatus(''); setFrom(''); setTo(''); setShowFilters(false); };
  const cutoff = useMemo(() => { const value = new Date(); value.setMonth(value.getMonth() - 1); return value; }, []);
  const currentEntries = hasFilters ? entries : entries.filter((entry) => new Date(entry.occurredAt) >= cutoff);
  const olderMonths = useMemo(() => {
    const grouped = new Map<string, number>();
    entries.filter((entry) => new Date(entry.occurredAt) < cutoff).forEach((entry) => {
      const key = entry.occurredAt.slice(0, 7);
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });
    return Array.from(grouped.entries()).sort(([left], [right]) => right.localeCompare(left));
  }, [entries, cutoff]);
  const selectMonth = (key: string) => {
    const [year, month] = key.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    setFrom(`${key}-01`); setTo(`${key}-${String(lastDay).padStart(2, '0')}`); setShowFilters(true);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><BookOpen className="h-7 w-7 text-viridian" /><h2 className="text-3xl font-bold text-gray-800">Logbuch</h2></div>
          <p className="mt-1 text-sm text-gray-600">Beobachtungen, Übergaben und Debriefings im Team festhalten.</p>
        </div>
        <button type="button" onClick={() => navigate('/logbook/new')} className="dashboard-accent-solid-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold"><Plus className="h-5 w-5" />Eintrag erstellen</button>
      </div>

      <section className="modern-card mb-5 p-3 sm:p-4">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm" placeholder="Logbuch durchsuchen…" /></label>
          {hasFilters && <button type="button" onClick={resetFilters} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50" title="Filter zurücksetzen"><RotateCcw className="h-4 w-4" /><span className="hidden sm:inline">Reset</span></button>}
          <button type="button" onClick={() => setShowFilters((value) => !value)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium ${showFilters ? 'border-viridian bg-viridian/10 text-viridian' : 'border-gray-200 bg-white text-gray-700'}`}><Filter className="h-4 w-4" /><span className="hidden sm:inline">Filter</span></button>
        </div>
        {showFilters && <div className="mt-3 grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-gray-600">Art<select value={type} onChange={(event) => setType(event.target.value as LogbookEntryType | '')} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"><option value="">Alle Arten</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs font-medium text-gray-600">Status<select value={status} onChange={(event) => setStatus(event.target.value as LogbookEntryStatus | '')} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"><option value="">Alle Status</option>{Object.entries(statusLabels).filter(([value]) => value !== 'archived').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs font-medium text-gray-600">Von<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" /></label>
          <label className="text-xs font-medium text-gray-600">Bis<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" /></label>
        </div>}
      </section>

      <div className="mb-3 flex items-center justify-between text-sm text-gray-500"><span>{data?.total || 0} Einträge</span><span className="hidden sm:inline">Die neuesten Einträge stehen oben.</span></div>
      {isLoading ? <div className="modern-card p-6 text-sm text-gray-500">Logbuch wird geladen…</div> : entries.length === 0 ? (
        <div className="modern-card p-8 text-center"><UserRound className="mx-auto mb-3 h-9 w-9 text-gray-300" /><h3 className="font-semibold text-gray-700">Noch keine passenden Einträge</h3><p className="mt-1 text-sm text-gray-500">Halte Beobachtungen, Übergaben oder Debriefings direkt im Logbuch fest.</p><button type="button" onClick={() => navigate('/logbook/new')} className="mt-4 rounded-xl bg-viridian px-4 py-2 text-sm font-semibold text-white">Ersten Eintrag erstellen</button></div>
      ) : <>
        {currentEntries.length > 0 && <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{currentEntries.map((entry) => <LogbookCard key={entry.id} entry={entry} />)}</div>}
        {olderMonths.length > 0 && !hasFilters && <section className="mt-7 border-t border-gray-200/70 pt-5"><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Ältere Einträge</h3><div className="flex flex-wrap gap-2">{olderMonths.map(([key, count]) => <button key={key} type="button" onClick={() => selectMonth(key)} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-700 shadow-sm transition hover:border-viridian hover:text-viridian"><span className="block">{new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date(`${key}-01T12:00:00`))}</span><span className="mt-0.5 block text-xs font-normal text-gray-500">{count} {count === 1 ? 'Eintrag' : 'Einträge'}</span></button>)}</div></section>}
        {currentEntries.length === 0 && olderMonths.length > 0 && !hasFilters && <div className="mt-4 text-sm text-gray-500">Die aktuellen Einträge wurden angezeigt; wähle einen Monat für das Archiv.</div>}
      </>}
    </div>
  );
}
