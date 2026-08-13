import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/lib/useIsMobile';
import { fetchAllActivities, useActivitiesPaged, type ActivitiesFilter } from '@/lib/activities';
import { fetchAllLogbookEntries, type LogbookEntry } from '@/lib/logbook';
import ActivityExecutionStatusBadge from '@/components/ActivityExecutionStatusBadge';
import ActivityTypeBadge from '@/components/ActivityTypeBadge';
import { useCategories, useCohorts, useTags } from '@/lib/taxonomy';
import type { Cohort } from '@/lib/taxonomy';
import { Download, Plus } from 'lucide-react';
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
import { CreateButton, IconButton } from '@/components/ui/Button';
import { HeaderFilterButton, HeaderSearchAction } from '@/components/ui/HeaderActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ResponsiveFilterPanel } from '@/components/ui/ResponsiveFilterPanel';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber } from '@/i18n/formatters';
import { autoT } from '@/i18n/auto';
import { getTemporaryActivityDateFilter } from '@/lib/activityUrlFilters';

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
  return date ? formatDate(date, { dateStyle: 'short' }) : '';
}

function formatActivityWeekday(date?: string | null) {
  return date ? formatDate(date, { weekday: 'short' }) : '';
}

function formatActivityMobileDate(date?: string | null) {
  if (!date) return '';
  const weekday = formatActivityWeekday(date);
  const formattedDate = formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return weekday ? `${weekday}, ${formattedDate}` : formattedDate;
}

function toLocalIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function Activities() {
  const { t } = useTranslation('activities');
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
  const editScrollYRef = useRef<{ y: number; element: HTMLElement | null } | null>(null);
  const { data: cohorts = [] } = useCohorts({ active: true });
  const { data: categories = [] } = useCategories({ active: true });
  const { data: tags = [] } = useTags({ active: true });
  const { data: projects = [] } = useProjects();
  const { data: locations = [] } = useLocations({ active: true });
  const { data: staff = [] } = useStaff({ active: true });
  const { data: publicConfig } = usePublicConfig();
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const exportTriggerRef = useRef<HTMLDivElement | null>(null);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const todayIso = toLocalIsoDate(new Date());
  const temporaryDateFilter = useMemo(
    () => getTemporaryActivityDateFilter(location.search),
    [location.search],
  );
  // Calendar links define a one-off period and must not overwrite filters the
  // user deliberately stored in the activities view.
  const effectiveAdvanced = useMemo(
    () => temporaryDateFilter ? { ...advanced, ...temporaryDateFilter } : advanced,
    [advanced, temporaryDateFilter],
  );
  useEffect(() => {
    saveActivitiesFilters({ advanced, order, search: searchTerm });
  }, [advanced, order, searchTerm]);
  const filters = {
    search: searchTerm.trim() || undefined,
    from: effectiveAdvanced.from,
    to: effectiveAdvanced.to,
    weekdays: effectiveAdvanced.weekdays,
    types: effectiveAdvanced.types,
    locationIds: effectiveAdvanced.locationIds,
    projectIds: effectiveAdvanced.projectIds,
    categoryIds: effectiveAdvanced.categoryIds,
    uncategorized: effectiveAdvanced.uncategorized,
    tagIds: effectiveAdvanced.tagIds,
    staffIds: effectiveAdvanced.staffIds,
    cohortIds: effectiveAdvanced.cohortIds,
    executionStatuses: effectiveAdvanced.executionStatuses,
    hasNotes: effectiveAdvanced.hasNotes,
    participantsMin: effectiveAdvanced.participantsMin,
    participantsMax: effectiveAdvanced.participantsMax,
    durationMin: effectiveAdvanced.durationMin,
    durationMax: effectiveAdvanced.durationMax,
    order,
  } as ActivitiesFilter;

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [temporaryDateFilter]);

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
  const openEditActivity = (activityId: string) => {
    const element = document.scrollingElement as HTMLElement | null;
    editScrollYRef.current = {
      y: Math.max(window.scrollY || window.pageYOffset || 0, element?.scrollTop || 0),
      element,
    };
    setEditId(activityId);
  };
  const closeEditActivity = () => {
    setEditId(null);
  };

  // Restore after the editor has actually been removed from the tree. The
  // history-backed modal and the body-scroll lock both finish their cleanup
  // asynchronously, so restoring directly inside onClose can be overwritten.
  useLayoutEffect(() => {
    if (editId !== null || !editScrollYRef.current) return;
    const { y, element } = editScrollYRef.current;
    editScrollYRef.current = null;
    const restore = () => {
      window.scrollTo({ top: y, left: 0, behavior: 'auto' });
      if (element) element.scrollTop = y;
    };
    restore();
    const frame = window.requestAnimationFrame(() => {
      restore();
      window.setTimeout(restore, 0);
      window.setTimeout(restore, 80);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editId]);
  const firstWords = (s?: string | null, n: number = 20) => {
    if (!s) return '';
    const words = s.trim().split(/\s+/).filter(Boolean);
    const part = words.slice(0, n).join(' ');
    return words.length > n ? part + '…' : part;
  };
  const formatFilterDate = (iso?: string) => {
    if (!iso) return '';
    return formatActivityDate(iso) || iso;
  };
  const rangeBadgeLabel = (() => {
    const from = formatFilterDate(effectiveAdvanced.from);
    const to = formatFilterDate(effectiveAdvanced.to);
    if (from && to) return from === to ? t('filters.rangeExact', { date: from }) : t('filters.rangeBetween', { from, to });
    if (from) return t('filters.rangeFrom', { date: from });
    if (to) return t('filters.rangeTo', { date: to });
    return t('filters.range');
  })();
  const exportCount = total;
  const exportCountLabel = formatNumber(exportCount);
  const exportItemLabel = t('export.activity', { count: exportCount });
  const activityTypeLabels = useMemo<Record<string, string>>(() => ({
    open_door: t('types.open_door'), project_open: t('types.project_open'), project_closed: t('types.project_closed'),
    event: t('types.event'), outreach: t('types.outreach'),
  }), [t]);
  const typeNameById = useMemo(() => new Map(Object.entries(activityTypeLabels)), [activityTypeLabels]);
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
    () => formatSelectedFilterBadge(t('filters.types'), effectiveAdvanced.types, typeNameById),
    [effectiveAdvanced.types, t, typeNameById],
  );
  const locationsBadgeLabel = useMemo(
    () => formatSelectedFilterBadge(t('filters.locations'), effectiveAdvanced.locationIds, locationNameById),
    [effectiveAdvanced.locationIds, locationNameById, t],
  );
  const projectsBadgeLabel = useMemo(
    () => formatSelectedFilterBadge(t('filters.projects'), effectiveAdvanced.projectIds, projectNameById),
    [effectiveAdvanced.projectIds, projectNameById, t],
  );
  const categoriesBadgeLabel = useMemo(
    () => formatSelectedFilterBadge(t('filters.categories'), effectiveAdvanced.categoryIds, categoryNameById),
    [effectiveAdvanced.categoryIds, categoryNameById, t],
  );
  const tagsBadgeLabel = useMemo(
    () => formatSelectedFilterBadge(t('filters.tags'), effectiveAdvanced.tagIds, tagNameById),
    [effectiveAdvanced.tagIds, tagNameById, t],
  );
  const staffBadgeLabel = useMemo(
    () => formatSelectedFilterBadge(t('filters.staff'), effectiveAdvanced.staffIds, staffNameById),
    [effectiveAdvanced.staffIds, staffNameById, t],
  );
  const cohortsBadgeLabel = useMemo(
    () => formatSelectedFilterBadge(t('filters.cohorts'), effectiveAdvanced.cohortIds, cohortNameById),
    [effectiveAdvanced.cohortIds, cohortNameById, t],
  );
  const weekdaysBadgeLabel = useMemo(() => {
    if (!effectiveAdvanced.weekdays?.length) return null;
    const weekdayNames = effectiveAdvanced.weekdays
      .slice()
      .sort((left, right) => left - right)
      .map((weekday) => formatDate(new Date(2024, 0, 7 + weekday), { weekday: 'short' }));
    return `${t('filters.weekdays')}: ${weekdayNames.join(', ')}`;
  }, [effectiveAdvanced.weekdays, t]);
  const executionStatusBadgeLabel = useMemo(() => {
    if (!effectiveAdvanced.executionStatuses?.length) return null;
    return `Status: ${formatActivityExecutionStatusList(effectiveAdvanced.executionStatuses)}`;
  }, [effectiveAdvanced.executionStatuses]);
  const hasAdvancedFilters = useMemo(
    () => Object.values(effectiveAdvanced).some((value) => (Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '')),
    [effectiveAdvanced],
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
      autoT('ui_df5c3008c765'),
      autoT('ui_bae7d5be7082'),
      autoT('ui_edcaf9aaa282'),
      autoT('ui_950701e758d1'),
      autoT('ui_20bda6d2e725'),
      autoT('ui_a8a4d6b019af'),
      autoT('ui_6b0d31c0d563'),
      autoT('ui_aff024fe4ab0'),
      autoT('ui_3c363836cf4e'),
      ...cohortHeaders,
      autoT('ui_d62550d402f1'),
      autoT('ui_4e1e15e17610'),
      autoT('ui_848eed0fbd54'),
      autoT('ui_7e458d013900'),
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
        activityTypeLabels[activity.type] || activity.type,
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
      setExportProgress(t('export.loadingActivities'));
      const list = await loadExportRows();
      setExportProgress(t('export.preparingFile'));
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
      utils.book_append_sheet(wb, ws, autoT('ui_b6bf5f1a2033'));

      if (variant === 'styled') {
        setExportProgress(autoT('ui_6cbf19e20da4'));
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
        const usedSheetNames = new Set<string>([autoT('ui_b6bf5f1a2033')]);
        const uniqueSheetName = (value: string) => {
          const base = (value.replace(/[\\/?*[\]:]/g, ' ').trim() || autoT('ui_20bda6d2e725')).slice(0, 31);
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
            : autoT('ui_f489591ec2c6');
          const projectRows: Array<Array<string | number>> = [
            [autoT('ui_5347abc77ca3'), autoT('ui_9d3fb5bb5707')],
            [autoT('ui_20bda6d2e725'), project?.title || projectActivities[0]?.project?.title || autoT('ui_7ad11e328f86')],
            [autoT('ui_fe359159c8ad'), rangeBadgeLabel],
            [autoT('ui_b6bf5f1a2033'), projectActivities.length],
            [autoT('ui_59c83f1c873f'), totalParticipants],
            ['Ø Besucher*innen', projectActivities.length ? Math.round((totalParticipants / projectActivities.length) * 10) / 10 : 0],
            [autoT('ui_0f4989b791e1'), ratio],
            ['Ø Dauer (min)', durations.length ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10 : '–'],
            [],
            [autoT('ui_df5c3008c765'), autoT('ui_edcaf9aaa282'), autoT('ui_950701e758d1'), autoT('ui_a8a4d6b019af'), autoT('ui_6b0d31c0d563'), autoT('ui_aff024fe4ab0'), autoT('ui_3c363836cf4e'), autoT('ui_d62550d402f1')],
            ...projectActivities.map((activity) => [
              (activity.date || '').slice(0, 10),
              activityTypeLabels[activity.type] || activity.type,
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
          utils.book_append_sheet(wb, projectSheet, uniqueSheetName(project?.title || projectActivities[0]?.project?.title || autoT('ui_20bda6d2e725')));
        }

        setExportProgress(autoT('ui_eb5ec187a1c8'));
        const projectFilter = effectiveAdvanced.projectIds?.length === 1 ? effectiveAdvanced.projectIds[0] : undefined;
        const allLogbookEntries = await fetchAllLogbookEntries({ from: effectiveAdvanced.from, to: effectiveAdvanced.to, projectId: projectFilter });
        const selectedProjectIds = effectiveAdvanced.projectIds || [];
        const logbookEntries = selectedProjectIds.length > 1
          ? allLogbookEntries.filter((entry) => entry.projectId && selectedProjectIds.includes(entry.projectId))
          : allLogbookEntries;
        const logbookRows: Array<Array<string | number>> = [
          [autoT('ui_df5c3008c765'), autoT('ui_edcaf9aaa282'), autoT('ui_950701e758d1'), autoT('ui_bae7d5be7082'), autoT('ui_20bda6d2e725'), autoT('ui_d28fd7140d15'), autoT('ui_1f9c9c4e9b69'), autoT('ui_24cb5c6fa8e6'), autoT('ui_76231e1d047c')],
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
      setExportProgress(t('export.savingFile'));
      await new Promise(requestAnimationFrame);
      writeFile(
        wb,
        variant === 'styled'
          ? `Stato_activities_${new Date().toISOString().slice(0, 10)}.xlsx`
          : `Stato_activity_data_${new Date().toISOString().slice(0, 10)}.xlsx`,
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
        title={t('title')}
        actions={(
          <DemoHoverHint
          title={autoT('ui_06724a5f3126')}
          description={autoT('ui_10651012f6b2')}
          placement="bottom"
          align="end"
        >
          <div className="flex justify-end">
            <div className="flex gap-2 flex-wrap justify-end">
            <HeaderSearchAction
              clearLabel={t('search.clear')}
              closeLabel={t('search.close')}
              onClear={clearSearch}
              onOpenChange={setSearchOpen}
              onValueChange={setSearchTerm}
              open={searchOpen}
              openLabel={t('search.open')}
              placeholder={t('search.placeholder')}
              value={searchTerm}
            />
          <IconButton
            variant="secondary"
            className="relative md:hidden"
            title={t('export.title')}
            aria-label={t('export.title')}
            disabled={exporting || exportCount === 0}
            onClick={() => setExportModalOpen(true)}
          >
            <Download className="w-5 h-5" />
          </IconButton>
          <div ref={exportTriggerRef} className="hidden md:block">
            <IconButton
              variant="secondary"
              title={t('export.title')}
              aria-label={t('export.title')}
              disabled={exporting || exportCount === 0}
              onClick={() => setExportModalOpen(true)}
            >
              <Download className="h-5 w-5" />
            </IconButton>
          </div>
          <div className="relative">
            <HeaderFilterButton
              aria-expanded={filterDrawer}
              className="touch-manipulation"
              onClick={() => setFilterDrawer((open) => !open)}
              title={t('filters.advanced')}
              aria-label={t('filters.advanced')}
            />
            <ActivitiesFilterDrawer
              open={filterDrawer}
              initial={advanced}
              onClose={() => setFilterDrawer(false)}
              onApply={(filters) => {
                setAdvanced(filters);
                setOrder('desc');
                setFilterDrawer(false);
              }}
            />
          </div>
          {/* Mobile icon-only: New activity */}
          <IconButton
            variant="primary"
            className="rounded-full md:hidden"
            onClick={() => {
              if (isMobile) navigate('/activities/new/select-project');
              else setPicker(true);
            }}
            title={t('actions.new')}
            aria-label={t('actions.new')}
          >
            <Plus className="w-5 h-5" />
          </IconButton>
          {/* Desktop: New activity text button */}
          <CreateButton
            className="hidden md:inline-flex"
            onClick={() => setPicker(true)}
          >
            {t('actions.new')}
          </CreateButton>
            </div>
          </div>
          </DemoHoverHint>
        )}
      />

      {/* Nur noch: Knopf + compakte Anzeige aktiver Filter */}
      <DemoHoverHint
        title={autoT('ui_c3a80d1a3f64')}
        description={autoT('ui_6b1b1e7aeefd')}
        placement="bottom"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="count">
              {activitiesLoading ? t('filters.resultsLoading') : t('filters.results', { count: exportCountLabel })}
            </Badge>
          {searchTerm.trim() ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-azure-web text-viridian">
              <span>{t('search.label', { value: searchTerm.trim() })}</span>
              <button
                type="button"
                onClick={clearSearch}
                className="rounded-full text-viridian/80 hover:text-viridian"
                aria-label={t('search.clear')}
                title={t('search.clear')}
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </span>
          ) : null}
          {effectiveAdvanced.from || effectiveAdvanced.to ? (
            <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{rangeBadgeLabel}</span>
          ) : null}
          {weekdaysBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{weekdaysBadgeLabel}</span> : null}
          {typesBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{typesBadgeLabel}</span> : null}
          {locationsBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{locationsBadgeLabel}</span> : null}
          {projectsBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{projectsBadgeLabel}</span> : null}
          {categoriesBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{categoriesBadgeLabel}</span> : null}
          {effectiveAdvanced.uncategorized ? (
            <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">
              {t('filters.uncategorized')}
            </span>
          ) : null}
          {tagsBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{tagsBadgeLabel}</span> : null}
          {staffBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{staffBadgeLabel}</span> : null}
          {cohortsBadgeLabel ? <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{cohortsBadgeLabel}</span> : null}
          {executionStatusBadgeLabel ? (
            <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">{executionStatusBadgeLabel}</span>
          ) : null}
          {effectiveAdvanced.hasNotes ? (
            <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">
              {t('filters.onlyNotes')}
            </span>
          ) : null}
          {(typeof effectiveAdvanced.participantsMin === 'number' ||
            typeof effectiveAdvanced.participantsMax === 'number') && (
            <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">
              {t('filters.participants', { value: typeof effectiveAdvanced.participantsMin === 'number' &&
              typeof effectiveAdvanced.participantsMax === 'number'
                ? `${effectiveAdvanced.participantsMin}–${effectiveAdvanced.participantsMax}`
                : typeof effectiveAdvanced.participantsMin === 'number'
                  ? `≥ ${effectiveAdvanced.participantsMin}`
                  : `≤ ${effectiveAdvanced.participantsMax}` })}
            </span>
          )}
          {(typeof effectiveAdvanced.durationMin === 'number' ||
            typeof effectiveAdvanced.durationMax === 'number') && (
            <span className="px-2 py-1 rounded-full bg-azure-web text-viridian">
              {t('filters.duration', { value: typeof effectiveAdvanced.durationMin === 'number' && typeof effectiveAdvanced.durationMax === 'number'
                ? `${effectiveAdvanced.durationMin}–${effectiveAdvanced.durationMax}`
                : typeof effectiveAdvanced.durationMin === 'number'
                  ? `≥ ${effectiveAdvanced.durationMin}`
                  : `≤ ${effectiveAdvanced.durationMax}` })}
            </span>
          )}
          {hasAdvancedFilters && (
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-azure-web text-viridian hover:bg-cambridge-blue/20 transition-colors"
              title={t('filters.reset')}
              aria-label={t('filters.reset')}
              onClick={() => {
                setAdvanced({});
                setOrder('desc');
                clearSearch();
                setPage(1);
                clearActivitiesFilters();
                navigate('/activities', { replace: true });
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="hidden md:block">
              <PaginationControls
                page={page}
                pageCount={pageCount}
                onFirst={goToFirstPage}
                onPrevious={goToPreviousPage}
                onNext={goToNextPage}
                onLast={goToLastPage}
                labels={{ first: t('pagination.first'), previous: t('pagination.previous'), next: t('pagination.next'), last: t('pagination.last') }}
              />
            </div>
          </div>
        </div>
      </DemoHoverHint>

      {/* Activity List */}
      {/* Desktop Table */}
      <DemoHoverHint
        title={autoT('ui_dab1e02ef964')}
        description={autoT('ui_a20ea17f2e7c')}
        placement="bottom"
        className="demo-hover-hint-anchor-top"
      >
        <div className="activities-desktop-table-shell bg-white rounded-lg shadow hidden md:block overflow-x-auto md:overflow-visible">
        <table className="activities-desktop-table w-full min-w-[700px]">
          <thead className="activities-desktop-table-header bg-azure-web">
            <tr>
              <th className="activities-col-date px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-viridian"
                  title={t('table.sortDate')}
                  onClick={() => {
                    setOrder((o) => (o === 'desc' ? "asc" : "desc"));
                    setPage(1);
                  }}
                >
                  {t('table.date')}
                  {order === 'desc' ? (
                    <ArrowDownWideNarrow className="w-4 h-4" />
                  ) : (
                    <ArrowUpNarrowWide className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="activities-col-type px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('table.type')}</th>
              <th className="activities-col-title px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                {t('table.titleProject')}
              </th>
              <th className="activities-col-participants px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                {t('table.participants')}
              </th>
              <th className="activities-col-duration px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 hidden lg:table-cell">{t('table.duration')}</th>
              <th className="activities-col-meta px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 hidden xl:table-cell">
                {t('table.categoriesTagsNotes')}
              </th>
              <th className="activities-col-action px-3 lg:px-6 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">{t('table.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {activities.map((a) => (
              <tr key={a.id} className="bg-white hover:bg-azure-web">
                <td className="activities-col-date px-3 lg:px-6 py-4 text-sm whitespace-nowrap">
                  {(() => {
                    const isToday = (a.date || '').slice(0, 10) === todayIso;
                    return (
                      <span className={isToday ? "font-semibold text-viridian" : "text-gray-700"}>
                        <span className="block text-xs font-medium text-gray-500">{formatActivityWeekday(a.date)}</span>
                        <span className="block">{formatActivityDate(a.date)}</span>
                      </span>
                    );
                  })()}
                </td>
                <td className="activities-col-type px-3 lg:px-6 py-4 text-sm">
                  <ActivityTypeBadge type={a.type} label={activityTypeLabels[a.type] || a.type} />
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
                      <span className="text-gray-500 text-xs ml-1 hidden lg:inline">{autoT('ui_c2a30a5a251c')}{a.countMale ?? 0}{autoT('ui_115f6e7d14bf')}{a.countFemale ?? 0}{autoT('ui_7578fb7a5a2f')}{a.countDiverse ?? 0})
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
                    onClick={() => openEditActivity(a.id)}
                    className="activity-edit-button relative z-10 p-2"
                    title={t('actions.edit')}
                    aria-label={t('actions.edit')}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {activities.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 lg:px-6 py-6 text-center text-gray-500 text-sm">
                  {t('table.noActivities')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </DemoHoverHint>
      {/* Pagination Controls */}
      <div className={`mt-4 mb-4 flex items-center gap-3 md:mb-0 ${total > 0 ? "justify-between" : "justify-end"}`}>
        {total > 0 ? (
          <div className="text-sm text-gray-600">
            {t('pagination.summary', { page, pageCount, total: formatNumber(total) })}
          </div>
        ) : null}
        <PaginationControls
          page={page}
          pageCount={pageCount}
          onFirst={goToFirstPage}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
          onLast={goToLastPage}
          labels={{ first: t('pagination.first'), previous: t('pagination.previous'), next: t('pagination.next'), last: t('pagination.last') }}
          compact={isMobile}
        />
      </div>

      {activitiesIsError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>
            {t('table.loadError')}
          </span>
          <button
            type="button"
            className="shrink-0 rounded-md border border-red-300 bg-white px-3 py-1.5 text-red-700 hover:bg-red-100"
            onClick={() => {
              void refetchActivities();
            }}
          >
            {t('actions.retry')}
          </button>
        </div>
      )}

      {/* Mobile Cards */}
      <DemoHoverHint
        title={autoT('ui_dab1e02ef964')}
        description={autoT('ui_ae48dac7af3d')}
      >
        <div className="relative min-h-[12rem] pt-2 md:hidden">
        <div className="space-y-3">
          {activities.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-lg shadow p-4 cursor-pointer hover:bg-azure-web/50 focus:outline-none focus:ring-2 focus:ring-viridian/40 relative overflow-hidden"
              role="button"
              tabIndex={0}
              aria-label={t('actions.open')}
              onClick={() => {
                if (isMobile)
                  navigate(`/activities/${a.id}`, {
                    state: { from: `${location.pathname}${location.search}` },
                  });
                else openEditActivity(a.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (isMobile)
                    navigate(`/activities/${a.id}`, {
                      state: { from: `${location.pathname}${location.search}` },
                    });
                  else openEditActivity(a.id);
                }
              }}
            >
              {a.project?.imageUrl ? (
                <>
                  <ProtectedImage
                    src={a.project.imageUrl || undefined}
                    alt=""
                    aria-hidden
                    className="absolute inset-y-0 right-0 w-[42%] h-full object-cover opacity-85"
                  />
                  <div
                    className="activity-image-fade-mobile absolute inset-y-0 right-0 w-[42%]"
                    aria-hidden
                  />
                </>
              ) : a.project?.color ? (
                <>
                  <div
                    className="absolute inset-y-0 right-0 w-[42%] opacity-80"
                    style={{
                      background: `linear-gradient(225deg, ${a.project.color} 0%, color-mix(in srgb, ${a.project.color} 68%, white) 100%)`,
                    }}
                    aria-hidden
                  />
                  <div
                    className="activity-image-fade-mobile absolute inset-y-0 right-0 w-[42%]"
                    aria-hidden
                  />
                </>
              ) : null}
              <div className="relative z-10 flex justify-between items-start mb-2">
                <div>
                  {(() => {
                    const isToday = (a.date || '').slice(0, 10) === todayIso;
                    return (
                      <div className={`text-sm ${isToday ? "font-semibold text-viridian" : "text-gray-500"}`}>
                        <span className="text-xs font-medium whitespace-nowrap">{formatActivityMobileDate(a.date)}</span>
                      </div>
                    );
                  })()}
                  <div className="font-semibold text-viridian">
                    {activityTypeLabels[a.type] || a.type}
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
                      {duration}{autoT('ui_b6c935d4f3c7')}</span>
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
                        {t('mobile.participants', { total, male: m, female: w, diverse: d })}
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
              description={t('table.adjustFilters')}
              title={t('table.noActivities')}
            />
          )}
        </div>
        </div>
      </DemoHoverHint>
      <div className={`mt-4 flex items-center gap-3 md:hidden ${total > 0 ? "justify-between" : "justify-end"}`}>
        {total > 0 ? (
          <div className="text-sm text-gray-600">
            {t('pagination.summary', { page, pageCount, total: formatNumber(total) })}
          </div>
        ) : null}
        <PaginationControls
          page={page}
          pageCount={pageCount}
          onFirst={goToFirstPage}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
          onLast={goToLastPage}
          labels={{ first: t('pagination.first'), previous: t('pagination.previous'), next: t('pagination.next'), last: t('pagination.last') }}
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
          onClose={closeEditActivity}
          project={editing.project ?? undefined}
          activity={editing}
        />
      )}
      <ResponsiveFilterPanel
        anchorRef={exportTriggerRef}
        desktopClassName="filter-popover--export"
        open={exportModalOpen}
        onClose={() => {
          if (!exporting) setExportModalOpen(false);
        }}
        title={t('export.title')}
      >
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            {t('export.modalIntro', { count: exportCountLabel, item: exportItemLabel })}
          </p>
          <p className="text-gray-600">
            {t('export.modalText')}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              className="export-option-card rounded-xl border p-4 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleExportConfirm('raw')}
              disabled={exporting || exportCount === 0}
            >
              <div className="font-semibold text-gray-900">{t('export.rawTitle')}</div>
              <div className="mt-1 text-xs text-gray-600">
                {t('export.rawDescription')}
              </div>
            </button>
            <button
              type="button"
              className="export-option-card export-option-card--stato rounded-xl border p-4 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleExportConfirm('styled')}
              disabled={exporting || exportCount === 0}
            >
              <div className="font-semibold text-viridian">{t('export.styledTitle')}</div>
              <div className="mt-1 text-xs text-gray-600">
                {t('export.styledDescription')}
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
              {t('export.cancel')}
            </button>
          </div>
        </div>
      </ResponsiveFilterPanel>
      <ExportProgressModal message={exportProgress} />
    </div>
  );
}
