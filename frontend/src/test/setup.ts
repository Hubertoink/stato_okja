import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import i18n from '@/i18n';
import { LOCALE_STORAGE_KEY } from '@/i18n/locales';

beforeEach(async () => {
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  await i18n.changeLanguage('de');
});
