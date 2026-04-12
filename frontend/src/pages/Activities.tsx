import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/lib/useIsMobile';
import { useActivitiesPaged, type ActivitiesFilter } from '@/lib/activities';
import { useCategories, useCohorts, useTags } from '@/lib/taxonomy';
import type { Cohort } from '@/lib/taxonomy';
import { Download, Filter as FilterIcon, Plus, Search } from 'lucide-react';
// switched to xlsx-js-style inside the export handler to support cell styling
import { api } from '@/lib/api';
// basic location quick filter removed
import ProjectPickerModal from './ProjectPickerModal';
import ActivityQuickAdd from './CalendarQuickAddModal';
import { useProjects, type Project } from '@/lib/projects';
import {
  Pencil,
  X,
  XCircle,
  Tag as TagIcon,
  StickyNote,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
} from 'lucide-react';
import { useActivity } from '@/lib/activities';
import ActivitiesFilterDrawer from '@/components/ActivitiesFilterDrawer';
import Modal from '@/components/Modal';
import { colorForActivityType } from '@/lib/colors';
import { getBgClass } from '@/lib/colorPalette';
import ProtectedImage from '@/components/ProtectedImage';
import { useLocations } from '@/lib/locations';
import { usePublicConfig } from '@/lib/publicConfig';

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  open_door: 'Offene Tür',
  project_open: 'Projekt (offen)',
  project_closed: 'Projekt (geschlossen)',
  event: 'Veranstaltung',
  outreach: 'Aufsuchend',
};

