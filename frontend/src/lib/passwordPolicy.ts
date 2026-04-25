export const PASSWORD_REQUIREMENTS_TEXT =
  'Mindestens 12 Zeichen mit Großbuchstaben, Kleinbuchstaben, Zahl und Sonderzeichen.';

export const PASSWORD_REQUIREMENTS_SHORT =
  'Mind. 12 Zeichen, Groß-/Kleinbuchstaben, Zahl und Sonderzeichen';

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
    { id: 'length', label: 'Mindestens 12 Zeichen', met: value.length >= 12 },
    { id: 'uppercase', label: 'Mindestens ein Großbuchstabe', met: /[A-Z]/.test(value) },
    { id: 'lowercase', label: 'Mindestens ein Kleinbuchstabe', met: /[a-z]/.test(value) },
    { id: 'digit', label: 'Mindestens eine Zahl', met: /\d/.test(value) },
    { id: 'special', label: 'Mindestens ein Sonderzeichen', met: /[^A-Za-z0-9]/.test(value) },
  ];
}

export function getPasswordValidationMessage(password: string) {
  if (!password) return null;
  return isStrongPassword(password) ? null : PASSWORD_REQUIREMENTS_SHORT;
}