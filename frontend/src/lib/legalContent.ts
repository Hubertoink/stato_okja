import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export const LEGAL_DOCUMENT_KEYS = ['imprint', 'privacy', 'terms'] as const;
export type LegalDocumentKey = (typeof LEGAL_DOCUMENT_KEYS)[number];

export type LegalContent = {
  termsVersion: string;
  updatedAt: string;
  documents: Record<LegalDocumentKey, { title: string; content: string }>;
};

export async function fetchLegalContent(): Promise<LegalContent> {
  const response = await api.get<LegalContent>('/auth/legal');
  return response.data;
}

export function useLegalContent() {
  return useQuery({
    queryKey: ['legal-content'],
    queryFn: fetchLegalContent,
    // Legal documents may be replaced independently from a frontend release.
    // Always verify the current version before a user can give consent.
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 1000 * 60 * 60,
  });
}
