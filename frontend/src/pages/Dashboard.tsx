import { Suspense, lazy, useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useActivities } from '@/lib/activities';
import { useAuditLogs, type AuditLog, type AuditLogAction } from '@/lib/audit';
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
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
  MessageCircle,
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
import CustomKpiCards from '@/components/CustomKpiCards';
import { useLogbookEntries } from '@/lib/logbook';
import ProtectedImage from '@/components/ProtectedImage';
import LogbookStatusBadge from '@/components/LogbookStatusBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { formatDate, formatNumber } from '@/i18n/formatters';
import { autoT } from '@/i18n/auto';

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
          orgId: typeof scope === 'undefined' ? undefined : scope === null ? 'null' : scope,
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

const RECENT_ACTIONS_PER_GROUP = 10;
const RECENT_ACTION_FETCH_LIMIT = 25;

const AUDIT_ACTION_STYLE: Record<
  AuditLogAction,
  {
    icon: typeof LogIn;
    iconClassName: string;
  }
> = {
  login: { icon: LogIn, iconClassName: 'text-sky-600' },
  create: { icon: PlusCircle, iconClassName: 'text-green-600' },
  update: { icon: Pencil, iconClassName: 'text-blue-600' },
  delete: { icon: Trash2, iconClassName: 'text-red-500' },
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

function formatAuditDiffLabel(entityType: string, key: string, t: TFunction) {
  if (entityType === 'activity') return t(`fields.${key}`, { defaultValue: key });
  return key;
}

function formatAuditDiffValue(entityType: string, key: string, value: unknown, t: TFunction): string {
  if (Array.isArray(value)) {
    const items = value
      .map((entry) => formatAuditDiffValue(entityType, key, entry, t))
      .filter((entry) => entry !== '—');
    return items.length > 0 ? items.join(', ') : '—';
  }
  if (value === null || typeof value === 'undefined' || value === '') return '—';
  if (typeof value === 'boolean') return value ? t('yes') : t('no');
  if (typeof value === 'number')
    return Number.isFinite(value) ? formatNumber(value) : '—';
  if (entityType === 'activity' && key === 'type' && typeof value === 'string') {
    return t(`activities:types.${value}`, { defaultValue: value });
  }
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function Dashboard() {
  const { t } = useTranslation(['dashboard', 'activities']);
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
  const [expandedRecentActionGroups, setExpandedRecentActionGroups] = useState<
    Record<AuditLogAction, boolean>
  >({
    login: false,
    create: false,
    update: false,
    delete: false,
  });
  // Determine effective orgId for opening hours
  const effectiveOrgId =
    user?.role === 'superadmin'
      ? typeof scope === 'string'
        ? scope
        : null
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
    const dayKeys: (keyof OpeningHours)[] = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
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

  const auditActionPresentation = {
    login: { ...AUDIT_ACTION_STYLE.login, label: t('recent.groups.login.label'), emptyState: t('recent.groups.login.empty'), summary: t('recent.groups.login.summary') },
    create: { ...AUDIT_ACTION_STYLE.create, label: t('recent.groups.create.label'), emptyState: t('recent.groups.create.empty'), summary: t('recent.groups.create.summary') },
    update: { ...AUDIT_ACTION_STYLE.update, label: t('recent.groups.update.label'), emptyState: t('recent.groups.update.empty'), summary: t('recent.groups.update.summary') },
    delete: { ...AUDIT_ACTION_STYLE.delete, label: t('recent.groups.delete.label'), emptyState: t('recent.groups.delete.empty'), summary: t('recent.groups.delete.summary') },
  };
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
        presentation: auditActionPresentation[action],
      };
    });
  }, [createAudit, deleteAudit, loginAudit, t, updateAudit]);
  const hasRecentActionEntries = recentActionGroups.some((group) => group.items.length > 0);

  const fmt = (n?: number) => (typeof n === 'number' ? formatNumber(n) : '0');
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
  const { data: logbookData } = useLogbookEntries({}, 1, 4);
  const recentLogbookEntries = logbookData?.data || [];
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
    const who = entry.userName || t('recent.someone');
    const what = t(`entities.${entry.entityType}`, { defaultValue: entry.entityType });
    const title = entry.entityTitle ? ` „${entry.entityTitle}“` : '';
    const when = formatDate(entry.createdAt, { dateStyle: 'medium', timeStyle: 'short' });
    const ackDone =
      entry.entityType === 'activity' &&
      entry.action === 'update' &&
      typeof (entry.details as { ackDone?: unknown } | null | undefined)?.ackDone === 'boolean'
        ? Boolean((entry.details as { ackDone?: boolean }).ackDone)
        : null;
    const verb =
      entry.action === 'login'
        ? ''
        : entry.action === 'create'
          ? t('recent.verbs.create')
          : ackDone !== null
            ? ackDone
              ? t('recent.verbs.discussed')
              : t('recent.verbs.undiscussed')
            : entry.action === 'update'
              ? t('recent.verbs.update')
              : t('recent.verbs.delete');
    const orgName = entry.orgName || (entry.orgId ? orgMap[entry.orgId] : undefined);
    const titleLine =
      entry.action === 'login'
        ? t('recent.loginSentence', { who })
        : t('recent.actionSentence', { who, what, title, verb });

    return (
      <div key={entry.id} className="recent-actions-entry rounded-lg px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="min-w-0">
          <h4 className="recent-actions-entry-title font-semibold">{titleLine}</h4>
          <p className="recent-actions-entry-meta text-xs">{when}</p>
          {entry.action === 'login' && entry.entityTitle && (
            <span className="recent-actions-chip mt-1 inline-block rounded px-1.5 py-0.5 text-[11px]">
              {t('recent.account', { name: entry.entityTitle })}
            </span>
          )}
          {orgName && (
            <span className="recent-actions-chip mt-1 ml-0 inline-block rounded px-1.5 py-0.5 text-[11px] sm:ml-1">
              {t('recent.organization', { name: orgName })}
            </span>
          )}
          {entry.diff && Object.keys(entry.diff).length > 0 && (
            <ul className="recent-actions-diff mt-2 list-disc space-y-0.5 pl-5 text-sm">
              {Object.entries(entry.diff as Record<string, { from: unknown; to: unknown }>).map(
                ([key, value]) => (
                  <li key={key}>
                    <span className="font-medium">
                      {formatAuditDiffLabel(entry.entityType, key, t)}:
                    </span>{' '}
                    {formatAuditDiffValue(entry.entityType, key, value.from, t)} →{' '}
                    {formatAuditDiffValue(entry.entityType, key, value.to, t)}
                  </li>
                ),
              )}
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
      <PageHeader title={t('title')} />

      {/* Today's Opening Hours */}
      {openingHours && (
        <div className="dashboard-accent-panel rounded-xl p-4 mb-6 flex items-center gap-3">
          <Clock className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">
            {t('today')}:{' '}
            {todayOpeningHours?.open
              ? `${todayOpeningHours.from || '–'} – ${todayOpeningHours.to || '–'}${t('clockSuffix') ? ` ${t('clockSuffix')}` : ''}`
              : t('closed')}
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="kpi-card">
          <h3 className="text-sm text-gray-500 font-medium mb-2">{t('kpis.activities')}</h3>
          <p className="text-3xl font-bold text-gray-800">{fmt(summary?.totalActivities)}</p>
        </div>

        <div className="kpi-card">
          <h3 className="text-sm text-gray-500 font-medium mb-2">{t('kpis.participants')}</h3>
          <p className="text-3xl font-bold text-gray-800">{fmt(summary?.totalParticipants)}</p>
        </div>

        <div className="kpi-card">
          <h3 className="text-sm text-gray-500 font-medium mb-2">{t('kpis.average')}</h3>
          <p className="text-3xl font-bold text-gray-800">
            {typeof summary?.averageParticipants === 'number' ? formatNumber(summary.averageParticipants) : autoT('ui_b6589fc6ab0d')}
          </p>
        </div>

        <div className="kpi-card">
          <h3 className="text-sm text-gray-500 font-medium mb-2">{t('kpis.hours')}</h3>
          <p className="text-3xl font-bold text-gray-800">
            {typeof summary?.totalHours === 'number' ? formatNumber(summary.totalHours) : autoT('ui_b6589fc6ab0d')}
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
        <div className="dashboard-accent-panel rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{t('tally.title')}</h3>
                <p className="text-white/80 text-sm">{t('tally.subtitle')}</p>
              </div>
            </div>
            <button
              onClick={openQuickTally}
              className="dashboard-accent-button px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" />
              {t('tally.start')}
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <SurfaceCard className="mb-8">
        <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">{t('quick.title')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            className="w-full"
            onClick={() => {
              const dateISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              if (isMobile) {
                navigate(`/activities/new/select-project?date=${encodeURIComponent(dateISO)}`);
              } else {
                setPicker(true);
              }
            }}
          >
            {t('quick.activity')}
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => navigate('/statistics')}
          >
            {t('quick.statistics')}
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => setExportOpen(true)}
            onMouseEnter={preloadExportModal}
            onFocus={preloadExportModal}
          >
            {t('quick.export')}
          </Button>
        </div>
      </SurfaceCard>

      <SurfaceCard className="mb-8" padding="md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('logbook.title')}</h3>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/logbook/new')}
          >
            <Plus className="h-4 w-4" />
            {t('logbook.entry')}
          </Button>
        </div>
        {recentLogbookEntries.length === 0 ? (
          <EmptyState
            className="py-6"
            description={t('logbook.emptyDescription')}
            title={t('logbook.emptyTitle')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {recentLogbookEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => navigate(`/logbook?entry=${encodeURIComponent(entry.id)}`)}
                className="dashboard-logbook-entry rounded-xl p-4 text-left"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold text-gray-800">{entry.title}</span>
                    <span
                      className="flex shrink-0 items-center text-xs text-gray-500"
                      title={formatDate(entry.occurredAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    >
                      <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                      {formatDate(entry.occurredAt, {
                        weekday: 'long',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  </div>
                  <LogbookStatusBadge className="shrink-0" status={entry.status} />
                </div>
                <p className="line-clamp-2 text-sm text-gray-600">{entry.body}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {entry.createdByUser?.avatarUrl && (
                      <span className="flex h-5 w-5 shrink-0 overflow-hidden rounded-full bg-viridian/10">
                        <ProtectedImage
                          src={entry.createdByUser.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </span>
                    )}
                    <span className="truncate">{entry.createdByName}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {entry.commentCount || 0}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate('/logbook')}
          className="mt-4 text-sm font-semibold text-viridian hover:underline"
        >
          {t('logbook.showAll')}
        </button>
      </SurfaceCard>

      {/* Daily Log */}
      <div className="modern-card p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {t('daily.title')}
          <span className="ml-2 text-xs text-gray-400 font-normal">{t('daily.period')}</span>
        </h3>
        {dailyLog.length === 0 ? (
          <div className="text-gray-500">
            {t('daily.empty')}
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
                      title={formatDate(item.createdAt || '', { dateStyle: 'medium', timeStyle: 'short' })}
                    >
                      <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                      {(() => {
                        const d = new Date(item.createdAt || '');
                        return formatDate(d, {
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
                      className={`p-1.5 rounded-full transition-all duration-200 ${doneMap[item.id] ? "bg-accent-green/10 text-accent-green" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                      title={
                        doneMap[item.id] ? t('daily.markUndiscussed') : t('daily.markDiscussed')
                      }
                      aria-label={
                        doneMap[item.id] ? t('daily.markUndiscussed') : t('daily.markDiscussed')
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
                      open_door: t('activities:types.open_door'),
                      project_open: t('activities:types.project_open'),
                      project_closed: t('activities:types.project_closed'),
                      event: t('activities:types.event'),
                      outreach: t('activities:types.outreach'),
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
                    <span className="inline-block text-gray-600">{t('daily.project', { name: item.project })}</span>
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
      <div className="modern-card p-4 sm:p-6">
        <h3 className="mb-3 text-lg font-bold text-gray-800 sm:mb-4 sm:text-xl">{t('recent.title')}</h3>
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
            <div className="recent-actions-empty text-sm">{t('recent.empty')}</div>
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
        <Suspense
          fallback={
            <Modal
              open={exportOpen}
              onClose={() => setExportOpen(false)}
              title={t('quick.export')}
              maxWidth="md"
            >
              <div className="py-6 text-sm text-gray-600">{t('exportLoading')}</div>
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
