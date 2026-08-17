import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Database, ExternalLink, FileJson, Loader2, Network, RefreshCw, Search, ShieldCheck, TableProperties, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '@/components/Modal';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import DatabaseRelationshipFlowModal from '@/components/system-data/DatabaseRelationshipFlowModal';
import {
  type DatabaseExplorerColumn,
  useDatabaseExplorerRows,
  useDatabaseExplorerTables,
} from '@/lib/systemData';
import { getApiErrorMessage } from '@/lib/systemData';

function renderValue(value: unknown, compact = false) {
  if (value === null || typeof value === 'undefined' || value === '') return <span className="text-[var(--text-muted)]">—</span>;
  if (typeof value === 'boolean') return value ? '✓' : '—';
  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    if (compact) return `${json.slice(0, 72)}${json.length > 72 ? '…' : ''}`;
    return <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]"><FileJson className="h-3.5 w-3.5" />{json}</span>;
  }
  const text = String(value);
  return compact && text.length > 96 ? `${text.slice(0, 96)}…` : text;
}

function SchemaBadges({ column }: { column: DatabaseExplorerColumn }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
      {column.primary && <span className="rounded bg-[var(--interactive-soft)] px-1.5 py-0.5 text-[var(--interactive-text)]">PK</span>}
      {column.reference && <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[var(--text-secondary)]">→ {column.reference.tableKey}</span>}
      {column.hidden && <span className="rounded bg-[var(--status-warning-bg)] px-1.5 py-0.5 text-[var(--status-warning-text)]">geschützt</span>}
    </div>
  );
}

function DetailValue({ value }: { value: unknown }) {
  if (value === null || typeof value === 'undefined' || value === '') return <span className="text-[var(--text-muted)]">—</span>;
  if (typeof value === 'object') {
    return <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--surface-1)] p-2.5 text-xs leading-5 text-[var(--text-secondary)]">{JSON.stringify(value, null, 2)}</pre>;
  }
  return <span className="break-words text-[var(--text-primary)]">{String(value)}</span>;
}

