import { useState, useMemo, useRef, useEffect } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  LabelList,
} from 'recharts';
import { useAuth } from '@/lib/auth';
import { useActivitiesPaged, type Activity } from '@/lib/activities';
import { useTags } from '@/lib/taxonomy';
import { useProjects } from '@/lib/projects';
import { useOrgScope, useOrgScopeKey } from '@/lib/orgScope';
import { useIsMobile } from '@/lib/useIsMobile';
import { colorForActivityType, translucent } from '@/lib/colors';
import { isDarkThemeName } from '../lib/theme';
import type jsPDF from 'jspdf';
import { FileDown, X as XIcon, Calendar, SlidersHorizontal, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '@/components/Modal';
import ProtectedImage from '@/components/ProtectedImage';
import { addDevMetricEvent, finishDevFlow, markDevFlow, startDevFlow } from '@/lib/devMetrics';
import { usePublicConfig } from '@/lib/publicConfig';

const TYPE_LABEL: Record<string, string> = {
  open_door: 'Offene Tür',
  project_open: 'Projekt (offen)',
  project_closed: 'Projekt (geschlossen)',
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
  { value: 1, shortLabel: 'Mo', label: 'Montag' },
  { value: 2, shortLabel: 'Di', label: 'Dienstag' },
  { value: 3, shortLabel: 'Mi', label: 'Mittwoch' },
  { value: 4, shortLabel: 'Do', label: 'Donnerstag' },
  { value: 5, shortLabel: 'Fr', label: 'Freitag' },
  { value: 6, shortLabel: 'Sa', label: 'Samstag' },
] as const;

const WEEKDAY_CHART_OPTIONS = [
  { value: 0, shortLabel: 'So', label: 'Sonntag' },
  ...WEEKDAY_OPTIONS,
] as const;

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

function parseCalendarDate(value?: string | null) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function getInclusiveWeekSpan(from?: string, to?: string) {
  const start = parseCalendarDate(from);
  const end = parseCalendarDate(to);
  if (!start || !end) return 0;

  const startTime = start.getTime();
  const endTime = end.getTime();
  const first = Math.min(startTime, endTime);
  const last = Math.max(startTime, endTime);
  const inclusiveDays = Math.floor((last - first) / 86400000) + 1;

  return Math.max(inclusiveDays / 7, 1);
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
  };
  byType: Array<{ type: string; count: number; totalParticipants: number }>;
  gender: { male: number; female: number; diverse: number };
  participantsTimeseries: Array<{ date: string; totalParticipants: number; activityCount: number }>;
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

function preloadPdfExportDependencies() {
  void loadPdfExportDependencies();
}

function preloadActivitiesExportDependencies() {
  preloadPdfExportDependencies();
  void import('xlsx-js-style');
}

function sanitizeExportSegment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
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

function addPdfPageHeader(pdf: jsPDF, orgTitle: string, dateRange: string) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(`Bericht: ${orgTitle}`, 14, 18);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text(dateRange ? `Zeitraum: ${dateRange}` : 'Gesamter Zeitraum', 14, 26);
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
  params: { from?: string; to?: string; projectId?: string; type?: string; weekdays?: number[] },
  scopeKey: string,
  options?: StatisticsRealtimeOptions,
) {
  return useQuery({
    queryKey: ['stats:overview', scopeKey, params.from ?? '', params.to ?? '', params.projectId ?? '', params.type ?? '', params.weekdays?.join(',') ?? ''],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      if (params.projectId) queryParams.projectId = params.projectId;
      if (params.type) queryParams.type = params.type;
      if (Array.isArray(params.weekdays) && params.weekdays.length > 0) {
        queryParams.weekdays = params.weekdays.join(',');
      }

      const res = await api.get('/stats/overview', { params: queryParams });
      return res.data as StatsOverviewResponse;
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: 'always',
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
  
  // Toggle für absolute vs. relative (Durchschnitt) Zahlen in KPIs
  const [showAverage, setShowAverage] = useState<boolean>(false);

  // Zeitverlauf Aggregation: 'day' | 'week' | 'month'
  const [timeAggregation, setTimeAggregation] = useState<'day' | 'week' | 'month'>('day');
  
  // Pagination für Aktivitäten-Tabelle
  const [activitiesPage, setActivitiesPage] = useState<number>(1);
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
  const [activeActivitiesExport, setActiveActivitiesExport] = useState<ActivitiesExportFormat | null>(null);
  const { user } = useAuth();
  const { scope } = useOrgScope();
  const scopeKey = useOrgScopeKey();
  const { data: publicConfig } = usePublicConfig();
  const statsParams = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      projectId: projectId || undefined,
      type: selectedType || undefined,
      weekdays: selectedWeekdays.length > 0 ? selectedWeekdays : undefined,
    }),
    [from, to, projectId, selectedType, selectedWeekdays],
  );
  const activitiesParams = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      weekdays: selectedWeekdays.length > 0 ? selectedWeekdays : undefined,
      projectIds: projectId ? [projectId] : undefined,
      type: selectedType || undefined,
    }),
    [from, to, projectId, selectedType, selectedWeekdays],
  );
  const overviewQ = useStatsOverview(statsParams, scopeKey, {
    refetchOnWindowFocus: 'always',
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
    refetchOnWindowFocus: 'always',
    refetchIntervalMs: publicConfig?.liveRefreshIntervalMs,
  });
  const pagedActivities = activitiesPageQ.data?.data ?? [];
  const totalActivities = activitiesPageQ.data?.total ?? summary?.totalActivities ?? 0;
  const { data: tagsAll = [] } = useTags({ active: true });
  const { data: projectsAll = [] } = useProjects();

  const statsRunKey = useMemo(
    () => JSON.stringify([scopeKey, statsParams.from ?? '', statsParams.to ?? '', statsParams.projectId ?? '', statsParams.type ?? '', statsParams.weekdays?.join(',') ?? '']),
    [scopeKey, statsParams.from, statsParams.to, statsParams.projectId, statsParams.type, statsParams.weekdays],
  );

  const initialLoading = overviewQ.isLoading;

  const backgroundRefreshing = !initialLoading && overviewQ.isFetching;

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
        label: 'summary-ready',
        status: overviewQ.status,
        isError: overviewQ.isError,
        isFetching: overviewQ.isFetching,
        size: summary ? 1 : 0,
      },
      {
        key: 'byType',
        label: 'by-type-ready',
        status: overviewQ.status,
        isError: overviewQ.isError,
        isFetching: overviewQ.isFetching,
        size: Array.isArray(byType) ? byType.length : 0,
      },
      {
        key: 'gender',
        label: 'gender-ready',
        status: overviewQ.status,
        isError: overviewQ.isError,
        isFetching: overviewQ.isFetching,
        size: gender ? 1 : 0,
      },
      {
        key: 'timeseries',
        label: 'timeseries-ready',
        status: overviewQ.status,
        isError: overviewQ.isError,
        isFetching: overviewQ.isFetching,
        size: Array.isArray(timeseries) ? timeseries.length : 0,
      },
      {
        key: 'byCohort',
        label: 'by-cohort-ready',
        status: overviewQ.status,
        isError: overviewQ.isError,
        isFetching: overviewQ.isFetching,
        size: Array.isArray(byCohort) ? byCohort.length : 0,
      },
      {
        key: 'byCategory',
        label: 'by-category-ready',
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
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

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
    const nextFrom = tempFrom?.trim() || '';
    const nextTo = tempTo?.trim() || '';
    setSelectedWeekdays(weekdays);

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
    if (isCustomRange) {
      selectYear(String(currentYear));
    }
  };

  // Check if custom range is active (not matching year or month pattern)
  const isCustomRange = useMemo(() => {
    if (!from || !to) return false;
    // Check if it matches a full year
    const yearMatch = from.match(/^(\d{4})-01-01$/) && to.match(/^(\d{4})-12-31$/);
    if (yearMatch && from.slice(0, 4) === to.slice(0, 4)) return false;
    // Check if it matches a full month
    const monthMatch = from.match(/^(\d{4})-(\d{2})-01$/) && to.match(/^(\d{4})-(\d{2})-\d{2}$/);
    if (monthMatch && from.slice(0, 7) === to.slice(0, 7)) {
      const year = Number(from.slice(0, 4));
      const month = Number(from.slice(5, 7));
      const lastDay = new Date(year, month, 0).getDate();
      if (to === `${from.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`) return false;
    }
    return true;
  }, [from, to]);

  const hasWeekdayFilter = selectedWeekdays.length > 0;
  const hasAdvancedFilter = isCustomRange || hasWeekdayFilter;

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
    if (!selectedYear) return 'Alle Zeiträume';
    if (selectedMonth !== null) {
      return `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
    }
    return selectedYear;
  };

  const formatAdvancedFilterDisplay = () => {
    const parts = [
      isCustomRange ? formatRangeDisplay() : '',
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
    backgroundColor: isDarkTheme ? 'rgba(17, 26, 43, 0.96)' : 'rgba(255, 255, 255, 0.96)',
    borderColor: isDarkTheme ? 'rgba(148, 163, 184, 0.22)' : 'rgba(15, 23, 42, 0.1)',
    borderRadius: '12px',
    boxShadow: isDarkTheme ? '0 16px 36px rgba(0, 0, 0, 0.42)' : '0 10px 24px rgba(15, 23, 42, 0.14)',
    color: isDarkTheme ? '#ecf3ff' : '#111827',
  } as const;
  const chartTooltipLabelStyle = {
    color: isDarkTheme ? '#c9d5eb' : '#475569',
    fontWeight: 600,
  } as const;
  const chartTooltipItemStyle = {
    color: isDarkTheme ? '#ecf3ff' : '#111827',
  } as const;
  const lineChartCursor = isDarkTheme
    ? { stroke: 'rgba(203, 213, 225, 0.75)', strokeWidth: 1, strokeDasharray: '4 4' }
    : { stroke: 'rgba(71, 85, 105, 0.48)', strokeWidth: 1, strokeDasharray: '4 4' };
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
        { name: 'männlich', value: gender.male, color: '#60a5fa' },
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
    }, [from, to, projectId, selectedType]);

  const fmtNumber = (n?: number) => (typeof n === 'number' ? n.toLocaleString('de-DE') : '0');

  const fmtDateCompact = (iso: string) => {
    const s = String(iso || '').slice(0, 10);
    const [yy, mm, dd] = s.split('-');
    const y = Number(yy);
    const m = Number(mm);
    const d = Number(dd);
    if (!y || !m || !d) return s || String(iso || '');
    // Use noon UTC to avoid timezone edge cases around midnight.
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const y2 = String(y).slice(-2);
    const mon = new Intl.DateTimeFormat('de-DE', { month: 'short' })
      .format(dt)
      .replace('.', '');
    const d2 = String(d).padStart(2, '0');
    return `${y2} ${mon} ${d2}`;
  };

  const topDays = useMemo(() => {
    const list = Array.isArray(timeseries) ? timeseries : [];
    const weekdayTotals = new Map<
      number,
      {
        weekday: number;
        name: string;
        fullName: string;
        count: number;
        activityCount: number;
      }
    >(
      WEEKDAY_CHART_OPTIONS.map((weekday) => [
        weekday.value,
        {
          weekday: weekday.value,
          name: weekday.shortLabel,
          fullName: weekday.label,
          count: 0,
          activityCount: 0,
        },
      ]),
    );

    for (const entry of list) {
      if (!entry || typeof entry.totalParticipants !== 'number') continue;
      const parsedDate = parseCalendarDate(entry.date);
      if (!parsedDate) continue;

      const weekday = parsedDate.getUTCDay();
      const bucket = weekdayTotals.get(weekday);
      if (!bucket) continue;

      bucket.count += entry.totalParticipants;
      bucket.activityCount += entry.activityCount;
    }

    return Array.from(weekdayTotals.values())
      .filter((entry) => entry.activityCount > 0 || entry.count > 0)
      .map((entry) => ({
        ...entry,
        id: String(entry.weekday),
        chartValue:
          entry.activityCount > 0 ? Math.round((entry.count / entry.activityCount) * 10) / 10 : 0,
      }))
      .sort((left, right) => {
        const leftValue = showAverage ? left.chartValue : left.count;
        const rightValue = showAverage ? right.chartValue : right.count;
        if (rightValue !== leftValue) return rightValue - leftValue;
        return left.weekday - right.weekday;
      });
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
    if (!useDesktopProjectCollapse || desktopProjectFilterExpanded) return sortedProjects;

    const initialProjects = sortedProjects.slice(0, DESKTOP_PROJECT_CHIP_VISIBLE_COUNT);
    if (!projectId || initialProjects.some((project) => project.id === projectId)) return initialProjects;

    const selectedProject = sortedProjects.find((project) => project.id === projectId);
    return selectedProject ? [...initialProjects, selectedProject] : initialProjects;
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
    if (!useMobileProjectCollapse || mobileProjectFilterExpanded) return sortedProjects;

    const initialProjects = sortedProjects.slice(0, MOBILE_PROJECT_CHIP_VISIBLE_COUNT);
    if (!projectId || initialProjects.some((project) => project.id === projectId)) return initialProjects;

    const selectedProject = sortedProjects.find((project) => project.id === projectId);
    return selectedProject ? [...initialProjects, selectedProject] : initialProjects;
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

  // Generic label renderer for bar charts (positions label above the bar)
  type LabelProps = { x?: number; y?: number; width?: number; value?: number | string };
  type LineLabelProps = { x?: number; y?: number; value?: number | string };
  type PieLabelProps = {
    cx?: number;
    x?: number;
    y?: number;
    percent?: number;
    value?: number;
    payload?: { color?: string };
  };

  const renderPieValueLabel = (showAbsoluteValue: boolean) => (props: PieLabelProps) => {
    const { cx, x, y, percent, value, payload } = props;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof percent !== 'number') return null;
    if (percent <= 0) return null;

    const textAnchor = typeof cx === 'number' && x < cx ? 'end' : 'start';
    const labelColor = payload?.color || chartValueLabelColor;
    const percentageText = `${(percent * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;

    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        fill={labelColor}
        stroke={chartValueLabelStroke}
        strokeWidth={2}
        paintOrder="stroke"
        fontWeight={600}
      >
        <tspan x={x} dy="0" fontSize={12}>
          {percentageText}
        </tspan>
        {showAbsoluteValue && (
          <tspan x={x} dy="1.15em" fontSize={10}>
            {fmtNumber(value)}
          </tspan>
        )}
      </text>
    );
  };

  const ValueLabel = (props: LabelProps) => {
    const { x, y, width, value } = props;
    const txt =
      typeof value === 'number'
        ? value.toLocaleString('de-DE', { maximumFractionDigits: 1 })
        : String(value ?? '');
    const cx = (x ?? 0) + (width ?? 0) / 2;
    const cy = (y ?? 0) - 4;
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        fill={chartValueLabelColor}
        stroke={chartValueLabelStroke}
        strokeWidth={2}
        paintOrder="stroke"
        fontSize={12}
        fontWeight={600}
      >
        {txt}
      </text>
    );
  };

  const LineValueLabel = (props: LineLabelProps) => {
    const { x, y, value } = props;
    if (typeof x !== 'number' || typeof y !== 'number') return null;

    const txt =
      typeof value === 'number'
        ? value.toLocaleString('de-DE', { maximumFractionDigits: 1 })
        : String(value ?? '');

    return (
      <text
        x={x}
        y={y - 12}
        textAnchor="middle"
        fill={chartValueLabelColor}
        stroke={chartValueLabelStroke}
        strokeWidth={2}
        paintOrder="stroke"
        fontSize={12}
        fontWeight={600}
      >
        {txt}
      </text>
    );
  };

  const exportRangeLabel = [from, to].filter(Boolean).join(' bis ') || 'Gesamter Zeitraum';
  const isParticipantsTrendExporting =
    activeChartExport?.startsWith('participants-trend:') ?? false;

  const setChartCardRef = (chartId: string) => (node: HTMLDivElement | null) => {
    chartCardRefs.current[chartId] = node;
  };

  const getChartFileName = (chartTitle: string, extension: ChartExportFormat) => {
    const parts = [
      'stato',
      sanitizeExportSegment(user?.orgName || 'organisation'),
      sanitizeExportSegment(chartTitle) || 'diagramm',
      sanitizeExportSegment(exportRangeLabel) || 'gesamt',
    ].filter(Boolean);
    return `${parts.join('-')}.${extension}`;
  };

  const getActivitiesExportFileName = (extension: ActivitiesExportFormat) => {
    const parts = [
      'stato',
      sanitizeExportSegment(user?.orgName || 'organisation'),
      'aktivitaeten-gefiltert',
      sanitizeExportSegment(exportRangeLabel) || 'gesamt',
    ].filter(Boolean);
    return `${parts.join('-')}.${extension}`;
  };

  const fetchAllFilteredActivities = async () => {
    const queryParams: Record<string, unknown> = { ...activitiesParams };

    if (typeof scope === 'string') {
      queryParams.orgId = scope;
    } else if (scope === null) {
      queryParams.orgId = '';
    }

    if (Array.isArray(activitiesParams.projectIds) && activitiesParams.projectIds.length > 0) {
      queryParams.projectIds = activitiesParams.projectIds.join(',');
    } else {
      delete queryParams.projectIds;
    }

    if (Array.isArray(activitiesParams.weekdays) && activitiesParams.weekdays.length > 0) {
      queryParams.weekdays = activitiesParams.weekdays.join(',');
    } else {
      delete queryParams.weekdays;
    }

    const response = await api.get('/activities', { params: queryParams });
    const payload = response.data;
    if (Array.isArray(payload?.data)) return payload.data as Activity[];
    return (Array.isArray(payload) ? payload : []) as Activity[];
  };

  const exportActivitiesAsExcel = async (activities: Activity[]) => {
    const rows = toActivityExportRows(activities);
    const sheetRows: Array<Array<string | number>> = [
      ['Datum', 'Typ', 'Titel', 'Projekt', 'TN ges.', 'm', 'w', 'd', 'Dauer (min)'],
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
    utils.book_append_sheet(workbook, worksheet, 'Aktivitäten');
    writeFile(workbook, getActivitiesExportFileName('xlsx'));
  };

  const exportActivitiesAsPdf = async (activities: Activity[]) => {
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
      { key: 'date', label: 'Datum', width: 18, align: 'left' as const },
      { key: 'type', label: 'Typ', width: 31, align: 'left' as const },
      { key: 'title', label: 'Titel', width: 64, align: 'left' as const },
      { key: 'project', label: 'Projekt', width: 58, align: 'left' as const },
      { key: 'total', label: 'TN ges.', width: 17, align: 'right' as const },
      { key: 'male', label: 'm', width: 11, align: 'right' as const },
      { key: 'female', label: 'w', width: 11, align: 'right' as const },
      { key: 'diverse', label: 'd', width: 11, align: 'right' as const },
      { key: 'duration', label: 'Dauer', width: 18, align: 'right' as const },
    ];
    const totalTableWidth = columns.reduce((sum, column) => sum + column.width, 0);
    const orgTitle = user?.orgName || 'Organisation';
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
      pdf.text('Alle Aktivitäten (gefiltert)', margin, 15);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10.5);
      pdf.text(orgTitle, margin, 21);
      pdf.text(exportRangeLabel, margin, 26);
      pdf.text(`${rows.length.toLocaleString('de-DE')} Einträge`, pageWidth - margin, 21, { align: 'right' });
      pdf.text(`Seite ${pageNumber}`, pageWidth - margin, 26, { align: 'right' });
      return drawTableHeader(tableTop);
    };

    let currentY = drawPageFrame();

    if (rows.length === 0) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text('Keine Aktivitäten für die aktuelle Filterung.', margin, currentY + 8);
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

    pdf.save(getActivitiesExportFileName('pdf'));
  };

  async function exportActivitiesTable(format: ActivitiesExportFormat) {
    setActiveActivitiesExport(format);

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
    }
  }

  async function exportChart(chartId: string, chartTitle: string, format: ChartExportFormat) {
    const card = chartCardRefs.current[chartId];
    if (!card) return;

    const exportKey = `${chartId}:${format}`;
    setActiveChartExport(exportKey);

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
      pdf.save(getChartFileName(chartTitle, 'pdf'));
    } catch (error) {
      console.error('Chart export failed', error);
    } finally {
      setActiveChartExport(null);
    }
  }

  const renderChartExportActions = (chartId: string, chartTitle: string) => {
    const isExporting = activeChartExport?.startsWith(`${chartId}:`) ?? false;

    return (
      <div
        className="group/chart-export relative shrink-0"
        onMouseEnter={preloadPdfExportDependencies}
      >
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-viridian hover:text-viridian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viridian/30 opacity-100 md:opacity-0 md:group-hover/chart-card:opacity-100 md:group-focus-within/chart-card:opacity-100"
          aria-label={`${chartTitle} exportieren`}
          title={`${chartTitle} exportieren`}
          onFocus={preloadPdfExportDependencies}
          style={isExporting ? { visibility: 'hidden' } : undefined}
        >
          <FileDown className="h-4 w-4" />
        </button>

        <div
          className="invisible pointer-events-none absolute right-0 top-full z-20 mt-2 w-44 translate-y-1 rounded-xl border border-gray-200 bg-white p-2 opacity-0 shadow-xl transition-all group-hover/chart-export:visible group-hover/chart-export:pointer-events-auto group-hover/chart-export:translate-y-0 group-hover/chart-export:opacity-100 group-focus-within/chart-export:visible group-focus-within/chart-export:pointer-events-auto group-focus-within/chart-export:translate-y-0 group-focus-within/chart-export:opacity-100"
          data-chart-export-ignore="true"
        >
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
            Diagramm exportieren
          </div>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void exportChart(chartId, chartTitle, 'png')}
            disabled={isExporting}
          >
            <span>Als PNG</span>
            <span className="text-xs text-gray-400">Bild</span>
          </button>
          <button
            type="button"
            className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void exportChart(chartId, chartTitle, 'pdf')}
            disabled={isExporting}
          >
            <span>Als PDF</span>
            <span className="text-xs text-gray-400">A4</span>
          </button>
          {isExporting && (
            <div className="px-3 pt-2 text-xs text-gray-500">Export wird vorbereitet…</div>
          )}
        </div>
      </div>
    );
  };

  const renderActivitiesExportActions = () => {
    const isExporting = activeActivitiesExport !== null;

    return (
      <div
        className="group/chart-export relative shrink-0"
        onMouseEnter={preloadActivitiesExportDependencies}
      >
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-viridian hover:text-viridian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viridian/30 opacity-100 md:opacity-0 md:group-hover/chart-card:opacity-100 md:group-focus-within/chart-card:opacity-100"
          aria-label="Aktivitäten exportieren"
          title="Aktivitäten exportieren"
          onFocus={preloadActivitiesExportDependencies}
          style={isExporting ? { visibility: 'hidden' } : undefined}
        >
          <FileDown className="h-4 w-4" />
        </button>

        <div className="invisible pointer-events-none absolute right-0 top-full z-20 mt-2 w-44 translate-y-1 rounded-xl border border-gray-200 bg-white p-2 opacity-0 shadow-xl transition-all group-hover/chart-export:visible group-hover/chart-export:pointer-events-auto group-hover/chart-export:translate-y-0 group-hover/chart-export:opacity-100 group-focus-within/chart-export:visible group-focus-within/chart-export:pointer-events-auto group-focus-within/chart-export:translate-y-0 group-focus-within/chart-export:opacity-100">
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
            Aktivitäten exportieren
          </div>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void exportActivitiesTable('pdf')}
            disabled={isExporting}
          >
            <span>Als PDF</span>
            <span className="text-xs text-gray-400">Komplett</span>
          </button>
          <button
            type="button"
            className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void exportActivitiesTable('xlsx')}
            disabled={isExporting}
          >
            <span>Als Excel</span>
            <span className="text-xs text-gray-400">Komplett</span>
          </button>
          {isExporting && (
            <div className="px-3 pt-2 text-xs text-gray-500">Export wird vorbereitet…</div>
          )}
        </div>
      </div>
    );
  };

  async function exportPdf() {
    // Render the report container to images and assemble into a PDF (A4 portrait)
    if (!reportRef.current) return;
    setPdfMode(true);

    try {
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
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const orgTitle = user?.orgName || 'Organisation';
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

      pdf.save(`StatO-Bericht-${orgTitle.replace(/\s+/g, '_')}.pdf`);
    } finally {
      setPdfMode(false);
    }
  }

  return (
    <div className="relative">
      <h2 className="text-3xl font-bold text-viridian mb-6">Statistiken & Auswertungen</h2>

      {/* Loading indicator - fixed position bottom right */}
      {(initialLoading || backgroundRefreshing) && (
        <div
          className="fixed bottom-20 md:bottom-6 right-4 z-40 flex items-center gap-2 bg-white/95 backdrop-blur-sm shadow-lg rounded-full px-4 py-2 text-sm border border-gray-200"
          role="status"
          aria-live="polite"
        >
          <span className="w-2 h-2 rounded-full bg-viridian animate-pulse" />
          <span className="text-gray-700">
            {initialLoading ? 'Laden…' : 'Aktualisieren…'}
          </span>
        </div>
      )}

      {/* Time Range Selector */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        {(() => {
          const openAdvancedFilters = () => {
            setTempFrom(isCustomRange ? from : '');
            setTempTo(isCustomRange ? to : '');
            setTempSelectedWeekdays(selectedWeekdays);
            setCustomFilterOpen(true);
          };

          if (isMobile) {
            return (
              <div className="space-y-4">
                <div className="rounded-2xl border p-4 shadow-sm" style={mobileFilterCardStyle}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${mobileLabelTextClass}`}>
                        Zeitraum & Filter
                      </div>
                      <div className={`mt-1 text-lg font-semibold truncate ${mobilePrimaryTextClass}`}>
                        {formatRangeDisplay()}
                      </div>
                      <div className={`mt-1 text-sm ${mobileSecondaryTextClass}`}>
                        {isCustomRange
                          ? 'Individueller Zeitraum'
                          : filterMode === 'month'
                            ? 'Monatsansicht'
                            : selectedYear
                              ? 'Jahresansicht'
                              : 'Gesamter Zeitraum'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${mobileSurfaceClass} ${mobileSurfaceHoverClass}`}
                      onClick={() => setMobileFiltersExpanded((current) => !current)}
                      aria-expanded={mobileFiltersExpanded}
                    >
                      {mobileFiltersExpanded ? 'Weniger' : 'Filter'}
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
                      title="Typ auswählen"
                    >
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-full border"
                        style={{
                          backgroundColor: selectedType ? colorForActivityType(selectedType) : '#6b7280',
                          borderColor: selectedType ? translucent(colorForActivityType(selectedType), 'aa') : 'rgba(0,0,0,0.08)',
                        }}
                      />
                      {selectedType ? TYPE_LABEL[selectedType] : 'Alle Typen'}
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
                          <span className={`h-5 w-5 overflow-hidden rounded-full border ${isDarkTheme ? 'border-white/10 bg-white/10' : 'border-gray-300 bg-gray-100'}`}>
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
                        title="Projekt auswählen"
                      >
                        <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-black/10 bg-gray-400" />
                        Alle Projekte
                        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                      </button>
                    )}

                    {hasWeekdayFilter && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-viridian/20 bg-viridian/10 px-3 py-1.5 text-sm font-medium text-viridian">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatWeekdayDisplay(selectedWeekdays)}
                      </span>
                    )}

                    {hasAdvancedFilter && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-viridian/20 bg-viridian/10 px-3 py-1.5 text-sm font-medium text-viridian"
                        onClick={resetAdvancedFilters}
                        title="Erweiterte Filter zurücksetzen"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                        Zurücksetzen
                      </button>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                        hasAdvancedFilter
                          ? 'border-viridian bg-viridian/5 text-viridian'
                          : `${mobileSurfaceClass} ${mobileSurfaceHoverClass}`
                      }`}
                      onClick={openAdvancedFilters}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Details
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-cambridge-blue px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-viridian"
                      onClick={exportPdf}
                      onMouseEnter={preloadPdfExportDependencies}
                      onFocus={preloadPdfExportDependencies}
                      title="Exportieren (PDF)"
                    >
                      <FileDown className="h-4 w-4" />
                      PDF
                    </button>
                  </div>
                </div>

                {mobileFiltersExpanded && (
                  <div className={`space-y-5 border-t pt-4 ${mobileDividerClass}`}>
                    <section className="space-y-3">
                      <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${mobileLabelTextClass}`}>
                        Zeitraum
                      </div>
                      <div className={`inline-flex items-center rounded-xl p-1 ${mobileMutedSurfaceClass}`}>
                        <button
                          type="button"
                          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                            filterMode === 'year' && !isCustomRange
                              ? 'bg-white shadow text-viridian font-medium'
                              : `${mobileSecondaryTextClass} hover:text-viridian`
                          }`}
                          onClick={() => {
                            setFilterMode('year');
                            setSelectedMonth(null);
                            updateDateRange(selectedYear || String(currentYear), null);
                          }}
                        >
                          Jahr
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                            filterMode === 'month' && !isCustomRange
                              ? 'bg-white shadow text-viridian font-medium'
                              : `${mobileSecondaryTextClass} hover:text-viridian`
                          }`}
                          onClick={() => {
                            setFilterMode('month');
                            const month = selectedMonth ?? currentMonth;
                            setSelectedMonth(month);
                            updateDateRange(selectedYear || String(currentYear), month);
                          }}
                        >
                          Monat
                        </button>
                      </div>

                      {filterMode === 'month' && !isCustomRange ? (
                        <>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${mobileSurfaceClass}`}
                              onClick={() => navigateMonth('prev')}
                              title="Vorheriger Monat"
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
                              title="Nächster Monat"
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
                            Alle
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
                        <div className={`text-sm font-medium ${mobilePrimaryTextClass}`}>Typen</div>
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
                                Weniger
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3.5 w-3.5" />
                                {hiddenMobileTypeCount} mehr
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
                          Alle Typen
                        </button>
                        {(useMobileTypeCollapse ? visibleMobileTypes : STATISTICS_TYPE_OPTIONS).map((type) => {
                          const active = selectedType === type;
                          const typeColor = colorForActivityType(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setSelectedType(type)}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                                active ? 'text-white shadow ring-2 ring-offset-1 ring-viridian/20' : 'text-gray-800'
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
                                  backgroundColor: active ? 'rgba(255,255,255,0.9)' : typeColor,
                                  borderColor: active ? 'rgba(255,255,255,0.35)' : translucent(typeColor, 'aa'),
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
                          <div className={`text-sm font-medium ${mobilePrimaryTextClass}`}>Projekte</div>
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
                                  Weniger
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3.5 w-3.5" />
                                  {hiddenMobileProjectCount} mehr
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {sortedProjects.length === 0 ? (
                          <div className={`rounded-xl border border-dashed px-4 py-3 text-sm ${mobileDashedSurfaceClass}`}>
                            Für den gewählten Typ sind keine Projekte verfügbar.
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
                              Alle Projekte
                            </button>
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
                                        active ? 'border-white/35 bg-white/15' : 'border-gray-300 bg-gray-100'
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
                                        borderColor: active ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.08)',
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
                        ? 'bg-white shadow text-viridian font-medium'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                    onClick={() => {
                      setFilterMode('year');
                      setSelectedMonth(null);
                      updateDateRange(selectedYear || String(currentYear), null);
                    }}
                  >
                    Jahr
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      filterMode === 'month' && !isCustomRange
                        ? 'bg-white shadow text-viridian font-medium'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                    onClick={() => {
                      setFilterMode('month');
                      const month = selectedMonth ?? currentMonth;
                      setSelectedMonth(month);
                      updateDateRange(selectedYear || String(currentYear), month);
                    }}
                  >
                    Monat
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {filterMode === 'month' && !isCustomRange ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 touch-manipulation"
                        onClick={() => navigateMonth('prev')}
                        title="Vorheriger Monat"
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
                        title="Nächster Monat"
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
                            ? 'bg-viridian text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                        }`}
                        onClick={() => selectYear('')}
                      >
                        Alle
                      </button>
                      {activityYears.map((y) => (
                        <button
                          key={y}
                          type="button"
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                            selectedYear === y && !isCustomRange
                              ? 'bg-viridian text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
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
                        title="Zurücksetzen"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className={`p-2 rounded-lg border transition-colors touch-manipulation ${
                      hasAdvancedFilter
                        ? 'border-viridian text-viridian bg-viridian/5'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                    onClick={openAdvancedFilters}
                    title="Erweiterter Filter"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 sm:ml-0">
                  <button
                    type="button"
                    className="bg-cambridge-blue text-white px-4 md:px-6 py-2 rounded-lg hover:bg-viridian transition-colors inline-flex items-center gap-2 text-sm touch-manipulation"
                    onClick={exportPdf}
                    onMouseEnter={preloadPdfExportDependencies}
                    onFocus={preloadPdfExportDependencies}
                    title="Exportieren (PDF)"
                  >
                    <FileDown className="h-4 w-4" />
                    <span className="hidden sm:inline">Export (PDF)</span>
                    <span className="sm:hidden">PDF</span>
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
                <div className="text-sm font-medium text-gray-700 mb-2">Typen</div>
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
                    Alle Typen
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
                  <div className="text-sm font-medium text-gray-700 mb-2">Projekte</div>
                  {sortedProjects.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      Für den gewählten Typ sind keine Projekte verfügbar.
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
                        Alle Projekte
                      </button>
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
                                    active ? 'border-white/40 bg-white/15' : 'border-gray-300 bg-gray-100'
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
                                    borderColor: active ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.08)',
                                  }}
                                />
                              )}
                              <span className={`truncate ${active ? 'drop-shadow' : ''}`}>{p.title}</span>
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
                              <ChevronUp className="h-4 w-4" />
                              Weniger anzeigen
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              {hiddenDesktopProjectCount > 0
                                ? `${hiddenDesktopProjectCount} weitere Projekte anzeigen`
                                : 'Weitere Projekte anzeigen'}
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
      </div>

      <div ref={reportRef} className="">
        {/* KPI Summary with Toggle */}
        <div className="flex items-center justify-end mb-4" data-pdf-section>
          <div className="stats-kpi-toggle flex items-center gap-2 rounded-lg p-1">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                !showAverage ? 'stats-kpi-toggle-button-active font-medium' : 'stats-kpi-toggle-button'
              }`}
              onClick={() => setShowAverage(false)}
            >
              Absolut
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                showAverage ? 'stats-kpi-toggle-button-active font-medium' : 'stats-kpi-toggle-button'
              }`}
              onClick={() => setShowAverage(true)}
            >
              Ø Werte
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8" data-pdf-section>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-4xl font-bold text-viridian">
              {showAverage
                ? averageActivitiesPerWeek.toLocaleString('de-DE', { maximumFractionDigits: 1 })
                : fmtNumber(summary?.totalActivities)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {showAverage ? 'Ø Aktivitäten / Woche' : 'Aktivitäten'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-4xl font-bold text-cambridge-blue">
              {showAverage
                ? summary?.averageParticipants?.toLocaleString('de-DE', { maximumFractionDigits: 1 })
                : fmtNumber(summary?.totalParticipants)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {showAverage ? 'Ø Teilnehmende / Aktivität' : 'Teilnehmende'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-4xl font-bold text-cambridge-blue">
              {totalParticipantsPerHour.toLocaleString('de-DE', { maximumFractionDigits: 1 })}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {showAverage ? 'Ø Teilnehmende / Stunde' : 'Teilnehmende / Stunde'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-4xl font-bold text-viridian">
              {showAverage
                ? averageHoursPerActivity.toLocaleString('de-DE', { maximumFractionDigits: 1 })
                : summary?.totalHours?.toLocaleString('de-DE')}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {showAverage ? 'Ø Stunden / Aktivität' : 'Gesamt-Stunden'}
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className={`grid gap-6 ${pdfMode ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>
          <div
            className="group/chart-card bg-white rounded-lg shadow p-6"
            data-pdf-section
            ref={setChartCardRef('activity-types')}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-viridian">Verteilung nach Tätigkeitstyp</h3>
              {renderChartExportActions('activity-types', 'Verteilung nach Tätigkeitstyp')}
            </div>
            <div className="h-80 md:h-[23rem]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 12, right: 20, bottom: 30, left: 20 }}>
                  <Pie
                    dataKey="value"
                    data={byTypeData}
                    nameKey="name"
                    cx="50%"
                    cy={byTypePieCenterY}
                    outerRadius={byTypeOuterRadius}
                    isAnimationActive={!(activeChartExport?.startsWith('activity-types:') ?? false)}
                    animationBegin={80}
                    animationDuration={700}
                    stroke={chartSeparatorColor}
                    strokeWidth={1.25}
                    label={renderPieValueLabel(activeChartExport?.startsWith('activity-types:') ?? false)}
                  >
                    {byTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chartTooltipContentStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                    // Hover zeigt jeweils die "gegenteilige" Darstellung
                    // (wenn Labels absolute zeigen, Tooltip prozentual und umgekehrt)
                    formatter={(
                      value: number,
                      _name: string,
                      entry?: { payload?: { name?: string } },
                    ) => [fmtNumber(value), entry?.payload?.name || '']}
                  />
                  <Legend verticalAlign="bottom" align="center" iconSize={11} wrapperStyle={pieLegendWrapperStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className="group/chart-card bg-white rounded-lg shadow p-6"
            data-pdf-section
            ref={setChartCardRef('gender-distribution')}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-viridian">Geschlechterverteilung</h3>
              {renderChartExportActions('gender-distribution', 'Geschlechterverteilung')}
            </div>
            <div className="h-80 md:h-[23rem]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 12, right: 20, bottom: 30, left: 20 }}>
                  <Pie
                    dataKey="value"
                    data={genderData}
                    nameKey="name"
                    cx="50%"
                    cy={genderPieCenterY}
                    innerRadius={genderInnerRadius}
                    outerRadius={genderOuterRadius}
                    isAnimationActive={!(activeChartExport?.startsWith('gender-distribution:') ?? false)}
                    animationBegin={80}
                    animationDuration={700}
                    stroke={chartSeparatorColor}
                    strokeWidth={1.25}
                    label={renderPieValueLabel(activeChartExport?.startsWith('gender-distribution:') ?? false)}
                  >
                    {genderData.map((entry, index) => (
                      <Cell key={`gcell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chartTooltipContentStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                    // Labels sind relativ (Prozent), daher im Tooltip die absoluten Werte anzeigen
                    formatter={(
                      value: number,
                      _name: string,
                      entry?: { payload?: { name?: string } },
                    ) => [fmtNumber(value), entry?.payload?.name || '']}
                  />
                  <Legend verticalAlign="bottom" align="center" iconSize={11} wrapperStyle={pieLegendWrapperStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Zeitverlauf Teilnehmende mit Aggregation */}
          <div
            className="group/chart-card bg-white rounded-lg shadow p-3 md:p-6 lg:col-span-2"
            data-pdf-section
            ref={setChartCardRef('participants-trend')}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-viridian">
                {showAverage ? 'Zeitverlauf Ø Teilnehmende' : 'Zeitverlauf Teilnehmende'}
              </h3>
              <div className="flex items-center gap-2">
                {renderChartExportActions(
                  'participants-trend',
                  showAverage ? 'Zeitverlauf Ø Teilnehmende' : 'Zeitverlauf Teilnehmende',
                )}
                <div className="stats-kpi-toggle flex items-center gap-1 rounded-lg p-1">
                  <button
                    onClick={() => setTimeAggregation('day')}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                      timeAggregation === 'day'
                        ? 'stats-kpi-toggle-button-active font-medium'
                        : 'stats-kpi-toggle-button'
                    }`}
                  >
                    Tag
                  </button>
                  <button
                    onClick={() => setTimeAggregation('week')}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                      timeAggregation === 'week'
                        ? 'stats-kpi-toggle-button-active font-medium'
                        : 'stats-kpi-toggle-button'
                    }`}
                  >
                    Woche
                  </button>
                  <button
                    onClick={() => setTimeAggregation('month')}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                      timeAggregation === 'month'
                        ? 'stats-kpi-toggle-button-active font-medium'
                        : 'stats-kpi-toggle-button'
                    }`}
                  >
                    Monat
                  </button>
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
                    tickFormatter={(v) => {
                      const s = String(v);
                      if (timeAggregation === 'week') {
                        // Format: 2026-W05 -> KW 05
                        const match = s.match(/^\d{4}-W(\d{2})$/);
                        if (match) return `KW ${match[1]}`;
                      }
                      if (timeAggregation === 'month') {
                        // Format: 2026-01 -> Jan 26
                        const [y, m] = s.split('-');
                        const dt = new Date(Number(y), Number(m) - 1, 15);
                        const mon = new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(dt).replace('.', '');
                        return `${mon} ${y.slice(-2)}`;
                      }
                      return fmtDateCompact(s);
                    }}
                  />
                  <YAxis allowDecimals={false} tick={chartAxisTick} />
                  <Tooltip
                    contentStyle={chartTooltipContentStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                    cursor={lineChartCursor}
                    formatter={(value: number) => [
                      value.toLocaleString('de-DE', { maximumFractionDigits: 1 }),
                      showAverage ? 'Ø Teilnehmende' : 'Teilnehmende'
                    ]}
                    labelFormatter={(l) => {
                      const s = String(l);
                      if (timeAggregation === 'week') {
                        const match = s.match(/^(\d{4})-W(\d{2})$/);
                        if (match) return `Kalenderwoche ${match[2]}, ${match[1]}`;
                        return s;
                      }
                      if (timeAggregation === 'month') {
                        const match = s.match(/^(\d{4})-(\d{2})$/);
                        if (match) {
                          const y = Number(match[1]);
                          const m = Number(match[2]);
                          const dt = new Date(y, m - 1, 15);
                          if (!isNaN(dt.getTime())) {
                            const mon = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(dt);
                            return `${mon} ${match[1]}`;
                          }
                        }
                        return s;
                      }
                      return `Datum: ${fmtDateCompact(s)}`;
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalParticipants"
                    name={showAverage ? 'Ø Teilnehmende' : 'Teilnehmende'}
                    stroke="#10b981"
                    strokeWidth={2}
                    isAnimationActive={!isParticipantsTrendExporting}
                    activeDot={{ r: 6, fill: '#10b981', stroke: isDarkTheme ? '#ecf3ff' : '#ffffff', strokeWidth: 2 }}
                    dot={
                      isParticipantsTrendExporting
                        ? { r: 4, fill: '#10b981', stroke: isDarkTheme ? '#ecf3ff' : '#ffffff', strokeWidth: 2 }
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

          <div
            className="group/chart-card bg-white rounded-lg shadow p-3 md:p-6"
            data-pdf-section
            ref={setChartCardRef('cohorts')}
          >
            <div className="flex items-center justify-between mb-4 gap-3">
              <h3 className="text-lg font-semibold text-viridian">
                {showAverage ? 'Ø Alterskohorten' : 'Alterskohorten'}
              </h3>
              {renderChartExportActions(
                'cohorts',
                showAverage ? 'Ø Alterskohorten' : 'Alterskohorten',
              )}
            </div>
            <div className={pdfMode ? 'h-72' : 'h-80 md:h-[23rem]'}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 12, right: 20, bottom: 30, left: 20 }}>
                  <Pie
                    dataKey="value"
                    data={cohortPieData}
                    nameKey="name"
                    cx="50%"
                    cy={cohortPieCenterY}
                    outerRadius={cohortPieOuterRadius}
                    isAnimationActive={!(activeChartExport?.startsWith('cohorts:') ?? false)}
                    animationBegin={80}
                    animationDuration={700}
                    stroke={chartSeparatorColor}
                    strokeWidth={1.25}
                    label={renderPieValueLabel(activeChartExport?.startsWith('cohorts:') ?? false)}
                  >
                    {cohortPieData.map((entry, index) => (
                      <Cell key={`cohort-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chartTooltipContentStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                    formatter={(
                      value: number,
                      _name: string,
                      entry?: { payload?: { name?: string } },
                    ) => [fmtNumber(value), entry?.payload?.name || '']}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconSize={11}
                    wrapperStyle={pieLegendWrapperStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className="group/chart-card bg-white rounded-lg shadow p-3 md:p-6"
            data-pdf-section
            ref={setChartCardRef('top-categories')}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-viridian">Top Kategorien</h3>
              {renderChartExportActions('top-categories', 'Top Kategorien')}
            </div>
            <div className={pdfMode ? 'h-64' : 'h-80 md:h-[23rem]'}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topCategoryChartData}
                  margin={compactBarChartMarginWithBottom}
                >
                  <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={chartAxisTick}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={64}
                  />
                  <YAxis allowDecimals={false} tick={chartAxisTick} />
                  <Tooltip contentStyle={chartTooltipContentStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} cursor={barChartCursor} formatter={(value: number) => value.toLocaleString('de-DE')} />
                  <Bar dataKey="count" name="Aktivitäten">
                    {topCategoryChartData.map((_, i) => (
                      <Cell
                        key={`bc-${i}`}
                        fill={fallbackBarColors[i % fallbackBarColors.length]}
                      />
                    ))}
                    <LabelList dataKey="count" content={<ValueLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className="group/chart-card bg-white rounded-lg shadow p-3 md:p-6"
            data-pdf-section
            ref={setChartCardRef('top-tags')}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-viridian">Top Tags</h3>
              {renderChartExportActions('top-tags', 'Top Tags')}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTags} margin={compactBarChartMargin}>
                  <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={chartAxisTick}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis allowDecimals={false} tick={chartAxisTick} />
                  <Tooltip contentStyle={chartTooltipContentStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} cursor={barChartCursor} formatter={(value: number) => value.toLocaleString('de-DE')} />
                  <Bar dataKey="count" name="Aktivitäten">
                    {topTags.map((t, i) => (
                      <Cell
                        key={`tt-${t.id}`}
                        fill={tagColor.get(t.id) || fallbackBarColors[i % fallbackBarColors.length]}
                      />
                    ))}
                    <LabelList dataKey="count" content={<ValueLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className="group/chart-card bg-white rounded-lg shadow p-3 md:p-6"
            data-pdf-section
            ref={setChartCardRef(projectId ? 'top-days' : 'top-projects')}
          >
            {projectId ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-viridian">Top Tage</h3>
                  {renderChartExportActions('top-days', 'Top Tage')}
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topDays} margin={compactBarChartMargin}>
                      <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={chartAxisTick}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis allowDecimals={showAverage} tick={chartAxisTick} />
                      <Tooltip
                        contentStyle={chartTooltipContentStyle}
                        labelStyle={chartTooltipLabelStyle}
                        itemStyle={chartTooltipItemStyle}
                        cursor={barChartCursor}
                        formatter={(value: number) =>
                          value.toLocaleString('de-DE', {
                            maximumFractionDigits: showAverage ? 1 : 0,
                          })
                        }
                        labelFormatter={(_, payload) =>
                          `Wochentag: ${payload?.[0]?.payload?.fullName ?? '—'}`
                        }
                      />
                      <Bar
                        dataKey={showAverage ? 'chartValue' : 'count'}
                        name={showAverage ? 'Ø Teilnehmende' : 'Teilnehmende'}
                        fill="#10b981"
                      >
                        <LabelList
                          dataKey={showAverage ? 'chartValue' : 'count'}
                          content={<ValueLabel />}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-viridian">Top Projekte</h3>
                  {renderChartExportActions('top-projects', 'Top Projekte')}
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProjects} margin={compactBarChartMargin}>
                      <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={chartAxisTick}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis allowDecimals={false} tick={chartAxisTick} />
                      <Tooltip contentStyle={chartTooltipContentStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} cursor={barChartCursor} formatter={(value: number) => value.toLocaleString('de-DE')} />
                      <Bar dataKey="count" name="Aktivitäten">
                        {topProjects.map((p, i) => (
                          <Cell
                            key={`tp-${p.id}`}
                            fill={
                              projectColor.get(p.id) ||
                              fallbackBarColors[i % fallbackBarColors.length]
                            }
                          />
                        ))}
                        <LabelList dataKey="count" content={<ValueLabel />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Aktivitäten-Tabelle (nach Diagrammen) */}
        <div className="group/chart-card bg-white rounded-lg shadow p-6 mt-8" data-pdf-section>
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-lg font-semibold text-viridian">
              Alle Aktivitäten (gefiltert)
              <span className="ml-2 text-sm font-normal text-gray-500">
                {totalActivities} Einträge
              </span>
            </h3>
            <div className="flex items-center gap-2">
              {renderActivitiesExportActions()}
              {totalActivityPages > 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">
                    Seite {activitiesPage} von {totalActivityPages}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-azure-web text-gray-700">
                  <th className="px-3 py-2 text-left">Datum</th>
                  <th className="px-3 py-2 text-left">Typ</th>
                  <th className="px-3 py-2 text-left">Titel</th>
                  <th className="px-3 py-2 text-left">Projekt</th>
                  <th className="px-3 py-2 text-right">TN ges.</th>
                  <th className="px-3 py-2 text-right">m</th>
                  <th className="px-3 py-2 text-right">w</th>
                  <th className="px-3 py-2 text-right">d</th>
                  <th className="px-3 py-2 text-right">Dauer (min)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedActivities.map((a: Activity) => {
                  const dateDE = formatActivityDateGerman(a.date);
                  const total = getActivityParticipantTotal(a);
                  const duration = getActivityDurationMinutes(a);
                  return (
                    <tr key={a.id} data-pdf-row>
                      <td className="px-3 py-1.5">{dateDE}</td>
                      <td className="px-3 py-1.5">{getActivityTypeLabel(a.type)}</td>
                      <td className="px-3 py-1.5">{a.title || ''}</td>
                      <td className="px-3 py-1.5">{a.project?.title || ''}</td>
                      <td className="px-3 py-1.5 text-right">{fmtNumber(total)}</td>
                      <td className="px-3 py-1.5 text-right">{fmtNumber(a.countMale || 0)}</td>
                      <td className="px-3 py-1.5 text-right">{fmtNumber(a.countFemale || 0)}</td>
                      <td className="px-3 py-1.5 text-right">{fmtNumber(a.countDiverse || 0)}</td>
                      <td className="px-3 py-1.5 text-right">{duration ?? ''}</td>
                    </tr>
                  );
                })}
                {activitiesPageQ.isLoading && pagedActivities.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-center text-gray-500" colSpan={9}>
                      Aktivitäten werden geladen.
                    </td>
                  </tr>
                )}
                {!activitiesPageQ.isLoading && pagedActivities.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-center text-gray-500" colSpan={9}>
                      Keine Aktivitäten im Zeitraum.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalActivityPages > 1 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="mb-3 text-xs text-gray-500 sm:mb-0">
                Zeige {((activitiesPage - 1) * ACTIVITIES_PER_PAGE) + 1}–{Math.min(activitiesPage * ACTIVITIES_PER_PAGE, totalActivities)} von {totalActivities}
              </div>
              <div className={`flex gap-1 ${isMobile ? 'flex-wrap items-center justify-start' : 'items-center justify-end'}`}>
                <button
                  onClick={() => setActivitiesPage(1)}
                  disabled={activitiesPage === 1}
                  className="bg-white border text-gray-700 px-2 py-1 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Erste Seite"
                  aria-label="Erste Seite"
                >
                  ««
                </button>
                <button
                  onClick={() => setActivitiesPage((p) => Math.max(1, p - 1))}
                  disabled={activitiesPage === 1}
                  className="bg-white border text-gray-700 px-2 py-1 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Vorherige Seite"
                  aria-label="Vorherige Seite"
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
                            ? 'bg-viridian text-white border-viridian'
                            : 'border-gray-200 hover:bg-gray-50'
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
                  title="Nächste Seite"
                  aria-label="Nächste Seite"
                >
                  »
                </button>
                <button
                  onClick={() => setActivitiesPage(totalActivityPages)}
                  disabled={activitiesPage === totalActivityPages}
                  className="bg-white border text-gray-700 px-2 py-1 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Letzte Seite"
                  aria-label="Letzte Seite"
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Konsolidiert (kompakt) */}
        <div className="bg-white rounded-lg shadow p-6 mt-6" data-pdf-section>
          <h3 className="text-lg font-semibold mb-4 text-viridian">Konsolidiert</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div data-pdf-section>
              <h4 className="font-medium text-gray-700 mb-2">Nach Tätigkeitstyp</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-azure-web text-gray-700">
                    <th className="px-3 py-2 text-left">Typ</th>
                    <th className="px-3 py-2 text-right">Aktivitäten</th>
                    <th className="px-3 py-2 text-right">Teilnehmende</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const map = new Map<string, { c: number; p: number }>();
                    (byType || []).forEach((entry) => {
                      map.set(entry.type || 'unknown', { c: entry.count, p: entry.totalParticipants });
                    });
                    const typeLabel: Record<string, string> = {
                      open_door: 'Offene Tür',
                      project_open: 'Projekt (offen)',
                      project_closed: 'Projekt (geschlossen)',
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
              <h4 className="font-medium text-gray-700 mb-2">Nach Kategorie</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-azure-web text-gray-700">
                    <th className="px-3 py-2 text-left">Kategorie</th>
                    <th className="px-3 py-2 text-right">Aktivitäten</th>
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
        title="Typ auswählen"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className={`text-sm ${mobileSecondaryTextClass}`}>
            Wähle den Tätigkeitstyp direkt aus der Übersicht.
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                !selectedType ? 'border-viridian bg-viridian text-white' : `${mobileSurfaceClass} ${mobileSurfaceHoverClass}`
              }`}
              onClick={() => {
                setSelectedType('');
                setTypePickerOpen(false);
              }}
            >
              Alle Typen
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
                    backgroundColor: active ? typeColor : translucent(typeColor, isDarkTheme ? '20' : '14'),
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
                        borderColor: active ? 'rgba(255,255,255,0.35)' : translucent(typeColor, 'aa'),
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
        title="Projekt auswählen"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <p className={`text-sm ${mobileSecondaryTextClass}`}>
            {selectedType
              ? `Es werden nur Projekte für ${TYPE_LABEL[selectedType]} angezeigt.`
              : 'Wähle direkt aus allen verfügbaren Projekten.'}
          </p>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                !projectId ? 'border-viridian bg-viridian text-white' : `${mobileSurfaceClass} ${mobileSurfaceHoverClass}`
              }`}
              onClick={() => {
                setProjectId('');
                setProjectPickerOpen(false);
              }}
            >
              Alle Projekte
            </button>

            {sortedProjects.length === 0 ? (
              <div className={`rounded-xl border border-dashed px-4 py-4 text-sm ${mobileDashedSurfaceClass}`}>
                Für den gewählten Typ sind aktuell keine Projekte verfügbar.
              </div>
            ) : (
              sortedProjects.map((project) => {
                const active = projectId === project.id;
                const projectColorValue =
                  typeof project.color === 'string' && project.color.trim() ? project.color.trim() : '#0f766e';
                const imageUrl =
                  typeof project.imageUrl === 'string' && project.imageUrl.trim() ? project.imageUrl.trim() : undefined;

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
                              backgroundColor: translucent(projectColorValue, isDarkTheme ? '18' : '10'),
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
                        <span className={`h-10 w-10 overflow-hidden rounded-full border ${active ? 'border-white/30 bg-white/10' : isDarkTheme ? 'border-white/10 bg-white/10' : 'border-gray-300 bg-gray-100'}`}>
                          <ProtectedImage src={imageUrl} alt="" className="h-full w-full object-cover" />
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
                        <span className={`block truncate text-xs ${active ? 'text-white/80' : mobileSecondaryTextClass}`}>
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

      {/* Custom Date Range Modal */}
      <Modal
        open={customFilterOpen}
        onClose={() => setCustomFilterOpen(false)}
        title="Erweiterter Filter"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Wähle Zeitraum und Wochentage für die Statistik-Auswertung.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-viridian focus:border-viridian"
                value={tempFrom}
                onChange={(e) => setTempFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-viridian focus:border-viridian"
                value={tempTo}
                onChange={(e) => setTempTo(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Leer lassen = aktuelle Auswahl oben links beibehalten. Ein eigener Zeitraum wird nur angewendet, wenn hier ein Datum gesetzt ist.
          </p>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-xs font-medium text-gray-500">Wochentage</div>
              <button
                type="button"
                className="text-xs font-medium text-viridian hover:text-cambridge-blue transition-colors"
                onClick={() => setTempSelectedWeekdays([])}
              >
                Alle Tage
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
            <p className="mt-2 text-xs text-gray-500">Keine Auswahl = alle Tage.</p>
          </div>

          {/* Quick presets */}
          <div className="pt-2 border-t">
            <div className="text-xs font-medium text-gray-500 mb-2">Schnellauswahl</div>
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
              >
                Diesen Monat
              </button>
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
              >
                Letzten Monat
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                onClick={() => {
                  const today = new Date();
                  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
                  setTempFrom(formatLocalDateInputValue(threeMonthsAgo));
                  setTempTo(formatLocalDateInputValue(today));
                }}
              >
                Letzte 3 Monate
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                onClick={() => {
                  const today = new Date();
                  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
                  setTempFrom(formatLocalDateInputValue(sixMonthsAgo));
                  setTempTo(formatLocalDateInputValue(today));
                }}
              >
                Letzte 6 Monate
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                onClick={() => {
                  const today = new Date();
                  const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
                  setTempFrom(formatLocalDateInputValue(yearAgo));
                  setTempTo(formatLocalDateInputValue(today));
                }}
              >
                Letztes Jahr
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={() => setCustomFilterOpen(false)}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue transition-colors"
              onClick={applyCustomRange}
            >
              Übernehmen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
