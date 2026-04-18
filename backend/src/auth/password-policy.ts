export const PASSWORD_POLICY_MESSAGE =
  'Passwort muss mindestens 12 Zeichen mit Groß-/Kleinbuchstaben, Zahl und Sonderzeichen enthalten';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export function isStrongPassword(password: string) {
  return STRONG_PASSWORD_REGEX.test(String(password || ''));
}