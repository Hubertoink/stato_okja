export const APP_LOCALES = ['de', 'en'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'de';
export const LOCALE_STORAGE_KEY = 'stato_locale_v1';

export const LOCALE_METADATA: Record<AppLocale, { label: string; intlLocale: string }> = {
  de: { label: 'Deutsch', intlLocale: 'de-DE' },
  en: { label: 'English', intlLocale: 'en-GB' },
};

export function normalizeAppLocale(value?: string | null): AppLocale {
  const primaryLanguage = String(value || '').trim().toLowerCase().split('-')[0];
  return APP_LOCALES.includes(primaryLanguage as AppLocale)
    ? (primaryLanguage as AppLocale)
    : DEFAULT_LOCALE;
}

export function getIntlLocale(locale?: string | null): string {
  return LOCALE_METADATA[normalizeAppLocale(locale)].intlLocale;
}
