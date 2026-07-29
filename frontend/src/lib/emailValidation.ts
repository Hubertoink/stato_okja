import { autoT } from '@/i18n/auto';

const ASCII_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getEmailValidationMessage(value: string): string | null {
  const email = String(value || '').trim();
  if (!email) return null;
  if ([...email].some((character) => character.charCodeAt(0) > 0x7f)) {
    return autoT('ui_1823bc28b1c6');
  }
  if (!ASCII_EMAIL_PATTERN.test(email)) {
    return autoT('ui_18434e4fc152');
  }
  return null;
}
