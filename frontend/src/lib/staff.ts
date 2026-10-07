import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopeKey, useOrgScopedQueryState } from './orgScope';

export type StaffRole = 'admin' | 'lead' | 'employee' | 'volunteer' | 'helper' | 'analyst';

export interface StaffMember {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  roles?: StaffRole[] | StaffRole; // backend currently single role; keep array for future-ready UI
  role?: StaffRole; // compatibility
  notes?: string | null;
  active?: boolean;
}

function staffPayload(data: Partial<StaffMember>) {
  const { name, email, phone, notes, active } = data;
  const role = Array.isArray(data.roles) ? data.roles[0] ?? data.role : data.roles ?? data.role;
  return { name, email, phone, notes, active, role };
}

export function useStaff(params?: { active?: boolean }) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['staff', scopeKey, params],
    queryFn: async () => {
      const res = await api.get('/staff', { params });
      return res.data as StaffMember[];
    },
    enabled: ready,
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (data: Partial<StaffMember>) => {
      const res = await api.post('/staff', staffPayload(data));
      return res.data as StaffMember;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', scopeKey] }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<StaffMember> }) => {
      const res = await api.patch(`/staff/${id}`, staffPayload(data));
      return res.data as StaffMember;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', scopeKey] }),
  });
}

export function useArchiveStaff() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      // No archive endpoint yet; fallback to active=false
      const res = await api.patch(`/staff/${id}`, { active: false });
      return res.data as StaffMember;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', scopeKey] }),
  });
}
