import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopeKey } from './orgScope';
import type { Location } from './locations';
import type { Project } from './projects';

function invalidateStatsQueries(qc: QueryClient, scopeKey: string) {
  void qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey;
      return (
        Array.isArray(k) &&
        typeof k[0] === 'string' &&
        (k[0] as string).startsWith('stats:') &&
        k[1] === scopeKey
      );
    },
  });
}

export interface Activity {
  id: string;
  date: string; // ISO date
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
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
  from?: string;
  to?: string;
  type?: string; // legacy single-type (kept for compatibility)
  types?: string[];
  locationId?: string; // legacy single-location
  locationIds?: string[];
  projectIds?: string[];
  categoryIds?: string[];
  uncategorized?: boolean;
  tagIds?: string[];
  cohortIds?: string[];
  hasNotes?: boolean;
  participantsMin?: number;
  participantsMax?: number;
  durationMin?: number;
  durationMax?: number;
  order?: 'asc'|'desc'; // sort by date/startTime
};

export function useActivities(params?: ActivitiesFilter) {
  const scopeKey = useOrgScopeKey();
  return useQuery({
    queryKey: ['activities', scopeKey, params],
    queryFn: async () => {
      // Encode arrays as comma-separated strings for simple query parsing
      const qp: Record<string, unknown> = { ...params };
      const arrayKeys: (keyof ActivitiesFilter)[] = ['types','locationIds','projectIds','categoryIds','tagIds','cohortIds'];
      for (const k of arrayKeys) {
        const v = params?.[k];
        if (Array.isArray(v) && v.length) qp[k as string] = (v as string[]).join(',');
        else if (Array.isArray(v)) delete qp[k as string];
      }
      // Legacy fields stay as-is
      const res = await api.get('/activities', { params: qp });
      return res.data as Activity[];
    },
  });
}

export interface PagedActivitiesResult {
  data: Activity[];
  total: number;
  page: number;
  pageSize: number; // limit
}

export function useActivitiesPaged(params: ActivitiesFilter | undefined, page: number, limit: number = 50) {
  const scopeKey = useOrgScopeKey();
  return useQuery({
    queryKey: ['activities', scopeKey, 'paged', params, page, limit],
    queryFn: async () => {
      const qp: Record<string, unknown> = { ...params };
      const arrayKeys: (keyof ActivitiesFilter)[] = ['types','locationIds','projectIds','categoryIds','tagIds','cohortIds'];
      for (const k of arrayKeys) {
        const v = params?.[k];
        if (Array.isArray(v) && v.length) qp[k as string] = (v as string[]).join(',');
        else if (Array.isArray(v)) delete qp[k as string];
      }
      // order is a simple string param if provided
      qp.page = page;
      qp.limit = Math.min(Math.max(limit, 1), 50);
      const res = await api.get('/activities', { params: qp });
      return res.data as PagedActivitiesResult;
    },
    placeholderData: (prev) => prev,
  });
}

export function useActivity(id?: string) {
  const scopeKey = useOrgScopeKey();
  return useQuery({
    queryKey: ['activity', scopeKey, id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/activities/${id}`);
      return res.data as Activity;
    },
    enabled: !!id,
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
