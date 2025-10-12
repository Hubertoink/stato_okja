import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface AuditLog {
  id: string;
  entityType: 'activity' | 'project' | 'tag' | 'category' | 'cohort' | string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  userId?: string | null;
  userName?: string | null;
  orgId?: string | null;
  orgName?: string | null;
  entityTitle?: string | null;
  diff?: Record<string, { from: unknown; to: unknown }> | null;
  createdAt: string;
}

export function useAuditLogs(limit = 10) {
  return useQuery({
    queryKey: ['audit', { limit }],
    queryFn: async () => {
      const res = await api.get('/audit', { params: { limit } });
      return res.data as AuditLog[];
    },
    staleTime: 5000,
  });
}
