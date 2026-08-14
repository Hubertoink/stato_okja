import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '@/lib/auth';
import { fetchAllActivities, useActivitiesPaged, type Activity } from '@/lib/activities';
import { fetchAllLogbookEntries } from '@/lib/logbook';
import { useCohorts, useTags, type Cohort } from '@/lib/taxonomy';
import { useProjects } from '@/lib/projects';
import { useOrgScope, useOrgScopeKey } from '@/lib/orgScope';
import { useIsMobile } from '@/lib/useIsMobile';
import { colorForActivityType, translucent } from '@/lib/colors';
import { isDarkThemeName, resolveThemeName } from '../lib/theme';
import {
  FileDown,
  Calendar,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Modal from '@/components/Modal';
import ExportProgressModal from '@/components/ExportProgressModal';
import ProtectedImage from '@/components/ProtectedImage';
import { useToast } from '@/components/Toast';
import { addDevMetricEvent, finishDevFlow, markDevFlow, startDevFlow } from '@/lib/devMetrics';
import { usePublicConfig } from '@/lib/publicConfig';
import {
  ACTIVITY_EXECUTION_STATUS_OPTIONS,
  formatActivityExecutionStatusList,
  isDefaultActivityExecutionStatusFilter,
  normalizeActivityExecutionStatuses,
} from '@/lib/activityExecutionStatus';
import {
  buildTopDayChartData,
  formatStatisticsAggregationTickLabel,
  formatStatisticsAggregationTooltipLabel,
  getInclusiveWeekSpan,
  getVisibleSelectedItems,
} from './statisticsHelpers';
import { createBarValueLabelRenderer, createPieValueLabelRenderer } from './statisticsChartLabels';
import {
  buildStatisticsActivitiesFileName,
  buildStatisticsChartFileName,
  buildStatisticsControllingFileName,
  buildStatisticsExportRangeLabel,
} from './statisticsExport';
import { StatisticsBarChartCard } from './StatisticsBarChartCard';
import { StatisticsExportActions } from './StatisticsExportActions';
import { StatisticsPieChartCard } from './StatisticsPieChartCard';
import CustomKpiCards from '@/components/CustomKpiCards';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Button, IconButton } from '@/components/ui/Button';
import { FieldLabel, Input } from '@/components/ui/Field';
import { FilterChip } from '@/components/ui/FilterChip';
import { ResponsiveFilterPanel } from '@/components/ui/ResponsiveFilterPanel';
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';
import { captureExportNode } from '@/lib/htmlCanvasExport';
import WeeklyProfileHeatmap from '@/components/WeeklyProfileHeatmap';
import type { OrganizationClosureStateFilter } from '@/lib/orgs';
import { useStatisticsOverview } from './statistics/useStatisticsOverview';
import { useStatisticsFilters } from './statistics/useStatisticsFilters';
import { StatisticsKpis } from './statistics/StatisticsKpis';
import { StatisticsActivitiesTable } from './statistics/StatisticsActivitiesTable';
import type { ActivitiesExportFormat, ChartExportFormat } from './statistics/types';
import {
  appendActivitiesTableToPdf,
  exportActivitiesAsExcel as runActivitiesExcelExport,
  exportActivitiesAsPdf as runActivitiesPdfExport,
} from './statistics/export/activitiesExport';
import { exportControllingDataAsExcel as runControllingExcelExport } from './statistics/export/controllingExport';
import {
  addPdfPageHeader,
  buildPdfSlices,
  canvasToBlob,
  CHART_EXPORT_HEADER_HEIGHT_MM,
  collectPdfBreakpoints,
  createCanvasSlice,
  downloadBlob,
  loadPdfExportDependencies,
  PDF_HEADER_HEIGHT_MM,
  PDF_MARGIN_MM,
  PDF_MAX_RENDER_HEIGHT_PX,
  PDF_RENDER_SCALE,
  renderParticipantsTrendCanvas,
} from './statistics/export/pdfCanvas';

const TYPE_LABEL: Record<string, string> = {
  open_door: autoT('ui_a80778b6b148'),
  project_open: autoT('ui_00d882fbb5d4'),
  project_closed: autoT('ui_8f256393653e'),
  event: 'Veranstaltung',
  outreach: 'Aufsuchend',
};

const STATISTICS_TYPE_OPTIONS: Activity['type'][] = [
  'open_door',
  'project_open',
  'project_closed',
  'event',
  'outreach',
];

const COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6'];
const DESKTOP_PROJECT_CHIP_COLLAPSE_THRESHOLD = 12;
const DESKTOP_PROJECT_CHIP_VISIBLE_COUNT = 10;
const MOBILE_TYPE_CHIP_VISIBLE_COUNT = 4;
const MOBILE_PROJECT_CHIP_VISIBLE_COUNT = 5;

const WEEKDAY_OPTIONS = [
  { value: 1, shortLabel: 'Mo', label: autoT('ui_8bb0f19f592e') },
  { value: 2, shortLabel: 'Di', label: autoT('ui_b2ce6b5d7cb1') },
  { value: 3, shortLabel: 'Mi', label: autoT('ui_ea3552526134') },
  { value: 4, shortLabel: 'Do', label: autoT('ui_7c3df2c5fe25') },
  { value: 5, shortLabel: 'Fr', label: autoT('ui_0ca5853904f5') },
  { value: 6, shortLabel: 'Sa', label: autoT('ui_85ad5644425c') },
  { value: 0, shortLabel: 'So', label: autoT('ui_f8e9c756eaa2') },
] as const;

const CLOSURE_FILTER_LABELS: Record<OrganizationClosureStateFilter, string> = {
  closed: autoT('ui_9a7a7c0c602f'),
  open: autoT('ui_032b3f37a45b'),
};
function normalizeWeekdays(weekdays: number[]) {
  return Array.from(
    new Set(
      weekdays.filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6),
    ),
  ).sort((left, right) => left - right);
}

function formatLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getActivityTypeLabel(type?: string | null) {
  if (!type) return '';
  return TYPE_LABEL[type] || type;
}

