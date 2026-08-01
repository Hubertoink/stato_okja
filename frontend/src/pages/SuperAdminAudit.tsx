import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Building2,
  Users,
  CalendarDays,
  FolderKanban,
  LogIn,
  UserCheck,
  HardDrive,
} from 'lucide-react';
import { autoT } from '@/i18n/auto';

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
  if (n === 0) return '0 B';
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

// KPI Card component
function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-5 flex items-center gap-3 sm:items-start sm:gap-4">
      <div
        className={`shrink-0 rounded-lg p-2.5 sm:p-3 ${accent || 'bg-viridian/10 text-viridian'}`}
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-gray-500 sm:text-sm">{label}</div>
        <div className="mt-0.5 text-xl font-bold text-gray-900 sm:text-2xl">{value}</div>
      </div>
    </div>
  );
}

export default function SuperAdminAudit() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
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
        <h2 className="text-2xl font-bold text-viridian">{autoT('ui_fa1703dd78a0')}</h2>
        <div className="mt-2 text-gray-700">{autoT('ui_9bac42e57f50')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div>
          <h2 className="text-3xl font-bold text-viridian">{autoT('ui_14888b4249de')}</h2>
          <p className="text-gray-600 mt-1">{autoT('ui_d4922dd11449')}</p>
        </div>
      </div>

      {isLoading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
          {autoT('ui_ec8dc51c204f')}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {autoT('ui_7413c458dc71')}
        </div>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <KpiCard
              icon={Building2}
              label={autoT('ui_4048d8ed39f2')}
              value={data.global.totalOrgs}
              accent="bg-blue-100 text-blue-600"
            />
            <KpiCard
              icon={Users}
              label={autoT('ui_bd26f3d230af')}
              value={data.global.totalUsers}
              accent="bg-emerald-100 text-emerald-600"
            />
            <KpiCard
              icon={CalendarDays}
              label={autoT('ui_b6bf5f1a2033')}
              value={data.global.totalActivities}
              accent="bg-amber-100 text-amber-600"
            />
            <KpiCard
              icon={FolderKanban}
              label={autoT('ui_3930f79f07e5')}
              value={data.global.totalProjects}
              accent="bg-purple-100 text-purple-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <KpiCard
              icon={LogIn}
              label={autoT('ui_86af4201fc3a')}
              value={data.global.loginsLast7Days}
              accent="bg-sky-100 text-sky-600"
            />
            <KpiCard
              icon={UserCheck}
              label={autoT('ui_9be8d4388e20')}
              value={data.global.activeUsersLast30Days}
              accent="bg-teal-100 text-teal-600"
            />
            <KpiCard
              icon={HardDrive}
              label={autoT('ui_5b8043b052a9')}
              value={formatBytes(totalStorage)}
              accent="bg-rose-100 text-rose-600"
            />
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Orgs Table */}
            <div className="audit-metrics-panel rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="audit-metrics-panel-header px-5 py-4 border-b border-gray-100">
                <h3 className="audit-metrics-panel-title font-semibold text-gray-900">{autoT('ui_4048d8ed39f2')}</h3>
                <p className="audit-metrics-panel-copy text-xs text-gray-500 mt-0.5">{autoT('ui_64b2ad3e9759')}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="audit-metrics-table-head text-gray-600 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-semibold">
                        {autoT('ui_709a23220f2c')}
                      </th>
                      <th className="text-right px-3 py-3 font-semibold">
                        {autoT('ui_9f8a2389a20c')}
                      </th>
                      <th className="text-right px-3 py-3 font-semibold">
                        {autoT('ui_b6bf5f1a2033')}
                      </th>
                      <th className="text-right px-3 py-3 font-semibold">
                        {autoT('ui_3930f79f07e5')}
                      </th>
                      <th className="text-right px-4 py-3 font-semibold">
                        {autoT('ui_9f8e6d6309c2')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="audit-metrics-table-body divide-y divide-gray-100">
                    {orgsTop.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                          {autoT('ui_4204973208fd')}
                        </td>
                      </tr>
                    )}
                    {orgsTop.map((o) => (
                      <tr key={o.id} className="audit-metrics-table-row transition-colors">
                        <td
                          className="px-4 py-3 font-medium text-gray-900 max-w-[220px] truncate"
                          title={o.name}
                        >
                          {o.name}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">{o.users}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{o.activities}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{o.projects}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700">
                          {formatBytes(o.attachmentBytes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Users Table */}
            <div className="audit-metrics-panel rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="audit-metrics-panel-header px-5 py-4 border-b border-gray-100">
                <h3 className="audit-metrics-panel-title font-semibold text-gray-900">{autoT('ui_7a334a2fea9c')}</h3>
                <p className="audit-metrics-panel-copy text-xs text-gray-500 mt-0.5">{autoT('ui_dc7d6956122a')}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="audit-metrics-table-head text-gray-600 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-semibold">
                        {autoT('ui_709a23220f2c')}
                      </th>
                      <th className="text-left px-4 py-3 font-semibold">
                        {autoT('ui_9eeffe4b7b6e')}
                      </th>
                      <th className="text-right px-4 py-3 font-semibold">
                        {autoT('ui_9a11f6c8d302')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="audit-metrics-table-body divide-y divide-gray-100">
                    {(data.topUsers30d ?? []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                          {autoT('ui_1c4ca5a98acd')}
                        </td>
                      </tr>
                    )}
                    {(data.topUsers30d ?? []).map((u) => (
                      <tr key={u.id} className="audit-metrics-table-row transition-colors">
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
