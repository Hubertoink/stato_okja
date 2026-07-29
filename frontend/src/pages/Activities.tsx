import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/lib/useIsMobile';
import { fetchAllActivities, useActivitiesPaged, type ActivitiesFilter } from '@/lib/activities';
import { fetchAllLogbookEntries, type LogbookEntry } from '@/lib/logbook';
import ActivityExecutionStatusBadge from '@/components/ActivityExecutionStatusBadge';
import { useCategories, useCohorts, useTags } from '@/lib/taxonomy';
import type { Cohort } from '@/lib/taxonomy';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
// switched to xlsx-js-style inside the export handler to support cell styling
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
import ExportProgressModal from '@/components/ExportProgressModal';
import { colorForActivityType } from '@/lib/colors';
import { getBadgeBackgroundColor } from '@/lib/colorPalette';
import ProtectedImage from '@/components/ProtectedImage';
import { useLocations } from '@/lib/locations';
import { usePublicConfig } from '@/lib/publicConfig';
import { useStaff } from '@/lib/staff';
import {
  ACTIVITY_EXECUTION_STATUS_LABELS,
  formatActivityExecutionStatusList,
  isCancelledActivity,
} from '@/lib/activityExecutionStatus';
import DemoHoverHint from '@/demo/DemoHoverHint';
import {
  clearActivitiesFilters,
  loadActivitiesFilters,
  saveActivitiesFilters,
} from '@/lib/activitiesFilterStorage';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';

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

