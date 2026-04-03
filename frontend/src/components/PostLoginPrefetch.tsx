import { useEffect, useRef, useState } from 'react';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOrgScope, useOrgScopeKey } from '@/lib/orgScope';
import type { ActivitiesFilter, PagedActivitiesResult } from '@/lib/activities';
import type { Project } from '@/lib/projects';
import LoadingOverlay from '@/components/LoadingOverlay';
import { addDevMetricEvent, finishDevFlow, markDevFlow, startDevFlow } from '@/lib/devMetrics';

function readActivitiesPrefetchParams(): { params: ActivitiesFilter; page: number; limit: number } {
  const page = 1;
  const limit = 50;

  let advanced: ActivitiesFilter = {};
  let order: 'asc' | 'desc' = 'desc';

  try {
    const raw = localStorage.getItem('activities:advancedFilters:v1');
    const parsed = raw ? (JSON.parse(raw) as unknown) : undefined;
    if (parsed && typeof parsed === 'object') advanced = parsed as ActivitiesFilter;
  } catch {
    /* ignore */
  }

  try {
    const raw = localStorage.getItem('activities:order:v1');
    if (raw === 'asc' || raw === 'desc') order = raw;
  } catch {
    /* ignore */
  }

  return { params: { ...advanced, order }, page, limit };
}

async function fetchProjects(params?: { search?: string; archived?: boolean }) {
  const res = await api.get('/projects', { params });
  return res.data as Project[];
}

async function fetchActivitiesPaged(params: ActivitiesFilter | undefined, page: number, limit: number) {
  const qp: Record<string, unknown> = { ...params };
  const arrayKeys: (keyof ActivitiesFilter)[] = [
    'types',
    'locationIds',
    'projectIds',
    'categoryIds',
    'tagIds',
    'cohortIds',
  ];
  for (const k of arrayKeys) {
    const v = params?.[k];
    if (Array.isArray(v) && v.length) qp[k as string] = (v as string[]).join(',');
    else if (Array.isArray(v)) delete qp[k as string];
  }
  qp.page = page;
  qp.limit = Math.min(Math.max(limit, 1), 50);
  const res = await api.get('/activities', { params: qp });
  return res.data as PagedActivitiesResult;
}

async function fetchStats<T>(path: string, params: { from?: string; to?: string; projectId?: string }) {
  const res = await api.get(path, { params });
  return res.data as T;
}

