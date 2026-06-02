import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopeKey } from './orgScope';

export interface ProjectDocument {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  size: number;
  storageRef: string;
  createdAt: string;
  downloadUrl?: string;
}

export interface Project {
  id: string;
  title: string;
  type: string;
  categoryId?: string | null;
  categories?: Array<{ id: string; name: string; color?: string | null }>;
  targetGroup?: string | null;
  imageUrl?: string | null;
  imageSize?: number | null;
  color?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  defaultStaff?: string | null;
  defaultVolunteers?: string | null;
  tag?: string | null;
  activityField?: string | null;
  description?: string | null;
  clientRequestId?: string | null;
  archived?: boolean;
  documents?: ProjectDocument[];
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function uploadProjectDocument(projectId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/projects/${projectId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as ProjectDocument;
}

export async function removeProjectDocument(projectId: string, documentId: string) {
  await api.delete(`/projects/${projectId}/documents/${documentId}`);
}

export async function downloadProjectDocument(projectId: string, document: Pick<ProjectDocument, 'id' | 'filename'>) {
  const res = await api.get(`/projects/${projectId}/documents/${document.id}/download`, {
    responseType: 'blob',
  });
  const blob = res.data instanceof Blob
    ? res.data
    : new Blob([res.data], { type: 'application/octet-stream' });
  downloadBlob(blob, document.filename || 'projekt-dokument');
}

export function useProjects(params?: { search?: string; archived?: boolean }) {
  const scopeKey = useOrgScopeKey();
  const key = ['projects', scopeKey, params];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await api.get('/projects', { params });
      return res.data as Project[];
    },
    // Keep showing the previous list while fetching new results for a new search term
    placeholderData: keepPreviousData,
    // Avoid instant trashing of cached results so quick toggles don't flicker
    gcTime: 1000 * 60 * 5,
    staleTime: 1000 * 5,
  });
  return query;
}

export function useCreateProject() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (data: Partial<Project>) => {
      const res = await api.post('/projects', data);
      return res.data as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', scopeKey] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Project> }) => {
      const res = await api.patch(`/projects/${id}`, data);
      return res.data as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', scopeKey] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (args: { id: string; archived: boolean }) => {
      const { id, archived } = args;
      const res = await api.patch(`/projects/${id}/archive`, { archived });
      return res.data as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', scopeKey] }),
  });
}

export function useRemoveProject() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/${id}`);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', scopeKey] }),
  });
}
