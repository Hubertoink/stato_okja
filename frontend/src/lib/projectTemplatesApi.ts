import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export type ProjectTemplateDto = {
  id: string;
  title: string;
  type: 'project_open' | 'project_closed' | 'event' | 'outreach' | 'open_door';
  targetGroup?: string | null;
  description?: string | null;
  categoryName?: string | null;
  imageUrl?: string | null;
  color?: string | null;
  archived: boolean;
  orgId: string | null;
  org?: { id: string; name: string } | null;
};

export function useProjectTemplates() {
  return useQuery({
    queryKey: ['project-templates'],
    queryFn: async () => {
      const res = await api.get('/project-templates');
      return res.data as ProjectTemplateDto[];
    },
  });
}

export function useOwnedProjectTemplates() {
  return useQuery({
    queryKey: ['project-templates', 'owned'],
    queryFn: async () => {
      const res = await api.get('/project-templates/owned');
      return res.data as ProjectTemplateDto[];
    },
  });
}

export function useCreateProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ProjectTemplateDto>) => {
      const res = await api.post('/project-templates', data);
      return res.data as ProjectTemplateDto;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-templates'] });
    },
  });
}

export function useUpdateProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProjectTemplateDto> }) => {
      const res = await api.patch(`/project-templates/${id}`, data);
      return res.data as ProjectTemplateDto;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-templates'] });
    },
  });
}

export function useDeleteProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/project-templates/${id}`);
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-templates'] });
    },
  });
}
