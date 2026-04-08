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

function parseBooleanish(value: string | undefined | null) {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on' || normalized === 'require') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off' || normalized === 'disable') {
    return false;
  }
  return undefined;
}

function isInternalDatabaseHost(host: string) {
  const normalized = normalize(host).toLowerCase();
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized === 'postgres';
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

export function getDatabaseTlsPolicy() {
  const dbType = normalize(process.env.DB_TYPE || 'postgres').toLowerCase();
  const host = normalize(process.env.DB_HOST || 'localhost');
  const sslEnv = normalize(process.env.DB_SSL).toLowerCase();
  const useSsl = sslEnv === 'true' || sslEnv === 'require' || sslEnv === '1';
  const rejectUnauthorized = normalize(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';
  const explicitRequireSsl = parseBooleanish(process.env.DB_REQUIRE_SSL);

  if (dbType !== 'postgres') {
    return { useSsl: false, rejectUnauthorized: false };
  }

  const requireSsl = explicitRequireSsl ?? (isStrictMode() && !isInternalDatabaseHost(host));

  if (requireSsl) {
    if (!useSsl) {
      throw new Error('DB_SSL muss für externe Postgres-Verbindungen in dieser Umgebung aktiviert sein.');
    }
    if (!rejectUnauthorized) {
      throw new Error('DB_SSL_REJECT_UNAUTHORIZED muss für externe Postgres-Verbindungen in dieser Umgebung aktiviert sein.');
    }
  }

  return { useSsl, rejectUnauthorized };
}