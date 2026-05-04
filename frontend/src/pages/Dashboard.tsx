import { Suspense, lazy, useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useActivities } from '@/lib/activities';
import { useAuditLogs, type AuditLog, type AuditLogAction } from '@/lib/audit';
import {
  ChevronDown,
  ChevronUp,
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
} from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useIsMobile } from '@/lib/useIsMobile';
import { useQuickTallySession } from '@/components/QuickTally';
import ProjectPickerModal from './ProjectPickerModal';
import ActivityQuickAdd from './CalendarQuickAddModal';
import Modal from '@/components/Modal';
import { type Project } from '@/lib/projects';
import { useAuth } from '@/lib/auth';
import { listOrgs, type OrgDto, getOpeningHours, OpeningHours } from '@/lib/orgs';
import { useOrgScope, useOrgScopeKey } from '@/lib/orgScope';
import { fetchActivityAcks, setActivityAck } from '@/lib/acks';
import { usePublicConfig } from '@/lib/publicConfig';
import DemoHoverHint from '@/demo/DemoHoverHint';
import CustomKpiCards from '@/components/CustomKpiCards';

const ExportModal = lazy(() => import('@/components/ExportModal'));

type DashboardRealtimeOptions = {
  refetchOnWindowFocus?: boolean | 'always';
  refetchIntervalMs?: number;
};

function useMonthSummary(
  year: number,
  month: number,
  scopeKey: string,
  options?: DashboardRealtimeOptions,
) {
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
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    refetchInterval:
      typeof options?.refetchIntervalMs === 'number' && options.refetchIntervalMs > 0
        ? options.refetchIntervalMs
        : false,
  });
}

function preloadExportModal() {
  void import('@/components/ExportModal');
}

const ACTIVITY_AUDIT_FIELD_LABELS: Record<string, string> = {
  title: 'Titel',
  date: 'Datum',
  startTime: 'Beginn',
  endTime: 'Ende',
  durationMinutes: 'Dauer (Min.)',
  type: 'Typ',
  project: 'Projekt',
  location: 'Standort',
  countMale: 'Teilnehmende m',
  countFemale: 'Teilnehmende w',
  countDiverse: 'Teilnehmende d',
  countTotal: 'Teilnehmende gesamt',
  notes: 'Notizen',
  goals: 'Ziele',
  categories: 'Kategorien',
  tags: 'Tags',
  staff: 'Mitarbeitende',
  cohorts: 'Kohorten',
};

const ACTIVITY_AUDIT_TYPE_LABELS: Record<string, string> = {
  open_door: 'Offene Tür',
  project_open: 'Projekt (offen)',
  project_closed: 'Projekt (geschlossen)',
  event: 'Veranstaltung',
  outreach: 'Aufsuchend',
};

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  activity: 'Aktivität',
  project: 'Projekt',
  tag: 'Tag',
  category: 'Kategorie',
  cohort: 'Kohorte',
  auth: 'Anmeldung',
  user: 'Benutzer',
  staff: 'Mitarbeiter',
  location: 'Einrichtung',
  organization: 'Organisation',
  project_template: 'Vorlage',
};

const RECENT_ACTIONS_PER_GROUP = 10;
const RECENT_ACTION_FETCH_LIMIT = 25;

const AUDIT_ACTION_PRESENTATION: Record<
  AuditLogAction,
  {
    label: string;
    emptyState: string;
    icon: typeof LogIn;
    iconClassName: string;
    summary: string;
  }
> = {
  login: {
    label: 'Anmeldungen',
    emptyState: 'Noch keine Anmeldungen im Feed.',
    icon: LogIn,
    iconClassName: 'text-sky-600',
    summary: 'Die neuesten Login-Events, separat von Inhaltsänderungen.',
  },
  create: {
    label: 'Neu angelegt',
    emptyState: 'Noch keine neuen Einträge im Feed.',
    icon: PlusCircle,
    iconClassName: 'text-green-600',
    summary: 'Neu angelegte Inhalte und Datensätze.',
  },
  update: {
    label: 'Bearbeitet',
    emptyState: 'Noch keine Bearbeitungen im Feed.',
    icon: Pencil,
    iconClassName: 'text-blue-600',
    summary: 'Aktualisierte Inhalte inklusive Feldänderungen.',
  },
  delete: {
    label: 'Gelöscht',
    emptyState: 'Noch keine Löschungen im Feed.',
    icon: Trash2,
    iconClassName: 'text-red-500',
    summary: 'Entfernte Datensätze und Inhalte.',
  },
};

