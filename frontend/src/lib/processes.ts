import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopeKey } from './orgScope';

export type ProcessNodeType = 'input' | 'activity' | 'decision' | 'output' | 'outcome' | 'reflection';

export interface ProcessDefinition {
  schemaVersion: 1;
  nodes: Array<{
    id: string;
    type: ProcessNodeType;
    position: { x: number; y: number };
    data: { label: string; description?: string; responsibleRole?: string };
  }>;
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
}

export interface ProcessDto {
  id: string;
  orgId: string;
  title: string;
  purpose: string | null;
  definition: ProcessDefinition;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessAccess {
  enabled: boolean;
  canEdit: boolean;
  orgId: string | null;
}

export type ProcessWriteData = Pick<ProcessDto, 'title'> & {
  purpose?: string | null;
  definition?: ProcessDefinition;
};

export function emptyProcessDefinition(): ProcessDefinition {
  return { schemaVersion: 1, nodes: [], edges: [] };
}

export async function getProcessAccess(): Promise<ProcessAccess> {
  const res = await api.get<ProcessAccess>('/processes/access');
  return res.data;
}

export function useProcessOAccess() {
  const scopeKey = useOrgScopeKey();
  return useQuery({
    queryKey: ['processes', 'access', scopeKey],
    queryFn: getProcessAccess,
    staleTime: 30_000,
    retry: false,
  });
}

export async function listProcesses(): Promise<ProcessDto[]> {
  const res = await api.get<ProcessDto[]>('/processes');
  return res.data;
}

export async function createProcess(data: ProcessWriteData): Promise<ProcessDto> {
  const res = await api.post<ProcessDto>('/processes', data);
  return res.data;
}

export async function updateProcess(id: string, data: Partial<ProcessWriteData>): Promise<ProcessDto> {
  const res = await api.patch<ProcessDto>(`/processes/${id}`, data);
  return res.data;
}

export async function deleteProcess(id: string): Promise<void> {
  await api.delete(`/processes/${id}`);
}
