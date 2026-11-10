import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { api } from './api';
import { useOrgScopedQueryState, useOrgScopeKey } from './orgScope';

export type Contributor = { id: string; name: string; color?: string; active: boolean };
export type Contribution = import('./contributionTimes').ContributionTime;
export type ContributionEntry = Contribution & {
  name: string; color?: string; active: boolean; date: string; activityId: string; title: string;
  projectId: string | null; projectTitle: string | null;
};

export function contributionError(error: unknown) {
  if (isAxiosError(error)) {
    const message: unknown = error.response?.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(' ');
  }
  return 'Die Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.';
}

export function useContributors() {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({ queryKey: ['contributors', scopeKey], enabled: ready,
    queryFn: async () => (await api.get<Contributor[]>('/contributors')).data });
}

export function useSaveContributor() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id?: string; name?: string; color?: string; active?: boolean }) =>
      (id ? await api.patch<Contributor>(`/contributors/${id}`, data) : await api.post<Contributor>('/contributors', data)).data,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['contributors', scopeKey] }),
        qc.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith('stats:') && query.queryKey[1] === scopeKey }),
      ]);
    },
  });
}

export async function contributorUsage(id: string) {
  return (await api.get<{ count: number }>(`/contributors/${id}/usage`)).data.count;
}

export function useDeleteContributor() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/contributors/${id}`); },
    onSuccess: async () => {
      await qc.invalidateQueries({ predicate: query => query.queryKey[1] === scopeKey });
    },
  });
}

export function useContributionReport(params: { from: string; to: string; projectId?: string }, enabled = true) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({ queryKey: ['stats:contributions', scopeKey, params], enabled: ready && enabled,
    queryFn: async () => (await api.get<ContributionEntry[]>('/contributors/report', { params })).data });
}

export function formatContributionMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} Std.${rest ? ` ${rest} Min.` : ''}` : `${rest} Min.`;
}

export function summarizeContributions(entries: ContributionEntry[]) {
  const people = new Map<string, { contributorId: string; name: string; color?: string; active: boolean; minutes: number; assignments: number; entries: ContributionEntry[] }>();
  for (const entry of entries) {
    const row = people.get(entry.contributorId) || { contributorId: entry.contributorId, name: entry.name, active: entry.active, minutes: 0, assignments: 0, entries: [] };
    row.minutes += entry.minutes;
    row.assignments += 1;
    row.entries.push(entry);
    people.set(entry.contributorId, row);
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
