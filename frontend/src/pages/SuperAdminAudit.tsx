import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Building2, Users, CalendarDays, FolderKanban, LogIn, UserCheck, RefreshCw, HardDrive } from 'lucide-react';

type AuditMetricsResponse = {
  global: {
    totalUsers: number;
    totalOrgs: number;
    totalActivities: number;
    totalProjects: number;
    loginsLast7Days: number;
    activeUsersLast30Days: number;
  };
  orgs: Array<{
    id: string;
    name: string;
    users: number;
    activities: number;
    projects: number;
    attachmentCount: number;
    attachmentBytes: number;
  }>;
  topUsers30d: Array<{
    id: string;
    name: string | null;
    email: string;
    role: string;
    orgId: string | null;
    lastLoginAt: string;
    loginCount30d: number;
  }>;
};

function formatBytes(bytes: number) {
  const n = Number(bytes) || 0;
  if (n === 0) return '–';
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

// KPI Card component
function KpiCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number | string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${accent || 'bg-viridian/10 text-viridian'}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-sm text-gray-500 font-medium">{label}</div>
        <div className="text-2xl font-bold text-gray-900 mt-0.5">{value}</div>
      </div>
    </div>
  );
}

export default function SuperAdminAudit() {
  const { user } = useAuth();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['audit:metrics'],
    queryFn: async () => {
      const res = await api.get<AuditMetricsResponse>('/audit/metrics');
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
  });

  const orgsTop = useMemo(() => (data?.orgs ?? []).slice(0, 50), [data?.orgs]);

  // Total storage across all orgs
  const totalStorage = useMemo(() => {
    return (data?.orgs ?? []).reduce((sum, o) => sum + (o.attachmentBytes || 0), 0);
  }, [data?.orgs]);

  if (!user) return null;
  if (user.role !== 'superadmin') {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-viridian">Audit</h2>
        <div className="mt-2 text-gray-700">Nicht erlaubt.</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold text-viridian">Audit & Metriken</h2>
          <p className="text-gray-600 mt-1">Plattformweite Kennzahlen für die Systemübersicht.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-60"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Lädt…' : 'Aktualisieren'}
        </button>
      </div>

      {isLoading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
          Lade Metriken…
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          Fehler beim Laden der Metriken.
        </div>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={Building2} label="Organisationen" value={data.global.totalOrgs} accent="bg-blue-100 text-blue-600" />
            <KpiCard icon={Users} label="Benutzer" value={data.global.totalUsers} accent="bg-emerald-100 text-emerald-600" />
            <KpiCard icon={CalendarDays} label="Aktivitäten" value={data.global.totalActivities} accent="bg-amber-100 text-amber-600" />
            <KpiCard icon={FolderKanban} label="Projekte" value={data.global.totalProjects} accent="bg-purple-100 text-purple-600" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard icon={LogIn} label="Logins (letzte 7 Tage)" value={data.global.loginsLast7Days} accent="bg-sky-100 text-sky-600" />
            <KpiCard icon={UserCheck} label="Aktive User (30 Tage)" value={data.global.activeUsersLast30Days} accent="bg-teal-100 text-teal-600" />
            <KpiCard icon={HardDrive} label="Gesamtspeicher" value={formatBytes(totalStorage)} accent="bg-rose-100 text-rose-600" />
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Orgs Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-semibold text-gray-900">Organisationen</h3>
                <p className="text-xs text-gray-500 mt-0.5">Sortiert nach Speicherverbrauch (Anhänge)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-semibold">Name</th>
                      <th className="text-right px-3 py-3 font-semibold">User</th>
                      <th className="text-right px-3 py-3 font-semibold">Aktivitäten</th>
                      <th className="text-right px-3 py-3 font-semibold">Projekte</th>
                      <th className="text-right px-4 py-3 font-semibold">Speicher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orgsTop.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-gray-500">Keine Organisationen vorhanden.</td>
                      </tr>
                    )}
                    {orgsTop.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[220px] truncate" title={o.name}>{o.name}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{o.users}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{o.activities}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{o.projects}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700">{formatBytes(o.attachmentBytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-semibold text-gray-900">Top User (Logins)</h3>
                <p className="text-xs text-gray-500 mt-0.5">Letzte 30 Tage, basierend auf Audit-Events</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-semibold">Name</th>
                      <th className="text-left px-4 py-3 font-semibold">E-Mail</th>
                      <th className="text-right px-4 py-3 font-semibold">Logins</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data.topUsers30d ?? []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-gray-500">Noch keine Login-Daten vorhanden.</td>
                      </tr>
                    )}
                    {(data.topUsers30d ?? []).map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{u.name || '–'}</td>
                        <td className="px-4 py-3 text-gray-600">{u.email}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-viridian/10 text-viridian">
                            {u.loginCount30d}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
