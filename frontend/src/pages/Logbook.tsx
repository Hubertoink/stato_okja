import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, X } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchAllLogbookEntries, useLogbookEntries } from '@/lib/logbook';
import {
  loadLogbookFilters,
  saveLogbookFilters,
  type LogbookAdvancedFilters,
} from '@/lib/logbookFilterStorage';
import LogbookFilterDrawer from '@/components/LogbookFilterDrawer';
import LogbookEntryFlyout from '@/components/LogbookEntryFlyout';
import LogbookCardView from '@/components/LogbookCard';
import LogbookStatusBadge from '@/components/LogbookStatusBadge';
import LogbookTypeBadge from '@/components/LogbookTypeBadge';
import ProtectedImage from '@/components/ProtectedImage';
import Toggle from '@/components/Toggle';
import { Badge } from '@/components/ui/Badge';
import { Button, CreateButton, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';
import { HeaderFilterButton, HeaderSearchAction } from '@/components/ui/HeaderActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { ErrorState, LoadingState } from '@/components/ui/StatePanel';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { formatDate, formatNumber } from '@/i18n/formatters';
import logbookEmptyIllustration from '../../assets/Illust_Amigos/Logbuch_keineEinträge.svg';

function filterDate(value: string) {
  return formatDate(`${value}T12:00:00`, { dateStyle: 'short' });
}

function dateBadge(t: TFunction, from?: string, to?: string) {
  if (from && to) return from === to
    ? t('periodExact', { date: filterDate(from) })
    : t('periodBetween', { from: filterDate(from), to: filterDate(to) });
  if (from) return t('periodFrom', { date: filterDate(from) });
  return to ? t('periodTo', { date: filterDate(to) }) : null;
}

export default function Logbook() {
  const { t } = useTranslation(['logbook', 'common']);
  const { showToast } = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [initialFilters] = useState(loadLogbookFilters);
  const [search, setSearch] = useState(params.get('status') === 'open' ? '' : initialFilters.search);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterDrawer, setFilterDrawer] = useState(false);
  const [advanced, setAdvanced] = useState<LogbookAdvancedFilters>(() => params.get('status') === 'open' ? { status: 'open' } : initialFilters.advanced);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [tableView, setTableView] = useState(initialFilters.tableView);
  const [tablePage, setTablePage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const returnTo =
    (location.state as { returnTo?: unknown } | null)?.returnTo === '/dashboard'
      ? '/dashboard'
      : '/logbook';
  const filters = useMemo(
    () => ({ search: search.trim() || undefined, ...advanced }),
    [advanced, search],
  );
  const tablePageSize = 20;
  const { data, isError, isLoading, refetch } = useLogbookEntries(
    filters,
    tableView ? tablePage : 1,
    tableView ? tablePageSize : 100,
  );
  const entries = data?.data || [];
  const tablePageCount = Math.max(1, Math.ceil((data?.total || 0) / tablePageSize));
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
    saveLogbookFilters({ search, advanced, tableView });
  }, [advanced, search, tableView]);

  useEffect(() => {
    const entryId = (params.get('entry') || '').trim();
    setSelectedEntryId(entryId || null);
  }, [params]);

  useEffect(() => {
    setTablePage(1);
  }, [filters]);

  const resetFilters = () => {
    setSearch('');
    setAdvanced({});
    setSearchOpen(false);
    setTablePage(1);
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
    dateBadge(t, advanced.from, advanced.to),
    advanced.type ? t('typeChip', { value: t(`types.${advanced.type}`) }) : null,
    advanced.status ? t('statusChip', { value: t(`common:logbookStatus.${advanced.status}`) }) : null,
    advanced.projectId ? t('projectSelected') : null,
    advanced.includeArchived ? t('archiveIncluded') : null,
  ].filter((value): value is string => Boolean(value));
  const exportToExcel = async () => {
    setExporting(true);
    try {
      const exportEntries = await fetchAllLogbookEntries(filters);
      const rows = [
        [t('exportColumns.occurredAt'), t('exportColumns.type'), t('exportColumns.title'), t('exportColumns.status'), t('exportColumns.visibility'), t('exportColumns.project'), t('exportColumns.activity'), t('exportColumns.author'), t('exportColumns.body'), t('exportColumns.highlights'), t('exportColumns.challenges'), t('exportColumns.nextSteps'), t('exportColumns.comments')],
        ...exportEntries.map((entry) => [
          formatDate(entry.occurredAt, { dateStyle: 'short', timeStyle: 'short' }),
          t(`types.${entry.type}`),
          entry.title,
          t(`common:logbookStatus.${entry.status}`),
          entry.visibility === 'admins' ? t('card.internal') : t('visibilityTeam'),
          entry.project?.title || '',
          entry.activity?.title || '',
          entry.createdByName,
          entry.body,
          entry.highlights || '',
          entry.challenges || '',
          entry.nextSteps || '',
          String(entry.commentCount || 0),
        ]),
      ];
      const xlsx = await import('xlsx-js-style');
      const { utils, writeFile } = xlsx as unknown as typeof import('xlsx-js-style');
      const worksheet = utils.aoa_to_sheet(rows);
      (worksheet as unknown as { ['!autofilter']?: { ref: string } })['!autofilter'] = {
        ref: `A1:${utils.encode_col(rows[0].length - 1)}${rows.length}`,
      };
      worksheet['!cols'] = [
        { wch: 20 }, { wch: 24 }, { wch: 32 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 28 }, { wch: 24 }, { wch: 56 }, { wch: 36 }, { wch: 36 }, { wch: 36 }, { wch: 12 },
      ];
      for (let column = 0; column < rows[0].length; column += 1) {
        const cell = worksheet[utils.encode_cell({ r: 0, c: column })] as { s?: unknown } | undefined;
        if (cell) cell.s = { font: { bold: true, color: { rgb: 'FFFFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FF5B6CFF' } } };
      }
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, t('exportSheet'));
      writeFile(workbook, `Stato_Logbuch_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(t('exported'));
    } catch {
      showToast(t('exportError'), { type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        className="mb-4"
        title={t('title')}
        actions={(
        <div className="flex justify-end gap-2">
          <HeaderSearchAction
            clearLabel={t('clearSearch')}
            closeLabel={t('closeSearch')}
            onClear={() => setSearch('')}
            onOpenChange={setSearchOpen}
            onValueChange={setSearch}
            open={searchOpen}
            openLabel={t('openSearch')}
            placeholder={t('search')}
            value={search}
          />
          <IconButton
            aria-label={t('common:workflow.logbookExport')}
            disabled={exporting}
            onClick={() => void exportToExcel()}
            title={t('common:workflow.logbookExport')}
            variant="secondary"
          >
            <Download aria-hidden="true" />
          </IconButton>
          <div className="relative">
            <HeaderFilterButton
              aria-expanded={filterDrawer}
              onClick={() => setFilterDrawer((open) => !open)}
              title={t('advancedFilter')}
              aria-label={t('advancedFilter')}
            />
            <LogbookFilterDrawer
              open={filterDrawer}
              initial={advanced}
              onClose={() => setFilterDrawer(false)}
              onApply={(next) => {
                setAdvanced(next);
                setFilterDrawer(false);
              }}
            />
          </div>
          <IconButton
            variant="primary"
            className="rounded-full md:hidden"
            onClick={() => navigate('/logbook/new')}
            title={t('create')}
            aria-label={t('create')}
          >
            <Plus className="h-5 w-5" />
          </IconButton>
          <CreateButton
            className="hidden md:inline-flex"
            onClick={() => navigate('/logbook/new')}
          >
            {t('new')}
          </CreateButton>
        </div>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <Button variant={advanced.status === 'open' ? 'primary' : 'secondary'} size="sm" aria-pressed={advanced.status === 'open'} onClick={() => { setSearch(''); setAdvanced(advanced.status === 'open' ? {} : { status: 'open' }); }}>{t('common:workflow.openTopics')}</Button>
        <Badge variant="count">
          {isLoading ? t('loadingResults') : t('results', { count: formatNumber(data?.total || 0) })}
        </Badge>
        {search.trim() && (
          <FilterChip onRemove={() => setSearch('')}>
            {t('searchChip', { value: search.trim() })}
          </FilterChip>
        )}
        {badges.map((badge) => (
          <FilterChip key={badge}>
            {badge}
          </FilterChip>
        ))}
        {hasFilters && (
          <IconButton
            size="icon-compact"
            variant="ghost"
            onClick={resetFilters}
            className="rounded-full"
            title={t('reset')}
            aria-label={t('reset')}
          >
            <X className="h-3.5 w-3.5" />
          </IconButton>
        )}
        <span className="ml-auto">
          <Toggle
            ariaLabel={t('tableView')}
            checked={tableView}
            label={t('tableView')}
            onChange={(next) => {
              setTableView(next);
              setTablePage(1);
            }}
          />
        </span>
      </div>

      {isLoading ? (
        <LoadingState label={t('loading')} />
      ) : isError ? (
        <ErrorState action={{ label: t('retry'), onClick: () => void refetch() }} />
      ) : entries.length === 0 && (!tableView || !data?.total) ? (
        <EmptyState
          illustration={logbookEmptyIllustration}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={(
          <Button
            onClick={() => navigate('/logbook/new')}
          >
            {t('createFirst')}
          </Button>
          )}
        />
      ) : (
        <>
          {entries.length > 0 && tableView && (
            <div className="activities-desktop-table-shell overflow-x-auto rounded-lg bg-white shadow md:overflow-visible">
              <table className="activities-desktop-table w-full min-w-[760px] text-left">
                <thead className="activities-desktop-table-header bg-azure-web text-sm text-gray-700">
                  <tr>
                    <th className="activities-col-date whitespace-nowrap px-3 py-3 font-semibold lg:px-6">{t('table.date')}</th>
                    <th className="activities-col-type px-3 py-3 font-semibold lg:px-6">{t('table.type')}</th>
                    <th className="activities-col-title px-3 py-3 font-semibold lg:px-6">{t('table.title')}</th>
                    <th className="activities-col-meta px-3 py-3 font-semibold lg:px-6">{t('table.project')}</th>
                    <th className="px-3 py-3 font-semibold lg:px-6">{t('table.status')}</th>
                    <th className="px-3 py-3 font-semibold lg:px-6">{t('table.author')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="cursor-pointer bg-white transition-colors hover:bg-azure-web"
                      onClick={() => navigate(`/logbook?entry=${encodeURIComponent(entry.id)}`)}
                    >
                      <td className="activities-col-date whitespace-nowrap px-3 py-4 text-sm text-gray-700 lg:px-6">{formatDate(entry.occurredAt, { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="activities-col-type px-3 py-4 lg:px-6"><LogbookTypeBadge label={t(`types.${entry.type}`)} type={entry.type} /></td>
                      <td className="activities-col-title max-w-xs px-3 py-4 lg:px-6"><span className="font-medium text-gray-900">{entry.title}</span>{entry.isUnread ? <Badge className="ml-2" variant="accent">{t('newBadge')}</Badge> : null}</td>
                      <td className="activities-col-meta max-w-[12rem] truncate px-3 py-4 text-sm text-gray-600 lg:px-6">{entry.project?.title || '–'}</td>
                      <td className="px-3 py-4 lg:px-6"><LogbookStatusBadge status={entry.status} /></td>
                      <td className="px-3 py-4 text-sm text-gray-600 lg:px-6">
                        <span className="flex min-w-0 items-center gap-2">
                          {(() => {
                            const avatarUrl = entry.createdByUser?.avatarUrl ?? (entry.createdByUserId === user?.id ? user?.avatarUrl : null);
                            return avatarUrl ? (
                              <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-viridian/10">
                                <ProtectedImage src={avatarUrl} alt="" className="h-full w-full object-cover" />
                              </span>
                            ) : null;
                          })()}
                          <span className="min-w-0 truncate">{entry.createdByName}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tableView && data?.total ? (
            <div className="mb-4 mt-4 flex items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                {t('pagination.summary', { page: tablePage, pageCount: tablePageCount, total: formatNumber(data.total) })}
              </div>
              <PaginationControls
                page={tablePage}
                pageCount={tablePageCount}
                onFirst={() => setTablePage(1)}
                onPrevious={() => setTablePage((page) => Math.max(1, page - 1))}
                onNext={() => setTablePage((page) => Math.min(tablePageCount, page + 1))}
                onLast={() => setTablePage(tablePageCount)}
                labels={{ first: t('pagination.first'), previous: t('pagination.previous'), next: t('pagination.next'), last: t('pagination.last') }}
              />
            </div>
          ) : null}
          {currentEntries.length > 0 && !tableView && (
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
          {olderMonths.length > 0 && !hasFilters && !tableView && (
            <section className="mt-7 border-t border-gray-200/70 pt-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                {t('older')}
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
                      {formatDate(`${key}-01T12:00:00`, { month: 'long', year: 'numeric' })}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-gray-500">
                      {t('entry', { count })}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {currentEntries.length === 0 && olderMonths.length > 0 && !hasFilters && !tableView && (
            <div className="mt-4 text-sm text-gray-500">
              {t('archiveHint')}
            </div>
          )}
        </>
      )}

      <LogbookEntryFlyout
        entryId={selectedEntryId}
        returnTo={returnTo}
        onClose={() => {
          void refetch();
          navigate(returnTo, { replace: true });
        }}
      />
    </div>
  );
}
