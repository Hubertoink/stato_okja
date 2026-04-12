import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopeKey } from './orgScope';

function stripTaxonomyMutationMeta<T extends object>(data: Partial<T>): Partial<T> {
  const sanitized = { ...data } as Record<string, unknown>;
  delete sanitized.id;
  delete sanitized.orgId;
  delete sanitized.sourceOrgId;
  delete sanitized.sourceOrgName;
  delete sanitized.isInherited;
  delete sanitized.canManage;
  delete sanitized.org;
  delete sanitized.createdAt;
  delete sanitized.updatedAt;
  return sanitized as Partial<T>;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  standardRef?: string | null;
  color?: string | null;
  active?: boolean;
  orgId?: string | null;
  sourceOrgId?: string | null;
  sourceOrgName?: string | null;
  isInherited?: boolean;
  canManage?: boolean;
}

export interface Tag {
  id: string;
  name: string;
  synonyms?: string[] | null;
  color?: string | null;
  active?: boolean;
  description?: string | null;
  orgId?: string | null;
  sourceOrgId?: string | null;
  sourceOrgName?: string | null;
  isInherited?: boolean;
  canManage?: boolean;
}

export interface Cohort {
  id: string;
  name: string;
  minAge: number;
  maxAge: number;
  sortOrder?: number;
  active?: boolean;
  inheritToChildren?: boolean;
  orgId?: string | null;
  sourceOrgId?: string | null;
  sourceOrgName?: string | null;
  isInherited?: boolean;
  canManage?: boolean;
}

export interface TaxonomyAccess {
  categories: { canCreateOwn: boolean };
  tags: { canCreateOwn: boolean };
  cohorts: { canCreateOwn: boolean };
}

// Categories
export function useCategories(params?: { active?: boolean }) {
  const scopeKey = useOrgScopeKey();
  return useQuery({
    queryKey: ['categories', scopeKey, params],
    queryFn: async () => {
      const res = await api.get('/taxonomy/categories', { params });
      return res.data as Category[];
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (data: Partial<Category>) => {
      const res = await api.post('/taxonomy/categories', stripTaxonomyMutationMeta(data));
      return res.data as Category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories', scopeKey] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Category> }) => {
      const res = await api.patch(`/taxonomy/categories/${id}`, stripTaxonomyMutationMeta(data));
      return res.data as Category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories', scopeKey] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/taxonomy/categories/${id}`);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories', scopeKey] }),
  });
}

export function useTaxonomyAccess() {
  const scopeKey = useOrgScopeKey();
  return useQuery({
    queryKey: ['taxonomy-access', scopeKey],
    queryFn: async () => {
      const res = await api.get('/taxonomy/access');
      return res.data as TaxonomyAccess;
    },
  });
}

// Tags
export function useTags(params?: { active?: boolean; search?: string }) {
  const scopeKey = useOrgScopeKey();
  return useQuery({
    queryKey: ['tags', scopeKey, params],
    queryFn: async () => {
      const res = await api.get('/taxonomy/tags', { params });
      return res.data as Tag[];
    },
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (data: Partial<Tag>) => {
      const res = await api.post('/taxonomy/tags', stripTaxonomyMutationMeta(data));
      return res.data as Tag;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags', scopeKey] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Tag> }) => {
      const res = await api.patch(`/taxonomy/tags/${id}`, stripTaxonomyMutationMeta(data));
      return res.data as Tag;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags', scopeKey] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/taxonomy/tags/${id}`);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags', scopeKey] }),
  });
}

// Cohorts
export function useCohorts(params?: { active?: boolean }) {
  const scopeKey = useOrgScopeKey();
  return useQuery({
    queryKey: ['cohorts', scopeKey, params],
    queryFn: async () => {
      const res = await api.get('/taxonomy/cohorts', { params });
      return res.data as Cohort[];
    },
  });
}

export function useCreateCohort() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (data: Partial<Cohort>) => {
      const res = await api.post('/taxonomy/cohorts', stripTaxonomyMutationMeta(data));
      return res.data as Cohort;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cohorts', scopeKey] }),
  });
}

export function useUpdateCohort() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Cohort> }) => {
      const res = await api.patch(`/taxonomy/cohorts/${id}`, stripTaxonomyMutationMeta(data));
      return res.data as Cohort;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cohorts', scopeKey] }),
  });
}

export function useDeleteCohort() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/taxonomy/cohorts/${id}`);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cohorts', scopeKey] }),
  });
}