export default function PostLoginPrefetch({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { scope, switching } = useOrgScope();
  const scopeKey = useOrgScopeKey();
  const qc = useQueryClient();
  const isRestoring = useIsRestoring();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string>('Daten werden vorbereitet…');
  const [progress, setProgress] = useState<{ current: number; total: number } | undefined>(undefined);
  const didRunKeyRef = useRef<string>('');
  const runIdRef = useRef(0);
  const lastScopeKeyRef = useRef<string>('');
  const wasSwitchingRef = useRef(false);

  useEffect(() => {
    // Reset per-user so switching accounts runs prefetch again.
    didRunKeyRef.current = '';
    lastScopeKeyRef.current = '';
  }, [user?.id]);

  // Track switching state to trigger prefetch when switching completes
  useEffect(() => {
    if (wasSwitchingRef.current && !switching) {
      // Switching just completed - reset to trigger prefetch with new scope
      didRunKeyRef.current = '';
    }
    wasSwitchingRef.current = switching;
  }, [switching]);

  // Show initializer overlay immediately when an org switch starts.
  useEffect(() => {
    if (!user) return;
    if (switching) {
      setOpen(true);
      setMessage('Organisation wird gewechselt…');
      setProgress(undefined);
    }
  }, [switching, user?.id]);

  // Also reset when scopeKey changes (org switch) to re-run prefetch
  useEffect(() => {
    if (lastScopeKeyRef.current && lastScopeKeyRef.current !== scopeKey) {
      // Org was switched - reset so prefetch runs again
      didRunKeyRef.current = '';
    }
    lastScopeKeyRef.current = scopeKey;
  }, [scopeKey]);

  useEffect(() => {
    if (!user) return;
    if (isRestoring) return;
    // Wait for org switching to complete before running prefetch,
    // but keep the overlay open while switching.
    if (switching) return;
    const scopeForKey = typeof scope === 'undefined' ? 'GLOBAL' : scope === null ? 'NULL' : scope;
    const runKey = `${user.id}:${scopeForKey}`;
    if (didRunKeyRef.current === runKey) return;

    didRunKeyRef.current = runKey;
    const runId = ++runIdRef.current;
    let cancelled = false;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to = new Date(year, month, 0);
    const toISO = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(
      to.getDate(),
    ).padStart(2, '0')}`;

    // Use scopeKey in all query keys for proper cache isolation per org
    const dashboardMonthSummaryKey = [
      'stats:summary',
      scopeKey,
      from,
      toISO,
      '',
    ] as const;

    const { params: activitiesParams, page: activitiesPage, limit: activitiesLimit } =
      readActivitiesPrefetchParams();
    const activitiesFirstPageKey = [
      'activities',
      scopeKey,
      'paged',
      activitiesParams,
      activitiesPage,
      activitiesLimit,
    ] as const;

    // Check cached data using scope-aware keys
    const hasProjects = qc.getQueryState(['projects', scopeKey, undefined])?.status === 'success';
    const hasDashboardMonthSummary = qc.getQueryState(dashboardMonthSummaryKey)?.status === 'success';
    const hasBaseStatsSummary = qc.getQueryState(['stats:summary', scopeKey, '', '', ''])?.status === 'success';
    const hasBaseStatsByType = qc.getQueryState(['stats:by-type', scopeKey, '', '', ''])?.status === 'success';
    const hasBaseStatsGender = qc.getQueryState(['stats:gender', scopeKey, '', '', ''])?.status === 'success';
    const hasBaseStatsTimeseries =
      qc.getQueryState(['stats:participants-timeseries', scopeKey, '', '', ''])?.status === 'success';
    const hasBaseStatsByCohort = qc.getQueryState(['stats:by-cohort', scopeKey, '', '', ''])?.status === 'success';
    const hasBaseStatsByCategory =
      qc.getQueryState(['stats:by-category', scopeKey, '', '', ''])?.status === 'success';

    const hasActivitiesFirstPage = qc.getQueryState(activitiesFirstPageKey)?.status === 'success';

    const needsBlockingWarmup =
      !hasProjects ||
      !hasDashboardMonthSummary ||
      !hasBaseStatsSummary ||
      !hasBaseStatsByType ||
      !hasBaseStatsGender ||
      !hasBaseStatsTimeseries ||
      !hasBaseStatsByCohort ||
      !hasBaseStatsByCategory ||
      !hasActivitiesFirstPage;

    (async () => {
      try {
        if (needsBlockingWarmup) {
          const flowId = startDevFlow('post-login-prefetch', {
            scopeKey,
            userId: user.id,
            from,
            to: toISO,
          });
          setOpen(true);
          setMessage('Daten werden geladen…');
          setProgress(undefined);

          // Run ALL prefetches in parallel for maximum performance
          const allTasks: Array<{ label: string; promise: Promise<unknown> }> = [];

          // Projects
          if (!hasProjects) {
            allTasks.push({
              label: 'projects:list',
              promise: qc.prefetchQuery({
                queryKey: ['projects', scopeKey, undefined],
                queryFn: () => fetchProjects(undefined),
              }),
            });
          }

          // Base stats (all 6 endpoints)
          const baseStatsParams = { from: undefined, to: undefined, projectId: undefined } as const;
          if (!hasBaseStatsSummary)
            allTasks.push({
              label: 'stats:summary',
              promise: qc.prefetchQuery({
                queryKey: ['stats:summary', scopeKey, '', '', ''],
                queryFn: () => fetchStats('/stats/summary', baseStatsParams),
              }),
            });
          if (!hasBaseStatsByType)
            allTasks.push({
              label: 'stats:by-type',
              promise: qc.prefetchQuery({
                queryKey: ['stats:by-type', scopeKey, '', '', ''],
                queryFn: () => fetchStats('/stats/by-type', baseStatsParams),
              }),
            });
          if (!hasBaseStatsGender)
            allTasks.push({
              label: 'stats:gender',
              promise: qc.prefetchQuery({
                queryKey: ['stats:gender', scopeKey, '', '', ''],
                queryFn: () => fetchStats('/stats/gender', baseStatsParams),
              }),
            });
          if (!hasBaseStatsTimeseries)
            allTasks.push({
              label: 'stats:participants-timeseries',
              promise: qc.prefetchQuery({
                queryKey: ['stats:participants-timeseries', scopeKey, '', '', ''],
                queryFn: () => fetchStats('/stats/participants-timeseries', baseStatsParams),
              }),
            });
          if (!hasBaseStatsByCohort)
            allTasks.push({
              label: 'stats:by-cohort',
              promise: qc.prefetchQuery({
                queryKey: ['stats:by-cohort', scopeKey, '', '', ''],
                queryFn: () => fetchStats('/stats/by-cohort', baseStatsParams),
              }),
            });
          if (!hasBaseStatsByCategory)
            allTasks.push({
              label: 'stats:by-category',
              promise: qc.prefetchQuery({
                queryKey: ['stats:by-category', scopeKey, '', '', ''],
                queryFn: () => fetchStats('/stats/by-category', baseStatsParams),
              }),
            });

          // Dashboard month summary
          if (!hasDashboardMonthSummary)
            allTasks.push({
              label: 'stats:summary:month',
              promise: qc.prefetchQuery({
                queryKey: dashboardMonthSummaryKey,
                queryFn: () => fetchStats('/stats/summary', { from, to: toISO, projectId: undefined }),
              }),
            });

          // Activities first page
          if (!hasActivitiesFirstPage) {
            allTasks.push({
              label: 'activities:paged:first-page',
              promise: qc.prefetchQuery({
                queryKey: activitiesFirstPageKey,
                queryFn: () => fetchActivitiesPaged(activitiesParams, activitiesPage, activitiesLimit),
              }),
            });
          }

          // Progress tracking
          const total = allTasks.length;
          setProgress(total > 0 ? { current: 0, total } : undefined);

          let done = 0;
          const tracked = allTasks.map(({ label, promise }) => {
            const taskStartedAt = performance.now();
            return promise.finally(() => {
              done += 1;
              markDevFlow(flowId, label, {
                durationMs: Math.round((performance.now() - taskStartedAt) * 10) / 10,
                completed: done,
                total,
              });
              if (!cancelled && runIdRef.current === runId) {
                setProgress({ current: done, total });
                setMessage(`Daten werden geladen… (${done}/${total})`);
              }
            });
          });

          // Wait for all parallel requests
          await Promise.allSettled(tracked);
          finishDevFlow(flowId, 'success', {
            totalTasks: total,
            completedTasks: done,
          });
        } else {
          addDevMetricEvent({
            kind: 'flow',
            status: 'info',
            name: 'post-login-prefetch',
            message: 'Warmup skipped because relevant data was already cached.',
            meta: { scopeKey, userId: user.id },
          });
        }
      } catch {
        addDevMetricEvent({
          kind: 'flow',
          status: 'error',
          name: 'post-login-prefetch',
          message: 'Warmup failed unexpectedly.',
          meta: { scopeKey, userId: user.id },
        });
        // Never block the app if prefetch fails — UI will load normally.
      } finally {
        // Always close the overlay for the latest run.
        if (!cancelled && runIdRef.current === runId) {
          setOpen(false);
          setProgress(undefined);
        }
      }
    })();

    return () => {
      cancelled = true;
      // If a newer run starts (e.g., org scope hydrates/changes), ensure the old overlay doesn't stay stuck open.
      if (runIdRef.current === runId) {
        setOpen(false);
        setProgress(undefined);
      }
    };
  }, [user?.id, isRestoring, qc, scope, scopeKey, switching]);

  return (
    <>
      {children}
      <LoadingOverlay open={open} title="Initialisiere StatO…" message={message} progress={progress} />
    </>
  );
}
