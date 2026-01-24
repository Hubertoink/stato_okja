import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string>('Daten werden vorbereitet…');
  const didRunRef = useRef(false);

  const shouldRun = useMemo(() => {
    if (!user) return false;
    return !didRunRef.current;
  }, [user?.id]);

  useEffect(() => {
    // Reset per-user so switching accounts runs prefetch again.
    didRunRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (!shouldRun) return;

    let cancelled = false;

    (async () => {
      setOpen(true);
      didRunRef.current = true;
      try {
        // 1) Projects (needed for Statistics project filter badges)
        setMessage('Projekte werden geladen…');
        await qc.prefetchQuery({
          queryKey: ['projects', undefined],
          queryFn: () => fetchProjects(undefined),
        });

        if (cancelled) return;

        // 2) Statistics (base, unfiltered)
        setMessage('Statistiken werden vorbereitet…');
        const statsParams = { from: undefined, to: undefined, projectId: undefined } as const;
        await Promise.all([
          qc.prefetchQuery({
            queryKey: ['stats:summary', '', '', ''],
            queryFn: () => fetchStats('/stats/summary', statsParams),
          }),
          qc.prefetchQuery({
            queryKey: ['stats:by-type', '', '', ''],
            queryFn: () => fetchStats('/stats/by-type', statsParams),
          }),
          qc.prefetchQuery({
            queryKey: ['stats:gender', '', '', ''],
            queryFn: () => fetchStats('/stats/gender', statsParams),
          }),
          qc.prefetchQuery({
            queryKey: ['stats:participants-timeseries', '', '', ''],
            queryFn: () => fetchStats('/stats/participants-timeseries', statsParams),
          }),
          qc.prefetchQuery({
            queryKey: ['stats:by-cohort', '', '', ''],
            queryFn: () => fetchStats('/stats/by-cohort', statsParams),
          }),
          qc.prefetchQuery({
            queryKey: ['stats:by-category', '', '', ''],
            queryFn: () => fetchStats('/stats/by-category', statsParams),
          }),
        ]);

        if (cancelled) return;

        // 3) Activities first page using persisted filters (if any)
        setMessage('Aktivitäten werden vorbereitet…');
        const { params, page, limit } = readActivitiesPrefetchParams();
        await qc.prefetchQuery({
          queryKey: ['activities', 'paged', params, page, limit],
          queryFn: () => fetchActivitiesPaged(params, page, limit),
        });

        if (cancelled) return;

      } catch {
        // Never block the app if prefetch fails (e.g. slow network) — UI will load normally.
      } finally {
        if (!cancelled) setOpen(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, shouldRun, qc]);

  return (
    <>
      {children}
      <LoadingOverlay open={open} title="Initialisiere StatO…" message={message} />
    </>
  );
}
