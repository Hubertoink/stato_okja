import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopedQueryState } from './orgScope';
import type { OrgDto } from './orgs';

export type OrganizationModule = 'processes' | 'logbook' | 'surveys';
export type OrganizationModuleAccess = Record<OrganizationModule, boolean> & { orgId: string | null };

export function useOrganizationModules() {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['organization-modules', scopeKey],
    queryFn: async () => (await api.get<OrganizationModuleAccess>('/orgs/modules/access')).data,
    enabled: ready,
    staleTime: 0,
    refetchInterval: 30_000,
    retry: false,
  });
}

export async function updateOrganizationModule(orgId: string, module: OrganizationModule, enabled: boolean) {
  return (await api.patch<OrgDto>(`/orgs/${orgId}/modules`, { module, enabled })).data;
}
