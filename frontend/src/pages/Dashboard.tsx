import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useActivities } from '@/lib/activities';
import { useNavigate } from 'react-router-dom';
import ProjectPickerModal from './ProjectPickerModal';
import ActivityQuickAdd from './CalendarQuickAddModal';
import ExportModal from '@/components/ExportModal';
import type { Project } from '@/lib/projects';

function useMonthSummary(year: number, month: number) {
  // month is 1-12
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = new Date(year, month, 0); // last day of month
  const toISO = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
  return useQuery({
    queryKey: ['stats:summary', { from, to: toISO }],
    queryFn: async () => {
      const res = await api.get('/stats/summary', { params: { from, to: toISO } });
      return res.data as {
        totalActivities: number;
        totalParticipants: number;
        totalDurationMinutes: number;
        totalHours: number;
        averageParticipants: number;
      };
    },
  });
}

export default function Dashboard() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const navigate = useNavigate();
  const [picker, setPicker] = useState(false);
  const [quickAdd, setQuickAdd] = useState<{ project: Project } | null>(null);
  const { data: summary } = useMonthSummary(year, month);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const { data: activities } = useActivities({ from, to });
  const [exportOpen, setExportOpen] = useState(false);

  const lastFive = useMemo(() =>
    (activities || [])
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 5),
  [activities]);

  const fmt = (n?: number) => (typeof n === 'number' ? n.toLocaleString('de-DE') : '0');
  const fmtDate = (iso?: string) => {
    const s = (iso || '').slice(0, 10);
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  };

  // Export handled via ExportModal

  return (
    <div>
      <h2 className="text-3xl font-bold text-viridian mb-6">Dashboard</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-viridian">
          <h3 className="text-sm text-gray-600 mb-1">Aktivitäten (Monat)</h3>
          <p className="text-3xl font-bold text-viridian">{fmt(summary?.totalActivities)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-cambridge-blue">
          <h3 className="text-sm text-gray-600 mb-1">Teilnehmende (Monat)</h3>
          <p className="text-3xl font-bold text-cambridge-blue">{fmt(summary?.totalParticipants)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-mint-green">
          <h3 className="text-sm text-gray-600 mb-1">Durchschnitt pro Aktivität</h3>
          <p className="text-3xl font-bold text-viridian">{summary?.averageParticipants?.toLocaleString('de-DE') || '0'}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-viridian">
          <h3 className="text-sm text-gray-600 mb-1">Gesamt-Stunden</h3>
          <p className="text-3xl font-bold text-viridian">{summary?.totalHours?.toLocaleString('de-DE') || '0'}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4 text-viridian">Schnellzugriff</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-viridian text-white px-6 py-3 rounded-lg hover:bg-cambridge-blue transition-colors" onClick={() => setPicker(true)}>
            Neue Aktivität erfassen
          </button>
          <button className="bg-cambridge-blue text-white px-6 py-3 rounded-lg hover:bg-viridian transition-colors" onClick={() => navigate('/statistics')}>
            Statistik anzeigen
          </button>
          <button className="bg-mint-green text-viridian px-6 py-3 rounded-lg hover:bg-cambridge-blue hover:text-white transition-colors" onClick={()=> setExportOpen(true)}>
            Daten exportieren
          </button>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4 text-viridian">Letzte Aktivitäten</h3>
        <div className="space-y-3">
          {(lastFive || []).map((a) => (
            <div key={a.id} className="border-l-4 border-viridian pl-4 py-2 bg-azure-web">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold">{({open_door:'Offene Tür', project_open:'Projekt (offen)', project_closed:'Projekt (geschlossen)', event:'Veranstaltung', outreach:'Aufsuchend'} as Record<string,string>)[a.type] || a.type}{a.title ? `: ${a.title}` : ''}</h4>
                  <p className="text-sm text-gray-600">{a.location?.name || a.project?.title || '–'} · {(a.countTotal ?? 0)} Teilnehmende</p>
                </div>
                <span className="text-sm text-gray-500">{fmtDate(a.date)}</span>
              </div>
            </div>
          ))}
          {(lastFive || []).length === 0 && (
            <div className="text-gray-500">Im aktuellen Monat wurden noch keine Aktivitäten erfasst.</div>
          )}
        </div>
      </div>
      {picker && (
        <ProjectPickerModal onPick={(p)=> { setPicker(false); setQuickAdd({ project: p }); }} onClose={() => setPicker(false)} />
      )}
      {quickAdd && (
        <ActivityQuickAdd dateISO={`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`} onClose={() => setQuickAdd(null)} project={quickAdd.project} />
      )}
      {exportOpen && (
        <ExportModal open={exportOpen} onClose={()=> setExportOpen(false)} initialYear={year} initialMonth={month} />
      )}
    </div>
  );
}
