import { useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw, Search, SlidersHorizontal, UserRound, XCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLogbookEntries } from '@/lib/logbook';
import { logbookStatusLabels, logbookTypeLabels } from '@/lib/logbookLabels';
import {
  loadLogbookFilters,
  saveLogbookFilters,
  type LogbookAdvancedFilters,
} from '@/lib/logbookFilterStorage';
import LogbookFilterDrawer from '@/components/LogbookFilterDrawer';
import LogbookEntryFlyout from '@/components/LogbookEntryFlyout';
import LogbookCardView from '@/components/LogbookCard';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, LoadingState } from '@/components/ui/StatePanel';

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
  const { data, isError, isLoading, refetch } = useLogbookEntries(filters, 1, 100);
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
      <PageHeader
        className="mb-4"
        title="Logbuch"
        actions={(
        <div className="flex justify-end gap-2">
          <div className="relative">
            {searchOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-2 shadow-xl backdrop-blur-md">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
                  <Input
                    autoFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Logbuch durchsuchen…"
                    className="mt-0 py-2 pl-9 pr-10"
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
            <IconButton
              variant="secondary"
              onClick={() => setSearchOpen((open) => !open)}
              title={searchOpen ? 'Suche ausblenden' : 'Suche öffnen'}
              aria-label={searchOpen ? 'Suche ausblenden' : 'Suche öffnen'}
            >
              <Search className="h-5 w-5" />
            </IconButton>
          </div>
          <IconButton
            variant="secondary"
            onClick={() => setFilterDrawer(true)}
            className={hasAdvancedFilters ? 'border-viridian/40 bg-[var(--interactive-soft)] text-viridian ring-1 ring-viridian/20' : ''}
            title="Erweiterter Filter"
            aria-label="Erweiterter Filter"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </IconButton>
          <IconButton
            variant="primary"
            className="rounded-full md:hidden"
            onClick={() => navigate('/logbook/new')}
            title="Eintrag erstellen"
            aria-label="Eintrag erstellen"
          >
            <Plus className="h-5 w-5" />
          </IconButton>
          <Button
            className="hidden md:inline-flex"
            onClick={() => navigate('/logbook/new')}
          >
            + Neuer Eintrag
          </Button>
        </div>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="count">
          {isLoading ? 'Treffer werden geladen…' : `Treffer: ${data?.total || 0}`}
        </Badge>
        {search.trim() && (
          <FilterChip onRemove={() => setSearch('')}>
            Suche: {search.trim()}
          </FilterChip>
        )}
        {badges.map((badge) => (
          <FilterChip key={badge}>
            {badge}
          </FilterChip>
        ))}
        {hasFilters && (
          <Button
            size="sm"
            variant="secondary"
            onClick={resetFilters}
            className="min-h-0 rounded-full px-2 py-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Zurücksetzen
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingState label="Logbuch wird geladen…" />
      ) : isError ? (
        <ErrorState action={{ label: 'Erneut versuchen', onClick: () => void refetch() }} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<UserRound className="h-5 w-5" />}
          title="Noch keine passenden Einträge"
          description="Halte Beobachtungen, Übergaben oder Debriefings direkt im Logbuch fest."
          action={(
          <Button
            onClick={() => navigate('/logbook/new')}
          >
            Ersten Eintrag erstellen
          </Button>
          )}
        />
      ) : (
        <>
          {currentEntries.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {currentEntries.map((entry) => (
                <LogbookCardView
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
