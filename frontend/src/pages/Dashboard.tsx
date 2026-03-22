import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useActivities } from '@/lib/activities';
import { useAuditLogs } from '@/lib/audit';
import {
  Pencil,
  PlusCircle,
  Trash2,
  LogIn,
  Users,
  StickyNote,
  Tag as TagIcon,
  Calendar as CalendarIcon,
  Circle,
  CheckCircle2,
  Clock,
  BarChart3,
  ClipboardList,
  FolderPlus,
  Image as ImageIcon,
  Sparkles,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Settings2,
} from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useIsMobile } from '@/lib/useIsMobile';
import { useQuickTallySession } from '@/components/QuickTally';
import ProjectPickerModal from './ProjectPickerModal';
import ActivityQuickAdd from './CalendarQuickAddModal';
import ExportModal from '@/components/ExportModal';
import Modal from '@/components/Modal';
import { useProjects, type Project } from '@/lib/projects';
import { useAuth } from '@/lib/auth';
import { listOrgs, type OrgDto, getOpeningHours, OpeningHours } from '@/lib/orgs';
import { useOrgScope, useOrgScopeKey } from '@/lib/orgScope';
import { fetchActivityAcks, setActivityAck } from '@/lib/acks';

function useMonthSummary(year: number, month: number, scopeKey: string) {
  // month is 1-12
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = new Date(year, month, 0); // last day of month
  const toISO = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
  const { scope } = useOrgScope();
  return useQuery({
    // Use consistent format: ['stats:summary', scopeKey, from, to, projectId]
    queryKey: ['stats:summary', scopeKey, from, toISO, ''],
    queryFn: async () => {
      const res = await api.get('/stats/summary', {
        params: {
          from,
          to: toISO,
          // Pass orgId explicitly so superadmin gets correctly scoped KPIs even before header is applied
          orgId:
            typeof scope === 'undefined' ? undefined : scope === null ? 'null' : scope,
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
  const { openQuickTally } = useOutletContext<{ openQuickTally: () => void }>();
  const scopeKey = useOrgScopeKey();
  const { scope } = useOrgScope();
  const { user } = useAuth();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [picker, setPicker] = useState(false);
  const [quickAdd, setQuickAdd] = useState<{ project: Project } | null>(null);
  const { data: summary } = useMonthSummary(year, month, scopeKey);
  const { data: projects = [], isLoading: projectsLoading } = useProjects({ archived: false });
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  useActivities({ from, to });
  const { data: audit } = useAuditLogs(50);
  const [exportOpen, setExportOpen] = useState(false);
  const { session: activeQuickTallySession } = useQuickTallySession();
  const [orgMap, setOrgMap] = useState<Record<string, string>>({});
  const tutorialDismissedStorageKey = useMemo(
    () => `dashboard-getting-started-v1:${user?.id || 'guest'}:${scopeKey}`,
    [scopeKey, user?.id],
  );
  const [tutorialDismissed, setTutorialDismissed] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    try {
      setTutorialDismissed(localStorage.getItem(tutorialDismissedStorageKey) === '1');
    } catch {
      setTutorialDismissed(false);
    }
  }, [tutorialDismissedStorageKey]);

  // Determine effective orgId for opening hours
  const effectiveOrgId = user?.role === 'superadmin'
    ? (typeof scope === 'string' ? scope : null)
    : (user?.orgId ?? null);

  // Fetch opening hours for today's display
  const { data: openingHours } = useQuery({
    queryKey: ['opening-hours', effectiveOrgId],
    queryFn: () => getOpeningHours(effectiveOrgId!),
    enabled: !!effectiveOrgId,
  });

  // Get today's opening hours
  const todayOpeningHours = useMemo(() => {
    if (!openingHours) return null;
    const dayKeys: (keyof OpeningHours)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc
    const dayData = openingHours[dayKeys[today]];
    if (!dayData) return null;
    return dayData;
  }, [openingHours]);

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

  useEffect(() => {
    if (!projectsLoading && projects.length === 0 && !tutorialDismissed) {
      setTutorialOpen(true);
    }
  }, [projects.length, projectsLoading, tutorialDismissed]);

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

  const dismissTutorial = () => {
    try {
      localStorage.setItem(tutorialDismissedStorageKey, '1');
    } catch {
      /* ignore */
    }
    setTutorialDismissed(true);
  };

  const closeTutorial = (dismiss = false) => {
    if (dismiss) dismissTutorial();
    setTutorialOpen(false);
  };

  const openTutorial = () => {
    setTutorialOpen(true);
  };

  const navigateFromTutorial = (path: string, dismiss = false) => {
    if (dismiss) dismissTutorial();
    setTutorialOpen(false);
    navigate(path);
  };

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
        <button
          type="button"
          onClick={openTutorial}
          className="inline-flex items-center justify-center gap-2 self-start md:self-auto rounded-2xl border border-white/80 bg-white/80 px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-white transition"
        >
          <BookOpen className="w-4 h-4 text-viridian" />
          Tutorial ansehen
        </button>
      </div>

      {/* Today's Opening Hours */}
      {openingHours && (
        <div className="bg-gradient-to-r from-viridian to-cambridge-blue rounded-xl p-4 mb-6 text-white flex items-center gap-3">
          <Clock className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">
            Heute:{' '}
            {todayOpeningHours?.open
              ? `${todayOpeningHours.from || '–'} – ${todayOpeningHours.to || '–'} Uhr`
              : 'Geschlossen'}
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="kpi-card">
          <h3 className="text-sm text-gray-500 font-medium mb-2">Aktivitäten (Monat)</h3>
          <p className="text-3xl font-bold text-gray-800">{fmt(summary?.totalActivities)}</p>
        </div>

        <div className="kpi-card">
          <h3 className="text-sm text-gray-500 font-medium mb-2">Teilnehmende (Monat)</h3>
          <p className="text-3xl font-bold text-gray-800">
            {fmt(summary?.totalParticipants)}
          </p>
        </div>

        <div className="kpi-card">
          <h3 className="text-sm text-gray-500 font-medium mb-2">Durchschnitt pro Aktivität</h3>
          <p className="text-3xl font-bold text-gray-800">
            {summary?.averageParticipants?.toLocaleString('de-DE') || '0'}
          </p>
        </div>

        <div className="kpi-card">
          <h3 className="text-sm text-gray-500 font-medium mb-2">Gesamt-Stunden</h3>
          <p className="text-3xl font-bold text-gray-800">
            {summary?.totalHours?.toLocaleString('de-DE') || '0'}
          </p>
        </div>
      </div>

      {/* Quick Tally - Daily Attendance Counter */}
      {/* Show start button only when no active session */}
      {!activeQuickTallySession && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 mb-8 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Tageserfassung</h3>
                <p className="text-white/80 text-sm">Schnelle Anwesenheitserfassung am Tablet</p>
              </div>
            </div>
            <button
              onClick={openQuickTally}
              className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" />
              Erfassung starten
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="modern-card p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Schnellzugriff</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            className="bg-blue-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-600 transition-colors"
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
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            onClick={() => navigate('/statistics')}
          >
            Statistik anzeigen
          </button>
          <button
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            onClick={() => setExportOpen(true)}
          >
            Daten exportieren
          </button>
        </div>
      </div>

      {/* Daily Log */}
      <div className="modern-card p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Daily Log
          <span className="ml-2 text-xs text-gray-400 font-normal">(letzte 14 Tage)</span>
        </h3>
        {dailyLog.length === 0 ? (
          <div className="text-gray-500">
            Keine Aktivitäten mit Notizen oder Tags im aktuellen Zeitraum.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dailyLog.map((item) => (
              <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <h4 className="font-medium text-gray-800 truncate" title={item.title}>
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-xs text-gray-500 flex items-center"
                      title={new Date(item.createdAt || '').toLocaleString('de-DE')}
                    >
                      <CalendarIcon className="w-3.5 h-3.5 mr-1" />
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
                      className={`p-1.5 rounded-full transition-all duration-200 ${doneMap[item.id] ? 'bg-accent-green/10 text-accent-green' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
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
                      open_door: 'bg-emerald-700 text-white',
                      project_open: 'bg-viridian text-white',
                      project_closed: 'bg-slate-700 text-white',
                      event: 'bg-amber-700 text-white',
                      outreach: 'bg-red-700 text-white',
                    };
                    const cls = typeBgClass[item.type] || 'bg-gray-700 text-white';
                    const label = labelMap[item.type] || item.type;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 mr-2 text-xs font-medium border border-black/10 ${cls}`}
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
      <div className="modern-card p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-800">Letzte Aktionen</h3>
        <div className="space-y-3">
          {(lastFive || []).map((e) => {
            const icon =
              e.action === 'login' ? (
                <LogIn className="w-5 h-5 text-sky-600" />
              ) : e.action === 'create' ? (
                <PlusCircle className="w-5 h-5 text-green-600" />
              ) : e.action === 'update' ? (
                <Pencil className="w-5 h-5 text-blue-600" />
              ) : (
                <Trash2 className="w-5 h-5 text-red-500" />
              );
            const labelMap: Record<string, string> = {
              activity: 'Aktivität',
              project: 'Projekt',
              tag: 'Tag',
              category: 'Kategorie',
              cohort: 'Kohorte',
              auth: 'Anmeldung',
            };
            const who = e.userName || 'Jemand';
            const what = labelMap[e.entityType] || e.entityType;
            const title = e.entityTitle ? ` „${e.entityTitle}“` : '';
            const when = new Date(e.createdAt).toLocaleString('de-DE');
            const verb =
              e.action === 'login'
                ? 'angemeldet'
                : e.action === 'create'
                ? 'angelegt'
                : e.action === 'update'
                  ? 'bearbeitet'
                  : 'gelöscht';
            // Prefer backend-provided orgName; fallback to local mapping for older entries
            const orgName = e.orgName || (e.orgId ? orgMap[e.orgId] : undefined);
            const titleLine =
              e.action === 'login'
                ? `${who} hat sich angemeldet.`
                : `${who} hat ${what}${title} ${verb}.`;
            return (
              <div key={e.id} className="bg-gray-50 rounded-lg px-4 py-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
                    <div>
                      <h4 className="font-semibold text-gray-800">
                        {titleLine}
                      </h4>
                      <p className="text-xs text-gray-600">{when}</p>
                      {e.action === 'login' && e.entityTitle && (
                        <span className="inline-block mt-1 text-[11px] text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">
                          Account: {e.entityTitle}
                        </span>
                      )}
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
      <GettingStartedTutorialModal
        open={tutorialOpen}
        onClose={closeTutorial}
        onNavigate={navigateFromTutorial}
      />
    </div>
  );
}

function GettingStartedTutorialModal({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: (dismiss?: boolean) => void;
  onNavigate: (path: string, dismiss?: boolean) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
      setDontShowAgain(false);
    }
  }, [open]);

  const steps: Array<{
    id: string;
    step: string;
    title: string;
    subtitle: string;
    description: string;
    icon: ReactNode;
    actionLabel: string;
    actionPath: string;
    preview: ReactNode;
  }> = [
    {
      id: 'projects',
      step: '01',
      title: 'Projekte anlegen',
      subtitle: 'Hier entsteht die Basis fuer alle Aktivitaeten.',
      description:
        'Legen Sie zuerst ein Projekt an. Dort definieren Sie Titel, Typ, Zielgruppe, Zeitraum, Bild, Kategorien und Farben. Danach koennen Aktivitaeten mit einem Klick auf dieses Projekt gebucht werden.',
      icon: <FolderPlus className="w-5 h-5" />,
      actionLabel: 'Zu Projekte',
      actionPath: '/projects?create=1',
      preview: (
        <TutorialPreviewCard title="Projektformular" badge="Projekte">
          <ScreenField label="Titel" value="Makerspace Mittwoch" />
          <div className="grid grid-cols-2 gap-2">
            <ScreenField label="Typ" value="Projekt (offen)" compact />
            <ScreenField label="Zielgruppe" value="12-16 Jahre" compact />
          </div>
          <div className="grid grid-cols-[1fr_92px] gap-2 items-end">
            <ScreenField label="Zeitraum" value="April - Juli" compact />
            <div className="rounded-2xl border border-gray-200 bg-gray-50 h-[58px] flex items-center justify-center text-[11px] text-gray-600 gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              Bild
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600 leading-5">
            Kategorien, Tags und Farben koennen direkt im selben Schritt gepflegt werden.
          </div>
        </TutorialPreviewCard>
      ),
    },
    {
      id: 'activities',
      step: '02',
      title: 'Aktivitaeten erfassen',
      subtitle: 'Hier dokumentieren Sie den Alltag vor Ort.',
      description:
        'In den Aktivitaeten erfassen Sie Datum, Uhrzeit, Projekt, Standort, Kategorie, Teilnehmendenzahlen und Notizen. Das ist die zentrale Arbeitsflaeche fuer Ihre Dokumentation.',
      icon: <ClipboardList className="w-5 h-5" />,
      actionLabel: 'Zu Aktivitaeten',
      actionPath: '/activities',
      preview: (
        <TutorialPreviewCard title="Aktivitaetsmaske" badge="Aktivitaeten">
          <div className="grid grid-cols-2 gap-2">
            <ScreenField label="Datum" value="22.03.2026" compact />
            <ScreenField label="Zeit" value="15:00 - 18:00" compact />
          </div>
          <ScreenField label="Projekt" value="Makerspace Mittwoch" />
          <div className="grid grid-cols-2 gap-2">
            <ScreenField label="Kategorie" value="Kreativ" compact />
            <ScreenField label="Standort" value="Jugendhaus" compact />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MetricPill label="m" value="7" />
            <MetricPill label="w" value="9" />
            <MetricPill label="d" value="1" />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600 leading-5">
            Notiz: Offene Werkbank, hohe Beteiligung, neue Teilnehmende kamen ueber Ferienprogramm.
          </div>
        </TutorialPreviewCard>
      ),
    },
    {
      id: 'calendar',
      step: '03',
      title: 'Kalender nutzen',
      subtitle: 'Planen, ueberblicken und schnell nachbuchen.',
      description:
        'Im Kalender sehen Sie alle Eintraege im Tages-, Wochen- oder Monatsblick. Von dort aus koennen Sie schnell pruefen, was gelaufen ist, und Eintraege direkt oeffnen.',
      icon: <CalendarIcon className="w-5 h-5" />,
      actionLabel: 'Zum Kalender',
      actionPath: '/calendar',
      preview: (
        <TutorialPreviewCard title="Kalenderblick" badge="Kalender">
          <div className="grid grid-cols-7 gap-1.5 text-[10px] uppercase tracking-[0.12em] text-gray-500">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
              <div key={day} className="text-center">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {[...Array(14)].map((_, index) => (
              <div key={index} className="rounded-xl border border-gray-200 bg-white p-1.5 min-h-[52px]">
                <div className="text-[10px] text-gray-400">{index + 10}</div>
                {(index === 2 || index === 8) && (
                  <div className="mt-1 rounded-lg bg-viridian/90 px-1.5 py-1 text-[10px] text-white">
                    Makerspace
                  </div>
                )}
              </div>
            ))}
          </div>
        </TutorialPreviewCard>
      ),
    },
    {
      id: 'statistics',
      step: '04',
      title: 'Statistiken lesen',
      subtitle: 'Aus Dokumentation werden auswertbare Zahlen.',
      description:
        'In den Statistiken sehen Sie Monatswerte, Trends, Teilnehmerzahlen und Verteilungen nach Projekten oder Kategorien. Dort entstehen die Uebersichten fuer Berichte und Gespraeche.',
      icon: <BarChart3 className="w-5 h-5" />,
      actionLabel: 'Zu Statistiken',
      actionPath: '/statistics',
      preview: (
        <TutorialPreviewCard title="Statistikbereich" badge="Statistiken">
          <div className="flex flex-wrap gap-2">
            <FilterChip label="Monat" active />
            <FilterChip label="Projekt" />
            <FilterChip label="Kategorie" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Aktivitaeten" value="12" />
            <MiniStat label="Teilnehmende" value="148" />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-end gap-2 h-24">
              {[38, 62, 48, 84, 70, 56].map((height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t-xl bg-gradient-to-t from-viridian to-cambridge-blue"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </TutorialPreviewCard>
      ),
    },
    {
      id: 'settings',
      step: '05',
      title: 'Einstellungen pflegen',
      subtitle: 'Stammdaten, Kategorien und Organisation im Blick behalten.',
      description:
        'Unter Einstellungen verwalten Sie Grundlagen wie Benutzer, Kategorien, Tags, Vorlagen und weitere Systemdaten. Hier wird Stato an Ihre Arbeitsweise angepasst.',
      icon: <Settings2 className="w-5 h-5" />,
      actionLabel: 'Zu Einstellungen',
      actionPath: '/settings',
      preview: (
        <TutorialPreviewCard title="Einstellungsbereiche" badge="Einstellungen">
          <div className="space-y-2">
            {[
              'Benutzer & Rollen',
              'Kategorien & Tags',
              'Projektvorlagen',
              'Standorte & Oeffnungszeiten',
            ].map((entry) => (
              <div key={entry} className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 flex items-center justify-between">
                <span>{entry}</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600 leading-5">
            Ideal, um die App nach dem Start auf Ihre Organisation zuzuschneiden.
          </div>
        </TutorialPreviewCard>
      ),
    },
  ];

  const step = steps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <Modal open={open} onClose={onClose} title="Stato Schritt fuer Schritt" maxWidth="3xl">
      <div className="space-y-6">
        <div className="rounded-[28px] border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(124,143,255,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.15),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,250,255,0.94))] p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="md:w-[340px] shrink-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-viridian shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                Schritt {step.step}
              </div>
              <h4 className="mt-4 text-2xl font-bold text-gray-900 leading-tight">{step.title}</h4>
              <p className="mt-2 text-sm font-medium text-viridian">{step.subtitle}</p>
              <p className="mt-4 text-sm text-gray-600 leading-7">{step.description}</p>

              <div className="mt-5 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Sie befinden sich hier</div>
                <div className="mt-2 flex items-center gap-3 text-sm text-gray-800 font-medium">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-viridian text-white shadow-sm">
                    {step.icon}
                  </span>
                  <span>{step.actionLabel.replace('Zu ', '')}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {steps.map((entry, index) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setStepIndex(index)}
                    className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                      stepIndex === index
                        ? 'bg-viridian text-white border-viridian'
                        : 'bg-white/80 text-gray-700 border-white hover:bg-white'
                    }`}
                  >
                    {entry.step}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-[240px]">{step.preview}</div>
          </div>
        </div>

        <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="font-medium text-gray-700">{stepIndex + 1}</span>
              <span>/</span>
              <span>{steps.length}</span>
              <div className="ml-2 flex items-center gap-1.5">
                {steps.map((entry, index) => (
                  <span
                    key={entry.id}
                    className={`h-1.5 rounded-full transition-all ${
                      index === stepIndex ? 'w-8 bg-viridian' : 'w-3 bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {isLastStep && (
              <label className="inline-flex items-start gap-3 rounded-2xl border border-gray-200 bg-white/90 px-3 py-2.5 text-sm text-gray-700 shadow-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(event) => setDontShowAgain(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-viridian focus:ring-viridian"
                />
                <span>Tutorial nicht mehr automatisch anzeigen</span>
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
              disabled={isFirstStep}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurueck
            </button>
            <button
              type="button"
              onClick={() => onNavigate(step.actionPath, isLastStep && dontShowAgain)}
              className="inline-flex items-center gap-2 rounded-2xl bg-viridian px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[rgba(91,108,255,0.20)] hover:brightness-105 transition"
            >
              {step.icon}
              {step.actionLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                if (isLastStep) onClose(dontShowAgain);
                else setStepIndex((index) => Math.min(steps.length - 1, index + 1));
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/90 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition"
            >
              {isLastStep ? 'Fertig' : 'Weiter'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TutorialPreviewCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[26px] border border-white/80 bg-white/78 backdrop-blur-md p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{badge}</div>
          <div className="mt-1 text-lg font-semibold text-gray-900">{title}</div>
        </div>
        <div className="inline-flex items-center rounded-full bg-viridian/10 text-viridian px-3 py-1 text-xs font-semibold">
          Vorschau
        </div>
      </div>

      <div className="mt-4 rounded-[22px] border border-gray-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,255,0.92))] p-4 space-y-3">
        {children}
      </div>
    </div>
  );
}

function ScreenField({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-white/80 bg-white/60 px-3 ${compact ? 'py-2' : 'py-2.5'}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{label}</div>
      <div className={`mt-1 font-medium text-gray-800 ${compact ? 'text-xs' : 'text-sm'}`}>{value}</div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/65 px-2.5 py-2 text-center">
      <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-800">{value}</div>
    </div>
  );
}

function FilterChip({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium border ${
        active
          ? 'bg-viridian text-white border-viridian'
          : 'bg-white/65 text-gray-700 border-white/80'
      }`}
    >
      {label}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/60 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}
