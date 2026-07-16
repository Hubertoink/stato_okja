import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopeKey, useOrgScopedQueryState } from './orgScope';
import type { Location } from './locations';
import type { Project } from './projects';
import type { ActivityExecutionStatus } from './activityExecutionStatus';
import type { OrganizationClosureStateFilter } from './orgs';

function invalidateStatsQueries(qc: QueryClient, scopeKey: string) {
  void qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey;
      return (
        Array.isArray(k) &&
        typeof k[0] === 'string' &&
        ((k[0] as string).startsWith('stats:') || k[0] === 'custom-kpi-results') &&
        k[1] === scopeKey
      );
    },
    refetchType: 'active',
  });
}

function applyOrgScopeParam(qp: Record<string, unknown>, scope: string | null | undefined) {
  if (typeof scope === 'string') {
    qp.orgId = scope;
    return;
  }
  if (scope === null) {
    qp.orgId = '';
  }
}

export interface Activity {
  id: string;
  date: string; // ISO date
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  executionStatus?: ActivityExecutionStatus | null;
  type: 'open_door' | 'project_open' | 'project_closed' | 'event' | 'outreach';
  locationId?: string | null;
  projectId?: string | null;
  location?: Location; // eager loaded on backend
  project?: Project | null; // eager loaded on backend
  title?: string | null;
  tags?: Array<{ id: string; name: string; color?: string | null }>;
  categories?: Array<{ id: string; name: string; color?: string | null }>;
  staff?: Array<{ id: string; name: string }>;
  countMale?: number;
  countFemale?: number;
  countDiverse?: number;
  countTotal?: number;
  notes?: string | null;
  // per-gender cohort breakdown stored on the backend (optional on read)
  cohorts?: Array<{ cohortId: string; m: number; w: number; d: number }>;
}

export type ActivitiesFilter = {
  search?: string;
  from?: string;
  to?: string;
  weekdays?: number[];
  type?: string; // legacy single-type (kept for compatibility)
  types?: string[];
  locationId?: string; // legacy single-location
  locationIds?: string[];
  projectIds?: string[];
  categoryIds?: string[];
  uncategorized?: boolean;
  tagIds?: string[];
  staffIds?: string[];
  cohortIds?: string[];
  executionStatuses?: ActivityExecutionStatus[];
  closureState?: OrganizationClosureStateFilter;
  hasNotes?: boolean;
  participantsMin?: number;
  participantsMax?: number;
  durationMin?: number;
  durationMax?: number;
  order?: 'asc'|'desc'; // sort by date/startTime
};

type ActivitiesQueryOptions = {
  refetchOnWindowFocus?: boolean | 'always';
  refetchIntervalMs?: number;
};

export function buildActivityQueryParams(
  params?: ActivitiesFilter,
  scope?: string | null | undefined,
) {
  const qp: Record<string, unknown> = { ...params };
  applyOrgScopeParam(qp, scope);
  const arrayKeys: (keyof ActivitiesFilter)[] = [
    'types', 'locationIds', 'projectIds', 'categoryIds', 'tagIds', 'staffIds', 'cohortIds', 'executionStatuses',
  ];
  for (const key of arrayKeys) {
    const value = params?.[key];
    if (Array.isArray(value) && value.length) qp[key] = value.join(',');
    else if (Array.isArray(value)) delete qp[key];
  }
  if (Array.isArray(params?.weekdays) && params.weekdays.length) qp.weekdays = params.weekdays.join(',');
  else if (Array.isArray(params?.weekdays)) delete qp.weekdays;
  return qp;
}

export function useActivities(params?: ActivitiesFilter, options?: ActivitiesQueryOptions) {
  const { scope, scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['activities', scopeKey, params],
    queryFn: () => fetchAllActivities(params, scope),
    enabled: ready,
    refetchOnMount: 'always',
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    refetchOnReconnect: true,
    refetchInterval:
      typeof options?.refetchIntervalMs === 'number' && options.refetchIntervalMs > 0
        ? options.refetchIntervalMs
        : false,
  });
}

export interface PagedActivitiesResult {
  data: Activity[];
  total: number;
  page: number;
  pageSize: number; // limit
}

/** Load all items only through bounded, paginated API requests. */
export async function fetchAllActivities(
  params?: ActivitiesFilter,
  scope?: string | null | undefined,
): Promise<Activity[]> {
  const qp = buildActivityQueryParams(params, scope);
  const limit = 50;
  const data: Activity[] = [];
  let page = 1;
  let total = 0;

  do {
    const response = await api.get<PagedActivitiesResult>('/activities', {
      params: { ...qp, page, limit },
    });
    const payload = response.data;
    const rows = Array.isArray(payload.data) ? payload.data : [];
    data.push(...rows);
    total = Number.isFinite(payload.total) ? payload.total : data.length;
    if (rows.length === 0) break;
    page += 1;
  } while (data.length < total);

  return data;
}

export function useActivitiesPaged(
  params: ActivitiesFilter | undefined,
  page: number,
  limit: number = 50,
  options?: ActivitiesQueryOptions,
) {
  const { scope, scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['activities', scopeKey, 'paged', params, page, limit],
    queryFn: async () => {
      const qp = buildActivityQueryParams(params, scope);
      const res = await api.get('/activities', {
        params: { ...qp, page, limit: Math.min(Math.max(limit, 1), 50) },
      });
      return res.data as PagedActivitiesResult;
    },
    enabled: ready,
    refetchOnMount: 'always',
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    refetchOnReconnect: true,
    refetchInterval:
      typeof options?.refetchIntervalMs === 'number' && options.refetchIntervalMs > 0
        ? options.refetchIntervalMs
        : false,
    placeholderData: (prev) => prev,
  });
}

export function useActivity(id?: string) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['activity', scopeKey, id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/activities/${id}`);
      return res.data as Activity;
    },
    enabled: !!id && ready,
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (data: Partial<Activity> & Record<string, unknown>) => {
      const res = await api.post('/activities', data);
      return res.data as Activity;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities', scopeKey] });
      invalidateStatsQueries(qc, scopeKey);
    },
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Activity> & Record<string, unknown> }) => {
      const res = await api.patch(`/activities/${id}`, data);
      return res.data as Activity;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['activities', scopeKey] });
      if (variables?.id) qc.invalidateQueries({ queryKey: ['activity', scopeKey, variables.id] });
      invalidateStatsQueries(qc, scopeKey);
    },
  });
}

export function useRemoveActivity() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/activities/${id}`);
      return true;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['activities', scopeKey] });
      if (id) qc.invalidateQueries({ queryKey: ['activity', scopeKey, id] });
      invalidateStatsQueries(qc, scopeKey);
    },
  });
}
