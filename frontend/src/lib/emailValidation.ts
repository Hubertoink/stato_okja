const ASCII_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getEmailValidationMessage(value: string): string | null {
  const email = String(value || '').trim();
  if (!email) return null;
  if (/[^\x00-\x7F]/.test(email)) {
    return 'E-Mail-Adressen dürfen keine Umlaute oder andere Nicht-ASCII-Zeichen enthalten.';
  }
  if (!ASCII_EMAIL_PATTERN.test(email)) {
    return 'Bitte eine gültige E-Mail-Adresse eingeben.';
  }
  return null;
}
