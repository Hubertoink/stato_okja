import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

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

export function useStaff(params?: { active?: boolean }) {
  return useQuery({
    queryKey: ['staff', params],
    queryFn: async () => {
      const res = await api.get('/staff', { params });
      return res.data as StaffMember[];
    },
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<StaffMember>) => {
      const payload: Partial<StaffMember> & { role?: StaffRole } = { ...data };
      // map roles -> role if single selection
      if (!payload.role && Array.isArray(payload.roles) && payload.roles.length > 0) {
        payload.role = payload.roles[0];
      }
      // remove unsupported key to avoid backend update of unknown column
      delete (payload as Record<string, unknown>).roles;
      const res = await api.post('/staff', payload);
      return res.data as StaffMember;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<StaffMember> }) => {
      const payload: Partial<StaffMember> & { role?: StaffRole } = { ...data };
      if (!payload.role && Array.isArray(payload.roles) && payload.roles.length > 0) {
        payload.role = payload.roles[0];
      }
      delete (payload as Record<string, unknown>).roles;
      const res = await api.patch(`/staff/${id}`, payload);
      return res.data as StaffMember;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useArchiveStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      // No archive endpoint yet; fallback to active=false
      const res = await api.patch(`/staff/${id}`, { active: false });
      return res.data as StaffMember;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });
}
