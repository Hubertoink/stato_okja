import { useEffect, useRef, useState } from 'react';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOrgScope } from '@/lib/orgScope';
import type { ActivitiesFilter, PagedActivitiesResult } from '@/lib/activities';
import type { Project } from '@/lib/projects';
import LoadingOverlay from '@/components/LoadingOverlay';

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
  const { scope } = useOrgScope();
  const qc = useQueryClient();
  const isRestoring = useIsRestoring();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string>('Daten werden vorbereitet…');
  const didRunKeyRef = useRef<string>('');
  const runIdRef = useRef(0);

  useEffect(() => {
    // Reset per-user so switching accounts runs prefetch again.
    didRunKeyRef.current = '';
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (isRestoring) return;
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

    const dashboardMonthSummaryKey = [
      'stats:summary',
      {
        from,
        to: toISO,
        scope: scopeForKey,
      },
    ] as const;

    const { params: activitiesParams, page: activitiesPage, limit: activitiesLimit } =
      readActivitiesPrefetchParams();
    const activitiesFirstPageKey = [
      'activities',
      'paged',
      activitiesParams,
      activitiesPage,
      activitiesLimit,
    ] as const;

    const hasProjects = qc.getQueryState(['projects', undefined])?.status === 'success';
    const hasDashboardMonthSummary = qc.getQueryState(dashboardMonthSummaryKey)?.status === 'success';
    const hasBaseStatsSummary = qc.getQueryState(['stats:summary', '', '', ''])?.status === 'success';
    const hasBaseStatsByType = qc.getQueryState(['stats:by-type', '', '', ''])?.status === 'success';
    const hasBaseStatsGender = qc.getQueryState(['stats:gender', '', '', ''])?.status === 'success';
    const hasBaseStatsTimeseries =
      qc.getQueryState(['stats:participants-timeseries', '', '', ''])?.status === 'success';
    const hasBaseStatsByCohort = qc.getQueryState(['stats:by-cohort', '', '', ''])?.status === 'success';
    const hasBaseStatsByCategory =
      qc.getQueryState(['stats:by-category', '', '', ''])?.status === 'success';

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
          setOpen(true);

          if (!hasProjects) {
            setMessage('Projekte werden geladen…');
            await qc.prefetchQuery({
              queryKey: ['projects', undefined],
              queryFn: () => fetchProjects(undefined),
            });
          }

          if (cancelled) return;

          setMessage('Statistiken werden vorbereitet…');
          const baseStatsParams = { from: undefined, to: undefined, projectId: undefined } as const;
          const tasks: Promise<unknown>[] = [];

          if (!hasBaseStatsSummary)
            tasks.push(
              qc.prefetchQuery({
                queryKey: ['stats:summary', '', '', ''],
                queryFn: () => fetchStats('/stats/summary', baseStatsParams),
              }),
            );
          if (!hasBaseStatsByType)
            tasks.push(
              qc.prefetchQuery({
                queryKey: ['stats:by-type', '', '', ''],
                queryFn: () => fetchStats('/stats/by-type', baseStatsParams),
              }),
            );
          if (!hasBaseStatsGender)
            tasks.push(
              qc.prefetchQuery({
                queryKey: ['stats:gender', '', '', ''],
                queryFn: () => fetchStats('/stats/gender', baseStatsParams),
              }),
            );
          if (!hasBaseStatsTimeseries)
            tasks.push(
              qc.prefetchQuery({
                queryKey: ['stats:participants-timeseries', '', '', ''],
                queryFn: () => fetchStats('/stats/participants-timeseries', baseStatsParams),
              }),
            );
          if (!hasBaseStatsByCohort)
            tasks.push(
              qc.prefetchQuery({
                queryKey: ['stats:by-cohort', '', '', ''],
                queryFn: () => fetchStats('/stats/by-cohort', baseStatsParams),
              }),
            );
          if (!hasBaseStatsByCategory)
            tasks.push(
              qc.prefetchQuery({
                queryKey: ['stats:by-category', '', '', ''],
                queryFn: () => fetchStats('/stats/by-category', baseStatsParams),
              }),
            );

          if (!hasDashboardMonthSummary)
            tasks.push(
              qc.prefetchQuery({
                queryKey: dashboardMonthSummaryKey,
                queryFn: async () => {
                  const res = await api.get('/stats/summary', {
                    params: {
                      from,
                      to: toISO,
                      orgId:
                        typeof scope === 'undefined' ? undefined : scope === null ? 'null' : scope,
                    },
                  });
                  return res.data;
                },
              }),
            );

          await Promise.all(tasks);

          if (cancelled) return;

          if (!hasActivitiesFirstPage) {
            setMessage('Aktivitäten werden vorbereitet…');
            await qc.prefetchQuery({
              queryKey: activitiesFirstPageKey,
              queryFn: () => fetchActivitiesPaged(activitiesParams, activitiesPage, activitiesLimit),
            });
          }
        }
      } catch {
        // Never block the app if prefetch fails — UI will load normally.
      } finally {
        // Always close the overlay for the latest run.
        if (!cancelled && runIdRef.current === runId) setOpen(false);
      }

      // Activities first page using persisted filters (if any) — always background.
      try {
        const hasActivities = qc.getQueryState(activitiesFirstPageKey)?.status === 'success';
        if (!hasActivities) {
          await qc.prefetchQuery({
            queryKey: activitiesFirstPageKey,
            queryFn: () => fetchActivitiesPaged(activitiesParams, activitiesPage, activitiesLimit),
          });
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
      // If a newer run starts (e.g., org scope hydrates/changes), ensure the old overlay doesn't stay stuck open.
      if (runIdRef.current === runId) setOpen(false);
    };
  }, [user?.id, isRestoring, qc, scope]);

  return (
    <>
      {children}
      <LoadingOverlay open={open} title="Initialisiere StatO…" message={message} />
    </>
  );
}
