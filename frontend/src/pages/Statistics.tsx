import { useState, useMemo, useRef, useEffect } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts';
import { useAuth } from '@/lib/auth';
import { fetchAllActivities, useActivitiesPaged, type Activity } from '@/lib/activities';
import { fetchAllLogbookEntries, type LogbookEntry } from '@/lib/logbook';
import { useCohorts, useTags, type Cohort } from '@/lib/taxonomy';
import { useProjects } from '@/lib/projects';
import { useOrgScope, useOrgScopeKey } from '@/lib/orgScope';
import { useIsMobile } from '@/lib/useIsMobile';
import { colorForActivityType, translucent } from '@/lib/colors';
import { isDarkThemeName } from '../lib/theme';
import type jsPDF from 'jspdf';
import { FileDown, X as XIcon, Calendar, SlidersHorizontal, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '@/components/Modal';
import ExportProgressModal from '@/components/ExportProgressModal';
import ProtectedImage from '@/components/ProtectedImage';
import { addDevMetricEvent, finishDevFlow, markDevFlow, startDevFlow } from '@/lib/devMetrics';
import { usePublicConfig } from '@/lib/publicConfig';
import ActivityExecutionStatusBadge from '@/components/ActivityExecutionStatusBadge';
import type { OrganizationClosureStateFilter } from '@/lib/orgs';
import {
  ACTIVITY_EXECUTION_STATUS_OPTIONS,
  DEFAULT_ACTIVITY_EXECUTION_STATUS,
  formatActivityExecutionStatusList,
  isCancelledActivity,
  isDefaultActivityExecutionStatusFilter,
  normalizeActivityExecutionStatuses,
  type ActivityExecutionStatus,
} from '@/lib/activityExecutionStatus';
import {
  buildTopDayChartData,
  formatStatisticsAggregationTickLabel,
  formatStatisticsAggregationTooltipLabel,
  getInclusiveWeekSpan,
  getVisibleSelectedItems,
} from './statisticsHelpers';
import {
  createBarValueLabelRenderer,
  createLineValueLabelRenderer,
  createPieValueLabelRenderer,
} from './statisticsChartLabels';
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
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';
import activitiesKpiIcon from '../../assets/Icons_KPI/Calendar_Icon_light.png';
import participantsKpiIcon from '../../assets/Icons_KPI/Clients_Light.png';
import hoursKpiIcon from '../../assets/Icons_KPI/Time_Light.png';
import participantsPerHourKpiIcon from '../../assets/Icons_KPI/Time_RMS_light.png';

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

const STATISTICS_KPI_ICONS = {
  activities: activitiesKpiIcon,
  participants: participantsKpiIcon,
  participantsPerHour: participantsPerHourKpiIcon,
  hours: hoursKpiIcon,
} as const;

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
    new Set(weekdays.filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)),
  ).sort((left, right) => left - right);
}

function formatLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type StatsOverviewResponse = {
  summary: {
    totalActivities: number;
    totalParticipants: number;
    totalMale: number;
    totalFemale: number;
    totalDiverse: number;
    totalDurationMinutes: number;
    totalHours: number;
    averageParticipants: number;
    closureDaysCount?: number;
  };
  byType: Array<{ type: string; count: number; totalParticipants: number }>;
  gender: { male: number; female: number; diverse: number };
  participantsTimeseries: Array<{
    date: string;
    totalParticipants: number;
    activityCount: number;
    totalDurationMinutes?: number;
  }>;
  byCohort: Array<{
    cohortId: string;
    name: string;
    total: number;
    male: number;
    female: number;
    diverse: number;
  }>;
  byCategory: Array<{ id: string; name: string; count: number }>;
  topTags: Array<{ id: string; name: string; count: number }>;
  topProjects: Array<{ id: string; name: string; count: number }>;
  availableYears: string[];
};

type StatisticsRealtimeOptions = {
  refetchOnWindowFocus?: boolean | 'always';
  refetchIntervalMs?: number;
};

type PdfSlice = {
  startPx: number;
  endPx: number;
};

type ChartExportFormat = 'png' | 'pdf';
type ActivitiesExportFormat = 'pdf' | 'xlsx';

type ControllingExportRow = Activity & {
  project?: { title?: string | null; type?: string | null } | null;
};

type ActivityExportRow = {
  date: string;
  type: string;
  title: string;
  project: string;
  total: number;
  male: number;
  female: number;
  diverse: number;
  duration: number | '';
};

const PDF_RENDER_SCALE = 2;
const PDF_MARGIN_MM = 10;
const PDF_HEADER_HEIGHT_MM = 40;
const PDF_MIN_PAGE_FILL_RATIO = 0.58;
const CHART_EXPORT_HEADER_HEIGHT_MM = 26;

let pdfExportDependenciesPromise:
  | Promise<{
      JsPDF: typeof import('jspdf').default;
      html2canvas: typeof import('html2canvas').default;
    }>
  | null = null;

function loadPdfExportDependencies() {
  if (!pdfExportDependenciesPromise) {
    pdfExportDependenciesPromise = Promise.all([import('jspdf'), import('html2canvas')]).then(
      ([jspdfModule, html2canvasModule]) => ({
        JsPDF: jspdfModule.default,
        html2canvas: html2canvasModule.default,
      }),
    );
  }

  return pdfExportDependenciesPromise;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('Canvas export failed.'));
    }, 'image/png');
  });
}

function getActivityTypeLabel(type?: string | null) {
  if (!type) return '';
  return TYPE_LABEL[type] || type;
}

function getActivityParticipantTotal(activity: Activity) {
  return (
    activity.countTotal ??
    (activity.countMale || 0) + (activity.countFemale || 0) + (activity.countDiverse || 0)
  ) || 0;
}

function getActivityDurationMinutes(activity: Activity): number | undefined {
  if (typeof activity.durationMinutes === 'number' && activity.durationMinutes >= 0) {
    return activity.durationMinutes;
  }

  const toMinutes = (time?: string | null) => {
    if (!time) return undefined;
    const [hours, minutes] = String(time)
      .split(':')
      .map((value) => parseInt(value, 10));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;
    return hours * 60 + minutes;
  };

  const start = toMinutes(activity.startTime);
  const end = toMinutes(activity.endTime);
  return start !== undefined && end !== undefined && end >= start ? end - start : undefined;
}

function formatActivityDateGerman(date?: string | null) {
  const safeDate = String(date || '').slice(0, 10);
  const [year, month, day] = safeDate.split('-');
  if (!year || !month || !day) return safeDate;
  return `${day}.${month}.${year}`;
}

function toActivityExportRows(activities: Activity[]): ActivityExportRow[] {
  return activities.map((activity) => ({
    date: formatActivityDateGerman(activity.date),
    type: getActivityTypeLabel(activity.type),
    title: activity.title || '',
    project: activity.project?.title || '',
    total: getActivityParticipantTotal(activity),
    male: activity.countMale || 0,
    female: activity.countFemale || 0,
    diverse: activity.countDiverse || 0,
    duration: getActivityDurationMinutes(activity) ?? '',
  }));
}

function getControllingDurationMinutes(activity: ControllingExportRow) {
  return getActivityDurationMinutes(activity) ?? '';
}

function addPdfPageHeader(pdf: jsPDF, orgTitle: string, dateRange: string) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(`Bericht: ${orgTitle}`, 14, 18);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text(dateRange ? autoT('ui_15fd2f861910', { value0: dateRange }) : autoT('ui_38fc1281b47b'), 14, 26);
}

function collectPdfBreakpoints(root: HTMLDivElement, canvas: HTMLCanvasElement) {
  const rootRect = root.getBoundingClientRect();
  const rootHeight = Math.max(rootRect.height, 1);
  const scaleY = canvas.height / rootHeight;
  const breakpoints = new Set<number>([0, canvas.height]);

  root.querySelectorAll<HTMLElement>('[data-pdf-section], [data-pdf-row]').forEach((node) => {
    const rect = node.getBoundingClientRect();
    const top = Math.round((rect.top - rootRect.top) * scaleY);

    if (top > 0 && top < canvas.height) {
      breakpoints.add(top);
    }
  });

  return Array.from(breakpoints).sort((left, right) => left - right);
}

function buildPdfSlices(totalHeightPx: number, pageHeightPx: number, breakpoints: number[]): PdfSlice[] {
  const slices: PdfSlice[] = [];
  const minFillPx = Math.floor(pageHeightPx * PDF_MIN_PAGE_FILL_RATIO);
  let startPx = 0;

  while (startPx < totalHeightPx) {
    const remainingPx = totalHeightPx - startPx;
    if (remainingPx <= pageHeightPx) {
      slices.push({ startPx, endPx: totalHeightPx });
      break;
    }

    const targetEndPx = Math.min(startPx + pageHeightPx, totalHeightPx);
    const candidateBreaks = breakpoints.filter(
      (point) => point > startPx + minFillPx && point < targetEndPx,
    );
    const endPx = candidateBreaks[candidateBreaks.length - 1] ?? targetEndPx;

    if (endPx <= startPx) {
      slices.push({ startPx, endPx: targetEndPx });
      startPx = targetEndPx;
      continue;
    }

    slices.push({ startPx, endPx });
    startPx = endPx;
  }

  return slices;
}

function createCanvasSlice(sourceCanvas: HTMLCanvasElement, startPx: number, endPx: number) {
  const sliceHeight = Math.max(endPx - startPx, 1);
  const sliceCanvas = document.createElement('canvas');
  const context = sliceCanvas.getContext('2d');

  if (!context) return null;

  sliceCanvas.width = sourceCanvas.width;
  sliceCanvas.height = sliceHeight;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
  context.drawImage(
    sourceCanvas,
    0,
    startPx,
    sourceCanvas.width,
    sliceHeight,
    0,
    0,
    sourceCanvas.width,
    sliceHeight,
  );

  return sliceCanvas;
}

function useStatsOverview(
  params: {
    from?: string;
    to?: string;
    projectId?: string;
    type?: string;
    executionStatuses?: ActivityExecutionStatus[];
    closureState?: OrganizationClosureStateFilter;
    weekdays?: number[];
  },
  scopeKey: string,
  options?: StatisticsRealtimeOptions,
) {
  return useQuery({
    queryKey: ['stats:overview', scopeKey, params.from ?? '', params.to ?? '', params.projectId ?? '', params.type ?? '', params.executionStatuses?.join(',') ?? '', params.closureState ?? '', params.weekdays?.join(',') ?? ''],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      if (params.projectId) queryParams.projectId = params.projectId;
      if (params.type) queryParams.type = params.type;
      if (Array.isArray(params.executionStatuses) && params.executionStatuses.length > 0) {
        queryParams.executionStatuses = params.executionStatuses.join(',');
      }
      if (params.closureState) {
        queryParams.closureState = params.closureState;
      }
      if (Array.isArray(params.weekdays) && params.weekdays.length > 0) {
        queryParams.weekdays = params.weekdays.join(',');
      }

      const res = await api.get('/stats/overview', { params: queryParams });
      return res.data as StatsOverviewResponse;
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    refetchInterval:
      typeof options?.refetchIntervalMs === 'number' && options.refetchIntervalMs > 0
        ? options.refetchIntervalMs
        : false,
    placeholderData: keepPreviousData,
  });
}

