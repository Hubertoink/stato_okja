import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import {
  type LogbookEntry,
  type LogbookEntryStatus,
  useLogbookEntries,
  useSetLogbookStatus,
} from '@/lib/logbook';
import { logbookStatusLabels, logbookTypeLabels } from '@/lib/logbookLabels';
import {
  loadLogbookFilters,
  saveLogbookFilters,
  type LogbookAdvancedFilters,
} from '@/lib/logbookFilterStorage';
import ProtectedImage from '@/components/ProtectedImage';
import LogbookFilterDrawer from '@/components/LogbookFilterDrawer';
import LogbookEntryFlyout from '@/components/LogbookEntryFlyout';

function formatDate(value: string) {
  return new Date(value).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusClass(status: LogbookEntryStatus) {
  return status === 'discussed'
    ? 'bg-green-100 text-green-700'
    : status === 'follow_up'
      ? 'bg-amber-100 text-amber-800'
      : status === 'archived'
        ? 'bg-gray-100 text-gray-600'
        : 'bg-blue-100 text-blue-700';
}

function AuthorBadge({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-viridian/10 font-semibold text-viridian">
        {avatarUrl ? (
          <ProtectedImage src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

function LogbookCard({ entry, onOpen }: { entry: LogbookEntry; onOpen: (id: string) => void }) {
  const { user } = useAuth();
  const status = useSetLogbookStatus();
  const canManage =
    user?.role === 'superadmin' || user?.role === 'org_admin' || user?.id === entry.createdByUserId;
  const wasUpdated = Boolean(entry.documentationUpdatedAt);
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(entry.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(entry.id);
        }
      }}
      className="modern-card cursor-pointer p-4 transition-transform hover:-translate-y-0.5 sm:p-5"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{formatDate(entry.occurredAt)}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
              {logbookTypeLabels[entry.type]}
            </span>
            {entry.visibility === 'admins' && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-700">
                Intern
              </span>
            )}
          </div>
          <h3 className="truncate text-base font-semibold text-gray-800 sm:text-lg">
            {entry.title}
          </h3>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(entry.status)}`}
        >
          {logbookStatusLabels[entry.status]}
        </span>
      </div>
      <p className="mb-4 line-clamp-3 whitespace-pre-wrap text-sm text-gray-700">{entry.body}</p>
      {(entry.project?.title || entry.activity?.title) && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {entry.project?.title && (
            <span className="rounded bg-gray-100 px-2 py-1 text-gray-700">
              Projekt: {entry.project.title}
            </span>
          )}
          {entry.activity?.title && (
            <span className="rounded bg-gray-100 px-2 py-1 text-gray-700">
              Aktivität: {entry.activity.title}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <div className="min-w-0">
          <AuthorBadge
            name={entry.createdByName}
            avatarUrl={
              entry.createdByUser?.avatarUrl ??
              (entry.createdByUserId === user?.id ? user?.avatarUrl : null)
            }
          />
          {wasUpdated && (
            <span className="mt-1 block text-[11px] text-gray-400">
              Geändert am {formatDate(entry.documentationUpdatedAt!)}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {entry.commentCount || 0}
          </span>
          {canManage && entry.status !== 'discussed' && entry.status !== 'archived' && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                status.mutate({ id: entry.id, status: 'discussed' });
              }}
              className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-green-700 hover:bg-green-50"
              title="Als besprochen markieren"
            >
              <CheckCircle2 className="h-4 w-4" />
              Besprochen
            </button>
          )}
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </article>
  );
}

function dateBadge(from?: string, to?: string) {
  if (from && to) return from === to ? `Zeitraum: ${from}` : `Zeitraum: ${from} – ${to}`;
  if (from) return `Zeitraum ab: ${from}`;
  return to ? `Zeitraum bis: ${to}` : null;
}

export default function Logbook() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [initialFilters] = useState(loadLogbookFilters);
  const [search, setSearch] = useState(initialFilters.search);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterDrawer, setFilterDrawer] = useState(false);
  const [advanced, setAdvanced] = useState<LogbookAdvancedFilters>(initialFilters.advanced);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const filters = useMemo(
    () => ({ search: search.trim() || undefined, ...advanced }),
    [advanced, search],
  );
  const { data, isLoading } = useLogbookEntries(filters, 1, 100);
  const entries = data?.data || [];
  const hasAdvancedFilters = Boolean(
    advanced.from ||
      advanced.to ||
      advanced.type ||
      advanced.status ||
      advanced.projectId ||
      advanced.includeArchived,
  );
  const hasFilters = Boolean(search.trim() || hasAdvancedFilters);
  const cutoff = useMemo(() => {
    const value = new Date();
    value.setMonth(value.getMonth() - 1);
    return value;
  }, []);
  const currentEntries = hasFilters
    ? entries
    : entries.filter((entry) => new Date(entry.occurredAt) >= cutoff);
  const olderMonths = useMemo(() => {
    const grouped = new Map<string, number>();
    entries
      .filter((entry) => new Date(entry.occurredAt) < cutoff)
      .forEach((entry) => {
        const key = entry.occurredAt.slice(0, 7);
        grouped.set(key, (grouped.get(key) || 0) + 1);
      });
    return Array.from(grouped.entries()).sort(([left], [right]) => right.localeCompare(left));
  }, [entries, cutoff]);

  useEffect(() => {
    saveLogbookFilters({ search, advanced });
  }, [advanced, search]);

  useEffect(() => {
    const entryId = (params.get('entry') || '').trim();
    setSelectedEntryId(entryId || null);
  }, [params]);

  const resetFilters = () => {
    setSearch('');
    setAdvanced({});
    setSearchOpen(false);
  };
  const selectMonth = (key: string) => {
    const [year, month] = key.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    setAdvanced((current) => ({
      ...current,
      from: `${key}-01`,
      to: `${key}-${String(lastDay).padStart(2, '0')}`,
    }));
  };
  const badges = [
    dateBadge(advanced.from, advanced.to),
    advanced.type ? `Art: ${logbookTypeLabels[advanced.type]}` : null,
    advanced.status ? `Status: ${logbookStatusLabels[advanced.status]}` : null,
    advanced.projectId ? 'Projekt ausgewählt' : null,
    advanced.includeArchived ? 'Archiv einbezogen' : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div>
      <div className="mb-4 mt-1 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <h2 className="text-3xl font-bold text-viridian">Logbuch</h2>
        <div className="flex justify-end gap-2">
          <div className="relative">
            {searchOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white/95 p-2 shadow-xl backdrop-blur-md">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Logbuch durchsuchen…"
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-10 text-sm focus:border-viridian focus:outline-none focus:ring-2 focus:ring-viridian/30"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      aria-label="Suche löschen"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSearchOpen((open) => !open)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-viridian transition-colors hover:border-gray-300 hover:bg-gray-50"
              title={searchOpen ? 'Suche ausblenden' : 'Suche öffnen'}
              aria-label={searchOpen ? 'Suche ausblenden' : 'Suche öffnen'}
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setFilterDrawer(true)}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-lg border transition-colors ${hasAdvancedFilters ? 'border-viridian/40 bg-white text-viridian ring-1 ring-viridian/20 hover:bg-gray-50' : 'border-gray-200 bg-white text-viridian hover:border-gray-300 hover:bg-gray-50'}`}
            title="Erweiterter Filter"
            aria-label="Erweiterter Filter"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/logbook/new')}
            className="dashboard-accent-solid-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold"
          >
            <Plus className="h-5 w-5" />
            <span className="hidden sm:inline">Eintrag erstellen</span>
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white/80 px-2 py-1 text-gray-700">
          {isLoading ? 'Treffer werden geladen…' : `Treffer: ${data?.total || 0}`}
        </span>
        {search.trim() && (
          <span className="inline-flex items-center gap-1 rounded-full bg-azure-web px-2 py-1 text-viridian">
            Suche: {search.trim()}
            <button
              type="button"
              onClick={() => setSearch('')}
              className="rounded-full text-viridian/80 hover:text-viridian"
              aria-label="Suche entfernen"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        {badges.map((badge) => (
          <span key={badge} className="rounded-full bg-azure-web px-2 py-1 text-viridian">
            {badge}
          </span>
        ))}
        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Zurücksetzen
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="modern-card p-6 text-sm text-gray-500">Logbuch wird geladen…</div>
      ) : entries.length === 0 ? (
        <div className="modern-card p-8 text-center">
          <UserRound className="mx-auto mb-3 h-9 w-9 text-gray-300" />
          <h3 className="font-semibold text-gray-700">Noch keine passenden Einträge</h3>
          <p className="mt-1 text-sm text-gray-500">
            Halte Beobachtungen, Übergaben oder Debriefings direkt im Logbuch fest.
          </p>
          <button
            type="button"
            onClick={() => navigate('/logbook/new')}
            className="mt-4 rounded-xl bg-viridian px-4 py-2 text-sm font-semibold text-white"
          >
            Ersten Eintrag erstellen
          </button>
        </div>
      ) : (
        <>
          {currentEntries.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {currentEntries.map((entry) => (
                <LogbookCard
                  key={entry.id}
                  entry={entry}
                  onOpen={(entryId) => navigate(`/logbook?entry=${encodeURIComponent(entryId)}`)}
                />
              ))}
            </div>
          )}
          {olderMonths.length > 0 && !hasFilters && (
            <section className="mt-7 border-t border-gray-200/70 pt-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Ältere Einträge
              </h3>
              <div className="flex flex-wrap gap-2">
                {olderMonths.map(([key, count]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectMonth(key)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-700 shadow-sm transition hover:border-viridian hover:text-viridian"
                  >
                    <span className="block">
                      {new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(
                        new Date(`${key}-01T12:00:00`),
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-gray-500">
                      {count} {count === 1 ? 'Eintrag' : 'Einträge'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {currentEntries.length === 0 && olderMonths.length > 0 && !hasFilters && (
            <div className="mt-4 text-sm text-gray-500">
              Die aktuellen Einträge wurden angezeigt; wähle einen Monat für das Archiv.
            </div>
          )}
        </>
      )}

      <LogbookFilterDrawer
        open={filterDrawer}
        initial={advanced}
        onClose={() => setFilterDrawer(false)}
        onApply={(next) => {
          setAdvanced(next);
          setFilterDrawer(false);
        }}
      />
      <LogbookEntryFlyout
        entryId={selectedEntryId}
        onClose={() => navigate('/logbook', { replace: true })}
      />
    </div>
  );
}
