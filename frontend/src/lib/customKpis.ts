import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopeKey, useOrgScopedQueryState } from './orgScope';

export type CustomKpiSurface = 'dashboard' | 'statistics' | 'both';
export type CustomKpiDateMode = 'inherit' | 'current_month' | 'current_year' | 'rolling_weeks';
export type CustomKpiMetric =
  | 'activity_count'
  | 'participant_total'
  | 'duration_hours'
  | 'duration_hours_per_week'
  | 'avg_participants_per_activity'
  | 'participants_per_hour'
  | 'female_total'
  | 'female_share_percent'
  | 'male_total'
  | 'diverse_total';

export type CustomKpiFilters = {
  projectId?: string;
  type?: string;
  executionStatuses?: string[];
  weekdays?: number[];
};

export type CustomKpiDefinition = {
  id: string;
  title: string;
  surface: CustomKpiSurface;
  position: number;
  enabled: boolean;
  backgroundColor?: string;
  metric: CustomKpiMetric;
  dateMode: CustomKpiDateMode;
  rollingWeeks?: number | null;
  filters?: CustomKpiFilters | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomKpiPayload = Omit<CustomKpiDefinition, 'id' | 'createdAt' | 'updatedAt'>;

export type CustomKpiResult = {
  definition: CustomKpiDefinition;
  value: number | null;
  unit: 'count' | 'hours' | 'percent' | 'ratio';
  precision: number;
  range: { from?: string; to?: string };
};

type CustomKpiResultsParams = {
  surface: Exclude<CustomKpiSurface, 'both'>;
  from?: string;
  to?: string;
};

type CustomKpiQueryOptions = {
  refetchOnWindowFocus?: boolean | 'always';
  refetchIntervalMs?: number;
};

function invalidateCustomKpis(queryClient: ReturnType<typeof useQueryClient>, scopeKey: string) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return (
        Array.isArray(key) &&
        key[1] === scopeKey &&
        (key[0] === 'custom-kpis' || key[0] === 'custom-kpi-results')
      );
    },
    refetchType: 'active',
  });
}

export function useCustomKpis(options?: CustomKpiQueryOptions) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['custom-kpis', scopeKey],
    queryFn: async () => {
      const res = await api.get('/stats/custom-kpis');
      return res.data as CustomKpiDefinition[];
    },
    enabled: ready,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    refetchInterval: options?.refetchIntervalMs,
  });
}

export function useCustomKpiResults(
  params: CustomKpiResultsParams,
  options?: CustomKpiQueryOptions,
) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['custom-kpi-results', scopeKey, params.surface, params.from ?? '', params.to ?? ''],
    queryFn: async () => {
      const res = await api.get('/stats/custom-kpis/results', { params });
      return res.data as CustomKpiResult[];
    },
    enabled: ready,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? 'always',
    refetchInterval: options?.refetchIntervalMs,
  });
}

export function useCreateCustomKpi() {
  const queryClient = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (payload: CustomKpiPayload) => {
      const res = await api.post('/stats/custom-kpis', payload);
      return res.data as CustomKpiDefinition;
    },
    onSuccess: () => invalidateCustomKpis(queryClient, scopeKey),
  });
}

export function useUpdateCustomKpi() {
  const queryClient = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<CustomKpiPayload> }) => {
      const res = await api.patch(`/stats/custom-kpis/${id}`, payload);
      return res.data as CustomKpiDefinition;
    },
    onSuccess: () => invalidateCustomKpis(queryClient, scopeKey),
  });
}

export function useDeleteCustomKpi() {
  const queryClient = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/stats/custom-kpis/${id}`);
      return true;
    },
    onSuccess: () => invalidateCustomKpis(queryClient, scopeKey),
  });
}