function formatActivityDate(date?: string | null) {
  const iso = (date || '').slice(0, 10);
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

function toLocalIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function ActivitiesPaginationControls({
  page,
  pageCount,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  compact = false,
}: {
  page: number;
  pageCount: number;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
      <button
        className="bg-white border border-gray-300 text-gray-700 px-2 py-1.5 rounded text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
        onClick={onFirst}
        disabled={page <= 1}
        title="Erste Seite"
        aria-label="Erste Seite"
      >
        <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        className="bg-white border border-gray-300 text-gray-700 px-2 py-1.5 rounded text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
        onClick={onPrevious}
        disabled={page <= 1}
        title="Vorherige Seite"
        aria-label="Vorherige Seite"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className={`${compact ? 'text-xs' : 'text-sm'} text-gray-700`}>
        {page} / {pageCount}
      </span>
      <button
        className="bg-white border border-gray-300 text-gray-700 px-2 py-1.5 rounded text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
        onClick={onNext}
        disabled={page >= pageCount}
        title="Nächste Seite"
        aria-label="Nächste Seite"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        className="bg-white border border-gray-300 text-gray-700 px-2 py-1.5 rounded text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
        onClick={onLast}
        disabled={page >= pageCount}
        title="Letzte Seite"
        aria-label="Letzte Seite"
      >
        <ChevronsRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function Activities() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const isMobile = useIsMobile();
  const [initialActivitiesFilters] = useState(loadActivitiesFilters);
  // Basic filter UI removed; we keep only advanced filter state
  const [filterDrawer, setFilterDrawer] = useState(false);
  const [advanced, setAdvanced] = useState<ActivitiesFilter>(() => initialActivitiesFilters.advanced);
  const [picker, setPicker] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(initialActivitiesFilters.search);
  const [order, setOrder] = useState<'asc' | 'desc'>(() => initialActivitiesFilters.order);
  const pageSize = 50;
  const [quickAdd, setQuickAdd] = useState<{ project: Project } | null>(null);
  const { data: cohorts = [] } = useCohorts({ active: true });
  const { data: categories = [] } = useCategories({ active: true });
  const { data: tags = [] } = useTags({ active: true });
  const { data: projects = [] } = useProjects();
  const { data: locations = [] } = useLocations({ active: true });
  const { data: staff = [] } = useStaff({ active: true });
  const { data: publicConfig } = usePublicConfig();
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const todayIso = toLocalIsoDate(new Date());
  useEffect(() => {
    saveActivitiesFilters({ advanced, order, search: searchTerm });
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
    staffIds: advanced.staffIds,
    cohortIds: advanced.cohortIds,
    executionStatuses: advanced.executionStatuses,
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

  useEffect(() => {
    const projectParam = (params.get('projectId') || '').trim();
    if (!projectParam) return;

    setAdvanced((current) => {
      const unchanged =
        Array.isArray(current.projectIds) &&
        current.projectIds.length === 1 &&
        current.projectIds[0] === projectParam &&
        !current.from &&
        !current.to &&
        !current.types?.length &&
        !current.locationIds?.length &&
        !current.categoryIds?.length &&
        !current.uncategorized &&
        !current.tagIds?.length &&
        !current.staffIds?.length &&
        !current.cohortIds?.length &&
        !current.hasNotes &&
        !current.participantsMin &&
        !current.participantsMax &&
        !current.durationMin &&
        !current.durationMax;

      if (unchanged) return current;
      return { projectIds: [projectParam] };
    });
    setSearchTerm('');
    setSearchOpen(false);
    setPage(1);
  }, [params]);

  const {
    data: paged,
    isLoading: activitiesLoading,
    isFetching: activitiesFetching,
    isError: activitiesIsError,
    refetch: refetchActivities,
  } = useActivitiesPaged(filters, page, pageSize, {
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchIntervalMs: publicConfig?.liveRefreshIntervalMs,
    staleTimeMs: publicConfig?.liveRefreshIntervalMs ?? 0,
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
  const staffNameById = useMemo(
    () => new Map(staff.map((member) => [member.id, member.name] as const)),
    [staff],
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
  const staffBadgeLabel = useMemo(
    () => formatSelectedFilterBadge('Mitarbeitende', advanced.staffIds, staffNameById),
    [advanced.staffIds, staffNameById],
  );
  const cohortsBadgeLabel = useMemo(
    () => formatSelectedFilterBadge('Kohorten', advanced.cohortIds, cohortNameById),
    [advanced.cohortIds, cohortNameById],
  );
  const executionStatusBadgeLabel = useMemo(() => {
    if (!advanced.executionStatuses?.length) return null;
    return `Status: ${formatActivityExecutionStatusList(advanced.executionStatuses)}`;
  }, [advanced.executionStatuses]);
  const hasAdvancedFilters = useMemo(
    () => Object.values(advanced).some((value) => (Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '')),
    [advanced],
  );
  const goToFirstPage = () => setPage(1);
  const goToPreviousPage = () => setPage((currentPage) => Math.max(currentPage - 1, 1));
  const goToNextPage = () => setPage((currentPage) => Math.min(currentPage + 1, pageCount));
  const goToLastPage = () => setPage(pageCount);
  type ExportRow = {
    id: string;
    projectId?: string | null;
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
    executionStatus?: 'completed' | 'cancelled' | null;
    cohorts?: Array<{ cohortId: string; m: number; w: number; d: number }>;
  };
  const loadExportRows = async () => {
    const rows = await fetchAllActivities(filters);
    return rows as Array<ExportRow>;
  };
  const buildExportSheet = (list: ExportRow[]) => {
    const cohortOrder = (cohorts as Cohort[])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const cohortIds = cohortOrder.map((cohort) => cohort.id);
    const cohortHeaders = cohortOrder.flatMap((cohort) => [
      `${cohort.name} (m)`,
      `${cohort.name} (w)`,
      `${cohort.name} (d)`,
    ]);
    const header = [
      'Datum',
      'Status',
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
    const durationFrom = (activity: ExportRow) => {
      if (typeof activity.durationMinutes === 'number' && activity.durationMinutes >= 0) {
        return activity.durationMinutes;
      }
      const toMinutes = (time?: string | null) => {
        if (!time) return undefined;
        const [hours, minutes] = time.split(':').map((value) => parseInt(value, 10));
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;
        return hours * 60 + minutes;
      };
      const start = toMinutes(activity.startTime);
      const end = toMinutes(activity.endTime);
      return start !== undefined && end !== undefined && end >= start ? end - start : undefined;
    };

    for (const activity of list) {
      const dateIso = (activity.date || '').slice(0, 10);
      const [year, month, day] = dateIso.split('-');
      const dateDE = `${day}.${month}.${year}`;
      const total =
        (activity.countTotal ??
          (activity.countMale || 0) + (activity.countFemale || 0) + (activity.countDiverse || 0)) || 0;
      const perCohort: Record<string, { m: number; w: number; d: number }> = Object.fromEntries(
        cohortIds.map((id) => [id, { m: 0, w: 0, d: 0 }] as const),
      );
      (activity.cohorts || []).forEach((cohort) => {
        perCohort[cohort.cohortId] = {
          m: (perCohort[cohort.cohortId]?.m || 0) + (cohort.m || 0),
          w: (perCohort[cohort.cohortId]?.w || 0) + (cohort.w || 0),
          d: (perCohort[cohort.cohortId]?.d || 0) + (cohort.d || 0),
        };
      });

      rows.push([
        dateDE,
        ACTIVITY_EXECUTION_STATUS_LABELS[
          activity.executionStatus === 'cancelled' ? 'cancelled' : 'completed'
        ],
        ACTIVITY_TYPE_LABELS[activity.type] || activity.type,
        activity.title || '',
        activity.project?.title || '',
        total,
        activity.countMale || 0,
        activity.countFemale || 0,
        activity.countDiverse || 0,
        ...cohortIds.flatMap((id) => {
          const cohort = perCohort[id] || { m: 0, w: 0, d: 0 };
          return [cohort.m, cohort.w, cohort.d];
        }),
        durationFrom(activity) ?? '',
        activity.project?.title && activity.project?.type === 'open_door'
          ? ''
          : (activity.categories || []).map((category) => category.name).join(', '),
        (activity.tags || []).map((tag) => tag.name).join(', '),
        activity.notes || '',
      ]);
    }

    const durationCol = 9 + cohortHeaders.length;
    return {
      rows,
      statusCol: 1,
      typeCol: 2,
      firstNumberCol: 5,
      durationCol,
      categoriesCol: durationCol + 1,
      tagsCol: durationCol + 2,
      notesCol: durationCol + 3,
    };
  };
  const handleExportConfirm = async (variant: 'raw' | 'styled') => {
    try {
      setExportModalOpen(false);
      setExporting(true);
      setExportProgress('Aktivitäten werden geladen …');
      const list = await loadExportRows();
      setExportProgress('Excel-Datei wird vorbereitet …');
      await new Promise(requestAnimationFrame);
      const { rows, statusCol, typeCol, firstNumberCol, durationCol, categoriesCol, tagsCol, notesCol } =
        buildExportSheet(list);

      const xlsx = await import('xlsx-js-style');
      const { utils, writeFile } = xlsx as unknown as typeof import('xlsx-js-style');
      type CellStyle = {
        font?: { bold?: boolean; color?: { rgb: string } };
        fill?: { patternType: 'solid'; fgColor: { rgb: string } };
        alignment?: { horizontal?: 'left' | 'center'; vertical?: 'top' | 'center'; wrapText?: boolean };
      };
      const ws = utils.aoa_to_sheet(rows);
      (ws as unknown as { ['!autofilter']?: { ref: string } })['!autofilter'] = {
        ref: `A1:${utils.encode_col((rows[0]?.length || 1) - 1)}1`,
      };
      ws['!cols'] = (rows[0] || []).map((header, index) => {
        if (index === 0) return { wch: 14 };
        if (index === statusCol) return { wch: 16 };
        if (index === typeCol) return { wch: 22 };
        if (index === 3 || index === 4) return { wch: 28 };
        if (index === categoriesCol || index === tagsCol) return { wch: 30 };
        if (index === notesCol) return { wch: 42 };
        return { wch: Math.max(10, String(header).length + 2) };
      });

      if (variant === 'styled') {
        const setStyle = (rowIndex: number, colIndex: number, style: CellStyle) => {
          const address = utils.encode_cell({ r: rowIndex, c: colIndex });
          const cell = ws[address] as unknown as { s?: CellStyle } | undefined;
          if (!cell) return;
          cell.s = {
            ...(cell.s || {}),
            ...style,
            font: { ...(cell.s?.font || {}), ...(style.font || {}) },
            fill: style.fill || cell.s?.fill,
            alignment: { ...(cell.s?.alignment || {}), ...(style.alignment || {}) },
          };
        };

        const brandHeaderFill = 'FF5B6CFF';
        const brandSoftFill = 'FFF5F7FF';
        const brandSoftStrongFill = 'FFE8EBFF';
        const successFill = 'FFEAF7EE';
        const successText = 'FF027A48';
        const cancelledFill = 'FFFDECEC';
        const cancelledText = 'FFB42318';
        const notesFill = 'FFF8FAFC';

        for (let column = 0; column < (rows[0]?.length || 0); column++) {
          setStyle(0, column, {
            font: { bold: true, color: { rgb: 'FFFFFFFF' } },
            fill: { patternType: 'solid', fgColor: { rgb: brandHeaderFill } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          });
        }

        const labelToCode: Record<string, string> = {
          'Offene Tür': 'open_door',
          'Projekt (offen)': 'project_open',
          'Projekt (geschlossen)': 'project_closed',
          Veranstaltung: 'event',
          Aufsuchend: 'outreach',
        };

        for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
          setStyle(rowIndex, 0, { alignment: { horizontal: 'center', vertical: 'center' } });
          setStyle(rowIndex, statusCol, {
            font:
              String(rows[rowIndex][statusCol] ?? '') === 'Ausgefallen'
                ? { bold: true, color: { rgb: cancelledText } }
                : { bold: true, color: { rgb: successText } },
            fill: {
              patternType: 'solid',
              fgColor: {
                rgb:
                  String(rows[rowIndex][statusCol] ?? '') === 'Ausgefallen'
                    ? cancelledFill
                    : successFill,
              },
            },
            alignment: { horizontal: 'center', vertical: 'center' },
          });

          const typeText = String(rows[rowIndex][typeCol] ?? '');
          const typeCode = labelToCode[typeText];
          if (typeCode) {
            const typeRgb = `FF${colorForActivityType(typeCode).replace('#', '').toUpperCase()}`;
            setStyle(rowIndex, typeCol, {
              font: { bold: true, color: { rgb: 'FFFFFFFF' } },
              fill: { patternType: 'solid', fgColor: { rgb: typeRgb } },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            });
          }

          for (let column = firstNumberCol; column <= durationCol; column++) {
            setStyle(rowIndex, column, {
              alignment: { horizontal: 'center', vertical: 'center' },
            });
          }

          if (rows[rowIndex][categoriesCol]) {
            setStyle(rowIndex, categoriesCol, {
              fill: { patternType: 'solid', fgColor: { rgb: brandSoftFill } },
              alignment: { vertical: 'top', wrapText: true },
            });
          }
          if (rows[rowIndex][tagsCol]) {
            setStyle(rowIndex, tagsCol, {
              fill: { patternType: 'solid', fgColor: { rgb: brandSoftStrongFill } },
              alignment: { vertical: 'top', wrapText: true },
            });
          }
          if (rows[rowIndex][notesCol]) {
            setStyle(rowIndex, notesCol, {
              fill: { patternType: 'solid', fgColor: { rgb: notesFill } },
              alignment: { vertical: 'top', wrapText: true },
            });
          }
        }
      }

      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Aktivitäten');

      if (variant === 'styled') {
        setExportProgress('Projekt-KPIs werden zusammengestellt …');
        const durationFrom = (activity: ExportRow) => {
          if (typeof activity.durationMinutes === 'number' && activity.durationMinutes >= 0) return activity.durationMinutes;
          const parseTime = (time?: string | null) => {
            if (!time) return undefined;
            const [hours, minutes] = time.split(':').map(Number);
            return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : undefined;
          };
          const start = parseTime(activity.startTime);
          const end = parseTime(activity.endTime);
          return start !== undefined && end !== undefined && end >= start ? end - start : undefined;
        };
        const styleHeader = (sheet: typeof ws, widthCount: number) => {
          for (let column = 0; column < widthCount; column++) {
            const cell = sheet[utils.encode_cell({ r: 0, c: column })] as unknown as { s?: CellStyle } | undefined;
            if (cell) cell.s = { font: { bold: true, color: { rgb: 'FFFFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FF5B6CFF' } }, alignment: { vertical: 'center', wrapText: true } };
          }
        };
        const usedSheetNames = new Set<string>(['Aktivitäten']);
        const uniqueSheetName = (value: string) => {
          const base = (value.replace(/[\\/?*[\]:]/g, ' ').trim() || 'Projekt').slice(0, 31);
          let name = base;
          let suffix = 2;
          while (usedSheetNames.has(name)) {
            name = `${base.slice(0, Math.max(1, 31 - String(suffix).length - 1))} ${suffix}`;
            suffix += 1;
          }
          usedSheetNames.add(name);
          return name;
        };
        const projectsById = new Map(projects.map((project) => [project.id, project]));
        const activitiesByProject = new Map<string, ExportRow[]>();
        for (const activity of list) {
          if (!activity.projectId) continue;
          const grouped = activitiesByProject.get(activity.projectId) || [];
          grouped.push(activity);
          activitiesByProject.set(activity.projectId, grouped);
        }
        for (const [projectId, projectActivities] of activitiesByProject) {
          const participantTotals = projectActivities.map((activity) => (activity.countTotal ?? ((activity.countMale || 0) + (activity.countFemale || 0) + (activity.countDiverse || 0))) || 0);
          const totalParticipants = participantTotals.reduce((sum, value) => sum + value, 0);
          const totalMale = projectActivities.reduce((sum, activity) => sum + (activity.countMale || 0), 0);
          const totalFemale = projectActivities.reduce((sum, activity) => sum + (activity.countFemale || 0), 0);
          const totalDiverse = projectActivities.reduce((sum, activity) => sum + (activity.countDiverse || 0), 0);
          const durations = projectActivities.map(durationFrom).filter((value): value is number => typeof value === 'number');
          const project = projectsById.get(projectId);
          const ratio = totalParticipants > 0
            ? `${Math.round((totalMale / totalParticipants) * 100)} % m · ${Math.round((totalFemale / totalParticipants) * 100)} % w · ${Math.round((totalDiverse / totalParticipants) * 100)} % d`
            : 'Keine Teilnehmendendaten';
          const projectRows: Array<Array<string | number>> = [
            ['Projekt-KPI', 'Wert'],
            ['Projekt', project?.title || projectActivities[0]?.project?.title || 'Unbenanntes Projekt'],
            ['Zeitraum', rangeBadgeLabel],
            ['Aktivitäten', projectActivities.length],
            ['Teilnehmende gesamt', totalParticipants],
            ['Ø Besucher*innen', projectActivities.length ? Math.round((totalParticipants / projectActivities.length) * 10) / 10 : 0],
            ['Geschlechterverhältnis', ratio],
            ['Ø Dauer (min)', durations.length ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10 : '–'],
            [],
            ['Datum', 'Typ', 'Titel', 'Teilnehmende', 'm', 'w', 'd', 'Dauer (min)'],
            ...projectActivities.map((activity) => [
              (activity.date || '').slice(0, 10),
              ACTIVITY_TYPE_LABELS[activity.type] || activity.type,
              activity.title || '',
              (activity.countTotal ?? ((activity.countMale || 0) + (activity.countFemale || 0) + (activity.countDiverse || 0))) || 0,
              activity.countMale || 0,
              activity.countFemale || 0,
              activity.countDiverse || 0,
              durationFrom(activity) ?? '',
            ]),
          ];
          const projectSheet = utils.aoa_to_sheet(projectRows);
          styleHeader(projectSheet, 2);
          for (let column = 0; column < 8; column++) {
            const cell = projectSheet[utils.encode_cell({ r: 9, c: column })] as unknown as { s?: CellStyle } | undefined;
            if (cell) cell.s = { font: { bold: true, color: { rgb: 'FFFFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FF5B6CFF' } } };
          }
          projectSheet['!cols'] = [{ wch: 20 }, { wch: 26 }, { wch: 30 }, { wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 14 }];
          utils.book_append_sheet(wb, projectSheet, uniqueSheetName(project?.title || projectActivities[0]?.project?.title || 'Projekt'));
        }

        setExportProgress('Logbuch wird ergänzt …');
        const projectFilter = advanced.projectIds?.length === 1 ? advanced.projectIds[0] : undefined;
        const allLogbookEntries = await fetchAllLogbookEntries({ from: advanced.from, to: advanced.to, projectId: projectFilter });
        const selectedProjectIds = advanced.projectIds || [];
        const logbookEntries = selectedProjectIds.length > 1
          ? allLogbookEntries.filter((entry) => entry.projectId && selectedProjectIds.includes(entry.projectId))
          : allLogbookEntries;
        const logbookRows: Array<Array<string | number>> = [
          ['Datum', 'Typ', 'Titel', 'Status', 'Projekt', 'Eintrag', 'Highlights', 'Herausforderungen', 'Nächste Schritte'],
          ...logbookEntries.map((entry: LogbookEntry) => [
            (entry.occurredAt || '').slice(0, 10), entry.type, entry.title, entry.status,
            entry.project?.title || '', entry.body || '', entry.highlights || '', entry.challenges || '', entry.nextSteps || '',
          ]),
        ];
        const logbookSheet = utils.aoa_to_sheet(logbookRows);
        styleHeader(logbookSheet, logbookRows[0].length);
        (logbookSheet as unknown as { ['!autofilter']?: { ref: string } })['!autofilter'] = { ref: `A1:${utils.encode_col(logbookRows[0].length - 1)}1` };
        logbookSheet['!cols'] = [{ wch: 14 }, { wch: 15 }, { wch: 30 }, { wch: 16 }, { wch: 26 }, { wch: 50 }, { wch: 32 }, { wch: 32 }, { wch: 32 }];
        utils.book_append_sheet(wb, logbookSheet, uniqueSheetName('Logbuch'));
      }
      setExportProgress('Datei wird gespeichert …');
      await new Promise(requestAnimationFrame);
      writeFile(
        wb,
        variant === 'styled'
          ? `Aktivitäten_Stato_${new Date().toISOString().slice(0, 10)}.xlsx`
          : `Aktivitäten_Rohdaten_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };
  const clearSearch = () => {
    setSearchTerm('');
    setSearchOpen(false);
    setPage(1);
  };
  return (
    <div>
      <PageHeader
        title="Aktivitäten"
        actions={(
          <DemoHoverHint
          title="Aktivitaeten-Werkzeuge"
          description="Hier suchst, exportierst, filterst und erstellst du Aktivitaeten. Der erweiterte Filter kombiniert Zeitraum, Typen, Projekte, Tags und Status."
          placement="bottom"
          align="end"
        >
          <div className="flex justify-end">
            <div className="flex gap-2 flex-wrap justify-end">
            <div className="relative">
              {searchOpen && (
                <div
                  className={`absolute top-full mt-2 z-20 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-2 shadow-xl backdrop-blur-md ${
                    isMobile
                      ? '-right-1 w-[min(16rem,calc(100vw-1.25rem))] max-w-[calc(100vw-1.25rem)]'
                      : 'right-0 w-[min(18rem,calc(100vw-2.5rem))] max-w-[calc(100vw-2.5rem)]'
                  }`}
                >
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
                    <Input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Titel / Projekt suchen"
                      className="mt-0 py-2 pl-9 pr-10"
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
              <IconButton
                variant="secondary"
                title={searchOpen ? 'Suche ausblenden' : 'Suche öffnen'}
                aria-label={searchOpen ? 'Suche ausblenden' : 'Suche öffnen'}
                onClick={() => setSearchOpen((open) => !open)}
              >
                <Search className="w-5 h-5" />
              </IconButton>
            </div>
          <IconButton
            variant="secondary"
            className="relative md:hidden"
            title="Excel-Export"
            aria-label="Excel-Export"
            disabled={exporting || exportCount === 0}
            onClick={() => setExportModalOpen(true)}
          >
            <Download className="w-5 h-5" />
          </IconButton>
          <Button
            variant="secondary"
            className="hidden md:inline-flex"
            title="Excel-Export"
            aria-label="Excel-Export"
            disabled={exporting || exportCount === 0}
            onClick={() => setExportModalOpen(true)}
          >
            <Download className="h-5 w-5" />
          </Button>
          <IconButton
            variant="secondary"
            className={`touch-manipulation ${hasAdvancedFilters ? 'border-viridian/40 bg-[var(--interactive-soft)] text-viridian ring-1 ring-viridian/20' : ''}`}
            onClick={() => setFilterDrawer(true)}
            title="Erweiterter Filter"
            aria-label="Erweiterter Filter"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </IconButton>
          {/* Mobile icon-only: New activity */}
          <IconButton
            variant="primary"
            className="rounded-full md:hidden"
            onClick={() => {
              if (isMobile) navigate('/activities/new/select-project');
              else setPicker(true);
            }}
            title="Neue Aktivität"
            aria-label="Neue Aktivität"
          >
            <Plus className="w-5 h-5" />
          </IconButton>
          {/* Desktop: New activity text button */}
          <Button
            className="hidden md:inline-flex"
            onClick={() => setPicker(true)}
          >
            + Neue Aktivität
          </Button>
            </div>
          </div>
          </DemoHoverHint>
        )}
      />

      {/* Nur noch: Knopf + compakte Anzeige aktiver Filter */}
      <DemoHoverHint
        title="Filteruebersicht"
        description="Diese Leiste zeigt Trefferzahl und aktive Filter. Einzelne Filterchips lassen sich entfernen, der Reset-Knopf setzt die Ansicht zurueck."
        placement="bottom"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="count">
              {activitiesLoading ? 'Treffer werden geladen…' : `Treffer: ${exportCountLabel}`}
            </Badge>
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
          {staffBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{staffBadgeLabel}</span> : null}
          {cohortsBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{cohortsBadgeLabel}</span> : null}
          {executionStatusBadgeLabel ? (
            <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{executionStatusBadgeLabel}</span>
          ) : null}
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
                clearActivitiesFilters();
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
                onFirst={goToFirstPage}
                onPrevious={goToPreviousPage}
                onNext={goToNextPage}
                onLast={goToLastPage}
              />
            </div>
          </div>
        </div>
      </DemoHoverHint>

      {/* Activity List */}
      {/* Desktop Table */}
      <DemoHoverHint
        title="Aktivitaetenliste"
        description="Die Tabelle zeigt die gefilterten Eintraege mit Datum, Typ, Teilnehmenden und Status. Ueber das Stift-Symbol oeffnest du die Bearbeitung."
        placement="bottom"
        className="demo-hover-hint-anchor-top"
      >
        <div className="activities-desktop-table-shell bg-white rounded-lg shadow hidden md:block overflow-x-auto">
        <table className="activities-desktop-table w-full min-w-[700px]">
          <thead className="bg-azure-web">
            <tr>
              <th className="activities-col-date px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
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
              <th className="activities-col-type px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700">Typ</th>
              <th className="activities-col-title px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                Titel / Projekt
              </th>
              <th className="activities-col-participants px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                Teilnehmende
              </th>
              <th className="activities-col-duration px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 hidden lg:table-cell">Dauer</th>
              <th className="activities-col-meta px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 hidden xl:table-cell">
                Kategorien, Tags & Notizen
              </th>
              <th className="activities-col-action px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {activities.map((a) => (
              <tr key={a.id} className="bg-white hover:bg-azure-web">
                <td className="activities-col-date px-3 lg:px-6 py-4 text-sm whitespace-nowrap">
                  {(() => {
                    const isToday = (a.date || '').slice(0, 10) === todayIso;
                    return (
                      <span className={isToday ? 'font-semibold text-viridian' : 'text-gray-700'}>
                        {formatActivityDate(a.date)}
                      </span>
                    );
                  })()}
                </td>
                <td className="activities-col-type px-3 lg:px-6 py-4 text-sm">
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
                <td className="activities-col-title px-3 lg:px-6 py-4 text-sm max-w-[150px] lg:max-w-none">
                  <div className="font-medium text-gray-900 truncate">{a.title || '-'}</div>
                  <div className="text-xs text-gray-600 truncate">{a.project?.title || '-'}</div>
                </td>
                <td className="activities-col-participants px-3 lg:px-6 py-4 text-sm whitespace-nowrap">
                  {isCancelledActivity(a.executionStatus) ? (
                    <ActivityExecutionStatusBadge status={a.executionStatus} />
                  ) : (
                    <>
                      <span className="font-medium">{a.countTotal ?? 0}</span>
                      <span className="text-gray-500 text-xs ml-1 hidden lg:inline">
                        (m:{a.countMale ?? 0}, w:{a.countFemale ?? 0}, d:{a.countDiverse ?? 0})
                      </span>
                    </>
                  )}
                </td>
                <td className="activities-col-duration px-3 lg:px-6 py-4 text-sm hidden lg:table-cell">
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
                <td className="activities-col-meta px-3 lg:px-6 py-4 text-sm hidden xl:table-cell">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(a.categories || []).map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                        style={{ backgroundColor: getBadgeBackgroundColor(c.color) }}
                        title={c.name}
                      >
                        {c.name}
                      </span>
                    ))}
                    {(a.tags || []).map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                        style={{ backgroundColor: getBadgeBackgroundColor(t.color, '#64748b') }}
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
                <td className="activities-col-action px-3 lg:px-6 py-4 text-sm relative overflow-hidden">
                  {a.project?.imageUrl ? (
                    <>
                      <ProtectedImage
                        src={a.project.imageUrl || undefined}
                        alt=""
                        aria-hidden
                        className="absolute inset-0 w-full h-full object-cover object-right opacity-70"
                      />
                      <div
                        className="activity-image-fade absolute inset-0"
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
                        className="activity-image-fade absolute inset-0"
                        aria-hidden
                      />
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setEditId(a.id)}
                    className="activity-edit-button relative z-10 p-2"
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
      </DemoHoverHint>
      {/* Pagination Controls */}
      <div className={`mt-4 mb-4 flex items-center gap-3 md:mb-0 ${total > 0 ? 'justify-between' : 'justify-end'}`}>
        {total > 0 ? (
          <div className="text-sm text-gray-600">
            {`Seite ${page} von ${pageCount} · ${total} Einträge`}
          </div>
        ) : null}
        <ActivitiesPaginationControls
          page={page}
          pageCount={pageCount}
          onFirst={goToFirstPage}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
          onLast={goToLastPage}
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
      <DemoHoverHint
        title="Aktivitaetenliste"
        description="Auf kleinen Bildschirmen oeffnet ein Tipp auf die Karte die Aktivitaet. Die Demo-Hinweise erscheinen bei Mausbedienung."
      >
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
                    className="activity-image-fade-mobile absolute inset-y-0 right-0 w-28"
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
                    className="activity-image-fade-mobile absolute inset-y-0 right-0 w-28"
                    aria-hidden
                  />
                </>
              ) : null}
              <div className="relative z-10 flex justify-between items-start mb-2">
                <div>
                  {(() => {
                    const isToday = (a.date || '').slice(0, 10) === todayIso;
                    return (
                      <div className={`text-sm ${isToday ? 'font-semibold text-viridian' : 'text-gray-500'}`}>
                        {formatActivityDate(a.date)}
                      </div>
                    );
                  })()}
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
                {isCancelledActivity(a.executionStatus) ? (
                  <ActivityExecutionStatusBadge status={a.executionStatus} />
                ) : (
                  (() => {
                    const m = a.countMale || 0;
                    const w = a.countFemale || 0;
                    const d = a.countDiverse || 0;
                    const total = (a.countTotal ?? m + w + d) || 0;
                    return (
                      <>
                        Teilnehmende: {total} (m:{m}, w:{w}, d:{d})
                      </>
                    );
                  })()
                )}
              </div>
              <div className="relative z-10 flex flex-wrap gap-1.5 mb-2">
                {(a.categories || []).map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-white"
                    style={{ backgroundColor: getBadgeBackgroundColor(c.color) }}
                    title={c.name}
                  >
                    {c.name}
                  </span>
                ))}
                {(a.tags || []).map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-white"
                    style={{ backgroundColor: getBadgeBackgroundColor(t.color, '#64748b') }}
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
            <EmptyState
              className="mx-3 mb-3"
              description="Passe den Zeitraum oder die Filter an, um weitere Aktivitäten zu sehen."
              title="Keine Aktivitäten im Zeitraum"
            />
          )}
        </div>
        </div>
      </DemoHoverHint>
      <div className={`mt-4 flex items-center gap-3 md:hidden ${total > 0 ? 'justify-between' : 'justify-end'}`}>
        {total > 0 ? (
          <div className="text-sm text-gray-600">
            {`Seite ${page} von ${pageCount} · ${total} Einträge`}
          </div>
        ) : null}
        <ActivitiesPaginationControls
          page={page}
          pageCount={pageCount}
          onFirst={goToFirstPage}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
          onLast={goToLastPage}
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
            Du kannst zwischen einer reinen Datendatei und einer Stato-formatierten Excel-Datei
            wählen. Beide Varianten enthalten Status, Teilnehmende, Kategorien, Tags und Notizen;
            das Stato-Format ergänzt Projekt-KPIs und das Logbuch.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              className="rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-viridian/40 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleExportConfirm('raw')}
              disabled={exporting || exportCount === 0}
            >
              <div className="font-semibold text-gray-900">Nur Daten (.xlsx)</div>
              <div className="mt-1 text-xs text-gray-600">
                Schlichte Tabelle ohne zusätzliche Farbgestaltung. Gut für Weiterverarbeitung und eigene Pivot-Auswertungen.
              </div>
            </button>
            <button
              type="button"
              className="rounded-xl border border-viridian/20 bg-azure-web p-4 text-left hover:border-viridian/40 hover:bg-mint-green disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleExportConfirm('styled')}
              disabled={exporting || exportCount === 0}
            >
              <div className="font-semibold text-viridian">Stato-Format (.xlsx)</div>
              <div className="mt-1 text-xs text-gray-600">
                Mit Header-Farben, Statusmarkierung und zusätzlichen Reitern je Projekt mit KPIs sowie einem Logbuch-Reiter.
              </div>
            </button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setExportModalOpen(false)}
              disabled={exporting}
            >
              Abbrechen
            </button>
          </div>
        </div>
      </Modal>
      <ExportProgressModal message={exportProgress} />
      <ActivitiesFilterDrawer
        open={filterDrawer}
        initial={advanced}
        onClose={() => setFilterDrawer(false)}
        onApply={(f) => {
          setAdvanced(f);
          setOrder('desc');
          setFilterDrawer(false);
        }}
      />
    </div>
  );
}
