import { useState, useMemo, useRef, useEffect } from 'react';
import { CalendarClock } from 'lucide-react';
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
import { useActivities, type Activity } from '@/lib/activities';
import { useTags } from '@/lib/taxonomy';
import { useProjects } from '@/lib/projects';
import { useOrgScopeKey } from '@/lib/orgScope';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const TYPE_LABEL: Record<string, string> = {
  open_door: 'Offene Tür',
  project_open: 'Projekt (offen)',
  project_closed: 'Projekt (geschlossen)',
  event: 'Veranstaltung',
  outreach: 'Aufsuchend',
};

const COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6'];

function useStatsSummary(params: { from?: string; to?: string; projectId?: string }, scopeKey: string) {
  return useQuery({
    queryKey: ['stats:summary', scopeKey, params.from ?? '', params.to ?? '', params.projectId ?? ''],
    queryFn: async () => {
      const res = await api.get('/stats/summary', { params });
      return res.data as {
        totalActivities: number;
        totalParticipants: number;
        totalMale: number;
        totalFemale: number;
        totalDiverse: number;
        totalDurationMinutes: number;
        totalHours: number;
        averageParticipants: number;
      };
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    placeholderData: keepPreviousData,
  });
}

function useStatsByType(params: { from?: string; to?: string; projectId?: string }, scopeKey: string) {
  return useQuery({
    queryKey: ['stats:by-type', scopeKey, params.from ?? '', params.to ?? '', params.projectId ?? ''],
    queryFn: async () => {
      const res = await api.get('/stats/by-type', { params });
      return res.data as Array<{ type: string; count: number }>;
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    placeholderData: keepPreviousData,
  });
}

function useStatsGender(params: { from?: string; to?: string; projectId?: string }, scopeKey: string) {
  return useQuery({
    queryKey: ['stats:gender', scopeKey, params.from ?? '', params.to ?? '', params.projectId ?? ''],
    queryFn: async () => {
      const res = await api.get('/stats/gender', { params });
      return res.data as { male: number; female: number; diverse: number };
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    placeholderData: keepPreviousData,
  });
}

function useStatsParticipantsTimeseries(params: { from?: string; to?: string; projectId?: string }, scopeKey: string) {
  return useQuery({
    queryKey: ['stats:participants-timeseries', scopeKey, params.from ?? '', params.to ?? '', params.projectId ?? ''],
    queryFn: async () => {
      const res = await api.get('/stats/participants-timeseries', { params });
      return res.data as Array<{ date: string; totalParticipants: number }>;
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    placeholderData: keepPreviousData,
  });
}

function useStatsByCohort(params: { from?: string; to?: string; projectId?: string }, scopeKey: string) {
  return useQuery({
    queryKey: ['stats:by-cohort', scopeKey, params.from ?? '', params.to ?? '', params.projectId ?? ''],
    queryFn: async () => {
      const res = await api.get('/stats/by-cohort', { params });
      return res.data as Array<{
        cohortId: string;
        name: string;
        total: number;
        male: number;
        female: number;
        diverse: number;
      }>;
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    placeholderData: keepPreviousData,
  });
}

function useStatsByCategory(params: { from?: string; to?: string; projectId?: string }, scopeKey: string) {
  return useQuery({
    queryKey: ['stats:by-category', scopeKey, params.from ?? '', params.to ?? '', params.projectId ?? ''],
    queryFn: async () => {
      const res = await api.get('/stats/by-category', { params });
      return res.data as Array<{ id: string; name: string; count: number }>;
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    placeholderData: keepPreviousData,
  });
}

export default function Statistics() {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [yearPickerOpen, setYearPickerOpen] = useState<boolean>(false);
  const yearPickerRef = useRef<HTMLDivElement | null>(null);
  const [yearDraft, setYearDraft] = useState<string>('');
  // We no longer show toggle buttons; default to percentage labels in the chart

  const [pdfMode, setPdfMode] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);
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
  const summaryQ = useStatsSummary(statsParams, scopeKey);
  const byTypeQ = useStatsByType(statsParams, scopeKey);
  const genderQ = useStatsGender(statsParams, scopeKey);
  const timeseriesQ = useStatsParticipantsTimeseries(statsParams, scopeKey);
  const { data: summary } = summaryQ;
  const { data: byType } = byTypeQ;
  const { data: gender } = genderQ;
  const { data: timeseries } = timeseriesQ;
  // All-time series to build available years for quick picker
  const timeseriesAllQ = useStatsParticipantsTimeseries({}, scopeKey);
  const { data: timeseriesAll = [] } = timeseriesAllQ;
  const activityYears = useMemo(() => {
    const set = new Set<string>();
    for (const d of timeseriesAll || []) {
      if (d?.date) set.add(String(d.date).slice(0, 4));
    }
    return Array.from(set).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }, [timeseriesAll]);
  const byCohortQ = useStatsByCohort(statsParams, scopeKey);
  const byCategoryQ = useStatsByCategory(statsParams, scopeKey);
  const { data: byCohort } = byCohortQ;
  const { data: byCategory } = byCategoryQ;
  const { data: activities = [] } = useActivities(activitiesParams);
  const { data: tagsAll = [] } = useTags({ active: true });
  const { data: projectsAll = [] } = useProjects();

  const initialLoading =
    summaryQ.isLoading ||
    byTypeQ.isLoading ||
    genderQ.isLoading ||
    timeseriesQ.isLoading ||
    byCohortQ.isLoading ||
    byCategoryQ.isLoading;

  const backgroundRefreshing =
    !initialLoading &&
    (summaryQ.isFetching ||
      byTypeQ.isFetching ||
      genderQ.isFetching ||
      timeseriesQ.isFetching ||
      byCohortQ.isFetching ||
      byCategoryQ.isFetching ||
      timeseriesAllQ.isFetching);

  // If the selected project disappears (e.g. archived/deleted), reset to "all"
  useEffect(() => {
    if (!projectId) return;
    if (!projectsAll.some((p) => p.id === projectId)) setProjectId('');
  }, [projectId, projectsAll]);

  // Close year dropdown on click-away
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!yearPickerOpen) return;
      const el = yearPickerRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setYearPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [yearPickerOpen]);

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

  // Top Tags (by activities that include the tag)
  type ActivityLite = {
    tags?: Array<{ id: string; name: string }>;
    project?: { id?: string; title?: string };
  };
  const topTags = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const a of activities as ActivityLite[]) {
      if (!Array.isArray(a.tags)) continue;
      for (const t of a.tags) {
        const cur = map.get(t.id) || { id: t.id, name: t.name, count: 0 };
        cur.count += 1;
        map.set(t.id, cur);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [activities]);

  // Top Projekte (by activities that are linked to a project)
  const topProjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const a of activities as ActivityLite[]) {
      const pid: string | undefined = a.project?.id;
      const ptitle: string | undefined = a.project?.title;
      if (!pid || !ptitle) continue; // nur konkrete Projekte
      const cur = map.get(pid) || { id: pid, name: ptitle, count: 0 };
      cur.count += 1;
      map.set(pid, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [activities]);

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
    <div>
      <h2 className="text-3xl font-bold text-viridian mb-6">Statistiken & Auswertungen</h2>

      {(initialLoading || backgroundRefreshing) && (
        <div
          className={`mb-4 rounded border px-3 py-2 text-sm ${
            initialLoading
              ? 'bg-azure-web border-viridian/20 text-viridian'
              : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}
          role="status"
          aria-live="polite"
        >
          {initialLoading
            ? 'Statistikdaten werden geladen…'
            : 'Statistikdaten werden aktualisiert…'}
        </div>
      )}

      {/* Time Range Selector */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex gap-4 items-end flex-wrap relative">
          <div>
            <label className="block text-sm font-medium mb-1">Von</label>
            <input
              type="date"
              title="Von"
              aria-label="Von"
              className="border border-gray-300 rounded px-3 py-2"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Bis</label>
            <input
              type="date"
              title="Bis"
              aria-label="Bis"
              className="border border-gray-300 rounded px-3 py-2"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          {/* Quick year picker */}
          <div className="relative" ref={yearPickerRef}>
            <label className="block text-sm font-medium mb-1">Jahr</label>
            <button
              type="button"
              title="Jahr auswählen"
              aria-label="Jahr auswählen"
              className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded"
              onClick={() => setYearPickerOpen((v) => !v)}
            >
              <CalendarClock className="w-4 h-4" />
              Schnell wählen
            </button>
            {yearPickerOpen && (
              <div className="absolute z-10 mt-2 bg-white border border-gray-200 rounded shadow p-2">
                <select
                  title="Jahr auswählen"
                  aria-label="Jahr auswählen"
                  className="border rounded px-2 py-1"
                  value={yearDraft}
                  onChange={(e) => {
                    const y = parseInt(e.target.value, 10);
                    if (!Number.isNaN(y)) {
                      setFrom(`${y}-01-01`);
                      setTo(`${y}-12-31`);
                      setYearDraft(String(y));
                      // Trigger refetch of stats queries
                      qc.invalidateQueries({
                        predicate: (q) => {
                          const key0 = Array.isArray(q.queryKey) ? q.queryKey[0] : undefined;
                          return typeof key0 === 'string' && key0.startsWith('stats:');
                        },
                        refetchType: 'active',
                      });
                    }
                    setYearPickerOpen(false);
                  }}
                >
                  <option value="" disabled>
                    Jahr wählen
                  </option>
                  {activityYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <button
            className="bg-viridian text-white px-6 py-2 rounded-lg hover:bg-cambridge-blue transition-colors"
            onClick={() => {
              // Force refetch of all stats queries even if params didn't change
              qc.invalidateQueries({
                predicate: (q) => {
                  const key0 = Array.isArray(q.queryKey) ? q.queryKey[0] : undefined;
                  return typeof key0 === 'string' && key0.startsWith('stats:');
                },
                refetchType: 'active',
              });
            }}
          >
            Aktualisieren
          </button>
          {(from || to || yearDraft) && (
            <button
              title="Filter zurücksetzen"
              aria-label="Filter zurücksetzen"
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              onClick={() => {
                setFrom('');
                setTo('');
                setYearDraft('');
                qc.invalidateQueries({
                  predicate: (q) => {
                    const key0 = Array.isArray(q.queryKey) ? q.queryKey[0] : undefined;
                    return typeof key0 === 'string' && key0.startsWith('stats:');
                  },
                  refetchType: 'active',
                });
              }}
            >
              ×
            </button>
          )}
          <button
            className="bg-cambridge-blue text-white px-6 py-2 rounded-lg hover:bg-viridian transition-colors"
            onClick={exportPdf}
          >
            Export (PDF)
          </button>
        </div>

        {/* Project quick filter tiles */}
        {projectsAll.length > 0 && (
          <div className="mt-5">
            <div className="text-sm font-medium text-gray-700 mb-2">Projekte</div>
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
              {projectsAll
                .slice()
                .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'de'))
                .map((p) => {
                  const active = projectId === p.id;
                  const color = typeof p.color === 'string' && p.color.trim() ? p.color.trim() : undefined;
                  const imageUrl = typeof p.imageUrl === 'string' && p.imageUrl.trim() ? p.imageUrl.trim() : undefined;
                  const fallbackColor = '#0f766e'; // viridian-ish
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
                        <span
                          aria-hidden
                          className="absolute inset-0"
                          style={{
                            backgroundImage: `url(${imageUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        />
                      ) : null}

                      {active ? (
                        <>
                          {/* ensure strong contrast for text */}
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
                            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
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
          </div>
        )}
      </div>

      <div ref={reportRef} className="">
        {/* KPI Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-4xl font-bold text-viridian">
              {fmtNumber(summary?.totalActivities)}
            </p>
            <p className="text-sm text-gray-600 mt-2">Aktivitäten</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-4xl font-bold text-cambridge-blue">
              {fmtNumber(summary?.totalParticipants)}
            </p>
            <p className="text-sm text-gray-600 mt-2">Teilnehmende</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-4xl font-bold text-viridian">
              {summary?.averageParticipants?.toLocaleString('de-DE')}
            </p>
            <p className="text-sm text-gray-600 mt-2">Ø pro Aktivität</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-4xl font-bold text-cambridge-blue">
              {summary?.totalHours?.toLocaleString('de-DE')}
            </p>
            <p className="text-sm text-gray-600 mt-2">Gesamt-Stunden</p>
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
                <PieChart>
                  <Pie
                    dataKey="value"
                    data={byTypeData}
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry: { value?: number; percent?: number }) =>
                      `${((entry.percent || 0) * 100).toLocaleString('de-DE', {
                        maximumFractionDigits: 1,
                      })} %`
                    }
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

          {/* Other charts remain placeholders for now */}
          <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4 text-viridian">Zeitverlauf Teilnehmende</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={timeseries || []}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => fmtDateCompact(String(v))}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => value.toLocaleString('de-DE')}
                    labelFormatter={(l) => `Datum: ${fmtDateCompact(String(l))}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalParticipants"
                    name="Teilnehmende"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-viridian">Alterskohorten</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCohort || []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                  data={byCategory || []}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
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
                    {(byCategory || []).map((_, i) => (
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
                <BarChart data={topTags} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                    <BarChart data={topDays} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                    <BarChart data={topProjects} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
          <h3 className="text-lg font-semibold mb-4 text-viridian">Alle Aktivitäten (gefiltert)</h3>
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
                {(activities as Activity[]).map((a) => {
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
                {(activities as Activity[]).length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-center text-gray-500" colSpan={9}>
                      Keine Aktivitäten im Zeitraum.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
                    (activities as Activity[]).forEach((a) => {
                      const key = a.type || 'unknown';
                      const v = map.get(key) || { c: 0, p: 0 };
                      v.c += 1;
                      const total =
                        (a.countTotal ??
                          (a.countMale || 0) + (a.countFemale || 0) + (a.countDiverse || 0)) ||
                        0;
                      v.p += total;
                      map.set(key, v);
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
                  {(() => {
                    const map = new Map<string, number>();
                    (activities as Activity[]).forEach((a) => {
                      (a.categories || []).forEach((c: { id: string; name: string }) => {
                        map.set(c.name, (map.get(c.name) || 0) + 1);
                      });
                    });
                    return Array.from(map.entries()).map(([name, count]) => (
                      <tr key={name}>
                        <td className="px-3 py-1.5">{name}</td>
                        <td className="px-3 py-1.5 text-right">{fmtNumber(count)}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
