import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from './api';
import { normalizeAppLocale } from '@/i18n/locales';

export const LEGAL_DOCUMENT_KEYS = ['imprint', 'privacy', 'terms'] as const;
export type LegalDocumentKey = (typeof LEGAL_DOCUMENT_KEYS)[number];

export type LegalContent = {
  termsVersion: string;
  updatedAt: string;
  documents: Record<LegalDocumentKey, { title: string; content: string; updatedAt: string }>;
};

export async function fetchLegalContent(locale?: string): Promise<LegalContent> {
  const response = await api.get<LegalContent>('/auth/legal', { params: { locale } });
  return response.data;
}

export function useLegalContent() {
  const { i18n } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  return useQuery({
    queryKey: ['legal-content', locale],
    queryFn: () => fetchLegalContent(locale),
    // Legal documents may be replaced independently from a frontend release.
    // Always verify the current version before a user can give consent.
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 1000 * 60 * 60,
  });
}
