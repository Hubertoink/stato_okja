import { api } from './api';

export type OrgMasterDataKind = 'categories' | 'tags' | 'cohorts' | 'locations';

export type OrgMasterDataPreview = {
  valid: boolean;
  sourceOrganization: string | null;
  counts: Record<OrgMasterDataKind, { total: number; create: number; existing: number }>;
  errors: string[];
  warnings: string[];
};

export type OrgMasterDataImportResult = {
  created: Record<OrgMasterDataKind, number>;
  skipped: Record<OrgMasterDataKind, number>;
};

function filenameFromHeaders(contentDisposition: string | undefined, fallback: string) {
  const filename = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1];
  return filename || fallback;
}

export async function downloadOrgMasterData(orgId: string) {
  const response = await api.get<Blob>(`/orgs/${orgId}/master-data/export`, {
    responseType: 'blob',
  });
  return {
    blob: response.data,
    filename: filenameFromHeaders(
      response.headers['content-disposition'] as string | undefined,
      'stato-stammdaten-export.yaml',
    ),
  };
}

export async function downloadOrgMasterDataTemplate() {
  const response = await api.get<Blob>('/orgs/master-data/template', { responseType: 'blob' });
  return {
    blob: response.data,
    filename: filenameFromHeaders(
      response.headers['content-disposition'] as string | undefined,
      'stato-stammdaten-vorlage.yaml',
    ),
  };
}

export async function previewOrgMasterDataImport(orgId: string, content: string) {
  const response = await api.post<OrgMasterDataPreview>(
    `/orgs/${orgId}/master-data/import/preview`,
    { content },
  );
  return response.data;
}

export async function importOrgMasterData(orgId: string, content: string) {
  const response = await api.post<OrgMasterDataImportResult>(`/orgs/${orgId}/master-data/import`, {
    content,
  });
  return response.data;
}

export function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
