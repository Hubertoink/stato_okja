import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopedQueryState } from './orgScope';

export interface Location {
  id: string;
  name: string;
  address?: string | null;
  roomType?: string | null;
  active?: boolean;
}

export function useLocations(params?: { active?: boolean }) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['locations', scopeKey, params],
    queryFn: async () => {
      const res = await api.get('/locations', { params });
      return res.data as Location[];
    },
    enabled: ready,
  });
}