const AUDIT_ACTION_ORDER: AuditLogAction[] = ['login', 'create', 'update', 'delete'];

function filterDuplicateAuditEntries(items: AuditLog[]) {
  const seenKeyWithUser = new Set<string>();
  for (const entry of items) {
    const key = `${entry.action}:${entry.entityType}:${entry.entityId}`;
    if (entry.userName) seenKeyWithUser.add(key);
  }

  return items.filter((entry) => {
    const key = `${entry.action}:${entry.entityType}:${entry.entityId}`;
    return !(!entry.userName && seenKeyWithUser.has(key));
  });
}

function formatAuditDiffLabel(entityType: string, key: string) {
  if (entityType === 'activity') return ACTIVITY_AUDIT_FIELD_LABELS[key] || key;
  return key;
}

function formatAuditDiffValue(entityType: string, key: string, value: unknown): string {
  if (Array.isArray(value)) {
    const items = value
      .map((entry) => formatAuditDiffValue(entityType, key, entry))
      .filter((entry) => entry !== '—');
    return items.length > 0 ? items.join(', ') : '—';
  }
  if (value === null || typeof value === 'undefined' || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('de-DE') : '—';
  if (entityType === 'activity' && key === 'type' && typeof value === 'string') {
    return ACTIVITY_AUDIT_TYPE_LABELS[value] || value;
  }
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function Dashboard() {
  const { openQuickTally } = useOutletContext<{ openQuickTally: () => void }>();
  const scopeKey = useOrgScopeKey();
  const { scope } = useOrgScope();
  const { user } = useAuth();
  const { data: publicConfig } = usePublicConfig();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [picker, setPicker] = useState(false);
  const [quickAdd, setQuickAdd] = useState<{ project: Project } | null>(null);
  const { data: summary } = useMonthSummary(year, month, scopeKey, {
    refetchOnWindowFocus: 'always',
    refetchIntervalMs: publicConfig?.liveRefreshIntervalMs,
  });
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  useActivities({ from, to });
  const { data: audit } = useAuditLogs(50, {
    refetchOnWindowFocus: 'always',
    refetchIntervalMs: publicConfig?.liveRefreshIntervalMs,
  });
  const auditRealtimeOptions = useMemo(
    () => ({
      refetchOnWindowFocus: 'always' as const,
      refetchIntervalMs: publicConfig?.liveRefreshIntervalMs,
    }),
    [publicConfig?.liveRefreshIntervalMs],
  );
  const { data: loginAudit = [] } = useAuditLogs(RECENT_ACTION_FETCH_LIMIT, {
    ...auditRealtimeOptions,
    actions: ['login'],
  });
  const { data: createAudit = [] } = useAuditLogs(RECENT_ACTION_FETCH_LIMIT, {
    ...auditRealtimeOptions,
    actions: ['create'],
  });
  const { data: updateAudit = [] } = useAuditLogs(RECENT_ACTION_FETCH_LIMIT, {
    ...auditRealtimeOptions,
    actions: ['update'],
  });
  const { data: deleteAudit = [] } = useAuditLogs(RECENT_ACTION_FETCH_LIMIT, {
    ...auditRealtimeOptions,
    actions: ['delete'],
  });
  const [exportOpen, setExportOpen] = useState(false);
  const { session: activeQuickTallySession } = useQuickTallySession();
  const [orgMap, setOrgMap] = useState<Record<string, string>>({});
  const [expandedRecentActionGroups, setExpandedRecentActionGroups] = useState<Record<AuditLogAction, boolean>>({
    login: false,
    create: false,
    update: false,
    delete: false,
  });
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

  const recentActionGroups = useMemo(() => {
    const auditByAction: Record<AuditLogAction, AuditLog[]> = {
      login: loginAudit,
      create: createAudit,
      update: updateAudit,
      delete: deleteAudit,
    };

    return AUDIT_ACTION_ORDER.map((action) => {
      const deduplicatedItems = filterDuplicateAuditEntries(auditByAction[action]);
      return {
        action,
        items: deduplicatedItems.slice(0, RECENT_ACTIONS_PER_GROUP),
        visibleCount: Math.min(deduplicatedItems.length, RECENT_ACTIONS_PER_GROUP),
        presentation: AUDIT_ACTION_PRESENTATION[action],
      };
    });
  }, [createAudit, deleteAudit, loginAudit, updateAudit]);
  const hasRecentActionEntries = recentActionGroups.some((group) => group.items.length > 0);

  const fmt = (n?: number) => (typeof n === 'number' ? n.toLocaleString('de-DE') : '0');
  // keep date helpers only where needed; recent actions use locale string

  // Build Daily Log: last 5 activities in the last 14 days that have notes and/or tags
  const nowISO = new Date();
  const fourteenDaysAgo = new Date(nowISO.getTime() - 14 * 24 * 60 * 60 * 1000);
  const from14 = `${fourteenDaysAgo.getFullYear()}-${String(fourteenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(fourteenDaysAgo.getDate()).padStart(2, '0')}`;
  const toToday = `${nowISO.getFullYear()}-${String(nowISO.getMonth() + 1).padStart(2, '0')}-${String(nowISO.getDate()).padStart(2, '0')}`;
  const { data: activitiesMonth = [], refetch: refetchDailyLogActivities } = useActivities(
    { from: from14, to: toToday },
    {
      refetchOnWindowFocus: 'always',
      refetchIntervalMs: publicConfig?.liveRefreshIntervalMs,
    },
  );
  const activityAuditRefreshKey = useMemo(
    () =>
      (audit || [])
        .filter((entry) => entry.entityType === 'activity')
        .map((entry) => `${entry.id}:${entry.createdAt}:${entry.action}`)
        .join('|'),
    [audit],
  );
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

  useEffect(() => {
    if (!activityAuditRefreshKey) return;
    void refetchDailyLogActivities();
  }, [activityAuditRefreshKey, refetchDailyLogActivities]);

  const toggleRecentActionGroup = (action: AuditLogAction) => {
    setExpandedRecentActionGroups((current) => ({
      ...current,
      [action]: !current[action],
    }));
  };

  const renderRecentActionEntry = (entry: AuditLog) => {
    const who = entry.userName || 'Jemand';
    const what = AUDIT_ENTITY_LABELS[entry.entityType] || entry.entityType;
    const title = entry.entityTitle ? ` „${entry.entityTitle}“` : '';
    const when = new Date(entry.createdAt).toLocaleString('de-DE');
    const ackDone =
      entry.entityType === 'activity' &&
      entry.action === 'update' &&
      typeof (entry.details as { ackDone?: unknown } | null | undefined)?.ackDone === 'boolean'
        ? Boolean((entry.details as { ackDone?: boolean }).ackDone)
        : null;
    const verb =
      entry.action === 'login'
        ? 'angemeldet'
        : entry.action === 'create'
          ? 'angelegt'
          : ackDone !== null
            ? ackDone
              ? 'als besprochen markiert'
              : 'als unbesprochen markiert'
            : entry.action === 'update'
              ? 'bearbeitet'
              : 'gelöscht';
    const orgName = entry.orgName || (entry.orgId ? orgMap[entry.orgId] : undefined);
    const titleLine =
      entry.action === 'login'
        ? `${who} hat sich angemeldet.`
        : `${who} hat ${what}${title} ${verb}.`;

    return (
      <div key={entry.id} className="recent-actions-entry rounded-lg px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="min-w-0">
          <h4 className="recent-actions-entry-title font-semibold">{titleLine}</h4>
          <p className="recent-actions-entry-meta text-xs">{when}</p>
          {entry.action === 'login' && entry.entityTitle && (
            <span className="recent-actions-chip mt-1 inline-block rounded px-1.5 py-0.5 text-[11px]">
              Account: {entry.entityTitle}
            </span>
          )}
          {orgName && (
            <span className="recent-actions-chip mt-1 ml-0 inline-block rounded px-1.5 py-0.5 text-[11px] sm:ml-1">
              Organisation: {orgName}
            </span>
          )}
          {entry.diff && Object.keys(entry.diff).length > 0 && (
            <ul className="recent-actions-diff mt-2 list-disc space-y-0.5 pl-5 text-sm">
              {Object.entries(
                entry.diff as Record<string, { from: unknown; to: unknown }>,
              ).map(([key, value]) => (
                <li key={key}>
                  <span className="font-medium">{formatAuditDiffLabel(entry.entityType, key)}:</span>{' '}
                  {formatAuditDiffValue(entry.entityType, key, value.from)} →{' '}
                  {formatAuditDiffValue(entry.entityType, key, value.to)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

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
      </div>

      {/* Today's Opening Hours */}
      {openingHours && (
        <div className="dashboard-accent-panel rounded-xl p-4 mb-6 flex items-center gap-3">
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

      <CustomKpiCards
        surface="dashboard"
        from={from}
        to={to}
        className="mb-8"
        refreshOptions={{
          refetchOnWindowFocus: 'always',
          refetchIntervalMs: publicConfig?.liveRefreshIntervalMs,
        }}
      />

      {/* Quick Tally - Daily Attendance Counter */}
      {/* Show start button only when no active session */}
      {!activeQuickTallySession && (
        <DemoHoverHint
          title="Tageserfassung"
          description="Startet eine schnelle Anwesenheitserfassung fuer den laufenden Tag. Ideal, wenn Teilnehmende direkt am Tablet mitgezaehlt werden."
          placement="bottom"
        >
          <div className="dashboard-accent-panel rounded-2xl p-6 mb-8">
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
                className="dashboard-accent-button px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <Users className="w-5 h-5" />
                Erfassung starten
              </button>
            </div>
          </div>
        </DemoHoverHint>
      )}

      {/* Quick Actions */}
      <DemoHoverHint
        title="Schnellzugriff"
        description="Fuehrt zu den wichtigsten Demo-Workflows: neue Aktivitaet anlegen, Auswertungen ansehen oder Daten exportieren."
      >
        <div className="modern-card p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Schnellzugriff</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              className="dashboard-accent-solid-button px-6 py-3 rounded-xl font-medium"
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
              onMouseEnter={preloadExportModal}
              onFocus={preloadExportModal}
            >
              Daten exportieren
            </button>
          </div>
        </div>
      </DemoHoverHint>

      {/* Daily Log */}
      <DemoHoverHint
        title="Daily Log"
        description="Zeigt aktuelle Aktivitaeten mit Notizen oder Tags. So lassen sich offene Ruecksprachen und auffaellige Eintraege schnell nachhalten."
      >
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
      </DemoHoverHint>

      {/* Recent Actions */}
      <DemoHoverHint
        title="Letzte Aktionen"
        description="Fasst Login-, Anlage-, Bearbeitungs- und Loeschereignisse zusammen. Die Gruppen lassen sich aufklappen, um Details der Demo-Daten zu sehen."
      >
        <div className="modern-card p-4 sm:p-6">
          <h3 className="mb-3 text-lg font-bold text-gray-800 sm:mb-4 sm:text-xl">Letzte Aktionen</h3>
          <div className="space-y-3">
            {recentActionGroups.map((group) => {
              const GroupIcon = group.presentation.icon;
              const expanded = expandedRecentActionGroups[group.action];

              return (
                <section key={group.action} className="recent-actions-group">
                  <button
                    type="button"
                    className="recent-actions-group-header flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors sm:px-5"
                    onClick={() => toggleRecentActionGroup(group.action)}
                    aria-expanded={expanded}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="recent-actions-icon-shell inline-flex rounded-xl p-2.5">
                        <GroupIcon className={`h-5 w-5 ${group.presentation.iconClassName}`} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[color:var(--text-primary)]">
                          {group.presentation.label}
                        </span>
                        <span className="recent-actions-group-kicker block truncate text-xs">
                          {group.presentation.summary}
                        </span>
                      </span>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="recent-actions-group-count inline-flex rounded-full px-2.5 py-1 text-xs font-medium">
                        {group.visibleCount}
                      </span>
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-[color:var(--text-muted)]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[color:var(--text-muted)]" />
                      )}
                    </span>
                  </button>

                  {expanded && (
                    <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                      {group.items.length === 0 ? (
                        <div className="recent-actions-empty px-2 py-2 text-sm">
                          {group.presentation.emptyState}
                        </div>
                      ) : (
                        <div className="space-y-2.5 sm:space-y-3">
                          {group.items.map(renderRecentActionEntry)}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
            {!hasRecentActionEntries && (
              <div className="recent-actions-empty text-sm">Noch keine Aktionen vorhanden.</div>
            )}
          </div>
        </div>
      </DemoHoverHint>

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
        <Suspense
          fallback={
            <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Daten exportieren" maxWidth="md">
              <div className="py-6 text-sm text-gray-600">Exportmodul wird geladen…</div>
            </Modal>
          }
        >
          <ExportModal
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            initialFrom={from}
            initialTo={to}
          />
        </Suspense>
      )}
    </div>
  );
}
