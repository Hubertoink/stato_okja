import { useActivitiesPaged, type ActivitiesFilter } from '@/lib/activities';
import { useOrgScopedQueryState } from '@/lib/orgScope';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useStatisticsOverview, useStatisticsYears } from './useStatisticsOverview';
import type { StatisticsOverviewParams } from './types';

export type TeamRow = {
  date?: string;
  staffId: string;
  name: string;
  type: string;
  status: string;
  minutes: number;
  assignments: number;
};
export function useTeamStatisticsQuery(params: StatisticsOverviewParams, enabled = true) {
  const { scope, scopeKey, ready } = useOrgScopedQueryState();
  const queryParams = {
    from: params.from,
    to: params.to,
    type: params.type,
    projectId: params.projectId,
    weekdays: params.weekdays?.join(','),
    closureState: params.closureState,
    orgId: scope === null ? '' : scope,
  };
  return useQuery<TeamRow[]>({
    queryKey: ['stats:team', scopeKey, queryParams],
    enabled: ready && enabled,
    queryFn: async ({ signal }) => (await api.get('/stats/team', { params: queryParams, signal })).data,
    refetchOnWindowFocus: true,
  });
}

export function useStatisticsAudienceQueries({
  audience, statsParams, activitiesParams, page, limit, refreshInterval,
}: {
  audience: 'visitors' | 'team';
  statsParams: StatisticsOverviewParams;
  activitiesParams: ActivitiesFilter;
  page: number;
  limit: number;
  refreshInterval?: number;
}) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  const visitors = audience === 'visitors';
  const visitorOptions = { enabled: ready && visitors, refetchOnWindowFocus: true, refetchIntervalMs: refreshInterval };
  const overviewQ = useStatisticsOverview(statsParams, scopeKey, visitorOptions);
  const activitiesPageQ = useActivitiesPaged(activitiesParams, page, limit, visitorOptions);
  const teamQuery = useTeamStatisticsQuery(statsParams, !visitors);
  const yearsQuery = useStatisticsYears(scopeKey, ready && !visitors, refreshInterval);
  const years = visitors ? overviewQ.data?.availableYears : yearsQuery.data;
  const yearsLoaded = visitors ? overviewQ.isSuccess && !overviewQ.isPlaceholderData : yearsQuery.isSuccess;

  return { overviewQ, activitiesPageQ, teamQuery, activityYears: years ?? [], firstActivity: yearsLoaded && years?.length === 0 };
}
