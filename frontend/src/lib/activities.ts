import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Location } from './locations';
import type { Project } from './projects';

export interface Activity {
  id: string;
  date: string; // ISO date
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  type: 'open_door' | 'project_open' | 'project_closed' | 'event' | 'outreach';
  locationId?: string | null;
  projectId?: string | null;
  location?: Location; // eager loaded on backend
  project?: Project | null; // eager loaded on backend
  title?: string | null;
  tags?: Array<{ id: string; name: string; color?: string | null }>;
  categories?: Array<{ id: string; name: string; color?: string | null }>;
  staff?: Array<{ id: string; name: string }>;
  countMale?: number;
  countFemale?: number;
  countDiverse?: number;
  countTotal?: number;
  notes?: string | null;
  // per-gender cohort breakdown stored on the backend (optional on read)
  cohorts?: Array<{ cohortId: string; m: number; w: number; d: number }>;
}

export function useActivities(params?: { from?: string; to?: string; type?: string; locationId?: string }) {
  return useQuery({
    queryKey: ['activities', params],
    queryFn: async () => {
      const res = await api.get('/activities', { params });
      return res.data as Activity[];
    },
  });
}

export function useActivity(id?: string) {
  return useQuery({
    queryKey: ['activity', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/activities/${id}`);
      return res.data as Activity;
    },
    enabled: !!id,
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Activity> & Record<string, unknown>) => {
      const res = await api.post('/activities', data);
      return res.data as Activity;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Activity> & Record<string, unknown> }) => {
      const res = await api.patch(`/activities/${id}`, data);
      return res.data as Activity;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['activities'] });
      if (variables?.id) qc.invalidateQueries({ queryKey: ['activity', variables.id] });
    },
  });
}

export function useRemoveActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/activities/${id}`);
      return true;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['activities'] });
      if (id) qc.invalidateQueries({ queryKey: ['activity', id] });
    },
  });
}
