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
  details?: Record<string, unknown> | null;
  createdAt: string;
}

type AuditQueryOptions = {
  refetchOnWindowFocus?: boolean | 'always';
  refetchIntervalMs?: number;
};

export function useAuditLogs(limit = 10, options?: AuditQueryOptions) {
  const scopeKey = useOrgScopeKey();
  return useQuery<AuditLog[]>({
    queryKey: ['audit', scopeKey, { limit }],
    queryFn: async () => {
      const res = await api.get('/audit', { params: { limit } });
      return res.data as AuditLog[];
    },
    staleTime: 5000,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    refetchInterval:
      typeof options?.refetchIntervalMs === 'number' && options.refetchIntervalMs > 0
        ? options.refetchIntervalMs
        : false,
  });
}
