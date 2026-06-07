import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopeKey, useOrgScopedQueryState } from './orgScope';

export type ProjectTemplateDto = {
  id: string;
  title: string;
  type: 'project_open' | 'project_closed' | 'event' | 'outreach' | 'open_door';
  targetGroup?: string | null;
  description?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  tags?: string | null; // comma-separated "name:color" pairs
  imageUrl?: string | null;
  color?: string | null;
  archived: boolean;
  orgId: string | null;
  org?: { id: string; name: string } | null;
};

export function useProjectTemplates() {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['project-templates', scopeKey],
    queryFn: async () => {
      const res = await api.get('/project-templates');
      return res.data as ProjectTemplateDto[];
    },
    enabled: ready,
  });
}

export function useOwnedProjectTemplates() {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['project-templates', scopeKey, 'owned'],
    queryFn: async () => {
      const res = await api.get('/project-templates/owned');
      return res.data as ProjectTemplateDto[];
    },
    enabled: ready,
  });
}

export function useCreateProjectTemplate() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (data: Partial<ProjectTemplateDto>) => {
      const res = await api.post('/project-templates', data);
      return res.data as ProjectTemplateDto;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-templates', scopeKey] });
    },
  });
}

export function useUpdateProjectTemplate() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProjectTemplateDto> }) => {
      const res = await api.patch(`/project-templates/${id}`, data);
      return res.data as ProjectTemplateDto;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-templates', scopeKey] });
    },
  });
}

export function useDeleteProjectTemplate() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/project-templates/${id}`);
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-templates', scopeKey] });
    },
  });
}
