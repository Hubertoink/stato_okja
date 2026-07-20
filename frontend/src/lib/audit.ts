import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopedQueryState } from './orgScope';

export interface AuditLog {
  id: string;
  entityType: 'activity' | 'project' | 'tag' | 'category' | 'cohort' | 'auth' | string;
  entityId: string;
  action: AuditLogAction;
  userId?: string | null;
  userName?: string | null;
  orgId?: string | null;
  orgName?: string | null;
  entityTitle?: string | null;
  diff?: Record<string, { from: unknown; to: unknown }> | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export type AuditLogAction = 'create' | 'update' | 'delete' | 'login';

type AuditQueryOptions = {
  refetchOnWindowFocus?: boolean | 'always';
  refetchIntervalMs?: number;
  actions?: AuditLogAction[];
};

export function useAuditLogs(limit = 10, options?: AuditQueryOptions) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  const actionsKey = options?.actions?.join(',') || 'all';
  return useQuery<AuditLog[]>({
    queryKey: ['audit', scopeKey, { limit, actions: actionsKey }],
    queryFn: async () => {
      const res = await api.get('/audit', {
        params: {
          limit,
          actions: options?.actions?.length ? options.actions.join(',') : undefined,
        },
      });
      return res.data as AuditLog[];
    },
    staleTime: 5000,
    enabled: ready,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    refetchInterval:
      typeof options?.refetchIntervalMs === 'number' && options.refetchIntervalMs > 0
        ? options.refetchIntervalMs
        : false,
  });
}
