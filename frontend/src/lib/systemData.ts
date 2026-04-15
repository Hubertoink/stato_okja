import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export type SystemDataSummary = {
  generatedAt: string;
  confirmationText: string;
  totals: {
    managedTables: number;
    databaseRows: number;
    uploadFiles: number;
    uploadBytes: number;
  };
  superadmins: Array<{ id: string; email: string; name: string | null }>;
  tables: Array<{ tableName: string; rowCount: number }>;
};

export type SystemDataExport = {
  blob: Blob;
  filename: string;
};

export type PurgeSystemDataPayload = {
  password: string;
  confirmationText: string;
};

export type PurgeSystemDataResult = {
  deletedTables: Array<{ tableName: string; deletedRows: number }>;
  deletedUsers: number;
  preservedSuperadmins: Array<{ id: string; email: string; name: string | null }>;
  clearedSuperadminOrgLinks: number;
  deletedUploadFiles: number;
  deletedUploadBytes: number;
  warnings: string[];
};

function parseFilename(contentDisposition?: string) {
  const value = String(contentDisposition || '');
  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const basicMatch = value.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] || `stato-system-data-export-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message.trim()) return message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function downloadSystemDataExport(file: SystemDataExport) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function useSystemDataSummary() {
  return useQuery({
    queryKey: ['system-data-summary'],
    queryFn: async () => {
      const res = await api.get<SystemDataSummary>('/admin/system-data/summary');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useExportSystemData() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.get('/admin/system-data/export', { responseType: 'blob' });
      const filename = parseFilename(res.headers['content-disposition']);
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/zip' });
      return { blob, filename } as SystemDataExport;
    },
  });
}

export function usePurgeSystemData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PurgeSystemDataPayload) => {
      const res = await api.post<PurgeSystemDataResult>('/admin/system-data/purge', payload);
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ predicate: () => true });
    },
  });
}