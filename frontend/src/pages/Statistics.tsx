import { useState, useMemo, useRef, useEffect } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useOrgScopeKey } from '@/lib/orgScope';
import { useIsMobile } from '@/lib/useIsMobile';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { FileDown, RefreshCw, X as XIcon, Calendar, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from '@/components/Modal';
import ProtectedImage from '@/components/ProtectedImage';
import { addDevMetricEvent, finishDevFlow, markDevFlow, startDevFlow } from '@/lib/devMetrics';

const TYPE_LABEL: Record<string, string> = {
  open_door: 'Offene Tür',
  project_open: 'Projekt (offen)',
  project_closed: 'Projekt (geschlossen)',
  event: 'Veranstaltung',
  outreach: 'Aufsuchend',
};

const COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6'];

const RADIAN = Math.PI / 180;

type PiePercentLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

function renderPiePercentLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  outerRadius = 0,
  percent = 0,
  width = 0,
  height = 0,
}: PiePercentLabelProps) {
  if (percent <= 0) return null;

  const labelRadius = outerRadius + 22;
  const rawX = cx + labelRadius * Math.cos(-midAngle * RADIAN);
  const rawY = cy + labelRadius * Math.sin(-midAngle * RADIAN);
  const padding = 18;
  const x = Math.min(Math.max(rawX, padding), Math.max(width - padding, padding));
  const y = Math.min(Math.max(rawY, padding), Math.max(height - padding, padding));
  const textAnchor = rawX >= cx ? 'start' : 'end';

  return (
    <text
      x={x}
      y={y}
      fill="#374151"
      fontSize={12}
      fontWeight={600}
      textAnchor={textAnchor}
      dominantBaseline="central"
    >
      {`${(percent * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`}
    </text>
  );
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

function useStatsOverview(params: { from?: string; to?: string; projectId?: string }, scopeKey: string) {
  return useQuery({
    queryKey: ['stats:overview', scopeKey, params.from ?? '', params.to ?? '', params.projectId ?? ''],
    queryFn: async () => {
      const res = await api.get('/stats/overview', { params });
      return res.data as StatsOverviewResponse;
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
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
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = ganzes Jahr
  const [filterMode, setFilterMode] = useState<'year' | 'month'>('year');
  const [customFilterOpen, setCustomFilterOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState<string>(from);
  const [tempTo, setTempTo] = useState<string>(to);
  
  // Toggle für absolute vs. relative (Durchschnitt) Zahlen in KPIs
  const [showAverage, setShowAverage] = useState<boolean>(false);

  // Zeitverlauf Aggregation: 'day' | 'week' | 'month'
  const [timeAggregation, setTimeAggregation] = useState<'day' | 'week' | 'month'>('day');
  
  // Pagination für Aktivitäten-Tabelle
  const [activitiesPage, setActivitiesPage] = useState<number>(1);
  const ACTIVITIES_PER_PAGE = 50;

  const [pdfMode, setPdfMode] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const statsUiFlowIdRef = useRef<string | null>(null);
  const statsUiFlowCompletedRef = useRef(false);
  const statsUiFlowMarksRef = useRef<Record<string, boolean>>({});
  const statsUiPendingRunKeyRef = useRef<string | null>(null);
  const statsUiFetchSeenRef = useRef<Record<string, boolean>>({});
  const qc = useQueryClient();
  const { user } = useAuth();
  const scopeKey = useOrgScopeKey();
  const statsParams = useMemo(
    () => ({ from: from || undefined, to: to || undefined, projectId: projectId || undefined }),
    [from, to, projectId],
  );
  const activitiesParams = useMemo(
    () => ({ from: from || undefined, to: to || undefined, projectIds: projectId ? [projectId] : undefined }),
    [from, to, projectId],
  );
  const overviewQ = useStatsOverview(statsParams, scopeKey);
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
  const activitiesPageQ = useActivitiesPaged(activitiesParams, activitiesPage, ACTIVITIES_PER_PAGE);
  const pagedActivities = activitiesPageQ.data?.data ?? [];
  const totalActivities = activitiesPageQ.data?.total ?? summary?.totalActivities ?? 0;
  const { data: tagsAll = [] } = useTags({ active: true });
  const { data: projectsAll = [] } = useProjects();

  const statsRunKey = useMemo(
    () => JSON.stringify([scopeKey, statsParams.from ?? '', statsParams.to ?? '', statsParams.projectId ?? '']),
    [scopeKey, statsParams.from, statsParams.to, statsParams.projectId],
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
      });
      markDevFlow(statsUiFlowIdRef.current, 'filters-applied', {
        from: statsParams.from ?? null,
        to: statsParams.to ?? null,
        projectId: statsParams.projectId ?? null,
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
    statsParams.to,
    summary,
    totalActivities,
    timeseries,
  ]);

  // If the selected project disappears (e.g. archived/deleted), reset to "all"
  useEffect(() => {
    if (!projectId) return;
    if (!projectsAll.some((p) => p.id === projectId)) setProjectId('');
  }, [projectId, projectsAll]);

  // Monatsnamen für die Anzeige
  const MONTH_NAMES = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

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
    setFrom(tempFrom);
    setTo(tempTo);
    setSelectedYear('');
    setSelectedMonth(null);
    setFilterMode('year');
    setCustomFilterOpen(false);
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

  const byTypeData = (byType || []).map((d, i) => ({
    name: TYPE_LABEL[d.type] || d.type,
    value: d.count,
    color: COLORS[i % COLORS.length],
  }));

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

  // Pagination für Aktivitäten
  const totalActivityPages = Math.max(1, Math.ceil(totalActivities / ACTIVITIES_PER_PAGE));
  
  // Reset page when filters change
  useEffect(() => {
    setActivitiesPage(1);
  }, [from, to, projectId]);

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
    return list
      .filter((d) => d && typeof d.totalParticipants === 'number')
      .slice()
      .sort((a, b) => b.totalParticipants - a.totalParticipants)
      .slice(0, 10)
      .map((d) => ({
        id: d.date,
        date: d.date,
        name: fmtDateCompact(d.date),
        count: d.totalParticipants,
      }));
  }, [timeseries]);

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
      projectsAll
        .slice()
        .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'de')),
    [projectsAll],
  );
  const useCompactProjectFilter = isMobile && sortedProjects.length >= 6;
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

  // Generic label renderer for bar charts (positions label above the bar)
  type LabelProps = { x?: number; y?: number; width?: number; value?: number | string };
  const ValueLabel = (props: LabelProps) => {
    const { x, y, width, value } = props;
    const txt = typeof value === 'number' ? value.toLocaleString('de-DE') : String(value ?? '');
    const cx = (x ?? 0) + (width ?? 0) / 2;
    const cy = (y ?? 0) - 4;
    return (
      <text x={cx} y={cy} textAnchor="middle" fill="#374151" fontSize={12}>
        {txt}
      </text>
    );
  };

  async function exportPdf() {
    // Render the report container to images and assemble into a PDF (A4 portrait)
    if (!reportRef.current) return;
    // Force export layout (e.g., 2-column grid, hide interactive bits)
    setPdfMode(true);
    await new Promise(requestAnimationFrame);
    const el = reportRef.current;
    // Ensure charts are fully rendered
    await new Promise(requestAnimationFrame);
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm

    // Title header
    const orgTitle = user?.orgName || 'Organisation';
    const dateRange = [from, to].filter(Boolean).join(' bis ');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(`Bericht: ${orgTitle}`, 14, 18);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text(dateRange ? `Zeitraum: ${dateRange}` : 'Gesamter Zeitraum', 14, 26);

    // Compute image dimensions keeping aspect ratio; fit width and paginate vertically if necessary
    const margin = 10; // mm
    const headerHeight = 40; // mm
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - headerHeight - margin;
    const ratioW = availableWidth / canvas.width; // mm per px when fitting width
    const imgHeightAtWidth = canvas.height * ratioW; // mm

    if (imgHeightAtWidth <= availableHeight) {
      // Single-page case
      pdf.addImage(
        imgData,
        'PNG',
        margin,
        headerHeight,
        availableWidth,
        imgHeightAtWidth,
        undefined,
        'FAST',
      );
    } else {
      // Multi-page: slice vertically into page-sized chunks
      const pageCanvas = document.createElement('canvas');
      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        const pagePxHeight = Math.floor(availableHeight / ratioW); // pixels corresponding to availableHeight mm at current scale
        let offset = 0;
        // First page
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(pagePxHeight, canvas.height);
        ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          offset,
          pageCanvas.width,
          pageCanvas.height,
          0,
          0,
          pageCanvas.width,
          pageCanvas.height,
        );
        pdf.addImage(
          pageCanvas.toDataURL('image/png'),
          'PNG',
          margin,
          headerHeight,
          availableWidth,
          availableHeight,
          undefined,
          'FAST',
        );
        offset += pagePxHeight;

        while (offset < canvas.height) {
          pdf.addPage('a4', 'portrait');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(16);
          pdf.text(`Bericht: ${orgTitle}`, 14, 18);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(12);
          pdf.text(dateRange ? `Zeitraum: ${dateRange}` : 'Gesamter Zeitraum', 14, 26);
          pageCanvas.width = canvas.width;
          pageCanvas.height = Math.min(pagePxHeight, canvas.height - offset);
          ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            offset,
            pageCanvas.width,
            pageCanvas.height,
            0,
            0,
            pageCanvas.width,
            pageCanvas.height,
          );
          pdf.addImage(
            pageCanvas.toDataURL('image/png'),
            'PNG',
            margin,
            headerHeight,
            availableWidth,
            Math.min(availableHeight, pageCanvas.height * ratioW),
            undefined,
            'FAST',
          );
          offset += pagePxHeight;
        }
      } else {
        // Fallback: single shrunken page if 2D context missing for some reason
        pdf.addImage(
          imgData,
          'PNG',
          margin,
          headerHeight,
          availableWidth,
          availableHeight,
          undefined,
          'FAST',
        );
      }
    }

    pdf.save(`StatO-Bericht-${orgTitle.replace(/\s+/g, '_')}.pdf`);
    setPdfMode(false);
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

      {/* Time Range Selector - Redesigned */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        {/* Main Filter Row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
          {/* Mode Toggle: Jahr / Monat */}
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

          {/* Year Selection */}
          <div className="flex items-center gap-2 flex-wrap">
            {filterMode === 'month' && !isCustomRange ? (
              /* Month Navigation */
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
              /* Year Pills */
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

          {/* Custom Range Button & Badge */}
          <div className="flex items-center gap-2 sm:ml-auto">
            {isCustomRange && (
              <div className="flex items-center gap-2 bg-viridian/10 text-viridian px-3 py-1.5 rounded-lg text-sm">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">{formatRangeDisplay()}</span>
                <button
                  type="button"
                  className="p-0.5 hover:bg-viridian/20 rounded"
                  onClick={() => selectYear(String(currentYear))}
                  title="Zurücksetzen"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              className={`p-2 rounded-lg border transition-colors touch-manipulation ${
                isCustomRange
                  ? 'border-viridian text-viridian bg-viridian/5'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => {
                setTempFrom(from);
                setTempTo(to);
                setCustomFilterOpen(true);
              }}
              title="Erweiterter Zeitfilter"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:ml-0">
            <button
              type="button"
              className="bg-cambridge-blue text-white px-4 md:px-6 py-2 rounded-lg hover:bg-viridian transition-colors inline-flex items-center gap-2 text-sm touch-manipulation"
              onClick={exportPdf}
              title="Exportieren (PDF)"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">Export (PDF)</span>
              <span className="sm:hidden">PDF</span>
            </button>
            <button
              type="button"
              title="Aktualisieren"
              className="p-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 touch-manipulation"
              onClick={() => {
                qc.invalidateQueries({
                  predicate: (q) => {
                    const key0 = Array.isArray(q.queryKey) ? q.queryKey[0] : undefined;
                    return (
                      (typeof key0 === 'string' && key0.startsWith('stats:')) ||
                      key0 === 'activities'
                    );
                  },
                  refetchType: 'active',
                });
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Month Picker Grid (shown in month mode) */}
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

        {/* Project quick filter tiles */}
        {projectsAll.length > 0 && (
          <div className="mt-5">
            <div className="text-sm font-medium text-gray-700 mb-2">Projekte</div>
            {useCompactProjectFilter ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setProjectId('')}
                  className={`px-3 py-2 rounded-full text-sm font-medium border transition-colors self-start ${
                    !projectId
                      ? 'bg-viridian text-white border-viridian'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Alle Projekte
                </button>
                <label className="flex-1 min-w-0">
                  <span className="sr-only">Projekt auswählen</span>
                  <select
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm focus:border-viridian focus:outline-none focus:ring-2 focus:ring-viridian/20"
                    aria-label="Projekt auswählen"
                  >
                    <option value="">Projekt auswählen…</option>
                    {sortedProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </label>
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
                {sortedProjects.map((p) => {
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
                        borderColor: active ? overlayColor : color || undefined,
                      }}
                      title={p.title}
                    >
                      {active && imageUrl ? (
                        <ProtectedImage
                          src={imageUrl}
                          alt=""
                          aria-hidden
                          className="absolute inset-0"
                        />
                      ) : null}

                      {active ? (
                        <>
                          <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/60" />
                          <span
                            aria-hidden
                            className="absolute inset-0"
                            style={{ backgroundColor: overlayColor, opacity: 0.25 }}
                          />
                        </>
                      ) : null}

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
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={reportRef} className="">
        {/* KPI Summary with Toggle */}
        <div className="flex items-center justify-end mb-4">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                !showAverage ? 'bg-white shadow text-viridian font-medium' : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setShowAverage(false)}
            >
              Absolut
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                showAverage ? 'bg-white shadow text-viridian font-medium' : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setShowAverage(true)}
            >
              Ø / Aktivität
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-4xl font-bold text-viridian">
              {fmtNumber(summary?.totalActivities)}
            </p>
            <p className="text-sm text-gray-600 mt-2">Aktivitäten</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-4xl font-bold text-cambridge-blue">
              {showAverage
                ? summary?.averageParticipants?.toLocaleString('de-DE', { maximumFractionDigits: 1 })
                : fmtNumber(summary?.totalParticipants)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {showAverage ? 'Ø Teilnehmende' : 'Teilnehmende'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-4xl font-bold text-viridian">
              {showAverage
                ? (summary?.totalActivities && summary?.totalActivities > 0
                    ? ((summary?.totalDurationMinutes ?? 0) / summary.totalActivities / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 })
                    : '0')
                : summary?.totalHours?.toLocaleString('de-DE')}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {showAverage ? 'Ø Stunden' : 'Gesamt-Stunden'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-4xl font-bold text-cambridge-blue">
              {showAverage
                ? (summary?.totalActivities && summary?.totalActivities > 0
                    ? (((summary?.totalMale ?? 0) + (summary?.totalFemale ?? 0) + (summary?.totalDiverse ?? 0)) / summary.totalActivities).toLocaleString('de-DE', { maximumFractionDigits: 1 })
                    : '0')
                : fmtNumber((summary?.totalMale ?? 0) + (summary?.totalFemale ?? 0) + (summary?.totalDiverse ?? 0))}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {showAverage ? 'Ø pro Aktivität' : 'Gesamt-Personen'}
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className={`grid gap-6 ${pdfMode ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-viridian">Verteilung nach Tätigkeitstyp</h3>
              {/* Toggle entfernt (Prozent/Anzahl). Labels zeigen Prozent, Tooltip absolute Werte. */}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                  <Pie
                    dataKey="value"
                    data={byTypeData}
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    labelLine={false}
                    label={renderPiePercentLabel}
                  >
                    {byTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    // Hover zeigt jeweils die "gegenteilige" Darstellung
                    // (wenn Labels absolute zeigen, Tooltip prozentual und umgekehrt)
                    formatter={(
                      value: number,
                      _name: string,
                      entry?: { payload?: { name?: string } },
                    ) => [fmtNumber(value), entry?.payload?.name || '']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-viridian">Geschlechterverteilung</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    dataKey="value"
                    data={genderData}
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    label={({ percent }) =>
                      `${(percent * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
                    }
                  >
                    {genderData.map((entry, index) => (
                      <Cell key={`gcell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    // Labels sind relativ (Prozent), daher im Tooltip die absoluten Werte anzeigen
                    formatter={(
                      value: number,
                      _name: string,
                      entry?: { payload?: { name?: string } },
                    ) => [fmtNumber(value), entry?.payload?.name || '']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Zeitverlauf Teilnehmende mit Aggregation */}
          <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-viridian">
                {showAverage ? 'Zeitverlauf Ø Teilnehmende' : 'Zeitverlauf Teilnehmende'}
              </h3>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setTimeAggregation('day')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    timeAggregation === 'day'
                      ? 'bg-white text-viridian shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Tag
                </button>
                <button
                  onClick={() => setTimeAggregation('week')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    timeAggregation === 'week'
                      ? 'bg-white text-viridian shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Woche
                </button>
                <button
                  onClick={() => setTimeAggregation('month')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    timeAggregation === 'month'
                      ? 'bg-white text-viridian shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Monat
                </button>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={aggregatedTimeseries}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
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
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
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
                    dot={timeAggregation !== 'day'}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-viridian">Alterskohorten</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCohort || []} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => value.toLocaleString('de-DE')} />
                  <Bar dataKey="total" name="Teilnehmende" fill="#2563eb">
                    <LabelList dataKey="total" content={<ValueLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-viridian">Top Kategorien</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topCategoryChartData}
                  margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => value.toLocaleString('de-DE')} />
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

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-viridian">Top Tags</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTags} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => value.toLocaleString('de-DE')} />
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

          <div className="bg-white rounded-lg shadow p-6">
            {projectId ? (
              <>
                <h3 className="text-lg font-semibold mb-4 text-viridian">Top Tage</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topDays} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) => value.toLocaleString('de-DE')}
                        labelFormatter={(l) => `Datum: ${l}`}
                      />
                      <Bar dataKey="count" name="Teilnehmende" fill="#10b981">
                        <LabelList dataKey="count" content={<ValueLabel />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-4 text-viridian">Top Projekte</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProjects} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => value.toLocaleString('de-DE')} />
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
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-viridian">
              Alle Aktivitäten (gefiltert)
              <span className="ml-2 text-sm font-normal text-gray-500">
                {totalActivities} Einträge
              </span>
            </h3>
            {totalActivityPages > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">
                  Seite {activitiesPage} von {totalActivityPages}
                </span>
              </div>
            )}
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
                  const s = String(a.date || '').slice(0, 10);
                  const [y, m, d] = s.split('-');
                  const dateDE = `${d}.${m}.${y}`;
                  const typeLabel: Record<string, string> = {
                    open_door: 'Offene Tür',
                    project_open: 'Projekt (offen)',
                    project_closed: 'Projekt (geschlossen)',
                    event: 'Veranstaltung',
                    outreach: 'Aufsuchend',
                  };
                  const total =
                    (a.countTotal ??
                      (a.countMale || 0) + (a.countFemale || 0) + (a.countDiverse || 0)) ||
                    0;
                  const duration = (() => {
                    if (typeof a.durationMinutes === 'number') return a.durationMinutes;
                    const parse = (t?: string | null) => {
                      if (!t) return undefined;
                      const [hh, mm] = String(t)
                        .split(':')
                        .map((v) => parseInt(v, 10));
                      if (Number.isNaN(hh) || Number.isNaN(mm)) return undefined;
                      return hh * 60 + mm;
                    };
                    const s = parse(a.startTime);
                    const e = parse(a.endTime);
                    return s !== undefined && e !== undefined && e >= s ? e - s : undefined;
                  })();
                  return (
                    <tr key={a.id}>
                      <td className="px-3 py-1.5">{dateDE}</td>
                      <td className="px-3 py-1.5">{typeLabel[a.type] || a.type}</td>
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
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4 text-viridian">Konsolidiert</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
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
            <div>
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

      {/* Custom Date Range Modal */}
      <Modal
        open={customFilterOpen}
        onClose={() => setCustomFilterOpen(false)}
        title="Erweiterter Zeitfilter"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Wähle einen individuellen Zeitraum für die Statistik-Auswertung.
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
                  setTempFrom(firstDay.toISOString().slice(0, 10));
                  setTempTo(today.toISOString().slice(0, 10));
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
                  setTempFrom(lastMonth.toISOString().slice(0, 10));
                  setTempTo(lastDay.toISOString().slice(0, 10));
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
                  setTempFrom(threeMonthsAgo.toISOString().slice(0, 10));
                  setTempTo(today.toISOString().slice(0, 10));
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
                  setTempFrom(sixMonthsAgo.toISOString().slice(0, 10));
                  setTempTo(today.toISOString().slice(0, 10));
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
                  setTempFrom(yearAgo.toISOString().slice(0, 10));
                  setTempTo(today.toISOString().slice(0, 10));
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
