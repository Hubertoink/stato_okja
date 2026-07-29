import { autoT } from '@/i18n/auto';

export const PASSWORD_REQUIREMENTS_TEXT =
  autoT('ui_82b43381ea8b');

export const PASSWORD_REQUIREMENTS_SHORT =
  autoT('ui_961ed8d190b1');

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

type PasswordRequirementState = {
  id: 'length' | 'uppercase' | 'lowercase' | 'digit' | 'special';
  label: string;
  met: boolean;
};

export function isStrongPassword(password: string) {
  return STRONG_PASSWORD_REGEX.test(String(password || ''));
}

export function getPasswordRequirementStates(password: string): PasswordRequirementState[] {
  const value = String(password || '');
  return [
    { id: 'length', label: autoT('ui_c7e2aa72d9ae'), met: value.length >= 12 },
    { id: 'uppercase', label: autoT('ui_0731587f6de7'), met: /[A-Z]/.test(value) },
    { id: 'lowercase', label: autoT('ui_b7ca0f07c3fa'), met: /[a-z]/.test(value) },
    { id: 'digit', label: autoT('ui_9bc423f4549f'), met: /\d/.test(value) },
    { id: 'special', label: autoT('ui_0af3ceef9ce2'), met: /[^A-Za-z0-9]/.test(value) },
  ];
}

export function getPasswordValidationMessage(password: string) {
  if (!password) return null;
  return isStrongPassword(password) ? null : PASSWORD_REQUIREMENTS_SHORT;
}
