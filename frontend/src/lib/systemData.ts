import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

type SystemDataSummary = {
  generatedAt: string;
  confirmationText: string;
  restoreConfirmationText: string;
  totals: {
    managedTables: number;
    databaseRows: number;
    uploadFiles: number;
    uploadBytes: number;
  };
  superadmins: Array<{ id: string; email: string; name: string | null }>;
  tables: Array<{ tableName: string; rowCount: number }>;
};

export type SystemDataUploadItem = {
  relativePath: string;
  filename: string;
  size: number;
  url: string;
  isImage: boolean;
  referenceCount: number;
  referenceBreakdown: {
    projects: number;
    projectDocuments: number;
    projectTemplates: number;
    userAvatars: number;
    organizationBanners: number;
  };
  referenceDetails: {
    projects: Array<{ id: string; title: string; orgId: string | null }>;
    projectDocuments: Array<{ id: string; filename: string; projectId: string; projectTitle: string | null; orgId: string | null }>;
    projectTemplates: Array<{ id: string; title: string; orgId: string | null }>;
    userAvatars: Array<{ id: string; name: string | null; email: string; role: string; orgId: string | null }>;
    organizationBanners: Array<{ id: string; name: string }>;
  };
};

type SystemDataUploadsResponse = {
  generatedAt: string;
  uploads: SystemDataUploadItem[];
};

type DeleteSystemDataUploadResult = {
  relativePath: string;
  deleted: boolean;
  deletedBytes: number;
  clearedReferences: number;
  referenceBreakdown: {
    projects: number;
    projectDocuments: number;
    projectTemplates: number;
    userAvatars: number;
    organizationBanners: number;
  };
};

type DeleteSystemDataUploadsResult = {
  deleted: Array<DeleteSystemDataUploadResult>;
  failures: Array<{ relativePath: string; message: string }>;
  deletedCount: number;
  deletedBytes: number;
  clearedReferences: number;
};

type SystemDataExport = {
  blob: Blob;
  filename: string;
};

type PurgeSystemDataPayload = {
  password: string;
  confirmationText: string;
};

type PurgeSystemDataResult = {
  deletedTables: Array<{ tableName: string; deletedRows: number }>;
  deletedUsers: number;
  preservedSuperadmins: Array<{ id: string; email: string; name: string | null }>;
  clearedSuperadminOrgLinks: number;
  deletedUploadFiles: number;
  deletedUploadBytes: number;
  warnings: string[];
};

type SystemDataImportPreview = {
  filename: string;
  generatedAt: string | null;
  generatedBy: { id?: string; name?: string | null; role?: string } | null;
  format: string;
  schemaVersion: number | null;
  confirmationText: string;
  totals: {
    managedTables: number;
    databaseRows: number;
    uploadFiles: number;
    uploadBytes: number;
  };
  tables: Array<{ tableName: string; rowCount: number }>;
  warnings: string[];
};

type ImportSystemDataPayload = {
  file: File;
  password: string;
  confirmationText: string;
};

type ImportSystemDataResult = {
  importedAt: string;
  filename: string;
  deletedTables: Array<{ tableName: string; deletedRows: number }>;
  importedTables: Array<{ tableName: string; importedRows: number }>;
  importedUploadFiles: number;
  importedUploadBytes: number;
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

export function useSystemDataUploads(enabled: boolean) {
  return useQuery({
    queryKey: ['system-data-uploads'],
    queryFn: async () => {
      const res = await api.get<SystemDataUploadsResponse>('/admin/system-data/uploads');
      return res.data;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useDeleteSystemDataUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (relativePath: string) => {
      const res = await api.post<DeleteSystemDataUploadResult>('/admin/system-data/uploads/delete', { relativePath });
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ predicate: () => true });
    },
  });
}

export function useDeleteSystemDataUploads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (relativePaths: string[]) => {
      const res = await api.post<DeleteSystemDataUploadsResult>('/admin/system-data/uploads/delete-many', { relativePaths });
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ predicate: () => true });
    },
  });
}

export function useInspectSystemDataImport() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post<SystemDataImportPreview>('/admin/system-data/import/inspect', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
  });
}

export function useImportSystemData() {
  return useMutation({
    mutationFn: async (payload: ImportSystemDataPayload) => {
      const formData = new FormData();
      formData.append('file', payload.file);
      formData.append('password', payload.password);
      formData.append('confirmationText', payload.confirmationText);
      const res = await api.post<ImportSystemDataResult>('/admin/system-data/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
  });
}

export function usePurgeSystemData() {
  return useMutation({
    mutationFn: async (payload: PurgeSystemDataPayload) => {
      const res = await api.post<PurgeSystemDataResult>('/admin/system-data/purge', payload);
      return res.data;
    },
  });
}