export default function DatabaseExplorerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('common');
  const tablesQuery = useDatabaseExplorerTables(open);
  const [selectedTableKey, setSelectedTableKey] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');
  const [search, setSearch] = useState('');
  const [orgId, setOrgId] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [isRelationshipMapOpen, setIsRelationshipMapOpen] = useState(false);
  const [activeInfoPanel, setActiveInfoPanel] = useState<'schema' | 'organization' | null>(null);
  const deferredSearch = useDeferredValue(search);

  const tables = tablesQuery.data?.tables || [];
  const selectedTable = tables.find((table) => table.key === selectedTableKey) || null;
  const filteredTables = useMemo(() => {
    const term = tableSearch.trim().toLowerCase();
    return term ? tables.filter((table) => table.key.toLowerCase().includes(term)) : tables;
  }, [tableSearch, tables]);

  useEffect(() => {
    if (!tables.length) return;
    if (!selectedTableKey || !tables.some((table) => table.key === selectedTableKey)) {
      setSelectedTableKey(tables[0].key);
    }
  }, [selectedTableKey, tables]);

  const rowParams = useMemo(() => ({
    page,
    pageSize: 50,
    search: deferredSearch || undefined,
    sort: sort || undefined,
    direction,
    orgId: orgId || undefined,
  }), [deferredSearch, direction, orgId, page, sort]);
  const rowsQuery = useDatabaseExplorerRows(selectedTableKey, rowParams, open);
  const rowData = rowsQuery.data;
  const displayColumns = rowData?.table.columns.filter((column) => !column.hidden) || [];
  const selectedRow = selectedRowIndex === null ? null : rowData?.rows[selectedRowIndex] || null;

  useEffect(() => {
    setSelectedRowIndex(null);
    setActiveInfoPanel(null);
  }, [selectedTableKey, rowData?.page]);

  const selectTable = (key: string, nextSearch = '') => {
    setSelectedTableKey(key);
    setSearch(nextSearch);
    setOrgId('');
    setSort('');
    setPage(1);
    setSelectedRowIndex(null);
    setActiveInfoPanel(null);
  };

  const changeSort = (column: string) => {
    setPage(1);
    if (sort === column) {
      setDirection((current) => current === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column);
      setDirection('asc');
    }
  };

  const canFilterOrganizations = Boolean(selectedTable?.organizationColumn);

  return (
    <Modal open={open} onClose={onClose} title={t('databaseExplorer.title')} maxWidth="screen" variant="information" contentClassName="!flex !flex-col !overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 py-1">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="system-data-banner system-data-banner-info flex flex-1 gap-3 rounded-xl px-4 py-3 text-sm">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{t('databaseExplorer.readOnlyNotice')}</div>
          </div>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setIsRelationshipMapOpen(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--interactive-soft-border)] hover:bg-[var(--interactive-soft)] hover:text-[var(--interactive-text)]"
          >
            <Network className="h-4 w-4" />
            <span className="hidden sm:inline">{t('databaseExplorer.relationships')}</span>
          </Button>
        </div>

        {tablesQuery.isLoading && (
          <div className="grid min-h-72 place-items-center text-[var(--text-muted)]"><Loader2 className="h-6 w-6 animate-spin" /></div>
        )}
        {tablesQuery.error && (
          <div className="system-data-banner system-data-banner-danger rounded-xl px-4 py-3 text-sm">
            {getApiErrorMessage(tablesQuery.error, t('databaseExplorer.loadError'))}
          </div>
        )}

        {!tablesQuery.isLoading && !tablesQuery.error && (
          <div className="grid min-h-[32rem] flex-1 grid-cols-1 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] lg:h-0 lg:min-h-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col border-b border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 lg:border-b-0 lg:border-r">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><Database className="h-4 w-4" />{t('databaseExplorer.tables')}</div>
              <label className="relative mb-3 block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder={t('databaseExplorer.tableSearch')}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] py-2 pl-8 pr-9 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--interactive-soft-border)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
                {tableSearch && (
                  <IconButton onClick={() => setTableSearch('')} aria-label={t('databaseExplorer.clearSearch')} variant="ghost" size="icon-compact" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]">
                    <X className="h-4 w-4" />
                  </IconButton>
                )}
              </label>
              <div className="max-h-44 min-h-0 flex-1 space-y-1 overflow-y-auto lg:max-h-none">
                {filteredTables.map((table) => (
                  <Button
                    key={table.key}
                    variant="ghost"
                    size="sm"
                    onClick={() => selectTable(table.key)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${selectedTableKey === table.key ? 'bg-[var(--interactive-soft)] font-semibold text-[var(--interactive-text)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]'}`}
                  >
                    <span className="truncate">{table.key}</span>
                    <span className="ml-3 shrink-0 text-xs opacity-75">{table.rowCount}</span>
                  </Button>
                ))}
              </div>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-col p-3 sm:p-4 lg:h-full">
              {!selectedTable ? (
                <div className="grid h-full min-h-56 place-items-center text-sm text-[var(--text-muted)]">{t('databaseExplorer.noRows')}</div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-3 lg:h-full">
                  <div className="relative flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]"><TableProperties className="h-4 w-4" />{selectedTable.key}</div>
                      <div className="mt-0.5 text-xs text-[var(--text-muted)]">{selectedTable.rowCount} {t('databaseExplorer.rows').toLowerCase()} · {selectedTable.columns.filter((column) => !column.hidden).length} {t('databaseExplorer.columns').toLowerCase()}</div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveInfoPanel((current) => current === 'schema' ? null : 'schema')}
                        aria-expanded={activeInfoPanel === 'schema'}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--interactive-soft-border)] hover:bg-[var(--interactive-soft)] hover:text-[var(--interactive-text)]"
                      ><TableProperties className="h-3.5 w-3.5" />{t('databaseExplorer.schema')}</Button>
                      {selectedTable.organizationColumn && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setActiveInfoPanel((current) => current === 'organization' ? null : 'organization')}
                          aria-expanded={activeInfoPanel === 'organization'}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--interactive-soft-border)] hover:bg-[var(--interactive-soft)] hover:text-[var(--interactive-text)]"
                        ><Network className="h-3.5 w-3.5" />{t('databaseExplorer.organizationDistribution')}</Button>
                      )}
                    </div>
                    <IconButton aria-label={t('databaseExplorer.refresh')} variant="secondary" size="icon-compact" onClick={() => void rowsQuery.refetch()}>
                      <RefreshCw className={`h-4 w-4 ${rowsQuery.isFetching ? 'animate-spin' : ''}`} />
                    </IconButton>
                    {activeInfoPanel === 'schema' && (
                      <section className="absolute left-0 top-full z-30 mt-2 w-[min(28rem,calc(100vw-5rem))] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3 shadow-xl">
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-[var(--text-primary)]"><span>{t('databaseExplorer.schema')}</span><IconButton onClick={() => setActiveInfoPanel(null)} aria-label={t('actions.close')} variant="ghost" size="icon-compact" className="text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></IconButton></div>
                        <div className="max-h-[48vh] divide-y divide-[var(--border-subtle)] overflow-y-auto">
                          {selectedTable.columns.map((column) => (
                            <div key={column.name} className="py-2 text-xs">
                              <div className="font-medium text-[var(--text-primary)]">{column.name} <span className="font-normal text-[var(--text-muted)]">{column.type}</span></div>
                              <SchemaBadges column={column} />
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                    {activeInfoPanel === 'organization' && (
                      <section className="absolute left-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-5rem))] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3 shadow-xl">
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-[var(--text-primary)]"><span>{t('databaseExplorer.organizationDistribution')}</span><IconButton onClick={() => setActiveInfoPanel(null)} aria-label={t('actions.close')} variant="ghost" size="icon-compact" className="text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></IconButton></div>
                        <div className="max-h-[48vh] space-y-1.5 overflow-y-auto text-xs">
                          {rowData?.organizationStats.length ? rowData.organizationStats.map((stat) => <div key={stat.id || stat.name} className="flex justify-between gap-3 rounded-md bg-[var(--surface-2)] px-2 py-1.5 text-[var(--text-secondary)]"><span className="truncate">{stat.name}</span><span className="font-medium text-[var(--text-primary)]">{stat.count}</span></div>) : <div className="text-[var(--text-muted)]">{t('databaseExplorer.noRows')}</div>}
                        </div>
                      </section>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_13rem]">
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                      <Input
                        value={search}
                        onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                        placeholder={t('databaseExplorer.search')}
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-2.5 pl-9 pr-10 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--interactive-soft-border)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                      />
                      {search && (
                        <IconButton onClick={() => { setSearch(''); setPage(1); }} aria-label={t('databaseExplorer.clearSearch')} variant="ghost" size="icon-compact" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]">
                          <X className="h-4 w-4" />
                        </IconButton>
                      )}
                    </label>
                    <Select
                      value={orgId}
                      disabled={!canFilterOrganizations}
                      onChange={(event) => { setOrgId(event.target.value); setPage(1); }}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={t('databaseExplorer.organization')}
                    >
                      <option value="">{canFilterOrganizations ? t('databaseExplorer.allOrganizations') : t('databaseExplorer.organization')}</option>
                      {(tablesQuery.data?.organizations || []).map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                    </Select>
                  </div>

                  {rowsQuery.error && <div className="system-data-banner system-data-banner-danger rounded-lg px-3 py-2 text-sm">{getApiErrorMessage(rowsQuery.error, t('databaseExplorer.loadError'))}</div>}

                  <div className="min-h-64 flex-1 overflow-auto overscroll-contain rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] lg:h-0 lg:min-h-0">
                    <table
                      className="table-fixed border-separate border-spacing-0 text-left text-sm"
                      style={{ minWidth: `${Math.max(760, displayColumns.length * 192)}px` }}
                    >
                      <thead className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--text-secondary)]">
                        <tr>
                          {displayColumns.map((column) => (
                            <th key={column.name} className="w-48 px-3 py-2.5 font-semibold">
                              <Button variant="ghost" size="sm" className="max-w-full items-baseline gap-1 truncate px-0 py-0 hover:text-[var(--text-primary)]" onClick={() => changeSort(column.name)}>
                                <span className="truncate">{column.name}</span><span className="shrink-0 text-[10px] font-normal text-[var(--text-muted)]">{column.type}</span>{sort === column.name ? (direction === 'asc' ? ' ↑' : ' ↓') : ''}
                              </Button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {rowsQuery.isLoading && <tr><td colSpan={Math.max(displayColumns.length, 1)} className="px-4 py-10 text-center text-[var(--text-muted)]"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
                        {!rowsQuery.isLoading && !rowData?.rows.length && <tr><td colSpan={Math.max(displayColumns.length, 1)} className="px-4 py-10 text-center text-[var(--text-muted)]">{t('databaseExplorer.noRows')}</td></tr>}
                        {rowData?.rows.map((row, index) => (
                          <tr key={String(row.values.id || index)} onClick={() => setSelectedRowIndex(index)} className={`cursor-pointer transition-colors hover:bg-[var(--interactive-soft)] ${selectedRowIndex === index ? 'bg-[var(--interactive-soft)]' : ''}`}>
                            {displayColumns.map((column) => {
                              const reference = row.references[column.name];
                              const value = row.values[column.name];
                              return (
                                <td key={column.name} className="w-48 max-w-48 px-3 py-2 align-top text-[var(--text-secondary)]">
                                  {reference ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(event) => { event.stopPropagation(); selectTable(reference.tableKey, reference.id); }}
                                      className="inline-flex max-w-full items-center gap-1 truncate rounded text-left text-[var(--interactive-text)] hover:underline"
                                      title={`${reference.tableKey}: ${reference.label}`}
                                    ><ExternalLink className="h-3.5 w-3.5 shrink-0" />{reference.label}</Button>
                                  ) : <div className="truncate" title={typeof value === 'string' ? value : undefined}>{renderValue(value, true)}</div>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-muted)]">{rowData ? t('databaseExplorer.page', { page: rowData.page, pages: rowData.pageCount }) : '—'}</span>
                    <div className="flex items-center gap-2">
                      <IconButton aria-label={t('databaseExplorer.previous')} variant="secondary" size="icon-compact" disabled={!rowData || rowData.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft /></IconButton>
                      <IconButton aria-label={t('databaseExplorer.next')} variant="secondary" size="icon-compact" disabled={!rowData || rowData.page >= rowData.pageCount} onClick={() => setPage((current) => current + 1)}><ChevronRight /></IconButton>
                    </div>
                  </div>

                </div>
              )}
            </section>
          </div>
        )}

        <Modal
          open={Boolean(selectedRow)}
          onClose={() => setSelectedRowIndex(null)}
          title={t('databaseExplorer.rowDetails')}
          maxWidth="lg"
          variant="information"
        >
          {selectedRow && (
            <div className="space-y-3">
              <div className="text-sm text-[var(--text-muted)]">{selectedTable?.key}</div>
              <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1">
                {Object.entries(selectedRow.values).map(([key, value]) => (
                  <div key={key} className="border-b border-[var(--border-subtle)] pb-3 last:border-0 last:pb-0">
                    <div className="mb-1 text-xs font-semibold text-[var(--text-muted)]">{key}</div>
                    <DetailValue value={value} />
                    {selectedRow.references[key] && (
                      <div className="mt-1.5 text-xs text-[var(--interactive-text)]">→ {selectedRow.references[key].tableKey}: {selectedRow.references[key].label}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
        <DatabaseRelationshipFlowModal
          open={isRelationshipMapOpen}
          onClose={() => setIsRelationshipMapOpen(false)}
          tables={tables}
          relations={tablesQuery.data?.relations || []}
        />
      </div>
    </Modal>
  );
}
