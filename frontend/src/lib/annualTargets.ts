import { useEffect } from 'react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopedQueryState, useOrgScopeKey } from './orgScope';
import type { Activity } from './activities';
import { usePublicConfig } from './publicConfig';

export const targetMetrics = {
  duration_hours: 'Aktivitätsstunden',
  participant_total: 'Besuche',
  activity_count: 'Anzahl Aktivitäten',
  female_share_percent: 'Weiblicher Besuchsanteil',
  male_share_percent: 'Männlicher Besuchsanteil',
  diverse_share_percent: 'Diverser Besuchsanteil',
};
export const targetTypes: Record<string, string> = {
  open_door: 'Offene Tür',
  project_open: 'Projekt (offen)',
  project_closed: 'Projekt (geschlossen)',
  event: 'Veranstaltung',
  outreach: 'Aufsuchend',
};
export const targetStatuses = { draft: 'Entwurf', active: 'Festgelegt', closed: 'Abgeschlossen' };
export type TargetMetric = keyof typeof targetMetrics;
export type TargetScope = { types?: string[]; projectId?: string; activityId?: string };
export type TargetSnapshot = {
  value: number | null;
  asOf: string;
  activityCount: number;
  series: Array<{ month: string; value: number | null }>;
};
export type TargetPayload = {
  title: string;
  year: number;
  dateFrom?: string | null;
  dateTo?: string | null;
  metric: TargetMetric;
  scope: TargetScope;
  rule: 'min' | 'max' | 'range';
  target: number;
  upperTarget: number | null;
  description: string;
  showOnDashboard: boolean;
  version?: number;
  reason?: string;
};
export type AnnualTarget = TargetPayload & {
  id: string;
  orgId: string | null;
  version: number;
  status: keyof typeof targetStatuses;
  review: string;
  scopeLabel: string;
  projectImageUrl?: string | null;
  result: TargetSnapshot;
  current: TargetSnapshot;
  snapshot: TargetSnapshot | null;
  dataChanged: boolean;
  evaluation: { met: boolean | null; difference: number | null };
  history?: Array<{
    at: string;
    actorId: string;
    actorName?: string;
    reason: string;
    definition: TargetPayload & {
      status: keyof typeof targetStatuses;
      review: string;
      snapshot: TargetSnapshot | null;
    };
  }>;
};

