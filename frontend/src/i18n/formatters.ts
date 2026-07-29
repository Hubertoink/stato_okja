import i18n from '.';
import { getIntlLocale } from './locales';

export function getCurrentIntlLocale() {
  return getIntlLocale(i18n.resolvedLanguage || i18n.language);
}

export function formatDate(value: Date | string | number, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(getCurrentIntlLocale(), options).format(new Date(value));
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(getCurrentIntlLocale(), options).format(value);
}

export function formatPercent(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(getCurrentIntlLocale(), { style: 'percent', ...options }).format(value);
}

export function compareLocalized(left: string, right: string) {
  return left.localeCompare(right, getCurrentIntlLocale());
}
