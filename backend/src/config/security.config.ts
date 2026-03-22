const PLACEHOLDER_SECRETS = new Set([
  'dev_secret_change_me',
  'please_change',
  'change_me',
  'changeme',
  'secret',
  'password',
]);

function normalize(value: string | undefined | null) {
  return String(value || '').trim();
}

function isStrictMode() {
  const nodeEnv = normalize(process.env.NODE_ENV).toLowerCase();
  const strict = normalize(process.env.STRICT_SECURITY_MODE).toLowerCase();
  return nodeEnv === 'production' || nodeEnv === 'staging' || strict === 'true';
}

function isPlaceholderSecret(value: string) {
  return PLACEHOLDER_SECRETS.has(value.trim().toLowerCase());
}

function isStrongSecret(value: string) {
  return value.length >= 32 && !isPlaceholderSecret(value);
}

export function getJwtSecret() {
  const configured = normalize(process.env.JWT_SECRET);
  if (configured && !isPlaceholderSecret(configured)) return configured;

  if (isStrictMode()) {
    throw new Error('JWT_SECRET muss in dieser Umgebung gesetzt und darf kein Platzhalter sein.');
  }

  return 'local-dev-only-jwt-secret-change-before-production';
}

export function assertSecureRuntimeConfig() {
  if (!isStrictMode()) return;

  const jwtSecret = normalize(process.env.JWT_SECRET);
  if (!isStrongSecret(jwtSecret)) {
    throw new Error('JWT_SECRET muss mindestens 32 Zeichen lang sein und darf kein Platzhalter sein.');
  }

  const dbPassword = normalize(process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD);
  if (!dbPassword || isPlaceholderSecret(dbPassword)) {
    throw new Error('DB_PASSWORD/POSTGRES_PASSWORD muss in dieser Umgebung gesetzt und darf kein Platzhalter sein.');
  }
}