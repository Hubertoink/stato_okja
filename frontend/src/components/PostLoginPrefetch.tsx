import { useEffect, useRef, useState } from 'react';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOrgScope, useOrgScopeKey } from '@/lib/orgScope';
import type { ActivitiesFilter, PagedActivitiesResult } from '@/lib/activities';
import type { Project } from '@/lib/projects';
import LoadingOverlay from '@/components/LoadingOverlay';
import DemoSplashScreen from '@/demo/DemoSplashScreen';
import { demoModeEnabled } from '@/demo/config';
import { addDevMetricEvent, finishDevFlow, markDevFlow, startDevFlow } from '@/lib/devMetrics';
import { getActivitiesPrefetchParams } from '@/lib/activitiesFilterStorage';
import { autoT } from '@/i18n/auto';

async function fetchProjects(params?: { search?: string; archived?: boolean }) {
  const res = await api.get('/projects', { params });
  return res.data as Project[];
}

async function fetchActivitiesPaged(
  params: ActivitiesFilter | undefined,
  page: number,
  limit: number,
  scope: string | null | undefined,
) {
  const qp: Record<string, unknown> = { ...params };
  if (typeof scope === 'string') qp.orgId = scope;
  else if (scope === null) qp.orgId = '';
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
  const { scope, ready, switching } = useOrgScope();
  const scopeKey = useOrgScopeKey();
  const qc = useQueryClient();
  const isRestoring = useIsRestoring();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string>(autoT('ui_4fe8f5bcccb7'));
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
      setMessage(autoT('ui_c8341da98f4c'));
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
    // Wait until the org scope has been hydrated so we do not warm up the
    // temporary legacy/global cache and immediately repeat the same work.
    if (!ready) return;
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
      getActivitiesPrefetchParams();
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
    const hasActivitiesFirstPage = qc.getQueryState(activitiesFirstPageKey)?.status === 'success';

    const needsBlockingWarmup =
      !hasProjects ||
      !hasDashboardMonthSummary ||
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
          setMessage(autoT('ui_ca66f165dc36'));
          setProgress(undefined);

          // Run ALL prefetches in parallel for maximum performance
          const allTasks: Array<{ label: string; promise: Promise<unknown> }> = [];

          // Projects
          if (!hasProjects) {
            allTasks.push({
              label: autoT('ui_4c489cf3d575'),
              promise: qc.prefetchQuery({
                queryKey: ['projects', scopeKey, undefined],
                queryFn: () => fetchProjects(undefined),
              }),
            });
          }

          // Dashboard month summary
          if (!hasDashboardMonthSummary)
            allTasks.push({
              label: autoT('ui_3431af46f2d2'),
              promise: qc.prefetchQuery({
                queryKey: dashboardMonthSummaryKey,
                queryFn: () => fetchStats('/stats/summary', { from, to: toISO, projectId: undefined }),
              }),
            });

          // Activities first page
          if (!hasActivitiesFirstPage) {
            allTasks.push({
              label: autoT('ui_c262a49754e0'),
              promise: qc.prefetchQuery({
                queryKey: activitiesFirstPageKey,
                queryFn: () => fetchActivitiesPaged(activitiesParams, activitiesPage, activitiesLimit, scope),
              }),
            });
          }

          // Progress tracking
          const total = allTasks.length;
          setProgress(total > 0 ? { current: 0, total } : undefined);

          let done = 0;
          const tracked = allTasks.map(async ({ label, promise }) => {
            const taskStartedAt = performance.now();
            try {
              await promise;
              return { label, status: 'success' as const };
            } catch (error) {
              return {
                label,
                status: 'error' as const,
                message: error instanceof Error ? error.message : String(error),
              };
            } finally {
              done += 1;
              markDevFlow(flowId, label, {
                durationMs: Math.round((performance.now() - taskStartedAt) * 10) / 10,
                completed: done,
                total,
              });
              if (!cancelled && runIdRef.current === runId) {
                setProgress({ current: done, total });
                setMessage(autoT('ui_6d153f4ac9f8', { value0: done, value1: total }));
              }
            }
          });

          // Wait for all parallel requests
          const results = await Promise.all(tracked);
          const failedTasks = results.filter((result) => result.status === 'error');

          if (failedTasks.length > 0) {
            finishDevFlow(flowId, 'error', {
              totalTasks: total,
              completedTasks: done,
              failedTasks: failedTasks.length,
              failedLabels: failedTasks.map((task) => task.label),
              partialFailure: failedTasks.length < total,
            });
            addDevMetricEvent({
              kind: 'flow',
              status: 'error',
              name: 'post-login-prefetch',
              message:
                failedTasks.length < total
                  ? 'Warmup completed with partial failures.'
                  : 'Warmup failed for all requested tasks.',
              meta: {
                scopeKey,
                userId: user.id,
                totalTasks: total,
                failedTasks: failedTasks.length,
                failedLabels: failedTasks.map((task) => ({
                  label: task.label,
                  message: task.message,
                })),
              },
            });
          } else {
            finishDevFlow(flowId, 'success', {
              totalTasks: total,
              completedTasks: done,
            });
          }
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
  }, [user?.id, isRestoring, qc, scope, scopeKey, ready, switching]);

  return (
    <>
      {children}
      {demoModeEnabled ? (
        <DemoSplashScreen open={open} message={message} progress={progress} />
      ) : (
        <LoadingOverlay open={open} title={autoT('ui_7898bb2b2332')} message={message} progress={progress} />
      )}
    </>
  );
}
