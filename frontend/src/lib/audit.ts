import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopeKey } from './orgScope';

export interface AuditLog {
  id: string;
  entityType: 'activity' | 'project' | 'tag' | 'category' | 'cohort' | 'auth' | string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'login';
  userId?: string | null;
  userName?: string | null;
  orgId?: string | null;
  orgName?: string | null;
  entityTitle?: string | null;
  diff?: Record<string, { from: unknown; to: unknown }> | null;
  createdAt: string;
}

export function useAuditLogs(limit = 10) {
<<<<<<< Updated upstream
  const scopeKey = useOrgScopeKey();
  return useQuery({
    queryKey: ['audit', scopeKey, { limit }],
=======
  return useQuery<AuditLog[]>({
    queryKey: ['audit', { limit }],
>>>>>>> Stashed changes
    queryFn: async () => {
      const res = await api.get('/audit', { params: { limit } });
      return res.data as AuditLog[];
    },
    staleTime: 5000,
  });
}
