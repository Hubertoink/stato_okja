import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';

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
      return res.data as Array<{ cohortId: string; name: string; total: number; male: number; female: number; diverse: number }>;
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
  const qc = useQueryClient();
  const params = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);
  const { data: summary } = useStatsSummary(params);
  const { data: byType } = useStatsByType(params);
  const { data: gender } = useStatsGender(params);
  const { data: timeseries } = useStatsParticipantsTimeseries(params);
  const { data: byCohort } = useStatsByCohort(params);
  const { data: byCategory } = useStatsByCategory(params);

  const byTypeData = (byType || []).map((d, i) => ({ name: TYPE_LABEL[d.type] || d.type, value: d.count, color: COLORS[i % COLORS.length] }));
  const genderData = gender ? [
    { name: 'männlich', value: gender.male, color: '#60a5fa' },
    { name: 'weiblich', value: gender.female, color: '#f472b6' },
    { name: 'divers', value: gender.diverse, color: '#a78bfa' },
  ] : [];

  const fmtNumber = (n?: number) => (typeof n === 'number' ? n.toLocaleString('de-DE') : '0');

  return (
    <div>
      <h2 className="text-3xl font-bold text-viridian mb-6">Statistiken & Auswertungen</h2>

      {/* Time Range Selector */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm font-medium mb-1">Von</label>
            <input type="date" className="border border-gray-300 rounded px-3 py-2" value={from} onChange={(e)=> setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Bis</label>
            <input type="date" className="border border-gray-300 rounded px-3 py-2" value={to} onChange={(e)=> setTo(e.target.value)} />
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
          <button className="bg-cambridge-blue text-white px-6 py-2 rounded-lg hover:bg-viridian transition-colors" onClick={() => { /* TODO: CSV export */ }}>
            Export (CSV)
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-4xl font-bold text-viridian">{fmtNumber(summary?.totalActivities)}</p>
          <p className="text-sm text-gray-600 mt-2">Aktivitäten</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-4xl font-bold text-cambridge-blue">{fmtNumber(summary?.totalParticipants)}</p>
          <p className="text-sm text-gray-600 mt-2">Teilnehmende</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-4xl font-bold text-viridian">{summary?.averageParticipants?.toLocaleString('de-DE')}</p>
          <p className="text-sm text-gray-600 mt-2">Ø pro Aktivität</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-4xl font-bold text-cambridge-blue">{summary?.totalHours?.toLocaleString('de-DE')}</p>
          <p className="text-sm text-gray-600 mt-2">Gesamt-Stunden</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-viridian">Verteilung nach Tätigkeitstyp</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={byTypeData} nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {byTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, _name: string, entry?: { payload?: { name?: string } }) => [value.toLocaleString('de-DE'), entry?.payload?.name || '']} />
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
                <Pie dataKey="value" data={genderData} nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                  {genderData.map((entry, index) => (
                    <Cell key={`gcell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, _name: string, entry?: { payload?: { name?: string } }) => [value.toLocaleString('de-DE'), entry?.payload?.name || '']} />
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
              <LineChart data={timeseries || []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => value.toLocaleString('de-DE')} labelFormatter={(l)=> `Datum: ${l}`} />
                <Legend />
                <Line type="monotone" dataKey="totalParticipants" name="Teilnehmende" stroke="#10b981" strokeWidth={2} dot={false} />
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
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => value.toLocaleString('de-DE')} />
                <Legend />
                <Bar dataKey="total" name="Teilnehmende" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-viridian">Top Kategorien</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory || []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => value.toLocaleString('de-DE')} />
                <Legend />
                <Bar dataKey="count" name="Aktivitäten" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
