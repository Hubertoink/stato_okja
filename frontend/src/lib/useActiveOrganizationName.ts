import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth';
import { useOrgScope } from './orgScope';
import { listOrgs } from './orgs';

/** Use the selected data scope, never a superadmin's unrelated home organization. */
export function useActiveOrganizationName() {
  const { user } = useAuth();
  const { scope } = useOrgScope();
  const orgId = scope === undefined && user?.role !== 'superadmin' ? user?.orgId : scope;
  const membership = user?.memberships?.find(item => item.orgId === orgId);
  const knownName = membership?.orgName || (orgId === user?.orgId ? user?.orgName : undefined);
  const { data } = useQuery({
    queryKey: ['report-organizations', user?.id],
    queryFn: listOrgs,
    enabled: Boolean(orgId && !knownName && user?.role === 'superadmin'),
  });
  return orgId ? knownName || data?.find(org => org.id === orgId)?.name || orgId : undefined;
}
