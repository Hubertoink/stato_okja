function normalize(value: string | undefined | null) {
  return String(value || '').trim();
}

function parseBooleanish(value: string | undefined | null) {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return false;
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function parsePositiveInt(value: string | undefined | null, fallback: number) {
  const parsed = Number.parseInt(normalize(value), 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return parsed;
}

export function isTwoFactorAuthenticationEnabled() {
  return parseBooleanish(process.env.AUTH_2FA_ENABLED);
}

export function getTwoFactorCodeTtlSeconds() {
  return parsePositiveInt(process.env.AUTH_2FA_CODE_TTL, 600);
}

export function assertTwoFactorRuntimeConfig() {
  if (!isTwoFactorAuthenticationEnabled()) return;

  const smtpHost = normalize(process.env.SMTP_HOST);
  if (!smtpHost) {
    throw new Error('AUTH_2FA_ENABLED=true erfordert eine funktionierende SMTP-Konfiguration (mindestens SMTP_HOST).');
  }

  getTwoFactorCodeTtlSeconds();
}