import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  StatisticsOverviewParams,
  StatisticsRealtimeOptions,
  StatsOverviewResponse,
} from './types';

export function useStatisticsOverview(
  params: StatisticsOverviewParams,
  scopeKey: string,
  options?: StatisticsRealtimeOptions,
) {
  return useQuery({
    queryKey: [
      'stats:overview',
      scopeKey,
      params.from ?? '',
      params.to ?? '',
      params.projectId ?? '',
      params.type ?? '',
      params.executionStatuses?.join(',') ?? '',
      params.closureState ?? '',
      params.weekdays?.join(',') ?? '',
    ],
    enabled: options?.enabled,
    queryFn: async ({ signal }) => {
      const queryParams: Record<string, string> = {};
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      if (params.projectId) queryParams.projectId = params.projectId;
      if (params.type) queryParams.type = params.type;
      if (Array.isArray(params.executionStatuses) && params.executionStatuses.length > 0) {
        queryParams.executionStatuses = params.executionStatuses.join(',');
      }
      if (params.closureState) queryParams.closureState = params.closureState;
      if (Array.isArray(params.weekdays) && params.weekdays.length > 0) {
        queryParams.weekdays = params.weekdays.join(',');
      }

      const res = await api.get('/stats/overview', { signal, params: queryParams });
      return res.data as StatsOverviewResponse;
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    refetchInterval:
      typeof options?.refetchIntervalMs === 'number' && options.refetchIntervalMs > 0
        ? options.refetchIntervalMs
        : false,
    placeholderData: (previous, query) => query?.queryKey[1] === scopeKey ? previous : undefined,
  });
}

export function useStatisticsYears(scopeKey: string, enabled: boolean, refreshInterval?: number) {
  return useQuery({
    queryKey: ['stats:years', scopeKey],
    enabled,
    queryFn: async ({ signal }) => (await api.get<string[]>('/stats/years', { signal })).data,
    staleTime: 60_000,
    refetchInterval: refreshInterval || false,
  });
}

// One small daily aggregate for the year, independent of the selected month.
export function useStatisticsMonthCounts(params: StatisticsOverviewParams, scopeKey: string, year: string, enabled: boolean) {
  const annualParams = { ...params, from: `${year}-01-01`, to: `${year}-12-31` };
  return useQuery({
    queryKey: ['stats:month-counts', scopeKey, annualParams],
    enabled: enabled && /^\d{4}$/.test(year),
    queryFn: async ({ signal }) => {
      const { executionStatuses, weekdays, ...rest } = annualParams;
      const res = await api.get('/stats/participants-timeseries', { signal, params: {
        ...rest, executionStatuses: executionStatuses?.join(','), weekdays: weekdays?.join(','),
      } });
      return res.data as StatsOverviewResponse['participantsTimeseries'];
    },
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
  });
}
