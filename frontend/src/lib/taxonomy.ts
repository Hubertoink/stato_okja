import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  standardRef?: string | null;
  color?: string | null;
  active?: boolean;
}

export interface Tag {
  id: string;
  name: string;
  synonyms?: string[] | null;
  color?: string | null;
  active?: boolean;
  description?: string | null;
}

export interface Cohort {
  id: string;
  name: string;
  minAge: number;
  maxAge: number;
  sortOrder?: number;
  active?: boolean;
}

// Categories
export function useCategories(params?: { active?: boolean }) {
  return useQuery({
    queryKey: ['categories', params],
    queryFn: async () => {
      const res = await api.get('/taxonomy/categories', { params });
      return res.data as Category[];
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Category>) => {
      const res = await api.post('/taxonomy/categories', data);
      return res.data as Category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Category> }) => {
      const res = await api.patch(`/taxonomy/categories/${id}`, data);
      return res.data as Category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/taxonomy/categories/${id}`);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

// Tags
export function useTags(params?: { active?: boolean; search?: string }) {
  return useQuery({
    queryKey: ['tags', params],
    queryFn: async () => {
      const res = await api.get('/taxonomy/tags', { params });
      return res.data as Tag[];
    },
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Tag>) => {
      const res = await api.post('/taxonomy/tags', data);
      return res.data as Tag;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Tag> }) => {
      const res = await api.patch(`/taxonomy/tags/${id}`, data);
      return res.data as Tag;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/taxonomy/tags/${id}`);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

// Cohorts
export function useCohorts(params?: { active?: boolean }) {
  return useQuery({
    queryKey: ['cohorts', params],
    queryFn: async () => {
      const res = await api.get('/taxonomy/cohorts', { params });
      return res.data as Cohort[];
    },
  });
}

export function useCreateCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Cohort>) => {
      const res = await api.post('/taxonomy/cohorts', data);
      return res.data as Cohort;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cohorts'] }),
  });
}

export function useUpdateCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Cohort> }) => {
      const res = await api.patch(`/taxonomy/cohorts/${id}`, data);
      return res.data as Cohort;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cohorts'] }),
  });
}

export function useDeleteCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/taxonomy/cohorts/${id}`);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cohorts'] }),
  });
}