function formatSelectedFilterBadge(
  label: string,
  selectedIds: string[] | undefined,
  nameById: Map<string, string>,
  maxVisible: number = 2,
) {
  if (!selectedIds?.length) return null;

  const names = Array.from(
    new Set(
      selectedIds
        .map((id) => nameById.get(id)?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  );

  if (!names.length) return `${label}: ${selectedIds.length}`;

  const visibleNames = names.slice(0, maxVisible);
  const remainingCount = names.length - visibleNames.length;
  return `${label}: ${visibleNames.join(', ')}${remainingCount > 0 ? ` +${remainingCount}` : ''}`;
}

function ActivitiesPaginationControls({
  page,
  pageCount,
  onPrevious,
  onNext,
  compact = false,
}: {
  page: number;
  pageCount: number;
  onPrevious: () => void;
  onNext: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
      <button
        className="bg-white border text-gray-700 px-2 py-1.5 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onPrevious}
        disabled={page <= 1}
        title="Vorherige Seite"
        aria-label="Vorherige Seite"
      >
        «
      </button>
      <span className={`${compact ? 'text-xs' : 'text-sm'} text-gray-700`}>
        {page} / {pageCount}
      </span>
      <button
        className="bg-white border text-gray-700 px-2 py-1.5 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onNext}
        disabled={page >= pageCount}
        title="Nächste Seite"
        aria-label="Nächste Seite"
      >
        »
      </button>
    </div>
  );
}

export default function Activities() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const isMobile = useIsMobile();
  const STORAGE_KEY = 'activities:advancedFilters:v1';
  const STORAGE_ORDER_KEY = 'activities:order:v1';
  // Basic filter UI removed; we keep only advanced filter state
  const [filterDrawer, setFilterDrawer] = useState(false);
  const [advanced, setAdvanced] = useState<ActivitiesFilter>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : undefined;
      return parsed && typeof parsed === 'object' ? (parsed as ActivitiesFilter) : {};
    } catch {
      return {};
    }
  });
  const [picker, setPicker] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [order, setOrder] = useState<'asc' | 'desc'>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_ORDER_KEY);
      return raw === 'asc' ? 'asc' : 'desc';
    } catch {
      return 'desc';
    }
  });
  const pageSize = 50;
  const [quickAdd, setQuickAdd] = useState<{ project: Project } | null>(null);
  const { data: cohorts = [] } = useCohorts({ active: true });
  const { data: categories = [] } = useCategories({ active: true });
  const { data: tags = [] } = useTags({ active: true });
  const { data: projects = [] } = useProjects();
  const { data: locations = [] } = useLocations({ active: true });
  const { data: publicConfig } = usePublicConfig();
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  // Persist filters across route/tab changes; reset only via the explicit reset button.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('activitiesFilters_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        advanced?: ActivitiesFilter;
        order?: 'asc' | 'desc';
        search?: string;
      };
      if (parsed?.advanced && typeof parsed.advanced === 'object') setAdvanced(parsed.advanced);
      if (parsed?.order === 'asc' || parsed?.order === 'desc') setOrder(parsed.order);
      if (typeof parsed?.search === 'string') {
        setSearchTerm(parsed.search);
        setSearchOpen(false);
      }
    } catch {
      /* ignore */
    }
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('activitiesFilters_v1', JSON.stringify({ advanced, order, search: searchTerm }));
    } catch {
      /* ignore */
    }
  }, [advanced, order, searchTerm]);
  const filters = {
    search: searchTerm.trim() || undefined,
    from: advanced.from,
    to: advanced.to,
    types: advanced.types,
    locationIds: advanced.locationIds,
    projectIds: advanced.projectIds,
    categoryIds: advanced.categoryIds,
    uncategorized: advanced.uncategorized,
    tagIds: advanced.tagIds,
    cohortIds: advanced.cohortIds,
    hasNotes: advanced.hasNotes,
    participantsMin: advanced.participantsMin,
    participantsMax: advanced.participantsMax,
    durationMin: advanced.durationMin,
    durationMax: advanced.durationMax,
    order,
  } as ActivitiesFilter;

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
    const dateParam = (params.get('date') || '').trim();
    const fromParam = (params.get('from') || '').trim();
    const toParam = (params.get('to') || '').trim();
    const nextFrom = isIsoDate(fromParam) ? fromParam : isIsoDate(dateParam) ? dateParam : '';
    const nextTo = isIsoDate(toParam) ? toParam : isIsoDate(dateParam) ? dateParam : '';
    if (!nextFrom && !nextTo) return;

    setAdvanced((current) => {
      const updated = {
        ...current,
        from: nextFrom || current.from,
        to: nextTo || current.to,
      };
      if (updated.from === current.from && updated.to === current.to) return current;
      return updated;
    });
    setPage(1);
  }, [params]);

  // Persist filters across navigation/tab switches (only reset when user explicitly clicks "Zurücksetzen")
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(advanced));
      localStorage.setItem(STORAGE_ORDER_KEY, order);
    } catch {
      /* ignore */
    }
  }, [advanced, order]);
  const {
    data: paged,
    isLoading: activitiesLoading,
    isFetching: activitiesFetching,
    isError: activitiesIsError,
    refetch: refetchActivities,
  } = useActivitiesPaged(filters, page, pageSize, {
    refetchOnWindowFocus: 'always',
    refetchIntervalMs: publicConfig?.liveRefreshIntervalMs,
  });
  // no quick location filter
  const activities = useMemo(() => paged?.data || [], [paged]);
  const total = paged?.total || 0;
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const [editId, setEditId] = useState<string | null>(null);
  const { data: editing } = useActivity(editId || undefined);
  const firstWords = (s?: string | null, n: number = 20) => {
    if (!s) return '';
    const words = s.trim().split(/\s+/).filter(Boolean);
    const part = words.slice(0, n).join(' ');
    return words.length > n ? part + '…' : part;
  };
  const formatFilterDate = (iso?: string) => {
    if (!iso) return '';
    const [year, month, day] = iso.split('-');
    if (!year || !month || !day) return iso;
    return `${day}.${month}.${year}`;
  };
  const rangeBadgeLabel = (() => {
    const from = formatFilterDate(advanced.from);
    const to = formatFilterDate(advanced.to);
    if (from && to) return from === to ? `Zeitraum: ${from}` : `Zeitraum: ${from} – ${to}`;
    if (from) return `Zeitraum: ab ${from}`;
    if (to) return `Zeitraum: bis ${to}`;
    return 'Zeitraum';
  })();
  const exportCount = total;
  const exportCountLabel = new Intl.NumberFormat('de-DE').format(exportCount);
  const exportItemLabel = exportCount === 1 ? 'Aktivität' : 'Aktivitäten';
  const typeNameById = useMemo(() => new Map(Object.entries(ACTIVITY_TYPE_LABELS)), []);
  const locationNameById = useMemo(
    () => new Map(locations.map((location) => [location.id, location.name] as const)),
    [locations],
  );
  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.title] as const)),
    [projects],
  );
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name] as const)),
    [categories],
  );
  const tagNameById = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag.name] as const)),
    [tags],
  );
  const cohortNameById = useMemo(
    () => new Map(cohorts.map((cohort) => [cohort.id, cohort.name] as const)),
    [cohorts],
  );
  const typesBadgeLabel = useMemo(
    () => formatSelectedFilterBadge('Typen', advanced.types, typeNameById),
    [advanced.types, typeNameById],
  );
  const locationsBadgeLabel = useMemo(
    () => formatSelectedFilterBadge('Einrichtungen', advanced.locationIds, locationNameById),
    [advanced.locationIds, locationNameById],
  );
  const projectsBadgeLabel = useMemo(
    () => formatSelectedFilterBadge('Projekte', advanced.projectIds, projectNameById),
    [advanced.projectIds, projectNameById],
  );
  const categoriesBadgeLabel = useMemo(
    () => formatSelectedFilterBadge('Kategorien', advanced.categoryIds, categoryNameById),
    [advanced.categoryIds, categoryNameById],
  );
  const tagsBadgeLabel = useMemo(
    () => formatSelectedFilterBadge('Tags', advanced.tagIds, tagNameById),
    [advanced.tagIds, tagNameById],
  );
  const cohortsBadgeLabel = useMemo(
    () => formatSelectedFilterBadge('Kohorten', advanced.cohortIds, cohortNameById),
    [advanced.cohortIds, cohortNameById],
  );
  const hasAdvancedFilters = useMemo(
    () => Object.values(advanced).some((value) => (Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '')),
    [advanced],
  );
  const goToPreviousPage = () => setPage((currentPage) => Math.max(currentPage - 1, 1));
  const goToNextPage = () => setPage((currentPage) => Math.min(currentPage + 1, pageCount));
  const handleExportConfirm = async () => {
    try {
      setExportModalOpen(false);
      setExporting(true);
      const qp: Record<string, unknown> = { ...filters };
      const arrayKeys: (keyof ActivitiesFilter)[] = [
        'types',
        'locationIds',
        'projectIds',
        'categoryIds',
        'tagIds',
        'cohortIds',
      ];
      for (const k of arrayKeys) {
        const v = (filters as ActivitiesFilter)[k];
        if (Array.isArray(v) && v.length) qp[k as string] = (v as string[]).join(',');
        else if (Array.isArray(v)) delete qp[k as string];
      }
      const res = await api.get('/activities', { params: qp });
      type ExportRow = {
        id: string;
        date: string;
        type: string;
        title?: string | null;
        project?: { title?: string | null; type?: string | null } | null;
        countTotal?: number | null;
        countMale?: number | null;
        countFemale?: number | null;
        countDiverse?: number | null;
        durationMinutes?: number | null;
        startTime?: string | null;
        endTime?: string | null;
        tags?: Array<{ name: string; color?: string | null }>;
        categories?: Array<{ name: string; color?: string | null }>;
        notes?: string | null;
        cohorts?: Array<{ cohortId: string; m: number; w: number; d: number }>;
      };
      const list: Array<ExportRow> = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];

      const cohortOrder = (cohorts as Cohort[])
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const cohortIds = cohortOrder.map((c) => c.id);
      const cohortHeaders = cohortOrder.flatMap((c) => [
        `${c.name} (m)`,
        `${c.name} (w)`,
        `${c.name} (d)`,
      ]);

      const header = [
        'Datum',
        'Typ',
        'Titel',
        'Projekt',
        'Teilnehmende',
        'm',
        'w',
        'd',
        ...cohortHeaders,
        'Dauer (min)',
        'Kategorien',
        'Tags',
        'Notizen',
      ];
      const rows = [header as (string | number)[]];
      const typeLabel: Record<string, string> = {
        open_door: 'Offene Tür',
        project_open: 'Projekt (offen)',
        project_closed: 'Projekt (geschlossen)',
        event: 'Veranstaltung',
        outreach: 'Aufsuchend',
      };
      const durFrom = (a: ExportRow) => {
        if (typeof a.durationMinutes === 'number' && a.durationMinutes >= 0) return a.durationMinutes;
        const toMinutes = (t?: string | null) => {
          if (!t) return undefined;
          const [hh, mm] = t.split(':').map((v) => parseInt(v, 10));
          if (Number.isNaN(hh) || Number.isNaN(mm)) return undefined;
          return hh * 60 + mm;
        };
        const s = toMinutes(a.startTime);
        const e = toMinutes(a.endTime);
        return s !== undefined && e !== undefined && e >= s ? e - s : undefined;
      };
      for (const a of list) {
        const s = (a.date || '').slice(0, 10);
        const [y, m, d] = s.split('-');
        const dateDE = `${d}.${m}.${y}`;
        const tlabel = typeLabel[a.type] || a.type;
        const total =
          (a.countTotal ?? (a.countMale || 0) + (a.countFemale || 0) + (a.countDiverse || 0)) || 0;
        const mcount = a.countMale || 0;
        const wcount = a.countFemale || 0;
        const dcount = a.countDiverse || 0;
        const perCoh: Record<string, { m: number; w: number; d: number }> = Object.fromEntries(
          cohortIds.map((id) => [id, { m: 0, w: 0, d: 0 }] as const),
        );
        (a.cohorts || []).forEach((c) => {
          perCoh[c.cohortId] = {
            m: (perCoh[c.cohortId]?.m || 0) + (c.m || 0),
            w: (perCoh[c.cohortId]?.w || 0) + (c.w || 0),
            d: (perCoh[c.cohortId]?.d || 0) + (c.d || 0),
          };
        });
        const duration = durFrom(a) ?? '';
        const catsText =
          a.project?.title && a.project?.type === 'open_door'
            ? ''
            : (a.categories || []).map((c) => c.name).join(', ');
        const tagsText = (a.tags || []).map((t) => t.name).join(', ');
        const row = [
          dateDE,
          tlabel,
          a.title || '',
          a.project?.title || '',
          total,
          mcount,
          wcount,
          dcount,
          ...cohortIds.flatMap((id) => {
            const entry = perCoh[id] || { m: 0, w: 0, d: 0 };
            return [entry.m, entry.w, entry.d];
          }),
          duration,
          catsText,
          tagsText,
          a.notes || '',
        ];
        rows.push(row);
      }
      const xlsx = await import('xlsx-js-style');
      const { utils, writeFile } = xlsx as unknown as typeof import('xlsx-js-style');
      type CellStyle = { font?: { bold?: boolean; color?: { rgb: string } } };
      const ws = utils.aoa_to_sheet(rows);
      (ws as unknown as { ['!autofilter']?: { ref: string } })['!autofilter'] = {
        ref: `A1:${utils.encode_col((rows[0]?.length || 1) - 1)}1`,
      };
      ws['!cols'] = (rows[0] || []).map((h, i) => ({
        wch: i <= 3 ? 18 : Math.max(10, String(h).length + 2),
      }));
      for (let c = 0; c < (rows[0]?.length || 0); c++) {
        const addr = utils.encode_cell({ r: 0, c });
        const cell = ws[addr] as unknown as { s?: CellStyle } | undefined;
        if (cell) cell.s = { ...(cell.s || {}), font: { ...(cell.s?.font || {}), bold: true } };
      }
      const typeCol = 1;
      const labelToCode: Record<string, string> = {
        'Offene Tür': 'open_door',
        'Projekt (offen)': 'project_open',
        'Projekt (geschlossen)': 'project_closed',
        Veranstaltung: 'event',
        Aufsuchend: 'outreach',
      };
      for (let r = 1; r < rows.length; r++) {
        const typeText = String(rows[r][typeCol] ?? '');
        const code = labelToCode[typeText];
        if (!code) continue;
        const hex = colorForActivityType(code);
        const rgb = 'FF' + hex.replace('#', '').toUpperCase();
        const addr = utils.encode_cell({ r, c: typeCol });
        const cell = ws[addr] as unknown as { s?: CellStyle } | undefined;
        if (cell) {
          cell.s = {
            ...(cell.s || {}),
            font: { ...(cell.s?.font || {}), color: { rgb } },
          };
        }
      }
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Aktivitäten');
      const fname = `Aktivitäten_${new Date().toISOString().slice(0, 10)}.xlsx`;
      writeFile(wb, fname);
    } finally {
      setExporting(false);
    }
  };
  const clearSearch = () => {
    setSearchTerm('');
    setSearchOpen(false);
    setPage(1);
  };
  return (
    <div>
      <div className="mb-6 mt-1 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <h2 className="text-3xl font-bold text-viridian">Aktivitäten</h2>
        <div className="flex justify-end mt-1">
          <div className="flex gap-2 flex-wrap justify-end">
            <div className="relative">
              {searchOpen && (
                <div className="absolute right-0 top-full mt-2 z-20 w-[min(18rem,calc(100vw-2.5rem))] max-w-[calc(100vw-2.5rem)] rounded-xl border border-gray-200 bg-white/95 p-2 shadow-xl backdrop-blur-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Titel / Projekt suchen"
                      className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-10 py-2 text-sm focus:border-viridian focus:outline-none focus:ring-2 focus:ring-viridian/30"
                      autoFocus
                    />
                    {searchTerm.trim() && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        aria-label="Suche löschen"
                        title="Suche löschen"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              <button
                className="inline-flex items-center justify-center rounded-lg bg-azure-web text-viridian hover:bg-mint-green transition-colors w-10 h-10"
                title={searchOpen ? 'Suche ausblenden' : 'Suche öffnen'}
                aria-label={searchOpen ? 'Suche ausblenden' : 'Suche öffnen'}
                onClick={() => setSearchOpen((open) => !open)}
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
            <button
            className="relative inline-flex md:hidden items-center justify-center rounded-lg bg-azure-web text-viridian hover:bg-mint-green transition-colors w-10 h-10 disabled:cursor-not-allowed disabled:opacity-60"
            title="Excel-Export"
            aria-label="Excel-Export"
            disabled={exporting || exportCount === 0}
            onClick={() => setExportModalOpen(true)}
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            className="hidden md:inline-flex items-center gap-2 rounded-lg bg-azure-web px-4 py-2 text-viridian hover:bg-mint-green transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            title="Excel-Export"
            aria-label="Excel-Export"
            disabled={exporting || exportCount === 0}
            onClick={() => setExportModalOpen(true)}
          >
            <Download className="h-5 w-5" />
          </button>
          {/* Mobile icon-only: Filter */}
          <button
            className="md:hidden inline-flex items-center justify-center rounded-full bg-azure-web text-viridian hover:bg-mint-green transition-colors w-10 h-10"
            onClick={() => setFilterDrawer(true)}
            title="Filter"
            aria-label="Filter"
          >
            <FilterIcon className="w-5 h-5" />
          </button>
          {/* Desktop: Filter text button */}
          <button
            className="hidden md:inline-flex items-center bg-azure-web text-viridian px-4 py-2 rounded-lg hover:bg-mint-green transition-colors"
            onClick={() => setFilterDrawer(true)}
          >
            Filter
          </button>
          {/* Mobile icon-only: New activity */}
          <button
            className="md:hidden inline-flex items-center justify-center rounded-full bg-viridian text-white hover:bg-cambridge-blue transition-colors w-10 h-10"
            onClick={() => {
              if (isMobile) navigate('/activities/new/select-project');
              else setPicker(true);
            }}
            title="Neue Aktivität"
            aria-label="Neue Aktivität"
          >
            <Plus className="w-5 h-5" />
          </button>
          {/* Desktop: New activity text button */}
          <button
            className="hidden md:inline-flex items-center bg-viridian text-white px-6 py-2 rounded-lg hover:bg-cambridge-blue transition-colors"
            onClick={() => setPicker(true)}
          >
            + Neue Aktivität
          </button>
          </div>
        </div>
      </div>

      {/* Nur noch: Knopf + compakte Anzeige aktiver Filter */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 bg-white/80 text-gray-700">
            {activitiesLoading ? 'Treffer werden geladen…' : `Treffer: ${exportCountLabel}`}
          </span>
          {searchTerm.trim() ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-azure-web text-viridian">
              <span>Suche: {searchTerm.trim()}</span>
              <button
                type="button"
                onClick={clearSearch}
                className="rounded-full text-viridian/80 hover:text-viridian"
                aria-label="Suche entfernen"
                title="Suche entfernen"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </span>
          ) : null}
          {advanced.from || advanced.to ? (
            <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{rangeBadgeLabel}</span>
          ) : null}
          {typesBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{typesBadgeLabel}</span> : null}
          {locationsBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{locationsBadgeLabel}</span> : null}
          {projectsBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{projectsBadgeLabel}</span> : null}
          {categoriesBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{categoriesBadgeLabel}</span> : null}
          {advanced.uncategorized ? (
            <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">
              Unkategorisiert
            </span>
          ) : null}
          {tagsBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{tagsBadgeLabel}</span> : null}
          {cohortsBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{cohortsBadgeLabel}</span> : null}
          {advanced.hasNotes ? (
            <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">
              Nur mit Notizen
            </span>
          ) : null}
          {(typeof advanced.participantsMin === 'number' ||
            typeof advanced.participantsMax === 'number') && (
            <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">
              Teilnehmende:{' '}
              {typeof advanced.participantsMin === 'number' &&
              typeof advanced.participantsMax === 'number'
                ? `${advanced.participantsMin}–${advanced.participantsMax}`
                : typeof advanced.participantsMin === 'number'
                  ? `≥ ${advanced.participantsMin}`
                  : `≤ ${advanced.participantsMax}`}
            </span>
          )}
          {(typeof advanced.durationMin === 'number' ||
            typeof advanced.durationMax === 'number') && (
            <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">
              Dauer:{' '}
              {typeof advanced.durationMin === 'number' && typeof advanced.durationMax === 'number'
                ? `${advanced.durationMin}–${advanced.durationMax} Min.`
                : typeof advanced.durationMin === 'number'
                  ? `≥ ${advanced.durationMin} Min.`
                  : `≤ ${advanced.durationMax} Min.`}
            </span>
          )}
          {hasAdvancedFilters && (
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-azure-web text-viridian hover:bg-cambridge-blue/20 transition-colors"
              title="Filter zurücksetzen"
              aria-label="Filter zurücksetzen"
              onClick={() => {
                setAdvanced({});
                setOrder('desc');
                clearSearch();
                setPage(1);
                try {
                  localStorage.removeItem(STORAGE_KEY);
                  localStorage.removeItem(STORAGE_ORDER_KEY);
                } catch {
                  /* ignore */
                }
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="hidden md:block">
            <ActivitiesPaginationControls
              page={page}
              pageCount={pageCount}
              onPrevious={goToPreviousPage}
              onNext={goToNextPage}
            />
          </div>
        </div>
      </div>

      {/* Activity List */}
      {/* Desktop Table */}
      <div className="bg-white rounded-lg shadow hidden md:block overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-azure-web">
            <tr>
              <th className="px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-viridian"
                  title="Nach Datum sortieren"
                  onClick={() => {
                    setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
                    setPage(1);
                  }}
                >
                  Datum
                  {order === 'desc' ? (
                    <ArrowDownWideNarrow className="w-4 h-4" />
                  ) : (
                    <ArrowUpNarrowWide className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700">Typ</th>
              <th className="px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                Titel / Projekt
              </th>
              <th className="px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                Teilnehmende
              </th>
              <th className="px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 hidden lg:table-cell">Dauer</th>
              <th className="px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 hidden xl:table-cell">
                Kategorien, Tags & Notizen
              </th>
              <th className="px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {activities.map((a) => (
              <tr key={a.id} className="bg-white hover:bg-azure-web">
                <td className="px-3 lg:px-6 py-4 text-sm whitespace-nowrap">
                  <span>
                    {(() => {
                      const s = (a.date || '').slice(0, 10);
                      const [y, m, d] = s.split('-');
                      return `${d}.${m}.${y}`;
                    })()}
                  </span>
                </td>
                <td className="px-3 lg:px-6 py-4 text-sm">
                  {(() => {
                    const label =
                      (
                        {
                          open_door: 'Offene Tür',
                          project_open: 'Projekt (offen)',
                          project_closed: 'Projekt (geschlossen)',
                          event: 'Veranstaltung',
                          outreach: 'Aufsuchend',
                        } as Record<string, string>
                      )[a.type] || a.type;
                    const typeBgClass: Record<string, string> = {
                      open_door: 'bg-emerald-700 text-white',
                      project_open: 'bg-viridian text-white',
                      project_closed: 'bg-slate-700 text-white',
                      event: 'bg-amber-700 text-white',
                      outreach: 'bg-red-700 text-white',
                    };
                    const cls = typeBgClass[a.type] || 'bg-gray-700 text-white';
                    return (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium tracking-tight border border-black/10 ${cls}`}
                      >
                        <span className="hidden lg:inline">{label}</span>
                        <span className="lg:hidden" title={label}>{label.split(' ')[0]}</span>
                      </span>
                    );
                  })()}
                </td>
                <td className="px-3 lg:px-6 py-4 text-sm max-w-[150px] lg:max-w-none">
                  <div className="font-medium text-gray-900 truncate">{a.title || '-'}</div>
                  <div className="text-xs text-gray-600 truncate">{a.project?.title || '-'}</div>
                </td>
                <td className="px-3 lg:px-6 py-4 text-sm whitespace-nowrap">
                  <span className="font-medium">{a.countTotal ?? 0}</span>
                  <span className="text-gray-500 text-xs ml-1 hidden lg:inline">
                    (m:{a.countMale ?? 0}, w:{a.countFemale ?? 0}, d:{a.countDiverse ?? 0})
                  </span>
                </td>
                <td className="px-3 lg:px-6 py-4 text-sm hidden lg:table-cell">
                  {(() => {
                    if (a.durationMinutes) return `${a.durationMinutes} min`;
                    const parse = (t?: string | null) => {
                      if (!t) return undefined;
                      const [h, m] = t.split(':').map((v) => parseInt(v, 10));
                      if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
                      return h * 60 + m;
                    };
                    const s = parse(a.startTime);
                    const e = parse(a.endTime);
                    if (s !== undefined && e !== undefined && e >= s) return `${e - s} min`;
                    return '-';
                  })()}
                </td>
                <td className="px-3 lg:px-6 py-4 text-sm hidden xl:table-cell">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(a.categories || []).map((c) => (
                      <span
                        key={c.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white ${getBgClass(
                          c.color as string,
                          'bg-slate-400',
                        )}`}
                        title={c.name}
                      >
                        {c.name}
                      </span>
                    ))}
                    {(a.tags || []).map((t) => (
                      <span
                        key={t.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white ${getBgClass(
                          t.color as string,
                          'bg-slate-500',
                        )}`}
                        title={t.name}
                      >
                        <TagIcon className="w-3 h-3" /> {t.name}
                      </span>
                    ))}
                    {(a.tags || []).length === 0 && (a.categories || []).length === 0 && (
                      <span className="text-xs text-gray-400">–</span>
                    )}
                  </div>
                  {a.notes && (
                    <div
                      className="text-xs text-gray-600 flex items-start gap-1"
                      title={a.notes || undefined}
                    >
                      <StickyNote className="w-3.5 h-3.5 mt-[2px] text-gray-500" />
                      <span>{firstWords(a.notes, 20)}</span>
                    </div>
                  )}
                </td>
                <td className="px-3 lg:px-6 py-4 text-sm relative overflow-hidden">
                  {a.project?.imageUrl ? (
                    <>
                      <ProtectedImage
                        src={a.project.imageUrl || undefined}
                        alt=""
                        aria-hidden
                        className="absolute inset-0 w-full h-full object-cover object-right opacity-70"
                      />
                      <div
                        className="absolute inset-0 bg-gradient-to-l from-transparent via-white/60 to-white"
                        aria-hidden
                      />
                    </>
                  ) : a.project?.color ? (
                    <>
                      <div
                        className="absolute inset-0 opacity-30"
                        style={{ backgroundColor: a.project.color || undefined }}
                        aria-hidden
                      />
                      <div
                        className="absolute inset-0 bg-gradient-to-l from-transparent via-white/70 to-white"
                        aria-hidden
                      />
                    </>
                  ) : null}
                  <button
                    onClick={() => setEditId(a.id)}
                    className="relative z-10 inline-flex items-center justify-center rounded-full bg-white border p-2 text-viridian hover:bg-azure-web"
                    title="Bearbeiten"
                    aria-label="Bearbeiten"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {activities.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 lg:px-6 py-6 text-center text-gray-500 text-sm">
                  Keine Aktivitäten im Zeitraum.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination Controls */}
      <div className="mt-4 mb-4 md:mb-0 flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          {total > 0 ? `Seite ${page} von ${pageCount} · ${total} Einträge` : 'Keine Einträge'}
        </div>
        <ActivitiesPaginationControls
          page={page}
          pageCount={pageCount}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
          compact={isMobile}
        />
      </div>

      {activitiesIsError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>
            Aktivitäten konnten nicht geladen werden. Bitte erneut versuchen.
          </span>
          <button
            type="button"
            className="shrink-0 rounded-md border border-red-300 bg-white px-3 py-1.5 text-red-700 hover:bg-red-100"
            onClick={() => {
              void refetchActivities();
            }}
          >
            Erneut laden
          </button>
        </div>
      )}

      {/* Mobile Cards */}
      <div className="relative min-h-[12rem] pt-2 md:hidden">
        <div className="space-y-3">
          {activities.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-lg shadow p-4 cursor-pointer hover:bg-azure-web/50 focus:outline-none focus:ring-2 focus:ring-viridian/40 relative overflow-hidden"
              role="button"
              tabIndex={0}
              aria-label="Aktivität öffnen"
              onClick={() => {
                if (isMobile)
                  navigate(`/activities/${a.id}`, {
                    state: { from: `${location.pathname}${location.search}` },
                  });
                else setEditId(a.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (isMobile)
                    navigate(`/activities/${a.id}`, {
                      state: { from: `${location.pathname}${location.search}` },
                    });
                  else setEditId(a.id);
                }
              }}
            >
              {a.project?.imageUrl ? (
                <>
                  <ProtectedImage
                    src={a.project.imageUrl || undefined}
                    alt=""
                    aria-hidden
                    className="absolute inset-y-0 right-0 w-28 h-full object-cover opacity-70"
                  />
                  <div
                    className="absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-transparent via-white/60 to-white"
                    aria-hidden
                  />
                </>
              ) : a.project?.color ? (
                <>
                  <div
                    className="absolute inset-y-0 right-0 w-28 opacity-40"
                    style={{ backgroundColor: a.project.color || undefined }}
                    aria-hidden
                  />
                  <div
                    className="absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-transparent via-white/70 to-white"
                    aria-hidden
                  />
                </>
              ) : null}
              <div className="relative z-10 flex justify-between items-start mb-2">
                <div>
                  <div className="text-sm text-gray-500">
                    {(() => {
                      const s = (a.date || '').slice(0, 10);
                      const [y, m, d] = s.split('-');
                      return `${d}.${m}.${y}`;
                    })()}
                  </div>
                  <div className="font-semibold text-viridian">
                    {(
                      {
                        open_door: 'Offene Tür',
                        project_open: 'Projekt (offen)',
                        project_closed: 'Projekt (geschlossen)',
                        event: 'Veranstaltung',
                        outreach: 'Aufsuchend',
                      } as Record<string, string>
                    )[a.type] || a.type}
                  </div>
                </div>
                {(() => {
                  const duration =
                    a.durationMinutes ??
                    (() => {
                      const parse = (t?: string | null) => {
                        if (!t) return undefined;
                        const [h, m] = t.split(':').map((v) => parseInt(v, 10));
                        if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
                        return h * 60 + m;
                      };
                      const s = parse(a.startTime);
                      const e = parse(a.endTime);
                      return s !== undefined && e !== undefined && e >= s ? e - s : undefined;
                    })();
                  return duration ? (
                    <span className="text-xs px-2 py-1 bg-viridian text-white rounded">
                      {duration} min
                    </span>
                  ) : null;
                })()}
              </div>
              <div className="relative z-10 text-sm text-gray-600 mb-1">{a.title || '-'}</div>
              <div className="relative z-10 text-xs text-gray-500 mb-3">
                {a.project?.title || '-'}
              </div>
              <div className="relative z-10 text-xs text-gray-600 mb-2">
                {(() => {
                  const m = a.countMale || 0;
                  const w = a.countFemale || 0;
                  const d = a.countDiverse || 0;
                  const total = (a.countTotal ?? m + w + d) || 0;
                  return (
                    <>
                      Teilnehmende: {total} (m:{m}, w:{w}, d:{d})
                    </>
                  );
                })()}
              </div>
              <div className="relative z-10 flex flex-wrap gap-1.5 mb-2">
                {(a.categories || []).map((c) => (
                  <span
                    key={c.id}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-white ${getBgClass(
                      c.color as string,
                      'bg-slate-400',
                    )}`}
                    title={c.name}
                  >
                    {c.name}
                  </span>
                ))}
                {(a.tags || []).map((t) => (
                  <span
                    key={t.id}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-white ${getBgClass(
                      t.color as string,
                      'bg-slate-500',
                    )}`}
                    title={t.name}
                  >
                    <TagIcon className="w-3 h-3" /> {t.name}
                  </span>
                ))}
              </div>
              {a.notes && (
                <div className="relative z-10 text-[12px] text-gray-600 flex items-start gap-1 mb-2">
                  <StickyNote className="w-3.5 h-3.5 mt-[2px] text-gray-500" />
                  <span>{firstWords(a.notes, 20)}</span>
                </div>
              )}
              {/* Mobile actions intentionally hidden; tap card to edit */}
            </div>
          ))}
          {activities.length === 0 && !activitiesLoading && !activitiesFetching && (
            <div className="text-gray-500 py-6 text-center">Keine Aktivitäten im Zeitraum.</div>
          )}
        </div>
        {(activitiesLoading || activitiesFetching) && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-white/45 pt-8">
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3 py-2 shadow-sm">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-viridian/25 border-t-viridian" aria-hidden />
              <span className="text-sm text-gray-600">Lädt…</span>
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 md:hidden">
        <div className="text-sm text-gray-600">
          {total > 0 ? `Seite ${page} von ${pageCount} · ${total} Einträge` : 'Keine Einträge'}
        </div>
        <ActivitiesPaginationControls
          page={page}
          pageCount={pageCount}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
          compact
        />
      </div>
      {picker && (
        <ProjectPickerModal
          onPick={(p) => {
            setPicker(false);
            setQuickAdd({ project: p });
          }}
          onClose={() => setPicker(false)}
        />
      )}
      {quickAdd && (
        <ActivityQuickAdd
          dateISO={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(
            2,
            '0',
          )}-${String(new Date().getDate()).padStart(2, '0')}`}
          onClose={() => setQuickAdd(null)}
          project={quickAdd.project}
        />
      )}
      {editId && editing && (
        <ActivityQuickAdd
          dateISO={editing.date}
          onClose={() => setEditId(null)}
          project={editing.project ?? undefined}
          activity={editing}
        />
      )}
      <Modal
        open={exportModalOpen}
        onClose={() => {
          if (!exporting) setExportModalOpen(false);
        }}
        title="Excel-Export"
        maxWidth="md"
      >
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            Es werden <span className="font-semibold text-viridian">{exportCountLabel}</span>{' '}
            {exportItemLabel} mit den aktuell gesetzten Filtern exportiert.
          </p>
          <p className="text-gray-600">
            Der Export erstellt eine Excel-Datei mit allen passenden Einträgen inklusive
            Teilnehmenden, Kategorien, Tags und Notizen.
          </p>
          <p className="font-medium text-gray-900">Soll der Export jetzt gestartet werden?</p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setExportModalOpen(false)}
              disabled={exporting}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="rounded-lg bg-viridian px-4 py-2 text-white hover:bg-cambridge-blue disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleExportConfirm}
              disabled={exporting || exportCount === 0}
            >
              {exporting ? 'Exportiere…' : 'OK'}
            </button>
          </div>
        </div>
      </Modal>
      <ActivitiesFilterDrawer
        open={filterDrawer}
        initial={advanced}
        onClose={() => setFilterDrawer(false)}
        onApply={(f) => {
          setAdvanced(f);
                setOrder('desc');
                try {
                  localStorage.removeItem('activitiesFilters_v1');
                } catch {
                  /* ignore */
                }
          setFilterDrawer(false);
        }}
      />
    </div>
  );
}
