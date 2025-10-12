import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useActivities } from '@/lib/activities';
import { useAuditLogs } from '@/lib/audit';
import { Pencil, PlusCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProjectPickerModal from './ProjectPickerModal';
import ActivityQuickAdd from './CalendarQuickAddModal';
import ExportModal from '@/components/ExportModal';
import type { Project } from '@/lib/projects';
import { useAuth } from '@/lib/auth';
import { listOrgs, type OrgDto } from '@/lib/orgs';
import { useOrgScope } from '@/lib/orgScope';

function useMonthSummary(year: number, month: number, scopeKey: string | null | undefined) {
  // month is 1-12
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = new Date(year, month, 0); // last day of month
  const toISO = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
  return useQuery({
    // Include scope in key so a scope change forces refetch after login/reload
    queryKey: ['stats:summary', { from, to: toISO, scope: scopeKey === undefined ? 'GLOBAL' : (scopeKey === null ? 'NULL' : scopeKey) }],
    queryFn: async () => {
      const res = await api.get('/stats/summary', {
        params: {
          from,
          to: toISO,
          // Pass orgId explicitly so superadmin gets correctly scoped KPIs even before header is applied
          orgId: typeof scopeKey === 'undefined' ? undefined : (scopeKey === null ? 'null' : scopeKey),
        },
      });
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
  const { scope } = useOrgScope();
  const { user } = useAuth();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const navigate = useNavigate();
  const [picker, setPicker] = useState(false);
  const [quickAdd, setQuickAdd] = useState<{ project: Project } | null>(null);
  const { data: summary } = useMonthSummary(year, month, scope);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  useActivities({ from, to });
  const { data: audit } = useAuditLogs(10);
  const [exportOpen, setExportOpen] = useState(false);
  const [orgMap, setOrgMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (user?.role === 'superadmin') {
        try {
          const orgs = await listOrgs();
          if (mounted) setOrgMap(Object.fromEntries((orgs as OrgDto[]).map(o => [o.id, o.name])));
        } catch { /* ignore */ }
      }
    })();
    return () => { mounted = false; };
  }, [user?.role]);

  const lastFive = useMemo(() => {
    const items = (audit || []);
    // Filter duplicate anonymous updates/deletes when a user-attributed entry with same entity/action exists
    const seenKeyWithUser = new Set<string>();
    for (const e of items) {
      const key = `${e.action}:${e.entityType}:${e.entityId}`;
      if (e.userName) seenKeyWithUser.add(key);
    }
    const filtered = items.filter(e => {
      const key = `${e.action}:${e.entityType}:${e.entityId}`;
      if (!e.userName && seenKeyWithUser.has(key)) return false;
      return true;
    });
    return filtered.slice(0, 10);
  }, [audit]);

  const fmt = (n?: number) => (typeof n === 'number' ? n.toLocaleString('de-DE') : '0');
  // keep date helpers only where needed; recent actions use locale string

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

      {/* Recent Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4 text-viridian">Letzte Aktionen</h3>
        <div className="space-y-3">
          {(lastFive || []).map((e) => {
            const icon = e.action === 'create' ? <PlusCircle className="w-4 h-4 text-viridian" /> : e.action === 'update' ? <Pencil className="w-4 h-4 text-cambridge-blue" /> : <Trash2 className="w-4 h-4 text-red-600" />;
            const labelMap: Record<string, string> = { activity: 'Aktivität', project: 'Projekt', tag: 'Tag', category: 'Kategorie', cohort: 'Kohorte' };
            const who = e.userName || 'Jemand';
            const what = labelMap[e.entityType] || e.entityType;
            const title = e.entityTitle ? ` „${e.entityTitle}“` : '';
            const when = new Date(e.createdAt).toLocaleString('de-DE');
            const verb = e.action === 'create' ? 'angelegt' : e.action === 'update' ? 'bearbeitet' : 'gelöscht';
            // Prefer backend-provided orgName; fallback to local mapping for older entries
            const orgName = e.orgName || (e.orgId ? orgMap[e.orgId] : undefined);
            return (
              <div key={e.id} className="border-l-4 border-viridian pl-4 py-2 bg-azure-web">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-2">
                    {icon}
                    <div>
                      <h4 className="font-semibold">{who} hat {what}{title} {verb}.</h4>
                      <p className="text-xs text-gray-600">{when}</p>
                      {orgName && <span className="inline-block mt-1 text-[11px] text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">Organisation: {orgName}</span>}
                      {e.diff && Object.keys(e.diff).length > 0 && (
                        <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-0.5">
                          {Object.entries(e.diff as Record<string, { from: unknown; to: unknown }>).map(([k, v]) => (
                            <li key={k}>
                              <span className="font-medium">{k}:</span> {String(v.from ?? '—')} → {String(v.to ?? '—')}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {(lastFive || []).length === 0 && (
            <div className="text-gray-500">Noch keine Aktionen vorhanden.</div>
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