export default function Statistics() {
  const isMobile = useIsMobile(768);
  const {
    currentYear,
    currentMonth,
    from,
    to,
    projectId,
    setProjectId,
    selectedType,
    setSelectedType,
    selectedYear,
    selectedMonth,
    filterMode,
    customFilterOpen,
    setCustomFilterOpen,
    customFilterTriggerRef,
    typePickerOpen,
    setTypePickerOpen,
    projectPickerOpen,
    setProjectPickerOpen,
    tempFrom,
    setTempFrom,
    tempTo,
    setTempTo,
    desktopProjectFilterExpanded,
    setDesktopProjectFilterExpanded,
    mobileFiltersExpanded,
    setMobileFiltersExpanded,
    mobileTypeFilterExpanded,
    setMobileTypeFilterExpanded,
    mobileProjectFilterExpanded,
    setMobileProjectFilterExpanded,
    selectedWeekdays,
    tempSelectedWeekdays,
    setTempSelectedWeekdays,
    selectedExecutionStatuses,
    tempSelectedExecutionStatuses,
    setTempSelectedExecutionStatuses,
    selectedClosureState,
    tempSelectedClosureState,
    setTempSelectedClosureState,
    activitiesPage,
    setActivitiesPage,
    selectYear,
    selectMonth,
    switchToYearView,
    switchToMonthView,
    navigateMonth,
    applyCustomRange,
    resetAdvancedFilters,
    isCustomRange,
    hasWeekdayFilter,
    hasExecutionStatusFilter,
    hasClosureStateFilter,
    hasAdvancedFilter,
    formatRangeDisplay,
    formatAdvancedFilterDisplay,
  } = useStatisticsFilters();
  const [showAverage, setShowAverage] = useState(false);
  const [timeAggregation, setTimeAggregation] = useState<'day' | 'week' | 'month'>('day');
  const ACTIVITIES_PER_PAGE = 50;

  const [pdfMode, setPdfMode] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const chartCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const statsUiFlowIdRef = useRef<string | null>(null);
  const statsUiFlowCompletedRef = useRef(false);
  const statsUiFlowMarksRef = useRef<Record<string, boolean>>({});
  const statsUiPendingRunKeyRef = useRef<string | null>(null);
  const statsUiFetchSeenRef = useRef<Record<string, boolean>>({});
  const [activeChartExport, setActiveChartExport] = useState<string | null>(null);
  const [activeActivitiesExport, setActiveActivitiesExport] =
    useState<ActivitiesExportFormat | null>(null);
  const [isControllingExporting, setIsControllingExporting] = useState(false);
  const [reportExportOpen, setReportExportOpen] = useState(false);
  const reportExportTriggerRef = useRef<HTMLDivElement | null>(null);
  const [includeActivitiesInPdf, setIncludeActivitiesInPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [isExportInProgress, setIsExportInProgress] = useState(false);
  const exportInProgressRef = useRef(false);

  const { user } = useAuth();
  const { showToast } = useToast();
  const { scope } = useOrgScope();
  const scopeKey = useOrgScopeKey();
  const { data: publicConfig } = usePublicConfig();
  const effectiveExecutionStatuses = useMemo(
    () => normalizeActivityExecutionStatuses(selectedExecutionStatuses),
    [selectedExecutionStatuses],
  );
  const executionStatusFilterParam = useMemo(
    () =>
      isDefaultActivityExecutionStatusFilter(selectedExecutionStatuses)
        ? undefined
        : effectiveExecutionStatuses,
    [effectiveExecutionStatuses, selectedExecutionStatuses],
  );
  const statsParams = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      projectId: projectId || undefined,
      type: selectedType || undefined,
      executionStatuses: executionStatusFilterParam,
      closureState: selectedClosureState,
      weekdays: selectedWeekdays.length > 0 ? selectedWeekdays : undefined,
    }),
    [
      executionStatusFilterParam,
      from,
      to,
      projectId,
      selectedClosureState,
      selectedType,
      selectedWeekdays,
    ],
  );
  const activitiesParams = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      weekdays: selectedWeekdays.length > 0 ? selectedWeekdays : undefined,
      projectIds: projectId ? [projectId] : undefined,
      type: selectedType || undefined,
      executionStatuses: executionStatusFilterParam,
      closureState: selectedClosureState,
    }),
    [
      executionStatusFilterParam,
      from,
      to,
      projectId,
      selectedClosureState,
      selectedType,
      selectedWeekdays,
    ],
  );
  const overviewQ = useStatisticsOverview(statsParams, scopeKey, {
    refetchOnWindowFocus: true,
    refetchIntervalMs: publicConfig?.liveRefreshIntervalMs,
  });
  const overview = overviewQ.data;
  const summary = overview?.summary;
  const byType = overview?.byType;
  const gender = overview?.gender;
  const timeseries = overview?.participantsTimeseries;
  const byCohort = overview?.byCohort;
  const byCategory = overview?.byCategory;
  const weeklyProfile = overview?.weeklyProfile;
  const topTags = overview?.topTags ?? [];
  const topProjects = overview?.topProjects ?? [];
  const activityYears = overview?.availableYears ?? [];
  const activitiesPageQ = useActivitiesPaged(
    activitiesParams,
    activitiesPage,
    ACTIVITIES_PER_PAGE,
    {
      refetchOnWindowFocus: true,
      refetchIntervalMs: publicConfig?.liveRefreshIntervalMs,
    },
  );
  const pagedActivities = activitiesPageQ.data?.data ?? [];
  const reportActivities = pagedActivities;
  const totalActivities = activitiesPageQ.data?.total ?? summary?.totalActivities ?? 0;
  const { data: tagsAll = [] } = useTags({ active: true });
  const { data: cohortsAll = [] } = useCohorts({ active: true });
  const { data: cohortsForStatistics = [] } = useCohorts();
  const { data: projectsAll = [] } = useProjects();

  const statsRunKey = useMemo(
    () =>
      JSON.stringify([
        scopeKey,
        statsParams.from ?? '',
        statsParams.to ?? '',
        statsParams.projectId ?? '',
        statsParams.type ?? '',
        statsParams.executionStatuses?.join(',') ?? '',
        statsParams.closureState ?? '',
        statsParams.weekdays?.join(',') ?? '',
      ]),
    [
      scopeKey,
      statsParams.from,
      statsParams.to,
      statsParams.projectId,
      statsParams.type,
      statsParams.executionStatuses,
      statsParams.closureState,
      statsParams.weekdays,
    ],
  );

  useEffect(() => {
    if (statsUiFlowIdRef.current && !statsUiFlowCompletedRef.current) {
      finishDevFlow(statsUiFlowIdRef.current, 'cancelled', { reason: 'superseded' });
    }
    statsUiFlowIdRef.current = null;
    statsUiFlowCompletedRef.current = false;
    statsUiFlowMarksRef.current = {};
    statsUiPendingRunKeyRef.current = statsRunKey;
    statsUiFetchSeenRef.current = {};
  }, [statsRunKey]);

  useEffect(() => {
    const queryStates = [
      {
        key: 'summary',
        label: autoT('ui_a89f502a92fb'),
        status: overviewQ.status,
        isError: overviewQ.isError,
        isFetching: overviewQ.isFetching,
        size: summary ? 1 : 0,
      },
      {
        key: 'byType',
        label: autoT('ui_a0ce6f7243f7'),
        status: overviewQ.status,
        isError: overviewQ.isError,
        isFetching: overviewQ.isFetching,
        size: Array.isArray(byType) ? byType.length : 0,
      },
      {
        key: 'gender',
        label: autoT('ui_88ff505da05e'),
        status: overviewQ.status,
        isError: overviewQ.isError,
        isFetching: overviewQ.isFetching,
        size: gender ? 1 : 0,
      },
      {
        key: 'timeseries',
        label: autoT('ui_b07fe6e94a2e'),
        status: overviewQ.status,
        isError: overviewQ.isError,
        isFetching: overviewQ.isFetching,
        size: Array.isArray(timeseries) ? timeseries.length : 0,
      },
      {
        key: 'byCohort',
        label: autoT('ui_6b4c4723b3eb'),
        status: overviewQ.status,
        isError: overviewQ.isError,
        isFetching: overviewQ.isFetching,
        size: Array.isArray(byCohort) ? byCohort.length : 0,
      },
      {
        key: 'byCategory',
        label: autoT('ui_c685feebfa6d'),
        status: overviewQ.status,
        isError: overviewQ.isError,
        isFetching: overviewQ.isFetching,
        size: Array.isArray(byCategory) ? byCategory.length : 0,
      },
    ];

    const anyFetching = queryStates.some((queryState) => queryState.isFetching);
    const anyPending = queryStates.some(
      (queryState) => queryState.status !== 'success' && !queryState.isError,
    );
    const allSettledSuccessfully = queryStates.every(
      (queryState) => queryState.status === 'success' && !queryState.isFetching,
    );
    const shouldStartFlow =
      !statsUiFlowIdRef.current &&
      !statsUiFlowCompletedRef.current &&
      statsUiPendingRunKeyRef.current === statsRunKey &&
      (anyFetching || anyPending);

    if (shouldStartFlow) {
      statsUiFlowIdRef.current = startDevFlow('statistics:ui-load', {
        scopeKey,
        from: statsParams.from ?? null,
        to: statsParams.to ?? null,
        projectId: statsParams.projectId ?? null,
        type: statsParams.type ?? null,
        weekdays: statsParams.weekdays?.join(',') ?? null,
      });
      markDevFlow(statsUiFlowIdRef.current, 'filters-applied', {
        from: statsParams.from ?? null,
        to: statsParams.to ?? null,
        projectId: statsParams.projectId ?? null,
        type: statsParams.type ?? null,
        weekdays: statsParams.weekdays?.join(',') ?? null,
      });
    }

    if (
      !statsUiFlowIdRef.current &&
      !statsUiFlowCompletedRef.current &&
      statsUiPendingRunKeyRef.current === statsRunKey &&
      allSettledSuccessfully
    ) {
      statsUiFlowCompletedRef.current = true;
      statsUiPendingRunKeyRef.current = null;
      addDevMetricEvent({
        kind: 'flow',
        status: 'info',
        name: 'statistics:ui-load',
        message: 'Statistics view was served from cache without a new fetch cycle.',
        meta: {
          scopeKey,
          from: statsParams.from ?? null,
          to: statsParams.to ?? null,
          projectId: statsParams.projectId ?? null,
          type: statsParams.type ?? null,
          weekdays: statsParams.weekdays?.join(',') ?? null,
          cacheHit: true,
        },
      });
      return;
    }

    const flowId = statsUiFlowIdRef.current;
    if (!flowId || statsUiFlowCompletedRef.current) return;

    for (const queryState of queryStates) {
      if (queryState.isFetching) {
        statsUiFetchSeenRef.current[queryState.key] = true;
      }
      if (queryState.status === 'success' && !statsUiFlowMarksRef.current[queryState.key]) {
        statsUiFlowMarksRef.current[queryState.key] = true;
        markDevFlow(flowId, queryState.label, {
          rows: queryState.size,
          fetched: Boolean(statsUiFetchSeenRef.current[queryState.key]),
        });
      }
    }

    const failedQueries = queryStates
      .filter((queryState) => queryState.isError)
      .map((queryState) => queryState.key);
    if (failedQueries.length > 0) {
      statsUiFlowCompletedRef.current = true;
      statsUiPendingRunKeyRef.current = null;
      finishDevFlow(flowId, 'error', { failedQueries });
      return;
    }

    if (allSettledSuccessfully) {
      statsUiFlowCompletedRef.current = true;
      statsUiPendingRunKeyRef.current = null;
      finishDevFlow(flowId, 'success', {
        from: statsParams.from ?? null,
        to: statsParams.to ?? null,
        projectId: statsParams.projectId ?? null,
        type: statsParams.type ?? null,
        weekdays: statsParams.weekdays?.join(',') ?? null,
        totalActivities: summary?.totalActivities ?? totalActivities,
      });
    }
  }, [
    byCategory,
    byCohort,
    byType,
    gender,
    overviewQ.isError,
    overviewQ.isFetching,
    overviewQ.status,
    scopeKey,
    statsRunKey,
    statsParams.from,
    statsParams.projectId,
    statsParams.type,
    statsParams.to,
    statsParams.weekdays,
    summary,
    totalActivities,
    timeseries,
  ]);

  const filteredProjects = useMemo(
    () =>
      selectedType ? projectsAll.filter((project) => project.type === selectedType) : projectsAll,
    [projectsAll, selectedType],
  );

  // If the selected project disappears (e.g. archived/deleted) or no longer matches the type filter, reset to "all"
  useEffect(() => {
    if (!projectId) return;
    if (!filteredProjects.some((project) => project.id === projectId)) setProjectId('');
  }, [filteredProjects, projectId]);

  // Monatsnamen für die Anzeige
  const MONTH_NAMES = [
    autoT('ui_626267415e7c'),
    autoT('ui_9aaceea74e57'),
    autoT('ui_0b30c927854e'),
    autoT('ui_a0393902db1f'),
    autoT('ui_afe526a6c998'),
    autoT('ui_7e1115bd02bb'),
    autoT('ui_aeb2d1b92e62'),
    autoT('ui_69d97c5797dc'),
    autoT('ui_1c542e79c9b4'),
    autoT('ui_ef2a59835205'),
    autoT('ui_3c5bf776f5ef'),
    autoT('ui_dbaab22b8b0f'),
  ];
  const MONTH_NAMES_SHORT = [
    autoT('ui_efed3690ea22'),
    autoT('ui_dc8415ccfe52'),
    autoT('ui_365b0a1446a1'),
    autoT('ui_befde54a108c'),
    autoT('ui_afe526a6c998'),
    autoT('ui_6d90df3be4d0'),
    autoT('ui_b737558468d7'),
    autoT('ui_75629af51d7c'),
    autoT('ui_fdd289e370bd'),
    autoT('ui_45071a113a68'),
    autoT('ui_bb9bfefd5391'),
    autoT('ui_99ae802ea663'),
  ];

  const formatWeekdayDisplay = (weekdays: number[]) =>
    normalizeWeekdays(weekdays)
      .map(
        (weekday) =>
          WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.shortLabel ?? `#${weekday}`,
      )
      .join(', ');

  const byTypeData = (byType || []).map((d, i) => ({
    name: TYPE_LABEL[d.type] || d.type,
    value: d.count,
    color: COLORS[i % COLORS.length],
  }));
  const isDarkTheme = isDarkThemeName(resolveThemeName(user?.theme, user?.themeMode));
  const chartSeparatorColor = isDarkTheme
    ? 'rgba(148, 163, 184, 0.2)'
    : 'rgba(255, 255, 255, 0.92)';
  const chartLegendTextColor = isDarkTheme ? '#c9d5eb' : '#4b5563';
  const chartValueLabelColor = isDarkTheme ? '#f8fbff' : '#374151';
  const chartValueLabelStroke = isDarkTheme ? 'rgba(8, 14, 26, 0.92)' : 'rgba(255, 255, 255, 0.9)';
  const chartGridColor = isDarkTheme ? 'rgba(148, 163, 184, 0.28)' : 'rgba(107, 114, 128, 0.35)';
  const chartAxisTick = { fontSize: 12, fill: chartLegendTextColor } as const;
  const lineChartMargin = isMobile
    ? { top: 10, right: 6, left: -14, bottom: 0 }
    : { top: 10, right: 20, left: 0, bottom: 0 };
  const compactBarChartMargin = isMobile
    ? { top: 16, right: 6, left: -14, bottom: 0 }
    : { top: 20, right: 20, left: 0, bottom: 0 };
  const compactBarChartMarginWithBottom = isMobile
    ? { top: 16, right: 6, left: -14, bottom: 4 }
    : { top: 20, right: 20, left: 0, bottom: 8 };
  const chartTooltipContentStyle = {
    // Keep tooltip colors explicit so interactive and exported charts remain legible.
    backgroundColor: isDarkTheme ? 'rgba(30, 34, 52, 0.96)' : 'rgba(255, 255, 255, 0.96)',
    borderColor: isDarkTheme ? 'rgba(148, 163, 184, 0.32)' : 'rgba(107, 114, 128, 0.24)',
    borderRadius: '12px',
    boxShadow: isDarkTheme
      ? '0 10px 34px rgba(0, 0, 0, 0.38)'
      : '0 8px 26px rgba(76, 79, 105, 0.1)',
    color: isDarkTheme ? '#c9d5eb' : '#374151',
  } as const;
  const chartTooltipLabelStyle = {
    color: chartLegendTextColor,
    fontWeight: 600,
  } as const;
  const chartTooltipItemStyle = {
    color: chartValueLabelColor,
  } as const;
  const lineChartCursor = {
    stroke: isDarkTheme ? 'rgba(148, 163, 184, 0.32)' : 'rgba(107, 114, 128, 0.24)',
    strokeWidth: 1,
    strokeDasharray: '4 4',
  };
  const barChartCursor = isDarkTheme
    ? { fill: 'rgba(110, 168, 255, 0.14)' }
    : { fill: 'rgba(91, 108, 255, 0.08)' };
  const pieLegendWrapperStyle = {
    color: chartLegendTextColor,
    fontSize: '13px',
    lineHeight: '20px',
    paddingTop: '10px',
    paddingLeft: isMobile ? '12px' : '0px',
    paddingRight: isMobile ? '12px' : '0px',
  } as const;
  const byTypePieCenterY = isMobile ? '41%' : '45%';
  const byTypeOuterRadius = isMobile ? 68 : 88;
  const genderPieCenterY = isMobile ? '42%' : '46%';
  const genderInnerRadius = isMobile ? 44 : 54;
  const genderOuterRadius = isMobile ? 72 : 88;
  const cohortPieCenterY = isMobile ? '41%' : '45%';
  const cohortPieOuterRadius = isMobile ? 60 : 76;
  const mobilePrimaryTextClass = isDarkTheme ? 'text-slate-100' : 'text-slate-900';
  const mobileSecondaryTextClass = isDarkTheme ? 'text-slate-300' : 'text-slate-700';
  const mobileLabelTextClass = isDarkTheme ? 'text-slate-400' : 'text-slate-600';
  const mobileSurfaceClass = isDarkTheme
    ? 'border-white/10 bg-white/5 text-slate-100'
    : 'border-gray-300 bg-white text-slate-800';
  const mobileSurfaceHoverClass = isDarkTheme ? 'hover:bg-white/10' : 'hover:bg-gray-50';
  const mobileMutedSurfaceClass = isDarkTheme
    ? 'bg-white/6 text-slate-100'
    : 'bg-gray-100 text-slate-900';
  const mobileSoftSurfaceClass = isDarkTheme
    ? 'bg-white/[0.05] text-slate-300'
    : 'bg-gray-50 text-slate-700';
  const mobileSoftSurfaceHoverClass = isDarkTheme ? 'hover:bg-white/[0.10]' : 'hover:bg-gray-100';
  const mobileDashedSurfaceClass = isDarkTheme
    ? 'border-white/10 bg-white/[0.04] text-slate-300'
    : 'border-gray-300 bg-gray-50 text-slate-600';
  const mobileDividerClass = isDarkTheme ? 'border-white/10' : 'border-gray-100';
  const mobileFilterCardStyle = {
    background: isDarkTheme
      ? 'radial-gradient(circle at top right, rgba(96, 165, 250, 0.18) 0%, transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, var(--surface-elevated) 34%, var(--surface-2) 100%)'
      : 'radial-gradient(circle at top right, rgba(96, 165, 250, 0.16) 0%, transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, var(--surface-elevated) 40%, var(--surface-2) 100%)',
    borderColor: 'var(--border-strong)',
    boxShadow: isDarkTheme
      ? '0 24px 48px rgba(0, 0, 0, 0.34)'
      : '0 18px 34px rgba(15, 23, 42, 0.12)',
  } as const;

  const genderData = gender
    ? [
        { name: autoT('ui_221d26dc16fc'), value: gender.male, color: '#60a5fa' },
        { name: 'weiblich', value: gender.female, color: '#f472b6' },
        { name: 'divers', value: gender.diverse, color: '#a78bfa' },
      ]
    : [];
  // Hinweis: genderTotal wird für Tooltip nicht mehr benötigt, da dort absolute Werte gezeigt werden

  // Aggregierte Timeseries-Daten basierend auf timeAggregation
  const aggregatedTimeseries = useMemo(() => {
    if (!timeseries || timeseries.length === 0) return [];

    const getWeekKey = (dateStr: string) => {
      const d = new Date(dateStr);
      // ISO week number
      const jan4 = new Date(d.getFullYear(), 0, 4);
      const dayOfYear =
        Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
      const weekNum = Math.ceil((dayOfYear + jan4.getDay() - 1) / 7);
      return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    };

    const getMonthKey = (dateStr: string) => {
      return dateStr.slice(0, 7); // YYYY-MM
    };

    if (timeAggregation === 'day') {
      if (showAverage) {
        return timeseries.map((item) => {
          const count = item.activityCount || 1;
          return {
            date: item.date,
            totalParticipants: Math.round((item.totalParticipants / count) * 10) / 10,
          };
        });
      }
      return timeseries;
    }

    const grouped = new Map<string, { total: number; activityCount: number }>();

    for (const item of timeseries) {
      const key = timeAggregation === 'week' ? getWeekKey(item.date) : getMonthKey(item.date);
      const current = grouped.get(key) || { total: 0, activityCount: 0 };
      current.total += item.totalParticipants;
      current.activityCount += item.activityCount || 0;
      grouped.set(key, current);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        totalParticipants: showAverage
          ? data.activityCount > 0
            ? Math.round((data.total / data.activityCount) * 10) / 10
            : 0
          : data.total,
      }));
  }, [timeseries, timeAggregation, showAverage]);

  const totalParticipantsPerHour = useMemo(() => {
    const totalDurationHours = (summary?.totalDurationMinutes ?? 0) / 60;
    if (totalDurationHours <= 0) return 0;
    return (summary?.totalParticipants ?? 0) / totalDurationHours;
  }, [summary?.totalDurationMinutes, summary?.totalParticipants]);

  const averageHoursPerActivity = useMemo(() => {
    const activityCount = summary?.totalActivities ?? 0;
    if (activityCount <= 0) return 0;
    return (summary?.totalDurationMinutes ?? 0) / activityCount / 60;
  }, [summary?.totalActivities, summary?.totalDurationMinutes]);

  const averageActivitiesPerWeek = useMemo(() => {
    const activityCount = summary?.totalActivities ?? 0;
    if (activityCount <= 0) return 0;

    const firstActivityDate = timeseries?.[0]?.date;
    const lastActivityDate = timeseries?.[timeseries.length - 1]?.date;
    const weekSpan = getInclusiveWeekSpan(from || firstActivityDate, to || lastActivityDate);

    if (weekSpan <= 0) return 0;
    return activityCount / weekSpan;
  }, [from, summary?.totalActivities, timeseries, to]);

  // Pagination für Aktivitäten
  const totalActivityPages = Math.max(1, Math.ceil(totalActivities / ACTIVITIES_PER_PAGE));

  // Reset page when filters change
  useEffect(() => {
    setActivitiesPage(1);
  }, [
    from,
    to,
    projectId,
    selectedType,
    selectedExecutionStatuses,
    selectedClosureState,
    selectedWeekdays,
  ]);

  const fmtNumber = (n?: number) =>
    typeof n === 'number' ? n.toLocaleString(getCurrentIntlLocale()) : '0';

  const topDays = useMemo(() => {
    return buildTopDayChartData(timeseries, showAverage);
  }, [showAverage, timeseries]);

  // Color maps
  const tagColor = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const t of tagsAll as Array<{ id: string; color?: string | null }>)
      m.set(t.id, t.color || undefined);
    return m;
  }, [tagsAll]);
  const projectColor = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const p of projectsAll as Array<{ id: string; color?: string | null }>)
      m.set(p.id, p.color || undefined);
    return m;
  }, [projectsAll]);
  const projectImage = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projectsAll) {
      const imageUrl = typeof p.imageUrl === 'string' ? p.imageUrl.trim() : '';
      if (imageUrl) m.set(p.id, imageUrl);
    }
    return m;
  }, [projectsAll]);
  const sortedProjects = useMemo(
    () =>
      filteredProjects
        .slice()
        .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'de')),
    [filteredProjects],
  );
  const selectedProjectRecord = useMemo(
    () =>
      sortedProjects.find((project) => project.id === projectId) ??
      projectsAll.find((project) => project.id === projectId) ??
      null,
    [projectId, projectsAll, sortedProjects],
  );
  const useDesktopProjectCollapse =
    !isMobile && sortedProjects.length > DESKTOP_PROJECT_CHIP_COLLAPSE_THRESHOLD;
  const visibleDesktopProjects = useMemo(() => {
    return getVisibleSelectedItems({
      items: sortedProjects,
      selectedId: projectId,
      expanded: !useDesktopProjectCollapse || desktopProjectFilterExpanded,
      visibleCount: DESKTOP_PROJECT_CHIP_VISIBLE_COUNT,
    });
  }, [desktopProjectFilterExpanded, projectId, sortedProjects, useDesktopProjectCollapse]);
  const hiddenDesktopProjectCount = Math.max(
    sortedProjects.length - visibleDesktopProjects.length,
    0,
  );
  const useMobileTypeCollapse =
    isMobile && STATISTICS_TYPE_OPTIONS.length > MOBILE_TYPE_CHIP_VISIBLE_COUNT;
  const visibleMobileTypes = useMemo(() => {
    if (!useMobileTypeCollapse || mobileTypeFilterExpanded) return STATISTICS_TYPE_OPTIONS;

    const initialTypes = STATISTICS_TYPE_OPTIONS.slice(0, MOBILE_TYPE_CHIP_VISIBLE_COUNT);
    if (!selectedType || initialTypes.includes(selectedType)) return initialTypes;

    return [...initialTypes, selectedType];
  }, [mobileTypeFilterExpanded, selectedType, useMobileTypeCollapse]);
  const hiddenMobileTypeCount = Math.max(
    STATISTICS_TYPE_OPTIONS.length - new Set(visibleMobileTypes).size,
    0,
  );
  const useMobileProjectCollapse =
    isMobile && sortedProjects.length > MOBILE_PROJECT_CHIP_VISIBLE_COUNT;
  const visibleMobileProjects = useMemo(() => {
    return getVisibleSelectedItems({
      items: sortedProjects,
      selectedId: projectId,
      expanded: !useMobileProjectCollapse || mobileProjectFilterExpanded,
      visibleCount: MOBILE_PROJECT_CHIP_VISIBLE_COUNT,
    });
  }, [mobileProjectFilterExpanded, projectId, sortedProjects, useMobileProjectCollapse]);
  const hiddenMobileProjectCount = Math.max(
    sortedProjects.length - visibleMobileProjects.length,
    0,
  );
  useEffect(() => {
    if (!useDesktopProjectCollapse && desktopProjectFilterExpanded) {
      setDesktopProjectFilterExpanded(false);
    }
  }, [desktopProjectFilterExpanded, useDesktopProjectCollapse]);
  useEffect(() => {
    setMobileFiltersExpanded(!isMobile);
    setMobileTypeFilterExpanded(false);
    setMobileProjectFilterExpanded(false);
  }, [isMobile]);
  const fallbackBarColors = [
    '#2563eb',
    '#f59e0b',
    '#10b981',
    '#ef4444',
    '#8b5cf6',
    '#14b8a6',
    '#eab308',
    '#0ea5e9',
    '#a855f7',
  ];
  const topCategoryChartData = useMemo(() => (byCategory || []).slice(0, 10), [byCategory]);
  const cohortChartData = useMemo(() => {
    const cohorts = Array.isArray(byCohort) ? byCohort : [];
    if (!showAverage) return cohorts;

    const activityCount = summary?.totalActivities ?? 0;
    return cohorts.map((entry) => ({
      ...entry,
      chartValue: activityCount > 0 ? Math.round((entry.total / activityCount) * 10) / 10 : 0,
    }));
  }, [byCohort, showAverage, summary?.totalActivities]);
  const cohortPieData = useMemo(
    () =>
      cohortChartData
        .map((entry) => {
          const metricValue =
            showAverage && 'chartValue' in entry && typeof entry.chartValue === 'number'
              ? entry.chartValue
              : entry.total;

          return {
            ...entry,
            metricValue,
          };
        })
        .filter((entry) => (entry.metricValue ?? 0) > 0)
        .map((entry, index) => ({
          name: (() => {
            const cohort = (cohortsForStatistics as Cohort[]).find(
              (item) => item.id === entry.cohortId,
            );
            return cohort
              ? `${cohort.minAge}–${cohort.maxAge} ${autoT('ui_b0bf2144b683')}`
              : entry.name;
          })(),
          value: entry.metricValue,
          color: fallbackBarColors[index % fallbackBarColors.length],
        })),
    [cohortChartData, cohortsForStatistics, fallbackBarColors, showAverage],
  );

  const renderPieValueLabel = (showAbsoluteValue: boolean) =>
    createPieValueLabelRenderer({
      showAbsoluteValue,
      fallbackColor: chartValueLabelColor,
      strokeColor: chartValueLabelStroke,
      formatNumber: fmtNumber,
    });

  const ValueLabel = useMemo(
    () =>
      createBarValueLabelRenderer({
        fillColor: chartValueLabelColor,
        strokeColor: chartValueLabelStroke,
      }),
    [chartValueLabelColor, chartValueLabelStroke],
  );

  const exportRangeLabel = buildStatisticsExportRangeLabel(from, to);
  const isActivityTypesExporting = activeChartExport?.startsWith('activity-types:') ?? false;
  const isGenderDistributionExporting =
    activeChartExport?.startsWith('gender-distribution:') ?? false;
  const isCohortsExporting = activeChartExport?.startsWith('cohorts:') ?? false;
  const isParticipantsTrendExporting =
    activeChartExport?.startsWith('participants-trend:') ?? false;

  const setChartCardRef = (chartId: string) => (node: HTMLDivElement | null) => {
    chartCardRefs.current[chartId] = node;
  };

  const getChartFileName = (chartTitle: string, extension: ChartExportFormat) => {
    return buildStatisticsChartFileName({
      orgName: user?.orgName,
      chartTitle,
      exportRangeLabel,
      extension,
    });
  };

  const getActivitiesExportFileName = (extension: ActivitiesExportFormat) => {
    return buildStatisticsActivitiesFileName({
      orgName: user?.orgName,
      exportRangeLabel,
      extension,
    });
  };

  const getControllingExportFileName = () => {
    return buildStatisticsControllingFileName({
      orgName: user?.orgName,
      exportRangeLabel,
    });
  };

  const fetchAllFilteredActivities = async () => {
    return fetchAllActivities(activitiesParams, scope);
  };

  const beginExport = () => {
    if (exportInProgressRef.current) {
      showToast('Ein Export wird bereits erstellt.', { type: 'info' });
      return false;
    }

    exportInProgressRef.current = true;
    setIsExportInProgress(true);
    return true;
  };

  const finishExport = () => {
    exportInProgressRef.current = false;
    setIsExportInProgress(false);
  };

  async function exportActivitiesTable(format: ActivitiesExportFormat) {
    if (!beginExport()) return;

    setActiveActivitiesExport(format);
    setExportProgress(autoT('ui_cde99ee62070'));

    try {
      await new Promise(requestAnimationFrame);
      const activities = await fetchAllFilteredActivities();
      if (format === 'xlsx') {
        await runActivitiesExcelExport({
          activities,
          fileName: getActivitiesExportFileName('xlsx'),
          getTypeLabel: getActivityTypeLabel,
          onProgress: setExportProgress,
        });
        return;
      }

      await runActivitiesPdfExport({
        activities,
        fileName: getActivitiesExportFileName('pdf'),
        orgName: user?.orgName,
        exportRangeLabel,
        getTypeLabel: getActivityTypeLabel,
        onProgress: setExportProgress,
      });
    } catch (error) {
      console.error('Activities export failed', error);
      showToast('Die Aktivitätenliste konnte nicht exportiert werden. Bitte erneut versuchen.', {
        type: 'error',
        durationMs: 5000,
      });
    } finally {
      setActiveActivitiesExport(null);
      setExportProgress(null);
      finishExport();
    }
  }

  async function exportControllingData() {
    if (!beginExport()) return;

    setIsControllingExporting(true);
    setExportProgress(autoT('ui_cde99ee62070'));

    try {
      await new Promise(requestAnimationFrame);
      const activities = await fetchAllFilteredActivities();
      await runControllingExcelExport({
        activities,
        cohorts: cohortsAll as Cohort[],
        projects: projectsAll,
        weeklyProfile,
        exportRangeLabel,
        fileName: getControllingExportFileName(),
        fetchLogbookEntries: () =>
          fetchAllLogbookEntries({
            from: from || undefined,
            to: to || undefined,
            projectId: projectId || undefined,
          }),
        getTypeLabel: getActivityTypeLabel,
        onProgress: setExportProgress,
      });
    } catch (error) {
      console.error('Controlling export failed', error);
      showToast('Der Controlling-Export konnte nicht erstellt werden. Bitte erneut versuchen.', {
        type: 'error',
        durationMs: 5000,
      });
    } finally {
      setIsControllingExporting(false);
      setExportProgress(null);
      finishExport();
    }
  }

  async function exportChart(chartId: string, chartTitle: string, format: ChartExportFormat) {
    const card = chartCardRefs.current[chartId];
    if (!card) return;
    if (!beginExport()) return;

    const exportKey = `${chartId}:${format}`;
    setActiveChartExport(exportKey);
    setExportProgress(
      format === 'pdf' ? autoT('ui_70aa98ab3b7d') : 'Diagramm wird als Bild aufbereitet …',
    );
    // The browser-native export capture applies a static export palette to
    // the cloned chart, leaving the interactive page untouched.
    card.classList.add('statistics-pdf-export-card');

    try {
      const { JsPDF } = await loadPdfExportDependencies();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);

      const canvas =
        chartId === 'participants-trend'
          ? await renderParticipantsTrendCanvas(card, chartTitle)
          : await captureExportNode(card, {
              scale: PDF_RENDER_SCALE,
              ignoreElements: (element) =>
                element instanceof HTMLElement && element.dataset.chartExportIgnore === 'true',
            });

      if (format === 'png') {
        setExportProgress(autoT('ui_8b3d272f0e55'));
        await new Promise(requestAnimationFrame);
        const blob = await canvasToBlob(canvas);
        downloadBlob(blob, getChartFileName(chartTitle, 'png'));
        return;
      }

      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new JsPDF({ orientation, unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const availableWidth = pageWidth - PDF_MARGIN_MM * 2;
      const availableHeight = pageHeight - CHART_EXPORT_HEADER_HEIGHT_MM - PDF_MARGIN_MM;
      const scale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
      const imageWidth = canvas.width * scale;
      const imageHeight = canvas.height * scale;
      const imageX = (pageWidth - imageWidth) / 2;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text(chartTitle, PDF_MARGIN_MM, 16);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.text(exportRangeLabel, PDF_MARGIN_MM, 23);
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        imageX,
        CHART_EXPORT_HEADER_HEIGHT_MM,
        imageWidth,
        imageHeight,
        undefined,
        'FAST',
      );
      setExportProgress(autoT('ui_0acf469c6a6c'));
      await new Promise(requestAnimationFrame);
      pdf.save(getChartFileName(chartTitle, 'pdf'));
    } catch (error) {
      console.error('Chart export failed', error);
      showToast('Das Diagramm konnte nicht exportiert werden. Bitte erneut versuchen.', {
        type: 'error',
        durationMs: 5000,
      });
    } finally {
      card.classList.remove('statistics-pdf-export-card');
      setActiveChartExport(null);
      setExportProgress(null);
      finishExport();
    }
  }

  const renderChartExportActions = (chartId: string, chartTitle: string) => {
    const isExporting =
      isExportInProgress || (activeChartExport?.startsWith(`${chartId}:`) ?? false);

    return (
      <StatisticsExportActions
        triggerLabel={`${chartTitle} exportieren`}
        menuTitle={autoT('ui_ef0c79fa89b2')}
        isExporting={isExporting}
        options={[
          {
            label: autoT('ui_eac2deaf6270'),
            meta: 'Bild',
            onClick: () => void exportChart(chartId, chartTitle, 'png'),
          },
          {
            label: autoT('ui_d2ca42015ecd'),
            meta: 'A4',
            onClick: () => void exportChart(chartId, chartTitle, 'pdf'),
          },
        ]}
      />
    );
  };

  const renderActivitiesExportActions = () => {
    const isExporting = isExportInProgress || activeActivitiesExport !== null;

    return (
      <StatisticsExportActions
        triggerLabel={autoT('ui_1f89e26bb68a')}
        menuTitle={autoT('ui_1f89e26bb68a')}
        isExporting={isExporting}
        options={[
          {
            label: autoT('ui_d2ca42015ecd'),
            meta: 'Komplett',
            onClick: () => void exportActivitiesTable('pdf'),
          },
          {
            label: autoT('ui_27c7a74a3136'),
            meta: 'Komplett',
            onClick: () => void exportActivitiesTable('xlsx'),
          },
        ]}
      />
    );
  };

  async function exportPdf(includeActivities: boolean) {
    // Render the report container to images and assemble into a PDF (A4 portrait)
    if (!reportRef.current) return;
    if (!beginExport()) return;

    try {
      setExportProgress(
        includeActivities
          ? 'Aktivitäten werden geladen. Das kann bei großen Datenmengen etwas dauern …'
          : 'PDF-Bericht wird vorbereitet …',
      );
      // Give React a frame to render the blocking progress dialog before the
      // paginated requests begin. This prevents accidental parallel exports.
      await new Promise(requestAnimationFrame);
      const activitiesForPdf = includeActivities ? await fetchAllFilteredActivities() : [];
      setPdfMode(true);
      setExportProgress(autoT('ui_c49a3f591c68'));
      const { JsPDF } = await loadPdfExportDependencies();
      await new Promise(requestAnimationFrame);
      const el = reportRef.current;
      if (!el) return;

      await new Promise(requestAnimationFrame);
      const renderScale = Math.min(
        PDF_RENDER_SCALE,
        Math.max(1, PDF_MAX_RENDER_HEIGHT_PX / Math.max(el.scrollHeight, 1)),
      );
      const canvas = await captureExportNode(el, {
        scale: renderScale,
      });

      const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      setExportProgress(autoT('ui_cd0d0b4b7c4d'));
      await new Promise(requestAnimationFrame);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const orgTitle = user?.orgName || autoT('ui_6e99c1d3b150');
      const dateRange = [from, to].filter(Boolean).join(' bis ');
      const availableWidth = pageWidth - PDF_MARGIN_MM * 2;
      const availableHeight = pageHeight - PDF_HEADER_HEIGHT_MM - PDF_MARGIN_MM;
      const mmPerPx = availableWidth / canvas.width;
      const pageHeightPx = Math.floor(availableHeight / mmPerPx);
      const breakpoints = collectPdfBreakpoints(el, canvas);
      const slices = buildPdfSlices(canvas.height, pageHeightPx, breakpoints);

      slices.forEach((slice, index) => {
        const sliceCanvas = createCanvasSlice(canvas, slice.startPx, slice.endPx);
        if (!sliceCanvas) return;

        if (index > 0) {
          pdf.addPage('a4', 'portrait');
        }

        addPdfPageHeader(pdf, orgTitle, dateRange);
        pdf.addImage(
          sliceCanvas.toDataURL('image/png'),
          'PNG',
          PDF_MARGIN_MM,
          PDF_HEADER_HEIGHT_MM,
          availableWidth,
          (slice.endPx - slice.startPx) * mmPerPx,
          undefined,
          'FAST',
        );
      });

      if (includeActivities && activitiesForPdf.length > 0) {
        setExportProgress('Aktivitätenliste wird hinzugefügt …');
        await new Promise(requestAnimationFrame);
        appendActivitiesTableToPdf(
          pdf,
          activitiesForPdf,
          orgTitle,
          dateRange,
          getActivityTypeLabel,
        );
      }

      setExportProgress(autoT('ui_0acf469c6a6c'));
      await new Promise(requestAnimationFrame);
      pdf.save(`StatO-Bericht-${orgTitle.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Statistics PDF export failed', error);
      showToast('Der PDF-Bericht konnte nicht erstellt werden. Bitte erneut versuchen.', {
        type: 'error',
        durationMs: 5000,
      });
    } finally {
      setPdfMode(false);
      setExportProgress(null);
      finishExport();
    }
  }

  return (
    <div className="relative">
      <PageHeader title={autoT('ui_23ad8442dc9f')} />

      {/* Time Range Selector */}
      <SurfaceCard className="mb-6">
        {(() => {
          const openAdvancedFilters = () => {
            setTempFrom(isCustomRange ? from : '');
            setTempTo(isCustomRange ? to : '');
            setTempSelectedWeekdays(selectedWeekdays);
            setTempSelectedExecutionStatuses(effectiveExecutionStatuses);
            setTempSelectedClosureState(selectedClosureState);
            setCustomFilterOpen(true);
          };

          if (isMobile) {
            return (
              <div className="space-y-4">
                <div className="rounded-2xl border p-4 shadow-sm" style={mobileFilterCardStyle}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${mobileLabelTextClass}`}
                      >
                        {autoT('ui_a0ee12af77e5')}
                      </div>
                      <div
                        className={`mt-1 text-lg font-semibold truncate ${mobilePrimaryTextClass}`}
                      >
                        {formatRangeDisplay(MONTH_NAMES)}
                      </div>
                      <div className={`mt-1 text-sm ${mobileSecondaryTextClass}`}>
                        {isCustomRange
                          ? autoT('ui_bd97404ed7e9')
                          : filterMode === 'month'
                            ? 'Monatsansicht'
                            : selectedYear
                              ? 'Jahresansicht'
                              : autoT('ui_38fc1281b47b')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${mobileSurfaceClass} ${mobileSurfaceHoverClass}`}
                      onClick={() => setMobileFiltersExpanded((current) => !current)}
                      aria-expanded={mobileFiltersExpanded}
                    >
                      {mobileFiltersExpanded ? autoT('ui_cc193d70551f') : autoT('ui_d7decf1aa22b')}
                      {mobileFiltersExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        selectedType ? mobilePrimaryTextClass : mobileSurfaceClass
                      }`}
                      style={
                        selectedType
                          ? {
                              backgroundColor: translucent(
                                colorForActivityType(selectedType),
                                '18',
                              ),
                              borderColor: translucent(colorForActivityType(selectedType), '66'),
                            }
                          : undefined
                      }
                      onClick={() => setTypePickerOpen(true)}
                      aria-haspopup="dialog"
                      title={autoT('ui_4324a8f20ad4')}
                    >
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-full border"
                        style={{
                          backgroundColor: selectedType
                            ? colorForActivityType(selectedType)
                            : '#6b7280',
                          borderColor: selectedType
                            ? translucent(colorForActivityType(selectedType), 'aa')
                            : 'rgba(0,0,0,0.08)',
                        }}
                      />
                      {selectedType ? TYPE_LABEL[selectedType] : autoT('ui_172a950cc0da')}
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </button>

                    {selectedProjectRecord ? (
                      <button
                        type="button"
                        className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${mobilePrimaryTextClass}`}
                        style={{
                          backgroundColor: selectedProjectRecord.color
                            ? translucent(selectedProjectRecord.color, '18')
                            : undefined,
                          borderColor: selectedProjectRecord.color || undefined,
                        }}
                        onClick={() => setProjectPickerOpen(true)}
                        aria-haspopup="dialog"
                        title={selectedProjectRecord.title}
                      >
                        {selectedProjectRecord.imageUrl ? (
                          <span
                            className={`h-5 w-5 overflow-hidden rounded-full border ${isDarkTheme ? 'border-white/10 bg-white/10' : 'border-gray-300 bg-gray-100'}`}
                          >
                            <ProtectedImage
                              src={selectedProjectRecord.imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </span>
                        ) : (
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 rounded-full border"
                            style={{
                              backgroundColor: selectedProjectRecord.color || '#0f766e',
                              borderColor: 'rgba(0,0,0,0.08)',
                            }}
                          />
                        )}
                        <span className="truncate">{selectedProjectRecord.title}</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${mobileSurfaceClass} ${mobileSurfaceHoverClass}`}
                        onClick={() => setProjectPickerOpen(true)}
                        aria-haspopup="dialog"
                        title={autoT('ui_42da26b250b4')}
                      >
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 rounded-full border border-black/10 bg-gray-400"
                        />
                        {autoT('ui_b857d350e38e')}
                        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                      </button>
                    )}

                    {hasWeekdayFilter && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-viridian/20 bg-viridian/10 px-3 py-1.5 text-sm font-medium text-viridian">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatWeekdayDisplay(selectedWeekdays)}
                      </span>
                    )}

                    {hasExecutionStatusFilter && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700">
                        {formatActivityExecutionStatusList(selectedExecutionStatuses)}
                      </span>
                    )}

                    {hasClosureStateFilter && selectedClosureState && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
                        {CLOSURE_FILTER_LABELS[selectedClosureState]}
                      </span>
                    )}

                    {hasAdvancedFilter ? (
                      <FilterChip onRemove={resetAdvancedFilters}>
                        <Calendar className="h-3.5 w-3.5" />
                        {formatAdvancedFilterDisplay(MONTH_NAMES)}
                      </FilterChip>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      className={`min-w-0 flex-1 ${hasAdvancedFilter ? 'border-viridian bg-viridian/5 text-viridian hover:bg-viridian/10' : `${mobileSurfaceClass} ${mobileSurfaceHoverClass}`}`}
                      onClick={openAdvancedFilters}
                      variant="secondary"
                    >
                      <SlidersHorizontal aria-hidden="true" />
                      {autoT('ui_dc3decbb9384')}
                    </Button>
                    <Button
                      disabled={isExportInProgress}
                      onClick={() => setReportExportOpen(true)}
                      title={autoT('ui_8dbb5c1c7f40')}
                    >
                      <FileDown aria-hidden="true" />
                      {autoT('ui_f3e4fadb9e37')}
                    </Button>
                  </div>
                </div>

                {mobileFiltersExpanded && (
                  <div className={`space-y-5 border-t pt-4 ${mobileDividerClass}`}>
                    <section className="space-y-3">
                      <div
                        className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${mobileLabelTextClass}`}
                      >
                        {autoT('ui_fe359159c8ad')}
                      </div>
                      <SegmentedControl<'year' | 'month'>
                        ariaLabel={autoT('ui_fe359159c8ad')}
                        onChange={(mode) =>
                          mode === 'year' ? switchToYearView() : switchToMonthView()
                        }
                        options={[
                          { value: 'year', label: autoT('ui_956a6e5ab6c7') },
                          { value: 'month', label: autoT('ui_da13625eeb37') },
                        ]}
                        value={filterMode}
                      />

                      {filterMode === 'month' && !isCustomRange ? (
                        <>
                          <div className="flex items-center gap-2">
                            <IconButton
                              aria-label={autoT('ui_9c52ab5061fe')}
                              className={mobileSurfaceClass}
                              onClick={() => navigateMonth('prev')}
                              size="icon-touch"
                              title={autoT('ui_9c52ab5061fe')}
                              variant="secondary"
                            >
                              <ChevronLeft aria-hidden="true" />
                            </IconButton>
                            <div
                              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium ${mobileSoftSurfaceClass}`}
                            >
                              <Calendar className={`h-4 w-4 ${mobileLabelTextClass}`} />
                              <span className="truncate">
                                {selectedMonth !== null
                                  ? MONTH_NAMES[selectedMonth - 1]
                                  : MONTH_NAMES[currentMonth - 1]}{' '}
                                {selectedYear || currentYear}
                              </span>
                            </div>
                            <IconButton
                              aria-label={autoT('ui_ad21607e5b49')}
                              className={mobileSurfaceClass}
                              onClick={() => navigateMonth('next')}
                              size="icon-touch"
                              title={autoT('ui_ad21607e5b49')}
                              variant="secondary"
                            >
                              <ChevronRight aria-hidden="true" />
                            </IconButton>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {MONTH_NAMES_SHORT.map((name, idx) => {
                              const month = idx + 1;
                              const isActive = selectedMonth === month;
                              const isCurrent =
                                month === currentMonth && selectedYear === String(currentYear);
                              return (
                                <button
                                  key={month}
                                  type="button"
                                  className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                                    isActive
                                      ? 'bg-viridian text-white'
                                      : isCurrent
                                        ? 'bg-viridian/10 text-viridian'
                                        : mobileSoftSurfaceClass
                                  }`}
                                  onClick={() => selectMonth(month)}
                                >
                                  {name}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                              !selectedYear && !isCustomRange
                                ? 'bg-viridian text-white'
                                : mobileMutedSurfaceClass
                            }`}
                            onClick={() => selectYear('')}
                          >
                            {autoT('ui_4c7a986ffe2b')}
                          </button>
                          {activityYears.map((y) => (
                            <button
                              key={y}
                              type="button"
                              className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                                selectedYear === y && !isCustomRange
                                  ? 'bg-viridian text-white'
                                  : mobileMutedSurfaceClass
                              }`}
                              onClick={() => selectYear(y)}
                            >
                              {y}
                            </button>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className={`text-sm font-medium ${mobilePrimaryTextClass}`}>
                          {autoT('ui_de9f4ac20f7f')}
                        </div>
                        {useMobileTypeCollapse && (
                          <button
                            type="button"
                            onClick={() => setMobileTypeFilterExpanded((current) => !current)}
                            className={`inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium ${mobileDashedSurfaceClass} ${mobileSoftSurfaceHoverClass}`}
                            aria-expanded={mobileTypeFilterExpanded}
                          >
                            {mobileTypeFilterExpanded ? (
                              <>
                                <ChevronUp className="h-3.5 w-3.5" />
                                {autoT('ui_cc193d70551f')}
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3.5 w-3.5" />
                                {hiddenMobileTypeCount}
                                {autoT('ui_1960ac5a2d44')}
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedType('')}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                            !selectedType
                              ? 'bg-viridian text-white border-viridian'
                              : mobileSurfaceClass
                          }`}
                        >
                          {autoT('ui_172a950cc0da')}
                        </button>
                        {(useMobileTypeCollapse ? visibleMobileTypes : STATISTICS_TYPE_OPTIONS).map(
                          (type) => {
                            const active = selectedType === type;
                            const typeColor = colorForActivityType(type);
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setSelectedType(type)}
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                                  active
                                    ? 'text-white shadow ring-2 ring-offset-1 ring-viridian/20'
                                    : 'text-gray-800'
                                }`}
                                style={{
                                  backgroundColor: active
                                    ? typeColor
                                    : translucent(typeColor, '14'),
                                  borderColor: active ? typeColor : translucent(typeColor, '66'),
                                }}
                              >
                                <span
                                  aria-hidden
                                  className="h-2.5 w-2.5 rounded-full border"
                                  style={{
                                    backgroundColor: active ? 'rgba(255,255,255,0.9)' : typeColor,
                                    borderColor: active
                                      ? 'rgba(255,255,255,0.35)'
                                      : translucent(typeColor, 'aa'),
                                  }}
                                />
                                {TYPE_LABEL[type]}
                              </button>
                            );
                          },
                        )}
                      </div>
                    </section>

                    {projectsAll.length > 0 && (
                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className={`text-sm font-medium ${mobilePrimaryTextClass}`}>
                            {autoT('ui_3930f79f07e5')}
                          </div>
                          {useMobileProjectCollapse && sortedProjects.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setMobileProjectFilterExpanded((current) => !current)}
                              className={`inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium ${mobileDashedSurfaceClass} ${mobileSoftSurfaceHoverClass}`}
                              aria-expanded={mobileProjectFilterExpanded}
                            >
                              {mobileProjectFilterExpanded ? (
                                <>
                                  <ChevronUp className="h-3.5 w-3.5" />
                                  {autoT('ui_cc193d70551f')}
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3.5 w-3.5" />
                                  {hiddenMobileProjectCount}
                                  {autoT('ui_1960ac5a2d44')}
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {sortedProjects.length === 0 ? (
                          <div
                            className={`rounded-xl border border-dashed px-4 py-3 text-sm ${mobileDashedSurfaceClass}`}
                          >
                            {autoT('ui_63c009ada12c')}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setProjectId('')}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                                !projectId
                                  ? 'bg-viridian text-white border-viridian'
                                  : mobileSurfaceClass
                              }`}
                            >
                              {autoT('ui_b857d350e38e')}
                            </button>
                            {(useMobileProjectCollapse
                              ? visibleMobileProjects
                              : sortedProjects
                            ).map((p) => {
                              const active = projectId === p.id;
                              const color =
                                typeof p.color === 'string' && p.color.trim()
                                  ? p.color.trim()
                                  : undefined;
                              const imageUrl =
                                typeof p.imageUrl === 'string' && p.imageUrl.trim()
                                  ? p.imageUrl.trim()
                                  : undefined;
                              const overlayColor = color || '#0f766e';

                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setProjectId(p.id)}
                                  className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                                    active
                                      ? 'text-white shadow ring-2 ring-offset-1 ring-viridian/20'
                                      : 'text-gray-800'
                                  }`}
                                  style={{
                                    backgroundColor: active
                                      ? overlayColor
                                      : color
                                        ? translucent(overlayColor, '14')
                                        : undefined,
                                    borderColor: active ? overlayColor : color || undefined,
                                  }}
                                  title={p.title}
                                >
                                  {imageUrl ? (
                                    <span
                                      className={`h-6 w-6 overflow-hidden rounded-full border ${
                                        active
                                          ? 'border-white/35 bg-white/15'
                                          : 'border-gray-300 bg-gray-100'
                                      }`}
                                    >
                                      <ProtectedImage
                                        src={imageUrl}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    </span>
                                  ) : (
                                    <span
                                      aria-hidden
                                      className="h-2.5 w-2.5 rounded-full border"
                                      style={{
                                        backgroundColor: overlayColor,
                                        borderColor: active
                                          ? 'rgba(255,255,255,0.45)'
                                          : 'rgba(0,0,0,0.08)',
                                      }}
                                    />
                                  )}
                                  <span className="truncate">{p.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    )}
                  </div>
                )}
              </div>
            );
          }

          return (
            <>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
                <SegmentedControl<'year' | 'month'>
                  ariaLabel={autoT('ui_fe359159c8ad')}
                  className="self-start"
                  onChange={(mode) => (mode === 'year' ? switchToYearView() : switchToMonthView())}
                  options={[
                    { value: 'year', label: autoT('ui_956a6e5ab6c7') },
                    { value: 'month', label: autoT('ui_da13625eeb37') },
                  ]}
                  value={filterMode}
                />

                <div className="flex items-center gap-2 flex-wrap">
                  {filterMode === 'month' && !isCustomRange ? (
                    <div className="flex items-center gap-1">
                      <IconButton
                        aria-label={autoT('ui_9c52ab5061fe')}
                        onClick={() => navigateMonth('prev')}
                        title={autoT('ui_9c52ab5061fe')}
                        variant="secondary"
                      >
                        <ChevronLeft aria-hidden="true" />
                      </IconButton>
                      <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-3 py-2 min-w-[140px] justify-center">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-gray-800">
                          {selectedMonth !== null
                            ? MONTH_NAMES_SHORT[selectedMonth - 1]
                            : MONTH_NAMES_SHORT[currentMonth - 1]}{' '}
                          {selectedYear || currentYear}
                        </span>
                      </div>
                      <IconButton
                        aria-label={autoT('ui_ad21607e5b49')}
                        onClick={() => navigateMonth('next')}
                        title={autoT('ui_ad21607e5b49')}
                        variant="secondary"
                      >
                        <ChevronRight aria-hidden="true" />
                      </IconButton>
                    </div>
                  ) : (
                    <SegmentedControl
                      ariaLabel={autoT('ui_a0ee12af77e5')}
                      onChange={selectYear}
                      options={[
                        { value: '', label: autoT('ui_4c7a986ffe2b') },
                        ...activityYears.map((year) => ({ value: year, label: year })),
                      ]}
                      value={selectedYear}
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 sm:ml-auto">
                  {hasAdvancedFilter ? (
                    <FilterChip onRemove={resetAdvancedFilters}>
                      <Calendar className="h-4 w-4" />
                      {formatAdvancedFilterDisplay(MONTH_NAMES)}
                    </FilterChip>
                  ) : null}
                  <div ref={customFilterTriggerRef} className="relative">
                    <IconButton
                      aria-label={autoT('ui_c78a00fa35d9')}
                      className={
                        hasAdvancedFilter
                          ? 'border-viridian bg-viridian/5 text-viridian hover:bg-viridian/10'
                          : ''
                      }
                      onClick={openAdvancedFilters}
                      title={autoT('ui_c78a00fa35d9')}
                      variant="secondary"
                    >
                      <SlidersHorizontal aria-hidden="true" />
                    </IconButton>
                  </div>
                </div>

                <div ref={reportExportTriggerRef} className="flex items-center gap-2 sm:ml-0">
                  <Button
                    disabled={isExportInProgress}
                    onClick={() => setReportExportOpen(true)}
                    title={autoT('ui_4e4a0d7117ee')}
                  >
                    <FileDown aria-hidden="true" />
                    {autoT('ui_f3e4fadb9e37')}
                  </Button>
                </div>
              </div>

              {filterMode === 'month' && !isCustomRange && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
                    {MONTH_NAMES_SHORT.map((name, idx) => {
                      const month = idx + 1;
                      const isActive = selectedMonth === month;
                      const isCurrent =
                        month === currentMonth && selectedYear === String(currentYear);
                      return (
                        <button
                          key={month}
                          type="button"
                          className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                            isActive
                              ? 'bg-viridian text-white'
                              : isCurrent
                                ? 'bg-viridian/10 text-viridian hover:bg-viridian/20'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
                          onClick={() => selectMonth(month)}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-5">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  {autoT('ui_de9f4ac20f7f')}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedType('')}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      !selectedType
                        ? 'bg-viridian text-white border-viridian'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {autoT('ui_172a950cc0da')}
                  </button>
                  {STATISTICS_TYPE_OPTIONS.map((type) => {
                    const active = selectedType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedType(type)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          active
                            ? 'bg-viridian text-white border-viridian'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {TYPE_LABEL[type]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {projectsAll.length > 0 && (
                <div className="mt-5">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    {autoT('ui_3930f79f07e5')}
                  </div>
                  {sortedProjects.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      {autoT('ui_63c009ada12c')}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setProjectId('')}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          !projectId
                            ? 'bg-viridian text-white border-viridian'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {autoT('ui_b857d350e38e')}
                      </button>
                      {(useDesktopProjectCollapse ? visibleDesktopProjects : sortedProjects).map(
                        (p) => {
                          const active = projectId === p.id;
                          const color =
                            typeof p.color === 'string' && p.color.trim()
                              ? p.color.trim()
                              : undefined;
                          const imageUrl =
                            typeof p.imageUrl === 'string' && p.imageUrl.trim()
                              ? p.imageUrl.trim()
                              : undefined;
                          const fallbackColor = '#0f766e';
                          const overlayColor = color || fallbackColor;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setProjectId(p.id)}
                              className={`relative overflow-hidden px-3 py-1.5 rounded-full text-sm border flex items-center gap-2 max-w-full transition-colors ${
                                active
                                  ? 'text-white shadow ring-2 ring-offset-1 ring-viridian/30'
                                  : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                              }`}
                              style={{
                                backgroundColor: active ? overlayColor : undefined,
                                borderColor: active ? overlayColor : color || undefined,
                              }}
                              title={p.title}
                            >
                              <span className="relative flex items-center gap-2 min-w-0">
                                {imageUrl ? (
                                  <span
                                    className={`w-5 h-5 rounded-full overflow-hidden border flex-shrink-0 ${
                                      active
                                        ? 'border-white/40 bg-white/15'
                                        : 'border-gray-300 bg-gray-100'
                                    }`}
                                  >
                                    <ProtectedImage
                                      src={imageUrl}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  </span>
                                ) : (
                                  <span
                                    aria-hidden
                                    className="w-2.5 h-2.5 rounded-full border flex-shrink-0"
                                    style={{
                                      backgroundColor: overlayColor,
                                      borderColor: active
                                        ? 'rgba(255,255,255,0.45)'
                                        : 'rgba(0,0,0,0.08)',
                                    }}
                                  />
                                )}
                                <span className={`truncate ${active ? 'drop-shadow' : ''}`}>
                                  {p.title}
                                </span>
                              </span>
                            </button>
                          );
                        },
                      )}
                      {useDesktopProjectCollapse && (
                        <button
                          type="button"
                          onClick={() => setDesktopProjectFilterExpanded((current) => !current)}
                          className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors inline-flex items-center gap-2"
                          aria-expanded={desktopProjectFilterExpanded}
                        >
                          {desktopProjectFilterExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              {autoT('ui_34a01cec7c0e')}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              {hiddenDesktopProjectCount > 0
                                ? autoT('ui_21c0aa06dc5f', { value0: hiddenDesktopProjectCount })
                                : autoT('ui_263563d98bdc')}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })()}
      </SurfaceCard>

      <div ref={reportRef} className={pdfMode ? 'statistics-pdf-report' : ''}>
        <StatisticsKpis
          pdfMode={pdfMode}
          showAverage={showAverage}
          onShowAverageChange={setShowAverage}
          summary={summary}
          selectedClosureState={selectedClosureState}
          averageActivitiesPerWeek={averageActivitiesPerWeek}
          totalParticipantsPerHour={totalParticipantsPerHour}
          averageHoursPerActivity={averageHoursPerActivity}
          formatNumber={fmtNumber}
        />

        <div className="mt-6" data-pdf-section>
          <WeeklyProfileHeatmap
            profile={weeklyProfile}
            selectedWeekdays={selectedWeekdays}
            isMobile={isMobile}
            pdfMode={pdfMode}
            chartRef={setChartCardRef('weekly-profile')}
            exportActions={renderChartExportActions('weekly-profile', 'Wochenprofil')}
          />
        </div>

        <CustomKpiCards
          surface="statistics"
          className="mt-6"
          from={from || undefined}
          to={to || undefined}
          showManager={!pdfMode}
          refreshOptions={{
            refetchOnWindowFocus: true,
            refetchIntervalMs: publicConfig?.liveRefreshIntervalMs,
          }}
        />

        {/* Charts */}
        <div className={`grid gap-6 ${pdfMode ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>
          <StatisticsPieChartCard
            title={autoT('ui_7a55d1e6e986')}
            exportActions={
              pdfMode ? null : renderChartExportActions('activity-types', autoT('ui_7a55d1e6e986'))
            }
            bodyClassName="h-80 md:h-[23rem]"
            chartRef={setChartCardRef('activity-types')}
            data={byTypeData}
            centerY={byTypePieCenterY}
            outerRadius={byTypeOuterRadius}
            showAbsoluteValueLabels={isActivityTypesExporting}
            createLabelRenderer={renderPieValueLabel}
            formatValue={fmtNumber}
            separatorColor={chartSeparatorColor}
            tooltipContentStyle={chartTooltipContentStyle}
            tooltipLabelStyle={chartTooltipLabelStyle}
            tooltipItemStyle={chartTooltipItemStyle}
            legendWrapperStyle={pieLegendWrapperStyle}
            cellKeyPrefix="activity-type"
          />

          <StatisticsPieChartCard
            title={autoT('ui_2b8c8cd6a28c')}
            exportActions={
              pdfMode
                ? null
                : renderChartExportActions('gender-distribution', 'Geschlechterverteilung')
            }
            bodyClassName="h-80 md:h-[23rem]"
            chartRef={setChartCardRef('gender-distribution')}
            data={genderData}
            centerY={genderPieCenterY}
            innerRadius={genderInnerRadius}
            outerRadius={genderOuterRadius}
            showAbsoluteValueLabels={isGenderDistributionExporting}
            createLabelRenderer={renderPieValueLabel}
            formatValue={fmtNumber}
            separatorColor={chartSeparatorColor}
            tooltipContentStyle={chartTooltipContentStyle}
            tooltipLabelStyle={chartTooltipLabelStyle}
            tooltipItemStyle={chartTooltipItemStyle}
            legendWrapperStyle={pieLegendWrapperStyle}
            cellKeyPrefix="gender"
          />

          {/* Zeitverlauf Teilnehmende mit Aggregation */}
          <div
            className="statistics-chart-card group/chart-card bg-white rounded-lg shadow p-3 md:p-6 lg:col-span-2"
            data-pdf-section
            ref={setChartCardRef('participants-trend')}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="statistics-chart-title text-lg font-semibold text-viridian">
                {showAverage ? autoT('ui_0a94bbd542a9') : autoT('ui_3b658714e6c5')}
              </h3>
              {!pdfMode && (
                <div className="flex items-center gap-2">
                  {renderChartExportActions(
                    'participants-trend',
                    showAverage ? autoT('ui_0a94bbd542a9') : autoT('ui_3b658714e6c5'),
                  )}
                  <SegmentedControl<'day' | 'week' | 'month'>
                    ariaLabel={autoT('ui_3b658714e6c5')}
                    onChange={setTimeAggregation}
                    options={[
                      { value: 'day', label: autoT('ui_982963c1c41c') },
                      { value: 'week', label: autoT('ui_7b2207dc85a6') },
                      { value: 'month', label: autoT('ui_da13625eeb37') },
                    ]}
                    value={timeAggregation}
                  />
                </div>
              )}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aggregatedTimeseries} margin={lineChartMargin}>
                  <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={chartAxisTick}
                    tickFormatter={(value) =>
                      formatStatisticsAggregationTickLabel(String(value), timeAggregation)
                    }
                  />
                  <YAxis allowDecimals={false} tick={chartAxisTick} />
                  <Tooltip
                    contentStyle={chartTooltipContentStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                    cursor={lineChartCursor}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length || label == null) return null;

                      const datePrefix = autoT('ui_1ae0fe72e0f6', { value0: '' }).trim();
                      const formattedDate = formatStatisticsAggregationTooltipLabel(
                        String(label),
                        timeAggregation,
                      );
                      const dateValue = formattedDate.startsWith(datePrefix)
                        ? formattedDate.slice(datePrefix.length).trimStart()
                        : formattedDate;
                      const item = payload[0];
                      const itemLabel = String(
                        item.name ||
                          (showAverage ? autoT('ui_c649f425302c') : autoT('ui_a8a4d6b019af')),
                      );
                      const value = Number(item.value ?? 0).toLocaleString(getCurrentIntlLocale(), {
                        maximumFractionDigits: 1,
                      });

                      return (
                        <div style={{ ...chartTooltipContentStyle, padding: '10px 12px' }}>
                          <p style={{ ...chartTooltipLabelStyle, margin: 0, fontWeight: 400 }}>
                            <strong>{datePrefix}</strong> {dateValue}
                          </p>
                          <p
                            style={{ ...chartTooltipItemStyle, margin: '6px 0 0', fontWeight: 400 }}
                          >
                            <strong>{itemLabel}:</strong> {value}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalParticipants"
                    name={showAverage ? autoT('ui_c649f425302c') : autoT('ui_a8a4d6b019af')}
                    stroke="#10b981"
                    strokeWidth={2}
                    isAnimationActive={!isParticipantsTrendExporting}
                    activeDot={{
                      r: 6,
                      fill: '#10b981',
                      stroke: isDarkTheme ? '#ecf3ff' : '#ffffff',
                      strokeWidth: 2,
                    }}
                    dot={timeAggregation !== 'day'}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <StatisticsPieChartCard
            title={showAverage ? autoT('ui_784a48af8419') : autoT('ui_4d34ac48c54e')}
            exportActions={
              pdfMode
                ? null
                : renderChartExportActions(
                    'cohorts',
                    showAverage ? 'Ø Alterskohorten' : 'Alterskohorten',
                  )
            }
            cardClassName="group/chart-card bg-white rounded-lg shadow p-3 md:p-6"
            bodyClassName={pdfMode ? 'h-72' : 'h-80 md:h-[23rem]'}
            chartRef={setChartCardRef('cohorts')}
            data={cohortPieData}
            centerY={cohortPieCenterY}
            outerRadius={cohortPieOuterRadius}
            showAbsoluteValueLabels={isCohortsExporting}
            createLabelRenderer={renderPieValueLabel}
            formatValue={fmtNumber}
            separatorColor={chartSeparatorColor}
            tooltipContentStyle={chartTooltipContentStyle}
            tooltipLabelStyle={chartTooltipLabelStyle}
            tooltipItemStyle={chartTooltipItemStyle}
            legendWrapperStyle={pieLegendWrapperStyle}
            cellKeyPrefix="cohort"
          />

          <StatisticsBarChartCard
            title={autoT('ui_14a39a02cc68')}
            exportActions={
              pdfMode ? null : renderChartExportActions('top-categories', 'Top Kategorien')
            }
            chartRef={setChartCardRef('top-categories')}
            data={topCategoryChartData}
            bodyClassName={pdfMode ? 'h-64' : 'h-80 md:h-[23rem]'}
            margin={compactBarChartMarginWithBottom}
            gridStroke={chartGridColor}
            axisTick={chartAxisTick}
            xAxisHeight={64}
            yAxisAllowDecimals={false}
            tooltipContentStyle={chartTooltipContentStyle}
            tooltipLabelStyle={chartTooltipLabelStyle}
            tooltipItemStyle={chartTooltipItemStyle}
            tooltipCursor={barChartCursor}
            tooltipFormatter={(value) => value.toLocaleString(getCurrentIntlLocale())}
            barDataKey="count"
            labelDataKey="count"
            barName={autoT('ui_b6bf5f1a2033')}
            valueLabelContent={<ValueLabel />}
            getCellFill={(_item, index) => fallbackBarColors[index % fallbackBarColors.length]}
            getCellKey={(_item, index) => `bc-${index}`}
          />

          <StatisticsBarChartCard
            title={autoT('ui_0fb32d3b3eaa')}
            exportActions={pdfMode ? null : renderChartExportActions('top-tags', 'Top Tags')}
            chartRef={setChartCardRef('top-tags')}
            data={topTags}
            bodyClassName="h-64"
            margin={compactBarChartMargin}
            gridStroke={chartGridColor}
            axisTick={chartAxisTick}
            xAxisHeight={50}
            yAxisAllowDecimals={false}
            tooltipContentStyle={chartTooltipContentStyle}
            tooltipLabelStyle={chartTooltipLabelStyle}
            tooltipItemStyle={chartTooltipItemStyle}
            tooltipCursor={barChartCursor}
            tooltipFormatter={(value) => value.toLocaleString(getCurrentIntlLocale())}
            barDataKey="count"
            labelDataKey="count"
            barName={autoT('ui_b6bf5f1a2033')}
            valueLabelContent={<ValueLabel />}
            getCellFill={(item, index) =>
              tagColor.get(item.id) || fallbackBarColors[index % fallbackBarColors.length]
            }
            getCellKey={(item) => `tt-${item.id}`}
          />

          {projectId ? (
            <StatisticsBarChartCard
              title={autoT('ui_77e6509147ca')}
              exportActions={pdfMode ? null : renderChartExportActions('top-days', 'Top Tage')}
              chartRef={setChartCardRef('top-days')}
              data={topDays}
              bodyClassName="h-64"
              margin={compactBarChartMargin}
              gridStroke={chartGridColor}
              axisTick={chartAxisTick}
              xAxisHeight={50}
              yAxisAllowDecimals={showAverage}
              tooltipContentStyle={chartTooltipContentStyle}
              tooltipLabelStyle={chartTooltipLabelStyle}
              tooltipItemStyle={chartTooltipItemStyle}
              tooltipCursor={barChartCursor}
              tooltipFormatter={(value) =>
                value.toLocaleString(getCurrentIntlLocale(), {
                  maximumFractionDigits: showAverage ? 1 : 0,
                })
              }
              tooltipLabelFormatter={(_label, payload) =>
                `Wochentag: ${payload?.[0]?.payload?.fullName ?? '—'}`
              }
              barDataKey={showAverage ? 'chartValue' : 'count'}
              labelDataKey={showAverage ? 'chartValue' : 'count'}
              barName={showAverage ? autoT('ui_c649f425302c') : autoT('ui_a8a4d6b019af')}
              barFill="#10b981"
              valueLabelContent={<ValueLabel />}
            />
          ) : (
            <StatisticsBarChartCard
              title={autoT('ui_70494e6a6cd0')}
              exportActions={
                pdfMode ? null : renderChartExportActions('top-projects', autoT('ui_70494e6a6cd0'))
              }
              chartRef={setChartCardRef('top-projects')}
              data={topProjects}
              bodyClassName="h-64"
              margin={compactBarChartMargin}
              gridStroke={chartGridColor}
              axisTick={chartAxisTick}
              xAxisHeight={50}
              yAxisAllowDecimals={false}
              tooltipContentStyle={chartTooltipContentStyle}
              tooltipLabelStyle={chartTooltipLabelStyle}
              tooltipItemStyle={chartTooltipItemStyle}
              tooltipCursor={barChartCursor}
              tooltipFormatter={(value) => value.toLocaleString(getCurrentIntlLocale())}
              barDataKey="count"
              labelDataKey="count"
              barName={autoT('ui_b6bf5f1a2033')}
              valueLabelContent={<ValueLabel />}
              getCellFill={(item, index) =>
                projectColor.get(item.id) || fallbackBarColors[index % fallbackBarColors.length]
              }
              getCellKey={(item) => `tp-${item.id}`}
              getCellImageUrl={(item) => projectImage.get(item.id)}
            />
          )}
        </div>

        <StatisticsActivitiesTable
          activities={reportActivities}
          isLoading={activitiesPageQ.isLoading}
          totalActivities={totalActivities}
          page={activitiesPage}
          totalPages={totalActivityPages}
          perPage={ACTIVITIES_PER_PAGE}
          onPageChange={setActivitiesPage}
          pdfMode={pdfMode}
          isMobile={isMobile}
          exportActions={renderActivitiesExportActions()}
          formatNumber={fmtNumber}
          getTypeLabel={getActivityTypeLabel}
        />

        {/* Konsolidiert (kompakt) */}
        <div className="bg-white rounded-lg shadow p-6 mt-6" data-pdf-section>
          <h3 className="text-lg font-semibold mb-4 text-viridian">{autoT('ui_c0d622468344')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div data-pdf-section>
              <h4 className="font-medium text-gray-700 mb-2">{autoT('ui_83cd7cada281')}</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-azure-web text-gray-700">
                    <th className="px-3 py-2 text-left">{autoT('ui_edcaf9aaa282')}</th>
                    <th className="px-3 py-2 text-right">{autoT('ui_b6bf5f1a2033')}</th>
                    <th className="px-3 py-2 text-right">{autoT('ui_a8a4d6b019af')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const map = new Map<string, { c: number; p: number }>();
                    (byType || []).forEach((entry) => {
                      map.set(entry.type || 'unknown', {
                        c: entry.count,
                        p: entry.totalParticipants,
                      });
                    });
                    const typeLabel: Record<string, string> = {
                      open_door: autoT('ui_a80778b6b148'),
                      project_open: autoT('ui_00d882fbb5d4'),
                      project_closed: autoT('ui_8f256393653e'),
                      event: 'Veranstaltung',
                      outreach: 'Aufsuchend',
                      unknown: 'Unbekannt',
                    };
                    return Array.from(map.entries()).map(([k, v]) => (
                      <tr key={k}>
                        <td className="px-3 py-1.5">{typeLabel[k] || k}</td>
                        <td className="px-3 py-1.5 text-right">{fmtNumber(v.c)}</td>
                        <td className="px-3 py-1.5 text-right">{fmtNumber(v.p)}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <div data-pdf-section>
              <h4 className="font-medium text-gray-700 mb-2">{autoT('ui_06f3a091a49c')}</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-azure-web text-gray-700">
                    <th className="px-3 py-2 text-left">{autoT('ui_358210386a4f')}</th>
                    <th className="px-3 py-2 text-right">{autoT('ui_b6bf5f1a2033')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(byCategory || []).map(({ id, name, count }) => (
                    <tr key={id}>
                      <td className="px-3 py-1.5">{name}</td>
                      <td className="px-3 py-1.5 text-right">{fmtNumber(count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={typePickerOpen}
        onClose={() => setTypePickerOpen(false)}
        title={autoT('ui_4324a8f20ad4')}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className={`text-sm ${mobileSecondaryTextClass}`}>{autoT('ui_269234dabd92')}</p>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                !selectedType
                  ? 'border-viridian bg-viridian text-white'
                  : `${mobileSurfaceClass} ${mobileSurfaceHoverClass}`
              }`}
              onClick={() => {
                setSelectedType('');
                setTypePickerOpen(false);
              }}
            >
              {autoT('ui_172a950cc0da')}
            </button>
            {STATISTICS_TYPE_OPTIONS.map((type) => {
              const active = selectedType === type;
              const typeColor = colorForActivityType(type);
              return (
                <button
                  key={type}
                  type="button"
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    active ? 'text-white' : mobilePrimaryTextClass
                  }`}
                  style={{
                    backgroundColor: active
                      ? typeColor
                      : translucent(typeColor, isDarkTheme ? '20' : '14'),
                    borderColor: active ? typeColor : translucent(typeColor, '66'),
                  }}
                  onClick={() => {
                    setSelectedType(type);
                    setTypePickerOpen(false);
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full border"
                      style={{
                        backgroundColor: active ? 'rgba(255,255,255,0.9)' : typeColor,
                        borderColor: active
                          ? 'rgba(255,255,255,0.35)'
                          : translucent(typeColor, 'aa'),
                      }}
                    />
                    {TYPE_LABEL[type]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      <Modal
        open={projectPickerOpen}
        onClose={() => setProjectPickerOpen(false)}
        title={autoT('ui_42da26b250b4')}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <p className={`text-sm ${mobileSecondaryTextClass}`}>
            {selectedType
              ? autoT('ui_1368c874cd5a', { value0: TYPE_LABEL[selectedType] })
              : autoT('ui_f88f628b1024')}
          </p>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                !projectId
                  ? 'border-viridian bg-viridian text-white'
                  : `${mobileSurfaceClass} ${mobileSurfaceHoverClass}`
              }`}
              onClick={() => {
                setProjectId('');
                setProjectPickerOpen(false);
              }}
            >
              {autoT('ui_b857d350e38e')}
            </button>

            {sortedProjects.length === 0 ? (
              <div
                className={`rounded-xl border border-dashed px-4 py-4 text-sm ${mobileDashedSurfaceClass}`}
              >
                {autoT('ui_4e5aca6ae1f5')}
              </div>
            ) : (
              sortedProjects.map((project) => {
                const active = projectId === project.id;
                const projectColorValue =
                  typeof project.color === 'string' && project.color.trim()
                    ? project.color.trim()
                    : '#0f766e';
                const imageUrl =
                  typeof project.imageUrl === 'string' && project.imageUrl.trim()
                    ? project.imageUrl.trim()
                    : undefined;

                return (
                  <button
                    key={project.id}
                    type="button"
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      active ? 'text-white' : `${mobileSurfaceClass} ${mobileSurfaceHoverClass}`
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: projectColorValue,
                            borderColor: projectColorValue,
                          }
                        : imageUrl || project.color
                          ? {
                              backgroundColor: translucent(
                                projectColorValue,
                                isDarkTheme ? '18' : '10',
                              ),
                              borderColor: project.color || 'var(--border-strong)',
                            }
                          : undefined
                    }
                    onClick={() => {
                      setProjectId(project.id);
                      setProjectPickerOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {imageUrl ? (
                        <span
                          className={`h-10 w-10 overflow-hidden rounded-full border ${active ? 'border-white/30 bg-white/10' : isDarkTheme ? 'border-white/10 bg-white/10' : 'border-gray-300 bg-gray-100'}`}
                        >
                          <ProtectedImage
                            src={imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </span>
                      ) : (
                        <span
                          aria-hidden
                          className="h-10 w-10 rounded-full border"
                          style={{
                            backgroundColor: projectColorValue,
                            borderColor: active ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.08)',
                          }}
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{project.title}</span>
                        <span
                          className={`block truncate text-xs ${active ? 'text-white/80' : mobileSecondaryTextClass}`}
                        >
                          {TYPE_LABEL[project.type] || project.type}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      <ResponsiveFilterPanel
        anchorRef={reportExportTriggerRef}
        desktopClassName="filter-popover--export"
        open={reportExportOpen}
        onClose={() => setReportExportOpen(false)}
        title={autoT('ui_8dbb5c1c7f40')}
      >
        <div className="space-y-4 text-sm text-gray-700">
          <p>{autoT('ui_fabb2abae3a4')}</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left">
            <input
              type="checkbox"
              checked={includeActivitiesInPdf}
              onChange={(event) => setIncludeActivitiesInPdf(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-viridian focus:ring-viridian"
            />
            <span>
              <span className="block font-semibold text-gray-900">Aktivitätenliste anhängen</span>
              <span className="mt-0.5 block text-xs text-gray-600">
                Für große Datenmengen wird die Liste als eigene, paginierte Tabelle ergänzt.
              </span>
            </span>
          </label>
          <div className="grid gap-2">
            <Button
              className="export-option-card h-auto min-h-0 w-full p-3"
              disabled={isExportInProgress}
              onClick={() => {
                setReportExportOpen(false);
                void exportPdf(includeActivitiesInPdf);
              }}
              variant="secondary"
            >
              <span>
                <span className="block font-semibold text-[var(--text-primary)]">
                  {autoT('ui_104827f9e0c7')}
                </span>
                <span className="mt-1 block text-xs font-normal text-[var(--text-secondary)]">
                  {autoT('ui_49b7d61d6e43')}
                </span>
              </span>
            </Button>
            <Button
              className="export-option-card export-option-card--stato h-auto min-h-0 w-full p-3"
              disabled={isExportInProgress}
              onClick={() => {
                setReportExportOpen(false);
                void exportActivitiesTable('xlsx');
              }}
              variant="secondary"
            >
              <span>
                <span className="block font-semibold text-[var(--text-primary)]">
                  {autoT('ui_db0d32742b50')}
                </span>
                <span className="mt-1 block text-xs font-normal text-[var(--text-secondary)]">
                  {autoT('ui_c40ca967212f')}
                </span>
              </span>
            </Button>
            <Button
              className="export-option-card h-auto min-h-0 w-full p-3"
              disabled={isExportInProgress || isControllingExporting}
              onClick={() => {
                setReportExportOpen(false);
                void exportControllingData();
              }}
              variant="secondary"
            >
              <span>
                <span className="block font-semibold text-[var(--text-primary)]">
                  {autoT('ui_601dd4ee44ea')}
                </span>
                <span className="mt-1 block text-xs font-normal text-[var(--text-secondary)]">
                  {autoT('ui_b56d47e133a3')}
                </span>
              </span>
            </Button>
          </div>
        </div>
      </ResponsiveFilterPanel>

      {/* Desktop popover, mobile bottom sheet. */}
      <ResponsiveFilterPanel
        anchorRef={customFilterTriggerRef}
        desktopClassName="filter-popover--statistics"
        open={customFilterOpen}
        onClose={() => setCustomFilterOpen(false)}
        title={autoT('ui_c78a00fa35d9')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel className="mb-1">{autoT('ui_a4b078f9eb7b')}</FieldLabel>
              <Input type="date" value={tempFrom} onChange={(e) => setTempFrom(e.target.value)} />
            </div>
            <div>
              <FieldLabel className="mb-1">{autoT('ui_0afaa0e566a1')}</FieldLabel>
              <Input type="date" value={tempTo} onChange={(e) => setTempTo(e.target.value)} />
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="text-xs font-medium text-gray-500 mb-2">{autoT('ui_37b72d9d418d')}</div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const today = new Date();
                  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                  setTempFrom(formatLocalDateInputValue(firstDay));
                  setTempTo(formatLocalDateInputValue(today));
                }}
              >
                {autoT('ui_f172e749dcc9')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const today = new Date();
                  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                  const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
                  setTempFrom(formatLocalDateInputValue(lastMonth));
                  setTempTo(formatLocalDateInputValue(lastDay));
                }}
              >
                {autoT('ui_46ae17ce0436')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const today = new Date();
                  const threeMonthsAgo = new Date(
                    today.getFullYear(),
                    today.getMonth() - 3,
                    today.getDate(),
                  );
                  setTempFrom(formatLocalDateInputValue(threeMonthsAgo));
                  setTempTo(formatLocalDateInputValue(today));
                }}
              >
                {autoT('ui_2c02931c55c8')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const today = new Date();
                  const sixMonthsAgo = new Date(
                    today.getFullYear(),
                    today.getMonth() - 6,
                    today.getDate(),
                  );
                  setTempFrom(formatLocalDateInputValue(sixMonthsAgo));
                  setTempTo(formatLocalDateInputValue(today));
                }}
              >
                {autoT('ui_dca13e4c1f6d')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const today = new Date();
                  const yearAgo = new Date(
                    today.getFullYear() - 1,
                    today.getMonth(),
                    today.getDate(),
                  );
                  setTempFrom(formatLocalDateInputValue(yearAgo));
                  setTempTo(formatLocalDateInputValue(today));
                }}
              >
                {autoT('ui_6e1af626e810')}
              </Button>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="text-xs font-medium text-gray-500 mb-2">{autoT('ui_bae7d5be7082')}</div>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_EXECUTION_STATUS_OPTIONS.map((status) => {
                const active = tempSelectedExecutionStatuses.includes(status);
                const activeClass =
                  status === 'cancelled'
                    ? 'border-rose-600 bg-rose-600 text-white'
                    : 'border-viridian bg-viridian text-white';

                return (
                  <button
                    key={status}
                    type="button"
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      active
                        ? activeClass
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setTempSelectedExecutionStatuses((current) => {
                        const next = current.includes(status)
                          ? current.filter((entry) => entry !== status)
                          : [...current, status];
                        return normalizeActivityExecutionStatuses(next);
                      });
                    }}
                    aria-pressed={active}
                  >
                    {status === 'cancelled' ? autoT('ui_af6ed3ac625b') : autoT('ui_3074a0ce7457')}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="text-xs font-medium text-gray-500 mb-2">{autoT('ui_afd5e7713414')}</div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: autoT('ui_a462abf80085'), value: undefined },
                { key: 'closed', label: autoT('ui_9a7a7c0c602f'), value: 'closed' as const },
                { key: 'open', label: autoT('ui_032b3f37a45b'), value: 'open' as const },
              ].map((option) => {
                const active = tempSelectedClosureState === option.value;
                const activeClass =
                  option.value === 'closed'
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : option.value === 'open'
                      ? 'border-slate-700 bg-slate-700 text-white'
                      : 'border-viridian bg-viridian text-white';

                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      active
                        ? activeClass
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setTempSelectedClosureState(option.value)}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-xs font-medium text-gray-500">{autoT('ui_1d474635b5d2')}</div>
              <button
                type="button"
                className="text-xs font-medium text-viridian hover:text-cambridge-blue transition-colors"
                onClick={() => setTempSelectedWeekdays([])}
              >
                {autoT('ui_a462abf80085')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((weekday) => {
                const active = tempSelectedWeekdays.includes(weekday.value);
                return (
                  <button
                    key={weekday.value}
                    type="button"
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      active
                        ? 'border-viridian bg-viridian text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setTempSelectedWeekdays((current) => {
                        const next = current.includes(weekday.value)
                          ? current.filter((entry) => entry !== weekday.value)
                          : [...current, weekday.value];
                        return normalizeWeekdays(next);
                      });
                    }}
                    aria-pressed={active}
                    title={weekday.label}
                  >
                    {weekday.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button onClick={() => setCustomFilterOpen(false)} variant="secondary">
              {autoT('ui_07af7cb30fca')}
            </Button>
            <Button onClick={applyCustomRange}>{autoT('ui_594308426372')}</Button>
          </div>
        </div>
      </ResponsiveFilterPanel>
      <ExportProgressModal message={exportProgress} />
    </div>
  );
}
