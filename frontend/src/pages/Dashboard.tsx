import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useActivities } from '@/lib/activities';
import { useAuditLogs } from '@/lib/audit';
import {
  Pencil,
  PlusCircle,
  Trash2,
  StickyNote,
  Tag as TagIcon,
  Calendar as CalendarIcon,
  Circle,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/lib/useIsMobile';
import ProjectPickerModal from './ProjectPickerModal';
import ActivityQuickAdd from './CalendarQuickAddModal';
import ExportModal from '@/components/ExportModal';
import type { Project } from '@/lib/projects';
import { useAuth } from '@/lib/auth';
import { listOrgs, type OrgDto } from '@/lib/orgs';
import { useOrgScope } from '@/lib/orgScope';
import { fetchActivityAcks, setActivityAck } from '@/lib/acks';

function useMonthSummary(year: number, month: number, scopeKey: string | null | undefined) {
  // month is 1-12
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = new Date(year, month, 0); // last day of month
  const toISO = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
  return useQuery({
    // Include scope in key so a scope change forces refetch after login/reload
    queryKey: [
      'stats:summary',
      {
        from,
        to: toISO,
        scope: scopeKey === undefined ? 'GLOBAL' : scopeKey === null ? 'NULL' : scopeKey,
      },
    ],
    queryFn: async () => {
      const res = await api.get('/stats/summary', {
        params: {
          from,
          to: toISO,
          // Pass orgId explicitly so superadmin gets correctly scoped KPIs even before header is applied
          orgId:
            typeof scopeKey === 'undefined' ? undefined : scopeKey === null ? 'null' : scopeKey,
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
  const isMobile = useIsMobile();
  const [picker, setPicker] = useState(false);
  const [quickAdd, setQuickAdd] = useState<{ project: Project } | null>(null);
  const { data: summary } = useMonthSummary(year, month, scope);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  useActivities({ from, to });
  const { data: audit } = useAuditLogs(50);
  const [exportOpen, setExportOpen] = useState(false);
  const [orgMap, setOrgMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (user?.role === 'superadmin') {
        try {
          const orgs = await listOrgs();
          if (mounted) setOrgMap(Object.fromEntries((orgs as OrgDto[]).map((o) => [o.id, o.name])));
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.role]);

  const lastFive = useMemo(() => {
    const items = audit || [];
    // Filter duplicate anonymous updates/deletes when a user-attributed entry with same entity/action exists
    const seenKeyWithUser = new Set<string>();
    for (const e of items) {
      const key = `${e.action}:${e.entityType}:${e.entityId}`;
      if (e.userName) seenKeyWithUser.add(key);
    }
    const filtered = items.filter((e) => {
      const key = `${e.action}:${e.entityType}:${e.entityId}`;
      if (!e.userName && seenKeyWithUser.has(key)) return false;
      return true;
    });
    return filtered.slice(0, 10);
  }, [audit]);

  const fmt = (n?: number) => (typeof n === 'number' ? n.toLocaleString('de-DE') : '0');
  // keep date helpers only where needed; recent actions use locale string

  // Build Daily Log: last 5 activities in the last 14 days that have notes and/or tags
  const nowISO = new Date();
  const fourteenDaysAgo = new Date(nowISO.getTime() - 14 * 24 * 60 * 60 * 1000);
  const from14 = `${fourteenDaysAgo.getFullYear()}-${String(fourteenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(fourteenDaysAgo.getDate()).padStart(2, '0')}`;
  const toToday = `${nowISO.getFullYear()}-${String(nowISO.getMonth() + 1).padStart(2, '0')}-${String(nowISO.getDate()).padStart(2, '0')}`;
  const { data: activitiesMonth = [] } = useActivities({ from: from14, to: toToday });
  // Persist a simple "done" flag per activity id for the Daily Log
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('dailyLogDone_v1');
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('dailyLogDone_v1', JSON.stringify(doneMap));
    } catch {
      /* ignore */
    }
  }, [doneMap]);
  const dailyLog = useMemo(() => {
    const candidates = (activitiesMonth || []).filter(
      (a) =>
        (a?.notes && a.notes.trim().length > 0) || (Array.isArray(a?.tags) && a.tags.length > 0),
    );
    // sort by date + startTime descending
    const toKey = (a: { date?: string; startTime?: string | null }) =>
      `${a.date || ''}T${a.startTime || '23:59'}`;
    candidates.sort((a, b) => (toKey(b) > toKey(a) ? 1 : toKey(b) < toKey(a) ? -1 : 0));
    const pick = candidates.slice(0, 5);
    // Map create user from audit logs
    const createById = new Map<string, { user?: string | null; at?: string }>();
    for (const e of audit || []) {
      if (e.entityType === 'activity' && e.action === 'create') {
        createById.set(e.entityId, { user: e.userName || null, at: e.createdAt });
      }
    }
    return pick.map((a) => ({
      id: a.id,
      title: a.title || '—',
      type: a.type,
      project: a.project?.title || undefined,
      notes: a.notes || '',
      tags: (a.tags || []).map((t) => ({ name: t.name, color: t.color || undefined })),
      createdBy: createById.get(a.id)?.user || '—',
      createdAt: createById.get(a.id)?.at || `${a.date || ''} ${a.startTime || ''}`,
    }));
  }, [activitiesMonth, audit]);

  // Sync server-side ack state for the visible Daily Log items
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ids = dailyLog.map((d) => d.id);
        if (ids.length === 0) return;
        const server = await fetchActivityAcks(ids);
        if (cancelled) return;
        setDoneMap((prev) => ({ ...prev, ...server }));
      } catch {
        // ignore; fall back to local storage state
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dailyLog.map((d) => d.id).join(',')]);

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
          <p className="text-3xl font-bold text-cambridge-blue">
            {fmt(summary?.totalParticipants)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-mint-green">
          <h3 className="text-sm text-gray-600 mb-1">Durchschnitt pro Aktivität</h3>
          <p className="text-3xl font-bold text-viridian">
            {summary?.averageParticipants?.toLocaleString('de-DE') || '0'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-viridian">
          <h3 className="text-sm text-gray-600 mb-1">Gesamt-Stunden</h3>
          <p className="text-3xl font-bold text-viridian">
            {summary?.totalHours?.toLocaleString('de-DE') || '0'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4 text-viridian">Schnellzugriff</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            className="bg-viridian text-white px-6 py-3 rounded-lg hover:bg-cambridge-blue transition-colors"
            onClick={() => {
              const dateISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              if (isMobile) {
                navigate(`/activities/new/select-project?date=${encodeURIComponent(dateISO)}`);
              } else {
                setPicker(true);
              }
            }}
          >
            Neue Aktivität erfassen
          </button>
          <button
            className="bg-cambridge-blue text-white px-6 py-3 rounded-lg hover:bg-viridian transition-colors"
            onClick={() => navigate('/statistics')}
          >
            Statistik anzeigen
          </button>
          <button
            className="bg-mint-green text-viridian px-6 py-3 rounded-lg hover:bg-cambridge-blue hover:text-white transition-colors"
            onClick={() => setExportOpen(true)}
          >
            Daten exportieren
          </button>
        </div>
      </div>

      {/* Daily Log */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4 text-viridian">
          Daily Log
          <span className="ml-2 text-xs italic text-gray-500 align-middle">(letzte 14 Tage)</span>
        </h3>
        {dailyLog.length === 0 ? (
          <div className="text-gray-500">
            Keine Aktivitäten mit Notizen oder Tags im aktuellen Zeitraum.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dailyLog.map((item) => (
              <div key={item.id} className="note-card border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <h4 className="font-semibold text-viridian truncate" title={item.title}>
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="inline-flex items-center gap-1 text-xs text-gray-600"
                      title={new Date(item.createdAt || '').toLocaleString('de-DE')}
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {(() => {
                        const d = new Date(item.createdAt || '');
                        return d.toLocaleDateString('de-DE', {
                          weekday: 'long',
                          day: '2-digit',
                          month: '2-digit',
                          // year intentionally omitted for recent daily log
                        });
                      })()}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const next = !doneMap[item.id];
                        // optimistic update
                        setDoneMap((m) => ({ ...m, [item.id]: next }));
                        try {
                          await setActivityAck(item.id, next);
                        } catch {
                          // revert on error
                          setDoneMap((m) => ({ ...m, [item.id]: !next }));
                        }
                      }}
                      className={`p-1 rounded-full border ${doneMap[item.id] ? 'border-green-600 text-green-600' : 'border-gray-300 text-gray-400'} hover:bg-gray-50`}
                      title={
                        doneMap[item.id] ? 'Als unbesprochen markieren' : 'Als besprochen markieren'
                      }
                      aria-label={
                        doneMap[item.id] ? 'Als unbesprochen markieren' : 'Als besprochen markieren'
                      }
                    >
                      {doneMap[item.id] ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-700 mb-2">
                  {(() => {
                    const labelMap: Record<string, string> = {
                      open_door: 'Offene Tür',
                      project_open: 'Projekt (offen)',
                      project_closed: 'Projekt (geschlossen)',
                      event: 'Veranstaltung',
                      outreach: 'Aufsuchend',
                    };
                    const typeBgClass: Record<string, string> = {
                      open_door: 'bg-cambridge-blue text-white',
                      project_open: 'bg-viridian text-white',
                      project_closed: 'bg-azure-web text-viridian',
                      event: 'bg-mint-green text-viridian',
                      outreach: 'bg-gray-700 text-white',
                    };
                    const cls = typeBgClass[item.type] || 'bg-gray-600 text-white';
                    const label = labelMap[item.type] || item.type;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 mr-2 ${cls}`}
                      >
                        {label}
                      </span>
                    );
                  })()}
                  {item.project && (
                    <span className="inline-block text-gray-600">Projekt: {item.project}</span>
                  )}
                </div>
                {item.notes && (
                  <div className="text-sm text-gray-800 mb-2 flex items-start gap-2">
                    <StickyNote className="w-4 h-4 text-gray-500 mt-0.5" />
                    <span className="whitespace-pre-wrap">{item.notes}</span>
                  </div>
                )}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {item.tags.map((t, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-gray-300 text-gray-700"
                        title={t.name}
                      >
                        <TagIcon className="w-3 h-3" /> {t.name}
                      </span>
                    ))}
                  </div>
                )}
                {/* Removed creator footer to simplify card */}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4 text-viridian">Letzte Aktionen</h3>
        <div className="space-y-3">
          {(lastFive || []).map((e) => {
            const icon =
              e.action === 'create' ? (
                <PlusCircle className="w-4 h-4 text-viridian" />
              ) : e.action === 'update' ? (
                <Pencil className="w-4 h-4 text-cambridge-blue" />
              ) : (
                <Trash2 className="w-4 h-4 text-red-600" />
              );
            const labelMap: Record<string, string> = {
              activity: 'Aktivität',
              project: 'Projekt',
              tag: 'Tag',
              category: 'Kategorie',
              cohort: 'Kohorte',
            };
            const who = e.userName || 'Jemand';
            const what = labelMap[e.entityType] || e.entityType;
            const title = e.entityTitle ? ` „${e.entityTitle}“` : '';
            const when = new Date(e.createdAt).toLocaleString('de-DE');
            const verb =
              e.action === 'create'
                ? 'angelegt'
                : e.action === 'update'
                  ? 'bearbeitet'
                  : 'gelöscht';
            // Prefer backend-provided orgName; fallback to local mapping for older entries
            const orgName = e.orgName || (e.orgId ? orgMap[e.orgId] : undefined);
            return (
              <div key={e.id} className="border-l-4 border-viridian pl-4 py-2 bg-azure-web">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-2">
                    {icon}
                    <div>
                      <h4 className="font-semibold">
                        {who} hat {what}
                        {title} {verb}.
                      </h4>
                      <p className="text-xs text-gray-600">{when}</p>
                      {orgName && (
                        <span className="inline-block mt-1 text-[11px] text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">
                          Organisation: {orgName}
                        </span>
                      )}
                      {e.diff && Object.keys(e.diff).length > 0 && (
                        <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-0.5">
                          {Object.entries(
                            e.diff as Record<string, { from: unknown; to: unknown }>,
                          ).map(([k, v]) => (
                            <li key={k}>
                              <span className="font-medium">{k}:</span> {String(v.from ?? '—')} →{' '}
                              {String(v.to ?? '—')}
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
        <ProjectPickerModal
          onPick={(p) => {
            setPicker(false);
            setQuickAdd({ project: p });
          }}
          onClose={() => setPicker(false)}
        />
      )}
      {quickAdd && (
        <ActivityQuickAdd
          dateISO={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`}
          onClose={() => setQuickAdd(null)}
          project={quickAdd.project}
        />
      )}
      {exportOpen && (
        <ExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          initialYear={year}
          initialMonth={month}
        />
      )}
    </div>
  );
}
