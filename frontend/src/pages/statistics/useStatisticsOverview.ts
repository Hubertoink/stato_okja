import { keepPreviousData, useQuery } from '@tanstack/react-query';
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
    queryFn: async () => {
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

      const res = await api.get('/stats/overview', { params: queryParams });
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
    placeholderData: keepPreviousData,
  });
}