export function targetUnit(metric: TargetMetric) {
  return metric === 'duration_hours' ? 'h' : metric.endsWith('_percent') ? '%' : '';
}
export function formatTargetValue(value: number | null, metric: TargetMetric) {
  if (value === null) return 'Noch nicht berechenbar';
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: metric.endsWith('_percent') || metric === 'duration_hours' ? 1 : 0 })} ${targetUnit(metric)}`.trim();
}
export function targetRequirement(
  target: Pick<TargetPayload, 'rule' | 'target' | 'upperTarget' | 'metric'>,
) {
  return target.rule === 'range'
    ? `${formatTargetValue(target.target, target.metric)} – ${formatTargetValue(target.upperTarget, target.metric)}`
    : `${target.rule === 'min' ? 'Mindestens' : 'Höchstens'} ${formatTargetValue(target.target, target.metric)}`;
}
export function targetScopeLabel(target: Pick<AnnualTarget, 'scope' | 'scopeLabel'>) {
  return target.scope.types?.length
    ? target.scope.types.map((type) => targetTypes[type]).join(', ')
    : target.scopeLabel;
}
export function targetDifference(target: AnnualTarget) {
  if (target.result.value === null) return 'Noch nicht berechenbar';
  if (target.rule === 'range' && target.evaluation.met) return 'Im Zielkorridor';
  const difference = target.evaluation.difference!;
  const amount =
    difference !== 0 && Math.abs(difference) < 0.1
      ? '< 0,1'
      : Math.abs(difference).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  const unit = target.metric.endsWith('_percent') ? 'Prozentpunkte' : targetUnit(target.metric);
  if (difference === 0) return 'Zielwert erreicht';
  if (target.rule === 'max')
    return `${amount} ${unit} ${difference >= 0 ? 'unter' : 'über'} Obergrenze`;
  if (target.rule === 'range' && target.result.value > target.upperTarget!)
    return `${amount} ${unit} über Obergrenze`;
  return `${amount} ${unit} ${difference < 0 ? 'fehlen' : 'über Ziel'}`;
}
export function targetYear() {
  return Number(
    new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(
      new Date(),
    ),
  );
}

export function targetPeriod(target: Pick<TargetPayload, 'year' | 'dateFrom' | 'dateTo'>) {
  return {
    from: target.dateFrom || `${target.year}-01-01`,
    to: target.dateTo || `${target.year}-12-31`,
  };
}
export function targetPeriodLabel(target: Pick<TargetPayload, 'year' | 'dateFrom' | 'dateTo'>) {
  const { from, to } = targetPeriod(target);
  return `${from.split('-').reverse().join('.')} – ${to.split('-').reverse().join('.')}`;
}
export function targetMonths(target: Pick<TargetPayload, 'year' | 'dateFrom' | 'dateTo'>) {
  const { from, to } = targetPeriod(target);
  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  while (`${year}-${String(month).padStart(2, '0')}` <= to.slice(0, 7)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}
export function targetCanClose(target: Pick<TargetPayload, 'year' | 'dateFrom' | 'dateTo'>) {
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return today > targetPeriod(target).to;
}

export function useAnnualTargets(year: number) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  const config = usePublicConfig();
  return useQuery({
    queryKey: ['stats:annual-targets', scopeKey, year],
    enabled: ready && config.data?.annualTargetsEnabled === true,
    queryFn: async () =>
      (await api.get<AnnualTarget[]>('/stats/annual-targets', { params: { year } })).data,
  });
}
export function useAnnualTarget(id: string) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['stats:annual-target', scopeKey, id],
    enabled: ready && !!id,
    queryFn: async () => (await api.get<AnnualTarget>(`/stats/annual-targets/${id}`)).data,
  });
}
export function useTargetActivities(id: string, page: number) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  const client = useQueryClient();
  const query = useQuery({
    ...targetActivitiesOptions(scopeKey, id, page),
    enabled: ready && !!id,
    // Keep rows only when paging within the same target and organization.
    placeholderData: (previous, previousQuery) =>
      ready && previousQuery?.queryKey[1] === scopeKey && previousQuery.queryKey[2] === id
        ? previous
        : undefined,
  });
  const data = query.data;
  useEffect(() => {
    if (!ready || !id || !data || query.isPlaceholderData || page * data.pageSize >= data.total)
      return;
    void client.prefetchQuery(targetActivitiesOptions(scopeKey, id, page + 1));
  }, [client, scopeKey, ready, id, page, data, query.isPlaceholderData]);
  return query;
}

function targetActivitiesOptions(scopeKey: string, id: string, page: number) {
  return queryOptions({
    queryKey: ['stats:annual-target-activities', scopeKey, id, page],
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const response = await api.get<{ items: Activity[]; total: number; pageSize: number }>(
        `/stats/annual-targets/${id}/activities`,
        { params: { page }, signal },
      );
      return { ...response.data, page };
    },
  });
}
export type TargetMutation =
  | { action: 'save'; id?: string; payload: TargetPayload }
  | { action: 'activate' | 'close' | 'reopen'; id: string; version: number; reason: string }
  | { action: 'copy'; id: string; year: number };
export function useTargetMutation() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (args: TargetMutation) => {
      if (args.action === 'save')
        return (
          args.id
            ? await api.patch(`/stats/annual-targets/${args.id}`, args.payload)
            : await api.post('/stats/annual-targets', args.payload)
        ).data;
      if (args.action === 'copy')
        return (await api.post(`/stats/annual-targets/${args.id}/copy`, { year: args.year })).data;
      return (
        await api.post(`/stats/annual-targets/${args.id}/command`, {
          action: args.action,
          version: args.version,
          reason: args.reason,
        })
      ).data;
    },
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === 'string' &&
          q.queryKey[0].startsWith('stats:annual-target') &&
          q.queryKey[1] === scopeKey,
      }),
  });
}

export function targetError(error: unknown) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response
    ?.data?.message;
  return Array.isArray(message)
    ? message.join(' · ')
    : message || 'Die Jahresziele konnten nicht verarbeitet werden. Bitte erneut versuchen.';
}