export default function Statistics() {
  // Aktuelles Jahr als Standard
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const isMobile = useIsMobile(768);
  const [from, setFrom] = useState<string>(`${currentYear}-01-01`);
  const [to, setTo] = useState<string>(`${currentYear}-12-31`);
  const [projectId, setProjectId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<Activity['type'] | ''>('');
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = ganzes Jahr
  const [filterMode, setFilterMode] = useState<'year' | 'month'>('year');
  const [customFilterOpen, setCustomFilterOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState<string>(from);
  const [tempTo, setTempTo] = useState<string>(to);
  const [desktopProjectFilterExpanded, setDesktopProjectFilterExpanded] = useState(false);
  const [mobileFiltersExpanded, setMobileFiltersExpanded] = useState(false);
  const [mobileTypeFilterExpanded, setMobileTypeFilterExpanded] = useState(false);
  const [mobileProjectFilterExpanded, setMobileProjectFilterExpanded] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [tempSelectedWeekdays, setTempSelectedWeekdays] = useState<number[]>([]);
  const [selectedExecutionStatuses, setSelectedExecutionStatuses] = useState<ActivityExecutionStatus[] | undefined>(undefined);
  const [tempSelectedExecutionStatuses, setTempSelectedExecutionStatuses] = useState<ActivityExecutionStatus[]>([DEFAULT_ACTIVITY_EXECUTION_STATUS]);
  const [selectedClosureState, setSelectedClosureState] = useState<OrganizationClosureStateFilter | undefined>(undefined);
  const [tempSelectedClosureState, setTempSelectedClosureState] = useState<OrganizationClosureStateFilter | undefined>(undefined);
  
  // Toggle für absolute vs. relative (Durchschnitt) Zahlen in KPIs
  const [showAverage, setShowAverage] = useState<boolean>(false);

  // Zeitverlauf Aggregation: 'day' | 'week' | 'month'
  const [timeAggregation, setTimeAggregation] = useState<'day' | 'week' | 'month'>('day');
  
  // Pagination für Aktivitäten-Tabelle
  const [activitiesPage, setActivitiesPage] = useState<number>(1);
  const ACTIVITIES_PER_PAGE = 50;

  const [pdfMode, setPdfMode] = useState(false);
  const [pdfActivities, setPdfActivities] = useState<Activity[]>([]);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const chartCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const statsUiFlowIdRef = useRef<string | null>(null);
  const statsUiFlowCompletedRef = useRef(false);
  const statsUiFlowMarksRef = useRef<Record<string, boolean>>({});
  const statsUiPendingRunKeyRef = useRef<string | null>(null);
  const statsUiFetchSeenRef = useRef<Record<string, boolean>>({});
  const [activeChartExport, setActiveChartExport] = useState<string | null>(null);
  const [activeActivitiesExport, setActiveActivitiesExport] = useState<ActivitiesExportFormat | null>(null);
  const [isControllingExporting, setIsControllingExporting] = useState(false);
  const [reportExportOpen, setReportExportOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const { user } = useAuth();
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
    [executionStatusFilterParam, from, to, projectId, selectedClosureState, selectedType, selectedWeekdays],
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
    [executionStatusFilterParam, from, to, projectId, selectedClosureState, selectedType, selectedWeekdays],
  );
  const overviewQ = useStatsOverview(statsParams, scopeKey, {
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
  const topTags = overview?.topTags ?? [];
  const topProjects = overview?.topProjects ?? [];
  const activityYears = overview?.availableYears ?? [];
  const activitiesPageQ = useActivitiesPaged(activitiesParams, activitiesPage, ACTIVITIES_PER_PAGE, {
    refetchOnWindowFocus: true,
    refetchIntervalMs: publicConfig?.liveRefreshIntervalMs,
  });
  const pagedActivities = activitiesPageQ.data?.data ?? [];
  const reportActivities = pdfMode ? pdfActivities : pagedActivities;
  const totalActivities = activitiesPageQ.data?.total ?? summary?.totalActivities ?? 0;
  const { data: tagsAll = [] } = useTags({ active: true });
  const { data: cohortsAll = [] } = useCohorts({ active: true });
  const { data: projectsAll = [] } = useProjects();

  const statsRunKey = useMemo(
    () => JSON.stringify([scopeKey, statsParams.from ?? '', statsParams.to ?? '', statsParams.projectId ?? '', statsParams.type ?? '', statsParams.executionStatuses?.join(',') ?? '', statsParams.closureState ?? '', statsParams.weekdays?.join(',') ?? '']),
    [scopeKey, statsParams.from, statsParams.to, statsParams.projectId, statsParams.type, statsParams.executionStatuses, statsParams.closureState, statsParams.weekdays],
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
    const anyPending = queryStates.some((queryState) => queryState.status !== 'success' && !queryState.isError);
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

    const failedQueries = queryStates.filter((queryState) => queryState.isError).map((queryState) => queryState.key);
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
    () => (selectedType ? projectsAll.filter((project) => project.type === selectedType) : projectsAll),
    [projectsAll, selectedType],
  );

  // If the selected project disappears (e.g. archived/deleted) or no longer matches the type filter, reset to "all"
  useEffect(() => {
    if (!projectId) return;
    if (!filteredProjects.some((project) => project.id === projectId)) setProjectId('');
  }, [filteredProjects, projectId]);

  // Monatsnamen für die Anzeige
  const MONTH_NAMES = [
    autoT('ui_626267415e7c'), autoT('ui_9aaceea74e57'), autoT('ui_0b30c927854e'), autoT('ui_a0393902db1f'), autoT('ui_afe526a6c998'), autoT('ui_7e1115bd02bb'),
    autoT('ui_aeb2d1b92e62'), autoT('ui_69d97c5797dc'), autoT('ui_1c542e79c9b4'), autoT('ui_ef2a59835205'), autoT('ui_3c5bf776f5ef'), autoT('ui_dbaab22b8b0f')
  ];
  const MONTH_NAMES_SHORT = [autoT('ui_efed3690ea22'), autoT('ui_dc8415ccfe52'), autoT('ui_365b0a1446a1'), autoT('ui_befde54a108c'), autoT('ui_afe526a6c998'), autoT('ui_6d90df3be4d0'), autoT('ui_b737558468d7'), autoT('ui_75629af51d7c'), autoT('ui_fdd289e370bd'), autoT('ui_45071a113a68'), autoT('ui_bb9bfefd5391'), autoT('ui_99ae802ea663')];

  const formatWeekdayDisplay = (weekdays: number[]) =>
    normalizeWeekdays(weekdays)
      .map((weekday) => WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.shortLabel ?? `#${weekday}`)
      .join(', ');

  // Helper: Update date range based on year and month selection
  const updateDateRange = (year: string, month: number | null) => {
    if (!year) {
      setFrom('');
      setTo('');
      return;
    }
    if (month === null) {
      // Ganzes Jahr
      setFrom(`${year}-01-01`);
      setTo(`${year}-12-31`);
    } else {
      // Spezifischer Monat
      const lastDay = new Date(Number(year), month, 0).getDate();
      setFrom(`${year}-${String(month).padStart(2, '0')}-01`);
      setTo(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    }
  };

  // Helper: Select a year quickly (year is a string like "2024" or empty for "all")
  const selectYear = (year: string) => {
    setSelectedYear(year);
    setSelectedMonth(null);
    setFilterMode('year');
    updateDateRange(year, null);
  };

  // Helper: Select a month
  const selectMonth = (month: number) => {
    const year = selectedYear || String(currentYear);
    setSelectedYear(year);
    setSelectedMonth(month);
    setFilterMode('month');
    updateDateRange(year, month);
  };

  // Leaving the "Alle" range must establish a concrete year. Otherwise the
  // resulting date range is incorrectly treated as a custom range on the way
  // back to the year view.
  const switchToYearView = () => {
    const year = selectedYear || String(currentYear);
    setSelectedYear(year);
    setSelectedMonth(null);
    setFilterMode('year');
    updateDateRange(year, null);
  };

  const switchToMonthView = () => {
    selectMonth(selectedMonth ?? currentMonth);
  };

  // Navigate to previous/next month
  const navigateMonth = (direction: 'prev' | 'next') => {
    let year = Number(selectedYear || currentYear);
    let month = selectedMonth ?? currentMonth;
    
    if (direction === 'prev') {
      month -= 1;
      if (month < 1) {
        month = 12;
        year -= 1;
      }
    } else {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    
    setSelectedYear(String(year));
    setSelectedMonth(month);
    setFilterMode('month');
    updateDateRange(String(year), month);
  };

  // Apply custom date range from modal
  const applyCustomRange = () => {
    const weekdays = normalizeWeekdays(tempSelectedWeekdays);
    const executionStatuses = normalizeActivityExecutionStatuses(tempSelectedExecutionStatuses);
    const nextFrom = tempFrom?.trim() || '';
    const nextTo = tempTo?.trim() || '';
    setSelectedWeekdays(weekdays);
    setSelectedExecutionStatuses(
      isDefaultActivityExecutionStatusFilter(executionStatuses) ? undefined : executionStatuses,
    );
    setSelectedClosureState(tempSelectedClosureState);

    if (!nextFrom && !nextTo) {
      if (isCustomRange) {
        setFrom('');
        setTo('');
        setSelectedYear('');
        setSelectedMonth(null);
        setFilterMode('year');
      }
      setCustomFilterOpen(false);
      return;
    }

    const normalizedRange =
      nextFrom && nextTo && nextFrom > nextTo
        ? { from: nextTo, to: nextFrom }
        : { from: nextFrom, to: nextTo };

    setFrom(normalizedRange.from);
    setTo(normalizedRange.to);
    setSelectedYear('');
    setSelectedMonth(null);
    setFilterMode('year');
    setCustomFilterOpen(false);
  };

  const resetAdvancedFilters = () => {
    setSelectedWeekdays([]);
    setTempSelectedWeekdays([]);
    setSelectedExecutionStatuses(undefined);
    setTempSelectedExecutionStatuses([DEFAULT_ACTIVITY_EXECUTION_STATUS]);
    setSelectedClosureState(undefined);
    setTempSelectedClosureState(undefined);
    if (isCustomRange) {
      selectYear(String(currentYear));
    }
  };

  // A date filter from the advanced modal is active whenever it owns the range state
  // instead of the standard year/month navigation.
  const isCustomRange = useMemo(
    () => Boolean(from || to) && !selectedYear && selectedMonth === null,
    [from, selectedMonth, selectedYear, to],
  );

  const hasWeekdayFilter = selectedWeekdays.length > 0;
  const hasExecutionStatusFilter = !isDefaultActivityExecutionStatusFilter(selectedExecutionStatuses);
  const hasClosureStateFilter = typeof selectedClosureState !== 'undefined';
  const hasAdvancedFilter = isCustomRange || hasWeekdayFilter || hasExecutionStatusFilter || hasClosureStateFilter;

  // Format the current range for display
  const formatRangeDisplay = () => {
    if (isCustomRange) {
      const fmtDate = (d: string) => {
        if (!d) return '';
        const [y, m, day] = d.split('-');
        return `${day}.${m}.${y}`;
      };
      return `${fmtDate(from)} – ${fmtDate(to)}`;
    }
    if (!selectedYear) return autoT('ui_eb3ab8ef013a');
    if (selectedMonth !== null) {
      return `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
    }
    return selectedYear;
  };

  const formatAdvancedFilterDisplay = () => {
    const parts = [
      isCustomRange ? formatRangeDisplay() : '',
      hasExecutionStatusFilter ? formatActivityExecutionStatusList(selectedExecutionStatuses) : '',
      hasClosureStateFilter && selectedClosureState ? CLOSURE_FILTER_LABELS[selectedClosureState] : '',
      hasWeekdayFilter ? formatWeekdayDisplay(selectedWeekdays) : '',
    ].filter(Boolean);
    return parts.join(' · ');
  };

  const byTypeData = (byType || []).map((d, i) => ({
    name: TYPE_LABEL[d.type] || d.type,
    value: d.count,
    color: COLORS[i % COLORS.length],
  }));
  const isDarkTheme = isDarkThemeName(user?.theme);
  const chartSeparatorColor = isDarkTheme ? 'rgba(148, 163, 184, 0.2)' : 'rgba(255, 255, 255, 0.92)';
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
    backgroundColor: 'color-mix(in srgb, var(--surface-1) 96%, transparent)',
    borderColor: 'var(--border-strong)',
    borderRadius: '12px',
    boxShadow: 'var(--card-shadow)',
    color: 'var(--text-primary)',
  } as const;
  const chartTooltipLabelStyle = {
    color: 'var(--text-secondary)',
    fontWeight: 600,
  } as const;
  const chartTooltipItemStyle = {
    color: 'var(--text-primary)',
  } as const;
  const lineChartCursor = { stroke: 'var(--border-strong)', strokeWidth: 1, strokeDasharray: '4 4' };
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
  const mobileMutedSurfaceClass = isDarkTheme ? 'bg-white/6 text-slate-100' : 'bg-gray-100 text-slate-900';
  const mobileSoftSurfaceClass = isDarkTheme ? 'bg-white/[0.05] text-slate-300' : 'bg-gray-50 text-slate-700';
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
    boxShadow: isDarkTheme ? '0 24px 48px rgba(0, 0, 0, 0.34)' : '0 18px 34px rgba(15, 23, 42, 0.12)',
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
      const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
      const weekNum = Math.ceil((dayOfYear + jan4.getDay() - 1) / 7);
      return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    };
    
    const getMonthKey = (dateStr: string) => {
      return dateStr.slice(0, 7); // YYYY-MM
    };

    if (timeAggregation === 'day') {
      if (showAverage) {
        return timeseries.map(item => {
          const count = item.activityCount || 1;
          return {
            date: item.date,
            totalParticipants: Math.round((item.totalParticipants / count) * 10) / 10
          };
        });
      }
      return timeseries;
    }
    
    const grouped = new Map<string, { total: number; activityCount: number }>();
    
    for (const item of timeseries) {
      const key = timeAggregation === 'week' 
        ? getWeekKey(item.date) 
        : getMonthKey(item.date);
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
          ? (data.activityCount > 0 ? Math.round((data.total / data.activityCount) * 10) / 10 : 0)
          : data.total
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
    }, [from, to, projectId, selectedType, selectedExecutionStatuses, selectedClosureState, selectedWeekdays]);

  const fmtNumber = (n?: number) => (typeof n === 'number' ? n.toLocaleString(getCurrentIntlLocale()) : '0');

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
  const useDesktopProjectCollapse = !isMobile && sortedProjects.length > DESKTOP_PROJECT_CHIP_COLLAPSE_THRESHOLD;
  const visibleDesktopProjects = useMemo(() => {
    return getVisibleSelectedItems({
      items: sortedProjects,
      selectedId: projectId,
      expanded: !useDesktopProjectCollapse || desktopProjectFilterExpanded,
      visibleCount: DESKTOP_PROJECT_CHIP_VISIBLE_COUNT,
    });
  }, [desktopProjectFilterExpanded, projectId, sortedProjects, useDesktopProjectCollapse]);
  const hiddenDesktopProjectCount = Math.max(sortedProjects.length - visibleDesktopProjects.length, 0);
  const useMobileTypeCollapse = isMobile && STATISTICS_TYPE_OPTIONS.length > MOBILE_TYPE_CHIP_VISIBLE_COUNT;
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
  const useMobileProjectCollapse = isMobile && sortedProjects.length > MOBILE_PROJECT_CHIP_VISIBLE_COUNT;
  const visibleMobileProjects = useMemo(() => {
    return getVisibleSelectedItems({
      items: sortedProjects,
      selectedId: projectId,
      expanded: !useMobileProjectCollapse || mobileProjectFilterExpanded,
      visibleCount: MOBILE_PROJECT_CHIP_VISIBLE_COUNT,
    });
  }, [mobileProjectFilterExpanded, projectId, sortedProjects, useMobileProjectCollapse]);
  const hiddenMobileProjectCount = Math.max(sortedProjects.length - visibleMobileProjects.length, 0);
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
      chartValue:
        activityCount > 0 ? Math.round((entry.total / activityCount) * 10) / 10 : 0,
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
          name: entry.name,
          value: entry.metricValue,
          color: fallbackBarColors[index % fallbackBarColors.length],
        })),
    [cohortChartData, fallbackBarColors, showAverage],
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

  const LineValueLabel = useMemo(
    () =>
      createLineValueLabelRenderer({
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

  const exportActivitiesAsExcel = async (activities: Activity[]) => {
    setExportProgress(autoT('ui_fdc6078908bb'));
    await new Promise(requestAnimationFrame);
    const rows = toActivityExportRows(activities);
    const sheetRows: Array<Array<string | number>> = [
      [autoT('ui_df5c3008c765'), autoT('ui_edcaf9aaa282'), autoT('ui_950701e758d1'), autoT('ui_20bda6d2e725'), autoT('ui_a24fe1e6fcc2'), autoT('ui_6b0d31c0d563'), autoT('ui_aff024fe4ab0'), autoT('ui_3c363836cf4e'), autoT('ui_d62550d402f1')],
      ...rows.map((row) => [
        row.date,
        row.type,
        row.title,
        row.project,
        row.total,
        row.male,
        row.female,
        row.diverse,
        row.duration === '' ? '' : row.duration,
      ]),
    ];

    const xlsx = await import('xlsx-js-style');
    const { utils, writeFile } = xlsx as unknown as typeof import('xlsx-js-style');
    type CellStyle = { font?: { bold?: boolean; color?: { rgb: string } } };
    const worksheet = utils.aoa_to_sheet(sheetRows);
    (worksheet as unknown as { ['!autofilter']?: { ref: string } })['!autofilter'] = {
      ref: `A1:${utils.encode_col((sheetRows[0]?.length || 1) - 1)}1`,
    };
    worksheet['!cols'] = [
      { wch: 13 },
      { wch: 22 },
      { wch: 34 },
      { wch: 30 },
      { wch: 10 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 12 },
    ];

    for (let column = 0; column < (sheetRows[0]?.length || 0); column++) {
      const address = utils.encode_cell({ r: 0, c: column });
      const cell = worksheet[address] as unknown as { s?: CellStyle } | undefined;
      if (cell) {
        cell.s = { ...(cell.s || {}), font: { ...(cell.s?.font || {}), bold: true } };
      }
    }

    for (let rowIndex = 1; rowIndex < sheetRows.length; rowIndex++) {
      const typeText = String(sheetRows[rowIndex][1] ?? '');
      const activityType = Object.entries(TYPE_LABEL).find(([, label]) => label === typeText)?.[0];
      if (!activityType) continue;

      const hex = colorForActivityType(activityType);
      const rgb = `FF${hex.replace('#', '').toUpperCase()}`;
      const address = utils.encode_cell({ r: rowIndex, c: 1 });
      const cell = worksheet[address] as unknown as { s?: CellStyle } | undefined;
      if (cell) {
        cell.s = {
          ...(cell.s || {}),
          font: { ...(cell.s?.font || {}), color: { rgb } },
        };
      }
    }

    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, autoT('ui_b6bf5f1a2033'));
    setExportProgress(autoT('ui_69d8049e6f66'));
    await new Promise(requestAnimationFrame);
    writeFile(workbook, getActivitiesExportFileName('xlsx'));
  };

  const exportControllingDataAsExcel = async (activities: Activity[]) => {
    setExportProgress(autoT('ui_2395ed5ba683'));
    await new Promise(requestAnimationFrame);

    const xlsx = await import('xlsx-js-style');
    const { utils, writeFile } = xlsx as unknown as typeof import('xlsx-js-style');
    type CellStyle = {
      font?: { bold?: boolean; color?: { rgb: string } };
      fill?: { patternType: 'solid'; fgColor: { rgb: string } };
      alignment?: { horizontal?: 'left' | 'center'; vertical?: 'top' | 'center'; wrapText?: boolean };
    };
    const rows = activities as ControllingExportRow[];
    const cohortOrder = (cohortsAll as Cohort[])
      .slice()
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
    const cohortIds = cohortOrder.map((cohort) => cohort.id);
    const cohortHeaders = cohortOrder.flatMap((cohort) => [
      `${cohort.name} (m)`,
      `${cohort.name} (w)`,
      `${cohort.name} (d)`,
    ]);
    const activityRows: Array<Array<string | number>> = [
      [
        autoT('ui_df5c3008c765'), autoT('ui_bae7d5be7082'), autoT('ui_edcaf9aaa282'), autoT('ui_950701e758d1'), autoT('ui_20bda6d2e725'), autoT('ui_a8a4d6b019af'), autoT('ui_6b0d31c0d563'), autoT('ui_aff024fe4ab0'), autoT('ui_3c363836cf4e'),
        ...cohortHeaders, autoT('ui_d62550d402f1'), autoT('ui_4e1e15e17610'), autoT('ui_848eed0fbd54'), autoT('ui_7e458d013900'),
      ],
      ...rows.map((activity) => {
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
        return [
          formatActivityDateGerman(activity.date),
          activity.executionStatus === 'cancelled' ? 'Ausgefallen' : autoT('ui_f91abe615749'),
          getActivityTypeLabel(activity.type),
          activity.title || '',
          activity.project?.title || '',
          getActivityParticipantTotal(activity),
          activity.countMale || 0,
          activity.countFemale || 0,
          activity.countDiverse || 0,
          ...cohortIds.flatMap((id) => {
            const cohort = perCohort[id] || { m: 0, w: 0, d: 0 };
            return [cohort.m, cohort.w, cohort.d];
          }),
          getControllingDurationMinutes(activity),
          activity.project?.type === 'open_door' ? '' : (activity.categories || []).map((category) => category.name).join(', '),
          (activity.tags || []).map((tag) => tag.name).join(', '),
          activity.notes || '',
        ];
      }),
    ];
    const statusCol = 1;
    const typeCol = 2;
    const firstNumberCol = 5;
    const durationCol = 9 + cohortHeaders.length;
    const categoriesCol = durationCol + 1;
    const tagsCol = durationCol + 2;
    const notesCol = durationCol + 3;
    const activitySheet = utils.aoa_to_sheet(activityRows);
    (activitySheet as unknown as { ['!autofilter']?: { ref: string } })['!autofilter'] = {
      ref: `A1:${utils.encode_col(activityRows[0].length - 1)}1`,
    };
    activitySheet['!cols'] = activityRows[0].map((header, index) => {
      if (index === 0) return { wch: 14 };
      if (index === statusCol) return { wch: 16 };
      if (index === typeCol) return { wch: 22 };
      if (index === 3 || index === 4) return { wch: 28 };
      if (index === categoriesCol || index === tagsCol) return { wch: 30 };
      if (index === notesCol) return { wch: 42 };
      return { wch: Math.max(10, String(header).length + 2) };
    });
    const setStyle = (sheet: typeof activitySheet, rowIndex: number, colIndex: number, style: CellStyle) => {
      const cell = sheet[utils.encode_cell({ r: rowIndex, c: colIndex })] as unknown as { s?: CellStyle } | undefined;
      if (!cell) return;
      cell.s = {
        ...(cell.s || {}),
        ...style,
        font: { ...(cell.s?.font || {}), ...(style.font || {}) },
        fill: style.fill || cell.s?.fill,
        alignment: { ...(cell.s?.alignment || {}), ...(style.alignment || {}) },
      };
    };
    const styleHeader = (sheet: typeof activitySheet, columnCount: number) => {
      for (let column = 0; column < columnCount; column++) {
        setStyle(sheet, 0, column, {
          font: { bold: true, color: { rgb: 'FFFFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'FF5B6CFF' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        });
      }
    };
    styleHeader(activitySheet, activityRows[0].length);
    for (let rowIndex = 1; rowIndex < activityRows.length; rowIndex++) {
      setStyle(activitySheet, rowIndex, 0, { alignment: { horizontal: 'center', vertical: 'center' } });
      const isCancelled = String(activityRows[rowIndex][statusCol] ?? '') === 'Ausgefallen';
      setStyle(activitySheet, rowIndex, statusCol, {
        font: { bold: true, color: { rgb: isCancelled ? 'FFB42318' : 'FF027A48' } },
        fill: { patternType: 'solid', fgColor: { rgb: isCancelled ? 'FFFDECEC' : 'FFEAF7EE' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      });
      const typeRgb = `FF${colorForActivityType(rows[rowIndex - 1].type).replace('#', '').toUpperCase()}`;
      setStyle(activitySheet, rowIndex, typeCol, {
        font: { bold: true, color: { rgb: 'FFFFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: typeRgb } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      });
      for (let column = firstNumberCol; column <= durationCol; column++) {
        setStyle(activitySheet, rowIndex, column, { alignment: { horizontal: 'center', vertical: 'center' } });
      }
      for (const [column, color] of [[categoriesCol, 'FFF5F7FF'], [tagsCol, 'FFE8EBFF'], [notesCol, 'FFF8FAFC']] as const) {
        if (activityRows[rowIndex][column]) {
          setStyle(activitySheet, rowIndex, column, {
            fill: { patternType: 'solid', fgColor: { rgb: color } },
            alignment: { vertical: 'top', wrapText: true },
          });
        }
      }
    }

    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, activitySheet, autoT('ui_b6bf5f1a2033'));
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
    const projectsById = new Map(projectsAll.map((project) => [project.id, project]));
    const activitiesByProject = new Map<string, ControllingExportRow[]>();
    rows.forEach((activity) => {
      if (!activity.projectId) return;
      const projectActivities = activitiesByProject.get(activity.projectId) || [];
      projectActivities.push(activity);
      activitiesByProject.set(activity.projectId, projectActivities);
    });
    for (const [id, projectActivities] of activitiesByProject) {
      const totalParticipants = projectActivities.reduce((sum, activity) => sum + getActivityParticipantTotal(activity), 0);
      const totalMale = projectActivities.reduce((sum, activity) => sum + (activity.countMale || 0), 0);
      const totalFemale = projectActivities.reduce((sum, activity) => sum + (activity.countFemale || 0), 0);
      const totalDiverse = projectActivities.reduce((sum, activity) => sum + (activity.countDiverse || 0), 0);
      const durations = projectActivities.map(getControllingDurationMinutes).filter((value): value is number => typeof value === 'number');
      const project = projectsById.get(id);
      const ratio = totalParticipants > 0
        ? `${Math.round((totalMale / totalParticipants) * 100)} % m · ${Math.round((totalFemale / totalParticipants) * 100)} % w · ${Math.round((totalDiverse / totalParticipants) * 100)} % d`
        : autoT('ui_f489591ec2c6');
      const projectRows: Array<Array<string | number>> = [
        [autoT('ui_5347abc77ca3'), autoT('ui_9d3fb5bb5707')],
        [autoT('ui_20bda6d2e725'), project?.title || projectActivities[0].project?.title || autoT('ui_7ad11e328f86')],
        [autoT('ui_fe359159c8ad'), exportRangeLabel],
        [autoT('ui_b6bf5f1a2033'), projectActivities.length],
        [autoT('ui_59c83f1c873f'), totalParticipants],
        ['Ø Besucher*innen', projectActivities.length ? Math.round((totalParticipants / projectActivities.length) * 10) / 10 : 0],
        [autoT('ui_0f4989b791e1'), ratio],
        ['Ø Dauer (min)', durations.length ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10 : '–'],
        [],
        [autoT('ui_df5c3008c765'), autoT('ui_edcaf9aaa282'), autoT('ui_950701e758d1'), autoT('ui_a8a4d6b019af'), autoT('ui_6b0d31c0d563'), autoT('ui_aff024fe4ab0'), autoT('ui_3c363836cf4e'), autoT('ui_d62550d402f1')],
        ...projectActivities.map((activity) => [
          formatActivityDateGerman(activity.date), getActivityTypeLabel(activity.type), activity.title || '',
          getActivityParticipantTotal(activity), activity.countMale || 0, activity.countFemale || 0,
          activity.countDiverse || 0, getControllingDurationMinutes(activity),
        ]),
      ];
      const projectSheet = utils.aoa_to_sheet(projectRows);
      styleHeader(projectSheet, 2);
      for (let column = 0; column < 8; column++) {
        setStyle(projectSheet, 9, column, {
          font: { bold: true, color: { rgb: 'FFFFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'FF5B6CFF' } },
        });
      }
      projectSheet['!cols'] = [{ wch: 20 }, { wch: 26 }, { wch: 30 }, { wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 14 }];
      utils.book_append_sheet(workbook, projectSheet, uniqueSheetName(project?.title || projectActivities[0].project?.title || autoT('ui_20bda6d2e725')));
    }

    setExportProgress(autoT('ui_eb5ec187a1c8'));
    const logbookEntries = await fetchAllLogbookEntries({ from: from || undefined, to: to || undefined, projectId: projectId || undefined });
    const logbookRows: Array<Array<string | number>> = [
      [autoT('ui_df5c3008c765'), autoT('ui_edcaf9aaa282'), autoT('ui_950701e758d1'), autoT('ui_bae7d5be7082'), autoT('ui_20bda6d2e725'), autoT('ui_d28fd7140d15'), autoT('ui_1f9c9c4e9b69'), autoT('ui_24cb5c6fa8e6'), autoT('ui_76231e1d047c')],
      ...logbookEntries.map((entry: LogbookEntry) => [
        formatActivityDateGerman(entry.occurredAt), entry.type, entry.title, entry.status,
        entry.project?.title || '', entry.body || '', entry.highlights || '', entry.challenges || '', entry.nextSteps || '',
      ]),
    ];
    const logbookSheet = utils.aoa_to_sheet(logbookRows);
    styleHeader(logbookSheet, logbookRows[0].length);
    (logbookSheet as unknown as { ['!autofilter']?: { ref: string } })['!autofilter'] = {
      ref: `A1:${utils.encode_col(logbookRows[0].length - 1)}1`,
    };
    logbookSheet['!cols'] = [{ wch: 14 }, { wch: 15 }, { wch: 30 }, { wch: 16 }, { wch: 26 }, { wch: 50 }, { wch: 32 }, { wch: 32 }, { wch: 32 }];
    utils.book_append_sheet(workbook, logbookSheet, uniqueSheetName('Logbuch'));

    setExportProgress(autoT('ui_69d8049e6f66'));
    await new Promise(requestAnimationFrame);
    writeFile(workbook, getControllingExportFileName());
  };

  const exportActivitiesAsPdf = async (activities: Activity[]) => {
    setExportProgress(autoT('ui_27e7c797926f'));
    await new Promise(requestAnimationFrame);
    const rows = toActivityExportRows(activities);
    const { JsPDF } = await loadPdfExportDependencies();
    const pdf = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const tableTop = 34;
    const rowPaddingY = 1.5;
    const lineHeight = 3.8;
    const columns = [
      { key: 'date', label: autoT('ui_df5c3008c765'), width: 18, align: 'left' as const },
      { key: 'type', label: autoT('ui_edcaf9aaa282'), width: 31, align: 'left' as const },
      { key: 'title', label: autoT('ui_950701e758d1'), width: 64, align: 'left' as const },
      { key: 'project', label: autoT('ui_20bda6d2e725'), width: 58, align: 'left' as const },
      { key: 'total', label: autoT('ui_a24fe1e6fcc2'), width: 17, align: 'right' as const },
      { key: 'male', label: autoT('ui_6b0d31c0d563'), width: 11, align: 'right' as const },
      { key: 'female', label: autoT('ui_aff024fe4ab0'), width: 11, align: 'right' as const },
      { key: 'diverse', label: autoT('ui_3c363836cf4e'), width: 11, align: 'right' as const },
      { key: 'duration', label: autoT('ui_f6e58177bf91'), width: 18, align: 'right' as const },
    ];
    const totalTableWidth = columns.reduce((sum, column) => sum + column.width, 0);
    const orgTitle = user?.orgName || autoT('ui_6e99c1d3b150');
    let pageNumber = 1;

    const drawTableHeader = (startY: number) => {
      let currentX = margin;
      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, startY, totalTableWidth, 7, 'F');
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(margin, startY, totalTableWidth, 7);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);

      columns.forEach((column) => {
        pdf.rect(currentX, startY, column.width, 7);
        pdf.text(column.label, currentX + 1.5, startY + 4.6);
        currentX += column.width;
      });

      return startY + 7;
    };

    const drawPageFrame = () => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text(autoT('ui_44eeeedb9e8f'), margin, 15);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10.5);
      pdf.text(orgTitle, margin, 21);
      pdf.text(exportRangeLabel, margin, 26);
      pdf.text(autoT('ui_9a3150b4e9ec', { value0: rows.length.toLocaleString(getCurrentIntlLocale()) }), pageWidth - margin, 21, { align: 'right' });
      pdf.text(`Seite ${pageNumber}`, pageWidth - margin, 26, { align: 'right' });
      return drawTableHeader(tableTop);
    };

    let currentY = drawPageFrame();

    if (rows.length === 0) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(autoT('ui_a64587b9ad76'), margin, currentY + 8);
      setExportProgress(autoT('ui_0acf469c6a6c'));
      await new Promise(requestAnimationFrame);
      pdf.save(getActivitiesExportFileName('pdf'));
      return;
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);

    rows.forEach((row, rowIndex) => {
      const cellLines = columns.map((column) => {
        const rawValue = row[column.key as keyof ActivityExportRow];
        const text = rawValue === '' ? '' : String(rawValue);
        if (column.align === 'right') return [text];
        const lines = pdf.splitTextToSize(text || ' ', column.width - 3);
        return Array.isArray(lines) && lines.length > 0 ? lines : [' '];
      });

      const maxLineCount = Math.max(...cellLines.map((lines) => lines.length), 1);
      const rowHeight = maxLineCount * lineHeight + rowPaddingY * 2;

      if (currentY + rowHeight > pageHeight - margin) {
        pdf.addPage('a4', 'landscape');
        pageNumber += 1;
        currentY = drawPageFrame();
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
      }

      if (rowIndex % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, currentY, totalTableWidth, rowHeight, 'F');
      }

      let currentX = margin;
      pdf.setDrawColor(226, 232, 240);
      columns.forEach((column, columnIndex) => {
        pdf.rect(currentX, currentY, column.width, rowHeight);
        const lines = cellLines[columnIndex];

        lines.forEach((line, lineIndex) => {
          const textY = currentY + rowPaddingY + 3.1 + lineIndex * lineHeight;
          if (column.align === 'right') {
            pdf.text(line, currentX + column.width - 1.2, textY, { align: 'right' });
          } else {
            pdf.text(line, currentX + 1.2, textY);
          }
        });

        currentX += column.width;
      });

      currentY += rowHeight;
    });

    setExportProgress(autoT('ui_0acf469c6a6c'));
    await new Promise(requestAnimationFrame);
    pdf.save(getActivitiesExportFileName('pdf'));
  };

  async function exportActivitiesTable(format: ActivitiesExportFormat) {
    setActiveActivitiesExport(format);
    setExportProgress(autoT('ui_cde99ee62070'));

    try {
      const activities = await fetchAllFilteredActivities();
      if (format === 'xlsx') {
        await exportActivitiesAsExcel(activities);
        return;
      }

      await exportActivitiesAsPdf(activities);
    } catch (error) {
      console.error('Activities export failed', error);
    } finally {
      setActiveActivitiesExport(null);
      setExportProgress(null);
    }
  }

  async function exportControllingData() {
    setIsControllingExporting(true);
    setExportProgress(autoT('ui_cde99ee62070'));

    try {
      const activities = await fetchAllFilteredActivities();
      await exportControllingDataAsExcel(activities);
    } catch (error) {
      console.error('Controlling export failed', error);
    } finally {
      setIsControllingExporting(false);
      setExportProgress(null);
    }
  }

  async function exportChart(chartId: string, chartTitle: string, format: ChartExportFormat) {
    const card = chartCardRefs.current[chartId];
    if (!card) return;

    const exportKey = `${chartId}:${format}`;
    setActiveChartExport(exportKey);
    setExportProgress(format === 'pdf' ? autoT('ui_70aa98ab3b7d') : 'Diagramm wird als Bild aufbereitet …');

    try {
      const { JsPDF, html2canvas } = await loadPdfExportDependencies();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);

      const canvas = await html2canvas(card, {
        scale: PDF_RENDER_SCALE,
        backgroundColor: '#ffffff',
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
    } finally {
      setActiveChartExport(null);
      setExportProgress(null);
    }
  }

  const renderChartExportActions = (chartId: string, chartTitle: string) => {
    const isExporting = activeChartExport?.startsWith(`${chartId}:`) ?? false;

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
    const isExporting = activeActivitiesExport !== null;

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

  async function exportPdf() {
    // Render the report container to images and assemble into a PDF (A4 portrait)
    if (!reportRef.current) return;

    try {
      // The on-screen table is intentionally paginated. The PDF must instead
      // render the complete matching dataset before html2canvas captures it.
      setExportProgress(autoT('ui_cde99ee62070'));
      setPdfActivities(await fetchAllFilteredActivities());
      setPdfMode(true);
      setExportProgress(autoT('ui_c49a3f591c68'));
      const { JsPDF, html2canvas } = await loadPdfExportDependencies();
      await new Promise(requestAnimationFrame);
      const el = reportRef.current;
      if (!el) return;

      await new Promise(requestAnimationFrame);
      const canvas = await html2canvas(el, {
        scale: PDF_RENDER_SCALE,
        backgroundColor: '#ffffff',
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

      setExportProgress(autoT('ui_0acf469c6a6c'));
      await new Promise(requestAnimationFrame);
      pdf.save(`StatO-Bericht-${orgTitle.replace(/\s+/g, '_')}.pdf`);
    } finally {
      setPdfMode(false);
      setPdfActivities([]);
      setExportProgress(null);
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
                      <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${mobileLabelTextClass}`}>{autoT('ui_a0ee12af77e5')}</div>
                      <div className={`mt-1 text-lg font-semibold truncate ${mobilePrimaryTextClass}`}>
                        {formatRangeDisplay()}
                      </div>
                      <div className={`mt-1 text-sm ${mobileSecondaryTextClass}`}>
                        {isCustomRange
                          ? autoT('ui_bd97404ed7e9')
                          : filterMode === 'month'
                            ? "Monatsansicht"
                            : selectedYear
                              ? "Jahresansicht"
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
                      {mobileFiltersExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                              backgroundColor: translucent(colorForActivityType(selectedType), '18'),
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
                          backgroundColor: selectedType ? colorForActivityType(selectedType) : "#6b7280",
                          borderColor: selectedType ? translucent(colorForActivityType(selectedType), 'aa') : "rgba(0,0,0,0.08)",
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
                          <span className={`h-5 w-5 overflow-hidden rounded-full border ${isDarkTheme ? "border-white/10 bg-white/10" : "border-gray-300 bg-gray-100"}`}>
                            <ProtectedImage src={selectedProjectRecord.imageUrl} alt="" className="h-full w-full object-cover" />
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
                        <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-black/10 bg-gray-400" />{autoT('ui_b857d350e38e')}<ChevronDown className="h-3.5 w-3.5 opacity-70" />
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

                    {hasAdvancedFilter && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-viridian/20 bg-viridian/10 px-3 py-1.5 text-sm font-medium text-viridian"
                        onClick={resetAdvancedFilters}
                        title={autoT('ui_9ba399b38183')}
                      >
                        <XIcon className="h-3.5 w-3.5" />{autoT('ui_a4565af537e2')}</button>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                        hasAdvancedFilter
                          ? "border-viridian bg-viridian/5 text-viridian"
                          : `${mobileSurfaceClass} ${mobileSurfaceHoverClass}`
                      }`}
                      onClick={openAdvancedFilters}
                    >
                      <SlidersHorizontal className="h-4 w-4" />{autoT('ui_dc3decbb9384')}</button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-cambridge-blue px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-viridian"
                      onClick={() => setReportExportOpen(true)}
                      title={autoT('ui_8dbb5c1c7f40')}
                    >
                      <FileDown className="h-4 w-4" />{autoT('ui_f3e4fadb9e37')}</button>
                  </div>
                </div>

                {mobileFiltersExpanded && (
                  <div className={`space-y-5 border-t pt-4 ${mobileDividerClass}`}>
                    <section className="space-y-3">
                      <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${mobileLabelTextClass}`}>{autoT('ui_fe359159c8ad')}</div>
                      <div className={`inline-flex items-center rounded-xl p-1 ${mobileMutedSurfaceClass}`}>
                        <button
                          type="button"
                          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                            filterMode === 'year' && !isCustomRange
                              ? "bg-white shadow text-viridian font-medium"
                              : `${mobileSecondaryTextClass} hover:text-viridian`
                          }`}
                          onClick={switchToYearView}
                        >{autoT('ui_956a6e5ab6c7')}</button>
                        <button
                          type="button"
                          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                            filterMode === 'month' && !isCustomRange
                              ? "bg-white shadow text-viridian font-medium"
                              : `${mobileSecondaryTextClass} hover:text-viridian`
                          }`}
                          onClick={switchToMonthView}
                        >{autoT('ui_da13625eeb37')}</button>
                      </div>

                      {filterMode === 'month' && !isCustomRange ? (
                        <>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${mobileSurfaceClass}`}
                              onClick={() => navigateMonth('prev')}
                              title={autoT('ui_9c52ab5061fe')}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium ${mobileSoftSurfaceClass}`}>
                              <Calendar className={`h-4 w-4 ${mobileLabelTextClass}`} />
                              <span className="truncate">
                                {selectedMonth !== null ? MONTH_NAMES[selectedMonth - 1] : MONTH_NAMES[currentMonth - 1]} {selectedYear || currentYear}
                              </span>
                            </div>
                            <button
                              type="button"
                              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${mobileSurfaceClass}`}
                              onClick={() => navigateMonth('next')}
                              title={autoT('ui_ad21607e5b49')}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {MONTH_NAMES_SHORT.map((name, idx) => {
                              const month = idx + 1;
                              const isActive = selectedMonth === month;
                              const isCurrent = month === currentMonth && selectedYear === String(currentYear);
                              return (
                                <button
                                  key={month}
                                  type="button"
                                  className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                                    isActive
                                      ? "bg-viridian text-white"
                                      : isCurrent
                                        ? "bg-viridian/10 text-viridian"
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
                                ? "bg-viridian text-white"
                                : mobileMutedSurfaceClass
                            }`}
                            onClick={() => selectYear('')}
                          >{autoT('ui_4c7a986ffe2b')}</button>
                          {activityYears.map((y) => (
                            <button
                              key={y}
                              type="button"
                              className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                                selectedYear === y && !isCustomRange
                                  ? "bg-viridian text-white"
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
                        <div className={`text-sm font-medium ${mobilePrimaryTextClass}`}>{autoT('ui_de9f4ac20f7f')}</div>
                        {useMobileTypeCollapse && (
                          <button
                            type="button"
                            onClick={() => setMobileTypeFilterExpanded((current) => !current)}
                            className={`inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium ${mobileDashedSurfaceClass} ${mobileSoftSurfaceHoverClass}`}
                            aria-expanded={mobileTypeFilterExpanded}
                          >
                            {mobileTypeFilterExpanded ? (
                              <>
                                <ChevronUp className="h-3.5 w-3.5" />{autoT('ui_cc193d70551f')}</>
                            ) : (
                              <>
                                <ChevronDown className="h-3.5 w-3.5" />
                                {hiddenMobileTypeCount}{autoT('ui_1960ac5a2d44')}</>
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
                              ? "bg-viridian text-white border-viridian"
                              : mobileSurfaceClass
                          }`}
                        >{autoT('ui_172a950cc0da')}</button>
                        {(useMobileTypeCollapse ? visibleMobileTypes : STATISTICS_TYPE_OPTIONS).map((type) => {
                          const active = selectedType === type;
                          const typeColor = colorForActivityType(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setSelectedType(type)}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                                active ? "text-white shadow ring-2 ring-offset-1 ring-viridian/20" : "text-gray-800"
                              }`}
                              style={{
                                backgroundColor: active ? typeColor : translucent(typeColor, '14'),
                                borderColor: active ? typeColor : translucent(typeColor, '66'),
                              }}
                            >
                              <span
                                aria-hidden
                                className="h-2.5 w-2.5 rounded-full border"
                                style={{
                                  backgroundColor: active ? "rgba(255,255,255,0.9)" : typeColor,
                                  borderColor: active ? "rgba(255,255,255,0.35)" : translucent(typeColor, 'aa'),
                                }}
                              />
                              {TYPE_LABEL[type]}
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {projectsAll.length > 0 && (
                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className={`text-sm font-medium ${mobilePrimaryTextClass}`}>{autoT('ui_3930f79f07e5')}</div>
                          {useMobileProjectCollapse && sortedProjects.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setMobileProjectFilterExpanded((current) => !current)}
                              className={`inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium ${mobileDashedSurfaceClass} ${mobileSoftSurfaceHoverClass}`}
                              aria-expanded={mobileProjectFilterExpanded}
                            >
                              {mobileProjectFilterExpanded ? (
                                <>
                                  <ChevronUp className="h-3.5 w-3.5" />{autoT('ui_cc193d70551f')}</>
                              ) : (
                                <>
                                  <ChevronDown className="h-3.5 w-3.5" />
                                  {hiddenMobileProjectCount}{autoT('ui_1960ac5a2d44')}</>
                              )}
                            </button>
                          )}
                        </div>

                        {sortedProjects.length === 0 ? (
                          <div className={`rounded-xl border border-dashed px-4 py-3 text-sm ${mobileDashedSurfaceClass}`}>{autoT('ui_63c009ada12c')}</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setProjectId('')}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                                !projectId
                                  ? "bg-viridian text-white border-viridian"
                                  : mobileSurfaceClass
                              }`}
                            >{autoT('ui_b857d350e38e')}</button>
                            {(useMobileProjectCollapse ? visibleMobileProjects : sortedProjects).map((p) => {
                              const active = projectId === p.id;
                              const color = typeof p.color === 'string' && p.color.trim() ? p.color.trim() : undefined;
                              const imageUrl = typeof p.imageUrl === 'string' && p.imageUrl.trim() ? p.imageUrl.trim() : undefined;
                              const overlayColor = color || '#0f766e';

                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setProjectId(p.id)}
                                  className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                                    active
                                      ? "text-white shadow ring-2 ring-offset-1 ring-viridian/20"
                                      : "text-gray-800"
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
                                        active ? "border-white/35 bg-white/15" : "border-gray-300 bg-gray-100"
                                      }`}
                                    >
                                      <ProtectedImage src={imageUrl} alt="" className="h-full w-full object-cover" />
                                    </span>
                                  ) : (
                                    <span
                                      aria-hidden
                                      className="h-2.5 w-2.5 rounded-full border"
                                      style={{
                                        backgroundColor: overlayColor,
                                        borderColor: active ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.08)",
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
                <div className="flex items-center bg-gray-100 rounded-lg p-1 self-start">
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      filterMode === 'year' && !isCustomRange
                        ? "bg-white shadow text-viridian font-medium"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                    onClick={switchToYearView}
                  >{autoT('ui_956a6e5ab6c7')}</button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      filterMode === 'month' && !isCustomRange
                        ? "bg-white shadow text-viridian font-medium"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                    onClick={switchToMonthView}
                  >{autoT('ui_da13625eeb37')}</button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {filterMode === 'month' && !isCustomRange ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 touch-manipulation"
                        onClick={() => navigateMonth('prev')}
                        title={autoT('ui_9c52ab5061fe')}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-3 py-2 min-w-[140px] justify-center">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-gray-800">
                          {selectedMonth !== null ? MONTH_NAMES_SHORT[selectedMonth - 1] : MONTH_NAMES_SHORT[currentMonth - 1]} {selectedYear || currentYear}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 touch-manipulation"
                        onClick={() => navigateMonth('next')}
                        title={autoT('ui_ad21607e5b49')}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                          !selectedYear && !isCustomRange
                            ? "bg-viridian text-white"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                        }`}
                        onClick={() => selectYear('')}
                      >{autoT('ui_4c7a986ffe2b')}</button>
                      {activityYears.map((y) => (
                        <button
                          key={y}
                          type="button"
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                            selectedYear === y && !isCustomRange
                              ? "bg-viridian text-white"
                              : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                          }`}
                          onClick={() => selectYear(y)}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:ml-auto">
                  {hasAdvancedFilter && (
                    <div className="flex items-center gap-2 bg-viridian/10 text-viridian px-3 py-1.5 rounded-lg text-sm">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">{formatAdvancedFilterDisplay()}</span>
                      <button
                        type="button"
                        className="p-0.5 hover:bg-viridian/20 rounded"
                        onClick={resetAdvancedFilters}
                        title={autoT('ui_a4565af537e2')}
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className={`p-2 rounded-lg border transition-colors touch-manipulation ${
                      hasAdvancedFilter
                        ? "border-viridian text-viridian bg-viridian/5"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                    onClick={openAdvancedFilters}
                    title={autoT('ui_c78a00fa35d9')}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 sm:ml-0">
                  <button
                    type="button"
                    className="bg-cambridge-blue text-white px-4 md:px-6 py-2 rounded-lg hover:bg-viridian transition-colors inline-flex items-center gap-2 text-sm touch-manipulation"
                    onClick={() => setReportExportOpen(true)}
                    title={autoT('ui_4e4a0d7117ee')}
                  >
                    <FileDown className="h-4 w-4" />
                    <span className="hidden sm:inline">{autoT('ui_f3e4fadb9e37')}</span>
                    <span className="sm:hidden">{autoT('ui_f3e4fadb9e37')}</span>
                  </button>
                </div>
              </div>

              {filterMode === 'month' && !isCustomRange && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
                    {MONTH_NAMES_SHORT.map((name, idx) => {
                      const month = idx + 1;
                      const isActive = selectedMonth === month;
                      const isCurrent = month === currentMonth && selectedYear === String(currentYear);
                      return (
                        <button
                          key={month}
                          type="button"
                          className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                            isActive
                              ? "bg-viridian text-white"
                              : isCurrent
                                ? "bg-viridian/10 text-viridian hover:bg-viridian/20"
                                : "bg-gray-50 text-gray-700 hover:bg-gray-100"
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
                <div className="text-sm font-medium text-gray-700 mb-2">{autoT('ui_de9f4ac20f7f')}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedType('')}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      !selectedType
                        ? "bg-viridian text-white border-viridian"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >{autoT('ui_172a950cc0da')}</button>
                  {STATISTICS_TYPE_OPTIONS.map((type) => {
                    const active = selectedType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedType(type)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          active
                            ? "bg-viridian text-white border-viridian"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
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
                  <div className="text-sm font-medium text-gray-700 mb-2">{autoT('ui_3930f79f07e5')}</div>
                  {sortedProjects.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">{autoT('ui_63c009ada12c')}</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setProjectId('')}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          !projectId
                            ? "bg-viridian text-white border-viridian"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >{autoT('ui_b857d350e38e')}</button>
                      {(useDesktopProjectCollapse ? visibleDesktopProjects : sortedProjects).map((p) => {
                        const active = projectId === p.id;
                        const color = typeof p.color === 'string' && p.color.trim() ? p.color.trim() : undefined;
                        const imageUrl = typeof p.imageUrl === 'string' && p.imageUrl.trim() ? p.imageUrl.trim() : undefined;
                        const fallbackColor = '#0f766e';
                        const overlayColor = color || fallbackColor;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setProjectId(p.id)}
                            className={`relative overflow-hidden px-3 py-1.5 rounded-full text-sm border flex items-center gap-2 max-w-full transition-colors ${
                              active
                                ? "text-white shadow ring-2 ring-offset-1 ring-viridian/30"
                                : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
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
                                    active ? "border-white/40 bg-white/15" : "border-gray-300 bg-gray-100"
                                  }`}
                                >
                                  <ProtectedImage src={imageUrl} alt="" className="w-full h-full object-cover" />
                                </span>
                              ) : (
                                <span
                                  aria-hidden
                                  className="w-2.5 h-2.5 rounded-full border flex-shrink-0"
                                  style={{
                                    backgroundColor: overlayColor,
                                    borderColor: active ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.08)",
                                  }}
                                />
                              )}
                              <span className={`truncate ${active ? "drop-shadow" : ''}`}>{p.title}</span>
                            </span>
                          </button>
                        );
                      })}
                      {useDesktopProjectCollapse && (
                        <button
                          type="button"
                          onClick={() => setDesktopProjectFilterExpanded((current) => !current)}
                          className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors inline-flex items-center gap-2"
                          aria-expanded={desktopProjectFilterExpanded}
                        >
                          {desktopProjectFilterExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4" />{autoT('ui_34a01cec7c0e')}</>
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
        {/* KPI Summary with Toggle */}
        <div className="flex items-center justify-end mb-4" data-pdf-section>
          <div className="stats-kpi-toggle flex items-center gap-2 rounded-lg p-1">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                !showAverage ? "stats-kpi-toggle-button-active font-medium" : "stats-kpi-toggle-button"
              }`}
              onClick={() => setShowAverage(false)}
            >{autoT('ui_ffa660db79fb')}</button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                showAverage ? "stats-kpi-toggle-button-active font-medium" : "stats-kpi-toggle-button"
              }`}
              onClick={() => setShowAverage(true)}
            >{autoT('ui_388b22eb70db')}</button>
          </div>
        </div>
        <div
          className={`statistics-kpi-grid ${selectedClosureState === 'closed' ? "statistics-kpi-grid--with-closure" : ''}`}
          data-pdf-section
        >
          <div className="statistics-kpi-card statistics-kpi-card--activities">
            <img className="statistics-kpi-card-icon" src={STATISTICS_KPI_ICONS.activities} alt="" aria-hidden="true" />
            <div className="statistics-kpi-card-content">
              <p className="statistics-kpi-card-value">
                {showAverage
                  ? averageActivitiesPerWeek.toLocaleString(getCurrentIntlLocale(), { maximumFractionDigits: 1 })
                  : fmtNumber(summary?.totalActivities)}
              </p>
              <p className="statistics-kpi-card-label">
                {showAverage ? autoT('ui_a5ae4475a508') : autoT('ui_b6bf5f1a2033')}
              </p>
            </div>
          </div>
          <div className="statistics-kpi-card statistics-kpi-card--participants">
            <img className="statistics-kpi-card-icon" src={STATISTICS_KPI_ICONS.participants} alt="" aria-hidden="true" />
            <div className="statistics-kpi-card-content">
              <p className="statistics-kpi-card-value">
                {showAverage
                  ? summary?.averageParticipants?.toLocaleString('de-DE', { maximumFractionDigits: 1 })
                  : fmtNumber(summary?.totalParticipants)}
              </p>
              <p className="statistics-kpi-card-label">
                {showAverage ? autoT('ui_ce999918d5c2') : autoT('ui_a8a4d6b019af')}
              </p>
            </div>
          </div>
          <div className="statistics-kpi-card statistics-kpi-card--participants-per-hour">
            <img className="statistics-kpi-card-icon" src={STATISTICS_KPI_ICONS.participantsPerHour} alt="" aria-hidden="true" />
            <div className="statistics-kpi-card-content">
              <p className="statistics-kpi-card-value">
                {totalParticipantsPerHour.toLocaleString(getCurrentIntlLocale(), { maximumFractionDigits: 1 })}
              </p>
              <p className="statistics-kpi-card-label">
                {showAverage ? autoT('ui_86f83c37babf') : autoT('ui_bb662b9cd669')}
              </p>
            </div>
          </div>
          <div className="statistics-kpi-card statistics-kpi-card--hours">
            <img className="statistics-kpi-card-icon" src={STATISTICS_KPI_ICONS.hours} alt="" aria-hidden="true" />
            <div className="statistics-kpi-card-content">
              <p className="statistics-kpi-card-value">
                {showAverage
                  ? averageHoursPerActivity.toLocaleString(getCurrentIntlLocale(), { maximumFractionDigits: 1 })
                  : summary?.totalHours?.toLocaleString('de-DE')}
              </p>
              <p className="statistics-kpi-card-label">
                {showAverage ? autoT('ui_ddd5d008e490') : autoT('ui_02f31c07bda8')}
              </p>
            </div>
          </div>
          {selectedClosureState === 'closed' && (
            <div className="statistics-kpi-card statistics-kpi-card--closure">
              <div className="statistics-kpi-card-content">
                <p className="statistics-kpi-card-value">
                  {fmtNumber(summary?.closureDaysCount ?? 0)}
                </p>
                <p className="statistics-kpi-card-label">{autoT('ui_13c97516c9d9')}</p>
              </div>
            </div>
          )}
        </div>

        <CustomKpiCards
          surface="statistics"
          from={from || undefined}
          to={to || undefined}
          showManager={!pdfMode}
          refreshOptions={{
            refetchOnWindowFocus: true,
            refetchIntervalMs: publicConfig?.liveRefreshIntervalMs,
          }}
        />

        {/* Charts */}
        <div className={`grid gap-6 ${pdfMode ? "grid-cols-2" : "grid-cols-1 lg:grid-cols-2"}`}>
          <StatisticsPieChartCard
            title={autoT('ui_7a55d1e6e986')}
            exportActions={renderChartExportActions('activity-types', autoT('ui_7a55d1e6e986'))}
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
            exportActions={renderChartExportActions('gender-distribution', 'Geschlechterverteilung')}
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
            className="group/chart-card bg-white rounded-lg shadow p-3 md:p-6 lg:col-span-2"
            data-pdf-section
            ref={setChartCardRef('participants-trend')}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-viridian">
                {showAverage ? autoT('ui_0a94bbd542a9') : autoT('ui_3b658714e6c5')}
              </h3>
              <div className="flex items-center gap-2">
                {renderChartExportActions(
                  'participants-trend',
                  showAverage ? autoT('ui_0a94bbd542a9') : autoT('ui_3b658714e6c5'),
                )}
                <div className="stats-kpi-toggle flex items-center gap-1 rounded-lg p-1">
                  <button
                    onClick={() => setTimeAggregation('day')}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                      timeAggregation === 'day'
                        ? "stats-kpi-toggle-button-active font-medium"
                        : "stats-kpi-toggle-button"
                    }`}
                  >{autoT('ui_982963c1c41c')}</button>
                  <button
                    onClick={() => setTimeAggregation('week')}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                      timeAggregation === 'week'
                        ? "stats-kpi-toggle-button-active font-medium"
                        : "stats-kpi-toggle-button"
                    }`}
                  >{autoT('ui_7b2207dc85a6')}</button>
                  <button
                    onClick={() => setTimeAggregation('month')}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                      timeAggregation === 'month'
                        ? "stats-kpi-toggle-button-active font-medium"
                        : "stats-kpi-toggle-button"
                    }`}
                  >{autoT('ui_da13625eeb37')}</button>
                </div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={aggregatedTimeseries}
                  margin={
                    isParticipantsTrendExporting
                      ? { ...lineChartMargin, top: Math.max(lineChartMargin.top, 28) }
                      : lineChartMargin
                  }
                >
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
                    formatter={(value: number) => [
                      value.toLocaleString(getCurrentIntlLocale(), { maximumFractionDigits: 1 }),
                      showAverage ? autoT('ui_c649f425302c') : autoT('ui_a8a4d6b019af')
                    ]}
                    labelFormatter={(value) =>
                      formatStatisticsAggregationTooltipLabel(String(value), timeAggregation)
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalParticipants"
                    name={showAverage ? autoT('ui_c649f425302c') : autoT('ui_a8a4d6b019af')}
                    stroke="#10b981"
                    strokeWidth={2}
                    isAnimationActive={!isParticipantsTrendExporting}
                    activeDot={{ r: 6, fill: '#10b981', stroke: isDarkTheme ? "#ecf3ff" : "#ffffff", strokeWidth: 2 }}
                    dot={
                      isParticipantsTrendExporting
                        ? { r: 4, fill: '#10b981', stroke: isDarkTheme ? "#ecf3ff" : "#ffffff", strokeWidth: 2 }
                        : timeAggregation !== 'day'
                    }
                  >
                    {isParticipantsTrendExporting && (
                      <LabelList dataKey="totalParticipants" content={<LineValueLabel />} />
                    )}
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <StatisticsPieChartCard
            title={showAverage ? autoT('ui_784a48af8419') : autoT('ui_4d34ac48c54e')}
            exportActions={renderChartExportActions(
              'cohorts',
              showAverage ? "Ø Alterskohorten" : "Alterskohorten",
            )}
            cardClassName="group/chart-card bg-white rounded-lg shadow p-3 md:p-6"
            bodyClassName={pdfMode ? "h-72" : "h-80 md:h-[23rem]"}
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
            exportActions={renderChartExportActions('top-categories', 'Top Kategorien')}
            chartRef={setChartCardRef('top-categories')}
            data={topCategoryChartData}
            bodyClassName={pdfMode ? "h-64" : "h-80 md:h-[23rem]"}
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
            exportActions={renderChartExportActions('top-tags', 'Top Tags')}
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
              exportActions={renderChartExportActions('top-days', 'Top Tage')}
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
              barDataKey={showAverage ? "chartValue" : "count"}
              labelDataKey={showAverage ? "chartValue" : "count"}
              barName={showAverage ? autoT('ui_c649f425302c') : autoT('ui_a8a4d6b019af')}
              barFill="#10b981"
              valueLabelContent={<ValueLabel />}
            />
          ) : (
            <StatisticsBarChartCard
              title={autoT('ui_70494e6a6cd0')}
              exportActions={renderChartExportActions('top-projects', autoT('ui_70494e6a6cd0'))}
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

        {/* Aktivitäten-Tabelle (nach Diagrammen) */}
        <div className="group/chart-card bg-white rounded-lg shadow p-6 mt-8" data-pdf-section>
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-lg font-semibold text-viridian">{autoT('ui_44eeeedb9e8f')}<span className="ml-2 text-sm font-normal text-gray-500">
                {totalActivities}{' '}{autoT('ui_303e11fd9d2b')}</span>
            </h3>
            <div className="flex items-center gap-2" data-chart-export-ignore="true">
              {!pdfMode && renderActivitiesExportActions()}
              {!pdfMode && totalActivityPages > 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="statistics-page-summary text-gray-500">
                    <span className="statistics-page-summary-desktop">{autoT('ui_633082b8c84b')}{' '}</span>
                    {activitiesPage}{' '}{autoT('ui_445584edc4cc')}{' '}{totalActivityPages}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-azure-web text-gray-700">
                  <th className="px-3 py-2 text-left">{autoT('ui_df5c3008c765')}</th>
                  <th className="px-3 py-2 text-left">{autoT('ui_edcaf9aaa282')}</th>
                  <th className="px-3 py-2 text-left">{autoT('ui_950701e758d1')}</th>
                  <th className="px-3 py-2 text-left">{autoT('ui_20bda6d2e725')}</th>
                  <th className="px-3 py-2 text-right">{autoT('ui_a24fe1e6fcc2')}</th>
                  <th className="px-3 py-2 text-right">{autoT('ui_6b0d31c0d563')}</th>
                  <th className="px-3 py-2 text-right">{autoT('ui_aff024fe4ab0')}</th>
                  <th className="px-3 py-2 text-right">{autoT('ui_3c363836cf4e')}</th>
                  <th className="px-3 py-2 text-right">{autoT('ui_d62550d402f1')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportActivities.map((a: Activity) => {
                  const dateDE = formatActivityDateGerman(a.date);
                  const total = getActivityParticipantTotal(a);
                  const duration = getActivityDurationMinutes(a);
                  const cancelled = isCancelledActivity(a.executionStatus);
                  return (
                    <tr key={a.id} data-pdf-row>
                      <td className="px-3 py-1.5">{dateDE}</td>
                      <td className="px-3 py-1.5">{getActivityTypeLabel(a.type)}</td>
                      <td className="px-3 py-1.5">{a.title || ''}</td>
                      <td className="px-3 py-1.5">{a.project?.title || ''}</td>
                      <td className="px-3 py-1.5 text-right">
                        {cancelled ? (
                          <div className="flex justify-end">
                            <ActivityExecutionStatusBadge status={a.executionStatus} compact />
                          </div>
                        ) : (
                          fmtNumber(total)
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">{cancelled ? '' : fmtNumber(a.countMale || 0)}</td>
                      <td className="px-3 py-1.5 text-right">{cancelled ? '' : fmtNumber(a.countFemale || 0)}</td>
                      <td className="px-3 py-1.5 text-right">{cancelled ? '' : fmtNumber(a.countDiverse || 0)}</td>
                      <td className="px-3 py-1.5 text-right">{duration ?? ''}</td>
                    </tr>
                  );
                })}
                {!pdfMode && activitiesPageQ.isLoading && reportActivities.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-center text-gray-500" colSpan={9}>{autoT('ui_c2b2d9c3136c')}</td>
                  </tr>
                )}
                {!pdfMode && !activitiesPageQ.isLoading && reportActivities.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-center text-gray-500" colSpan={9}>{autoT('ui_afc08a0675e3')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {!pdfMode && totalActivityPages > 1 && (
            <div className="mt-4 border-t border-gray-100 pt-4" data-chart-export-ignore="true">
              <div className="mb-3 text-xs text-gray-500 sm:mb-0">{autoT('ui_6e7156111137')}{' '}{((activitiesPage - 1) * ACTIVITIES_PER_PAGE) + 1}–{Math.min(activitiesPage * ACTIVITIES_PER_PAGE, totalActivities)}{' '}{autoT('ui_445584edc4cc')}{' '}{totalActivities}
              </div>
              <div className={`flex gap-1 ${isMobile ? "flex-wrap items-center justify-start" : "items-center justify-end"}`}>
                <button
                  onClick={() => setActivitiesPage(1)}
                  disabled={activitiesPage === 1}
                  className="bg-white border text-gray-700 px-2 py-1 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title={autoT('ui_f4b057452fde')}
                  aria-label={autoT('ui_f4b057452fde')}
                >
                  ««
                </button>
                <button
                  onClick={() => setActivitiesPage((p) => Math.max(1, p - 1))}
                  disabled={activitiesPage === 1}
                  className="bg-white border text-gray-700 px-2 py-1 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title={autoT('ui_f6bc60bc537b')}
                  aria-label={autoT('ui_f6bc60bc537b')}
                >
                  «
                </button>
                
                {/* Page number buttons */}
                {(() => {
                  const pages: (number | 'ellipsis')[] = [];
                  const total = totalActivityPages;
                  const current = activitiesPage;
                  
                  if (total <= 7) {
                    for (let i = 1; i <= total; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (current > 3) pages.push('ellipsis');
                    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
                      pages.push(i);
                    }
                    if (current < total - 2) pages.push('ellipsis');
                    pages.push(total);
                  }
                  
                  return pages.map((p, idx) => 
                    p === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setActivitiesPage(p)}
                        className={`px-3 py-1 text-xs rounded border ${
                          p === current
                            ? "bg-viridian text-white border-viridian"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}
                
                <button
                  onClick={() => setActivitiesPage((p) => Math.min(totalActivityPages, p + 1))}
                  disabled={activitiesPage === totalActivityPages}
                  className="bg-white border text-gray-700 px-2 py-1 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title={autoT('ui_d3e6a4a47b5f')}
                  aria-label={autoT('ui_d3e6a4a47b5f')}
                >
                  »
                </button>
                <button
                  onClick={() => setActivitiesPage(totalActivityPages)}
                  disabled={activitiesPage === totalActivityPages}
                  className="bg-white border text-gray-700 px-2 py-1 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title={autoT('ui_58365134024f')}
                  aria-label={autoT('ui_58365134024f')}
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </div>

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
                      map.set(entry.type || 'unknown', { c: entry.count, p: entry.totalParticipants });
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
                !selectedType ? "border-viridian bg-viridian text-white" : `${mobileSurfaceClass} ${mobileSurfaceHoverClass}`
              }`}
              onClick={() => {
                setSelectedType('');
                setTypePickerOpen(false);
              }}
            >{autoT('ui_172a950cc0da')}</button>
            {STATISTICS_TYPE_OPTIONS.map((type) => {
              const active = selectedType === type;
              const typeColor = colorForActivityType(type);
              return (
                <button
                  key={type}
                  type="button"
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    active ? "text-white" : mobilePrimaryTextClass
                  }`}
                  style={{
                    backgroundColor: active ? typeColor : translucent(typeColor, isDarkTheme ? "20" : "14"),
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
                        backgroundColor: active ? "rgba(255,255,255,0.9)" : typeColor,
                        borderColor: active ? "rgba(255,255,255,0.35)" : translucent(typeColor, 'aa'),
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
                !projectId ? "border-viridian bg-viridian text-white" : `${mobileSurfaceClass} ${mobileSurfaceHoverClass}`
              }`}
              onClick={() => {
                setProjectId('');
                setProjectPickerOpen(false);
              }}
            >{autoT('ui_b857d350e38e')}</button>

            {sortedProjects.length === 0 ? (
              <div className={`rounded-xl border border-dashed px-4 py-4 text-sm ${mobileDashedSurfaceClass}`}>{autoT('ui_4e5aca6ae1f5')}</div>
            ) : (
              sortedProjects.map((project) => {
                const active = projectId === project.id;
                const projectColorValue =
                  typeof project.color === 'string' && project.color.trim() ? project.color.trim() : "#0f766e";
                const imageUrl =
                  typeof project.imageUrl === 'string' && project.imageUrl.trim() ? project.imageUrl.trim() : undefined;

                return (
                  <button
                    key={project.id}
                    type="button"
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      active ? "text-white" : `${mobileSurfaceClass} ${mobileSurfaceHoverClass}`
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: projectColorValue,
                            borderColor: projectColorValue,
                          }
                        : imageUrl || project.color
                          ? {
                              backgroundColor: translucent(projectColorValue, isDarkTheme ? "18" : "10"),
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
                        <span className={`h-10 w-10 overflow-hidden rounded-full border ${active ? "border-white/30 bg-white/10" : isDarkTheme ? "border-white/10 bg-white/10" : "border-gray-300 bg-gray-100"}`}>
                          <ProtectedImage src={imageUrl} alt="" className="h-full w-full object-cover" />
                        </span>
                      ) : (
                        <span
                          aria-hidden
                          className="h-10 w-10 rounded-full border"
                          style={{
                            backgroundColor: projectColorValue,
                            borderColor: active ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.08)",
                          }}
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{project.title}</span>
                        <span className={`block truncate text-xs ${active ? "text-white/80" : mobileSecondaryTextClass}`}>
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

      <Modal
        open={reportExportOpen}
        onClose={() => setReportExportOpen(false)}
        title={autoT('ui_8dbb5c1c7f40')}
        maxWidth="xl"
      >
        <div className="space-y-4 text-sm text-gray-700">
          <p>{autoT('ui_fabb2abae3a4')}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              className="rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-viridian/40 hover:bg-gray-50"
              onClick={() => { setReportExportOpen(false); void exportPdf(); }}
            >
              <div className="font-semibold text-gray-900">{autoT('ui_104827f9e0c7')}</div>
              <div className="mt-1 text-xs text-gray-600">{autoT('ui_49b7d61d6e43')}</div>
            </button>
            <button
              type="button"
              className="rounded-xl border border-viridian/20 bg-azure-web p-4 text-left hover:border-viridian/40 hover:bg-mint-green"
              onClick={() => { setReportExportOpen(false); void exportActivitiesTable('xlsx'); }}
            >
              <div className="font-semibold text-viridian">{autoT('ui_db0d32742b50')}</div>
              <div className="mt-1 text-xs text-gray-600">{autoT('ui_c40ca967212f')}</div>
            </button>
            <button
              type="button"
              className="rounded-xl border border-viridian/20 bg-azure-web p-4 text-left hover:border-viridian/40 hover:bg-mint-green disabled:cursor-wait disabled:opacity-60"
              disabled={isControllingExporting}
              onClick={() => { setReportExportOpen(false); void exportControllingData(); }}
            >
              <div className="font-semibold text-viridian">{autoT('ui_601dd4ee44ea')}</div>
              <div className="mt-1 text-xs text-gray-600">{autoT('ui_b56d47e133a3')}</div>
            </button>
          </div>
        </div>
      </Modal>

      {/* Custom Date Range Modal */}
      <Modal
        open={customFilterOpen}
        onClose={() => setCustomFilterOpen(false)}
        title={autoT('ui_c78a00fa35d9')}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{autoT('ui_d7aaf75d8532')}</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{autoT('ui_a4b078f9eb7b')}</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-viridian focus:border-viridian"
                value={tempFrom}
                onChange={(e) => setTempFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{autoT('ui_0afaa0e566a1')}</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-viridian focus:border-viridian"
                value={tempTo}
                onChange={(e) => setTempTo(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">{autoT('ui_3a315ae104b5')}</p>

            <div className="pt-2 border-t">
              <div className="text-xs font-medium text-gray-500 mb-2">{autoT('ui_37b72d9d418d')}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                  onClick={() => {
                    const today = new Date();
                    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                    setTempFrom(formatLocalDateInputValue(firstDay));
                    setTempTo(formatLocalDateInputValue(today));
                  }}
                >{autoT('ui_f172e749dcc9')}</button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                  onClick={() => {
                    const today = new Date();
                    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
                    setTempFrom(formatLocalDateInputValue(lastMonth));
                    setTempTo(formatLocalDateInputValue(lastDay));
                  }}
                >{autoT('ui_46ae17ce0436')}</button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                  onClick={() => {
                    const today = new Date();
                    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
                    setTempFrom(formatLocalDateInputValue(threeMonthsAgo));
                    setTempTo(formatLocalDateInputValue(today));
                  }}
                >{autoT('ui_2c02931c55c8')}</button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                  onClick={() => {
                    const today = new Date();
                    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
                    setTempFrom(formatLocalDateInputValue(sixMonthsAgo));
                    setTempTo(formatLocalDateInputValue(today));
                  }}
                >{autoT('ui_dca13e4c1f6d')}</button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                  onClick={() => {
                    const today = new Date();
                    const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
                    setTempFrom(formatLocalDateInputValue(yearAgo));
                    setTempTo(formatLocalDateInputValue(today));
                  }}
                >{autoT('ui_6e1af626e810')}</button>
              </div>
            </div>

          <div className="pt-2 border-t">
            <div className="text-xs font-medium text-gray-500 mb-2">{autoT('ui_bae7d5be7082')}</div>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_EXECUTION_STATUS_OPTIONS.map((status) => {
                const active = tempSelectedExecutionStatuses.includes(status);
                const activeClass =
                  status === 'cancelled'
                    ? "border-rose-600 bg-rose-600 text-white"
                    : "border-viridian bg-viridian text-white";

                return (
                  <button
                    key={status}
                    type="button"
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      active
                        ? activeClass
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
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
            <p className="mt-2 text-xs text-gray-500">{autoT('ui_99b2f97806df')}</p>
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
                    ? "border-amber-600 bg-amber-600 text-white"
                    : option.value === 'open'
                      ? "border-slate-700 bg-slate-700 text-white"
                      : "border-viridian bg-viridian text-white";

                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      active
                        ? activeClass
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                    onClick={() => setTempSelectedClosureState(option.value)}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-500">{autoT('ui_e303090e1632')}</p>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-xs font-medium text-gray-500">{autoT('ui_1d474635b5d2')}</div>
              <button
                type="button"
                className="text-xs font-medium text-viridian hover:text-cambridge-blue transition-colors"
                onClick={() => setTempSelectedWeekdays([])}
              >{autoT('ui_a462abf80085')}</button>
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
                        ? "border-viridian bg-viridian text-white"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
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
            <p className="mt-2 text-xs text-gray-500">{autoT('ui_c05c93e50e33')}</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={() => setCustomFilterOpen(false)}
            >{autoT('ui_07af7cb30fca')}</button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue transition-colors"
              onClick={applyCustomRange}
            >{autoT('ui_594308426372')}</button>
          </div>
        </div>
      </Modal>
      <ExportProgressModal message={exportProgress} />
    </div>
  );
}
