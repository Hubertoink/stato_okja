import { useState, useMemo, useRef, useEffect } from 'react';
import { CalendarClock } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useActivities } from '@/lib/activities';
import { useTags } from '@/lib/taxonomy';
import { useProjects } from '@/lib/projects';
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

function useStatsSummary(params: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['stats:summary', params],
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
  });
}

function useStatsByType(params: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['stats:by-type', params],
    queryFn: async () => {
      const res = await api.get('/stats/by-type', { params });
      return res.data as Array<{ type: string; count: number }>;
    },
  });
}

function useStatsGender(params: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['stats:gender', params],
    queryFn: async () => {
      const res = await api.get('/stats/gender', { params });
      return res.data as { male: number; female: number; diverse: number };
    },
  });
}

function useStatsParticipantsTimeseries(params: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['stats:participants-timeseries', params],
    queryFn: async () => {
      const res = await api.get('/stats/participants-timeseries', { params });
      return res.data as Array<{ date: string; totalParticipants: number }>;
    },
  });
}

function useStatsByCohort(params: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['stats:by-cohort', params],
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
  });
}

function useStatsByCategory(params: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['stats:by-category', params],
    queryFn: async () => {
      const res = await api.get('/stats/by-category', { params });
      return res.data as Array<{ id: string; name: string; count: number }>;
    },
  });
}

export default function Statistics() {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [yearPickerOpen, setYearPickerOpen] = useState<boolean>(false);
  const yearPickerRef = useRef<HTMLDivElement | null>(null);
  const [yearDraft, setYearDraft] = useState<string>('');
  const [typeShowAbsolute, setTypeShowAbsolute] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();
  const { user } = useAuth();
  const params = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);
  const { data: summary } = useStatsSummary(params);
  const { data: byType } = useStatsByType(params);
  const { data: gender } = useStatsGender(params);
  const { data: timeseries } = useStatsParticipantsTimeseries(params);
  // All-time series to build available years for quick picker
  const { data: timeseriesAll = [] } = useStatsParticipantsTimeseries({});
  const activityYears = useMemo(() => {
    const set = new Set<string>();
    for (const d of timeseriesAll || []) {
      if (d?.date) set.add(String(d.date).slice(0, 4));
    }
    return Array.from(set).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }, [timeseriesAll]);
  const { data: byCohort } = useStatsByCohort(params);
  const { data: byCategory } = useStatsByCategory(params);
  const { data: activities = [] } = useActivities(params);
  const { data: tagsAll = [] } = useTags({ active: true });
  const { data: projectsAll = [] } = useProjects();

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
  const byTypeTotal = (byTypeData || []).reduce((sum, d) => sum + (d.value || 0), 0);
  const genderData = gender
    ? [
        { name: 'männlich', value: gender.male, color: '#60a5fa' },
        { name: 'weiblich', value: gender.female, color: '#f472b6' },
        { name: 'divers', value: gender.diverse, color: '#a78bfa' },
      ]
    : [];
  const genderTotal = (genderData || []).reduce((sum, g) => sum + (g.value || 0), 0);

  const fmtNumber = (n?: number) => (typeof n === 'number' ? n.toLocaleString('de-DE') : '0');

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
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-viridian mb-6">Statistiken & Auswertungen</h2>

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
          {(from || to) && (
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-viridian">Verteilung nach Tätigkeitstyp</h3>
              <div className="flex items-center gap-2 text-sm">
                <button
                  className={`px-2 py-1 rounded ${!typeShowAbsolute ? 'bg-viridian text-white' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setTypeShowAbsolute(false)}
                >
                  Prozent
                </button>
                <button
                  className={`px-2 py-1 rounded ${typeShowAbsolute ? 'bg-viridian text-white' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setTypeShowAbsolute(true)}
                >
                  Anzahl
                </button>
              </div>
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
                      typeShowAbsolute
                        ? fmtNumber(entry.value || 0)
                        : `${((entry.percent || 0) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
                    }
                  >
                    {byTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(
                      value: number,
                      _name: string,
                      entry?: { payload?: { name?: string } },
                    ) => [
                      typeShowAbsolute
                        ? fmtNumber(value)
                        : byTypeTotal > 0
                          ? `${((value / byTypeTotal) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
                          : '0 %',
                      entry?.payload?.name || '',
                    ]}
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
                    formatter={(
                      value: number,
                      _name: string,
                      entry?: { payload?: { name?: string } },
                    ) => [
                      genderTotal > 0
                        ? `${((value / genderTotal) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
                        : '0 %',
                      entry?.payload?.name || '',
                    ]}
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
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => value.toLocaleString('de-DE')}
                    labelFormatter={(l) => `Datum: ${l}`}
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
                          projectColor.get(p.id) || fallbackBarColors[i % fallbackBarColors.length]
                        }
                      />
                    ))}
                    <LabelList dataKey="count" content={<ValueLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
