import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  normalizeAppLocale,
  type AppLocale,
} from './locales';
import { resources } from './resources';

function getStoredLocale(): AppLocale | null {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored ? normalizeAppLocale(stored) : null;
  } catch {
    return null;
  }
}

function detectInitialLocale(): AppLocale {
  const stored = getStoredLocale();
  if (stored) return stored;
  if (typeof navigator !== 'undefined') {
    return normalizeAppLocale(navigator.languages?.[0] || navigator.language);
  }
  return DEFAULT_LOCALE;
}

function applyDocumentLocale(locale: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = normalizeAppLocale(locale);
}

const initialLocale = detectInitialLocale();

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: ['de', 'en'],
    defaultNS: 'common',
    ns: Object.keys(resources.de),
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });

applyDocumentLocale(initialLocale);
i18n.on('languageChanged', applyDocumentLocale);

export async function setPreferredLocale(locale: AppLocale, options?: { reload?: boolean }) {
  const normalized = normalizeAppLocale(locale);
  const changed = normalizeAppLocale(i18n.resolvedLanguage || i18n.language) !== normalized;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
  } catch {
    // A language switch should also work when browser storage is unavailable.
  }
  await i18n.changeLanguage(normalized);
  if (changed && options?.reload && typeof window !== 'undefined') {
    window.location.reload();
  }
}

export default i18n;
