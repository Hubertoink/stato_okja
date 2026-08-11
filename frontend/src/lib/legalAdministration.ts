import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { LegalContent, LegalDocumentKey } from './legalContent';

export type LegalDocumentFiles = Partial<Record<LegalDocumentKey, File>>;

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return error instanceof Error ? error.message : 'Die Rechtstexte konnten nicht importiert werden.';
}

export function useLegalContentForImport() {
  return useQuery({
    queryKey: ['legal-content-import'],
    queryFn: async () => (await api.get<LegalContent>('/auth/legal/import')).data,
  });
}

export function useImportLegalContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (files: LegalDocumentFiles) => {
      const documents = Object.fromEntries(await Promise.all(
        (Object.entries(files) as Array<[LegalDocumentKey, File | undefined]>)
          .filter((entry): entry is [LegalDocumentKey, File] => !!entry[1])
          .map(async ([key, file]) => [key, await file.text()] as const),
      ));
      return (await api.post<LegalContent>('/auth/legal/import', { documents })).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['legal-content'] });
      await queryClient.invalidateQueries({ queryKey: ['legal-content-import'] });
    },
    meta: { getErrorMessage: errorMessage },
  });
}

export async function downloadLegalDocument(key: LegalDocumentKey) {
  const response = await api.get(`/auth/legal/download/${key}`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data instanceof Blob ? response.data : new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `stato-${key}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export { errorMessage as getLegalImportErrorMessage };
