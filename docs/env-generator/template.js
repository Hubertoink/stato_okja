export const ENV_GENERATOR_VERSION = '1.2.0';

export const DEFAULT_VALUES = {
  outputFormat: 'onprem',
  installationMode: 'local',
  appOrigin: 'http://localhost',
  httpPort: '80',
  publicHost: '',
  httpsPort: '443',
  organizationName: 'Meine Organisation',
  appName: 'StatO',
  superadminEmail: 'admin@stato.local',
  imageTag: '',
  timezone: 'Europe/Berlin',
  backupRetentionDays: '14',
  provisioningMode: 'email',
  enableEmail: false,
  smtpHost: '',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
  enableTwoFactor: false,
  databasePassword: '',
  jwtSecret: '',
  setupToken: '',
};

export const ZIMAOS_DEFAULT_VERSION = '1.9.1';

const BASE_VARIABLES = [
  ['POSTGRES_DB', 'stato_prod'],
  ['POSTGRES_USER', 'stato_user'],
  ['POSTGRES_PASSWORD', (config) => config.databasePassword],
  ['HTTP_BIND_ADDRESS', (config) => (config.installationMode === 'internal-tls' ? '127.0.0.1' : '0.0.0.0')],
  ['HTTP_PORT', (config) => config.httpPort],
  ['APP_ORIGIN', (config) => config.appOrigin],
  ['CORS_ORIGINS', (config) => config.appOrigin],
  ['API_PREFIX', 'api'],
  ['TRUST_PROXY', 'true'],
  ['STATO_TLS_MODE', (config) => (config.installationMode === 'internal-tls' ? 'internal' : 'off')],
  ['STATO_PUBLIC_HOST', (config) => (config.installationMode === 'internal-tls' ? config.publicHost : '')],
  ['HTTPS_BIND_ADDRESS', '0.0.0.0'],
  ['HTTPS_PORT', (config) => config.httpsPort],
  ['AUTH_REFRESH_COOKIE_SECURE', (config) => String(config.appOrigin.startsWith('https://'))],
  ['AUTH_REFRESH_COOKIE_SAMESITE', 'lax'],
  ['JWT_SECRET', (config) => config.jwtSecret],
  ['JWT_ACCESS_EXPIRATION', '15m'],
  ['JWT_REFRESH_EXPIRATION', '7d'],
  ['INVITE_TOKEN_EXPIRATION', '24h'],
  ['RESET_TOKEN_EXPIRATION', '1h'],
  ['AUTH_2FA_ENABLED', (config) => String(config.enableTwoFactor)],
  ['AUTH_2FA_CODE_TTL', '600'],
  ['STRICT_SECURITY_MODE', 'true'],
  ['SWAGGER_ENABLED', 'false'],
  ['SUPERADMIN_EMAIL', (config) => config.superadminEmail],
  ['SUPERADMIN_PASSWORD', ''],
  ['SUPERADMIN_EMAIL_FORCE', 'false'],
  ['SUPERADMIN_PASSWORD_FORCE', 'false'],
  ['INITIAL_SETUP_ENABLED', 'true'],
  ['INITIAL_SETUP_TOKEN', (config) => config.setupToken],
  ['DB_SYNCHRONIZE', 'false'],
  ['DB_MIGRATIONS_RUN', 'true'],
  ['DB_BOOTSTRAP_ON_EMPTY', 'true'],
  ['DB_LOGGING', 'false'],
  ['DB_REQUIRE_SSL', 'false'],
  ['DB_SSL', 'false'],
  ['DB_SSL_REJECT_UNAUTHORIZED', 'false'],
  ['PASSWORD_RESET_MODE', (config) => (config.enableEmail ? 'email' : 'admin_temp_password')],
  ['USER_PROVISIONING_MODE', (config) => config.enableEmail ? config.provisioningMode : 'local'],
  ['STATO_IMAGE_TAG', (config) => config.imageTag],
  ['STATO_FRONTEND_IMAGE_TAG', (config) => (config.imageTag ? `onprem-${config.imageTag}` : '')],
  ['PUBLIC_APP_NAME', (config) => config.appName],
  ['PUBLIC_ORG_NAME', (config) => config.organizationName],
  ['PUBLIC_LOGIN_SUBTITLE', 'OKJA Statistik und Dokumentation'],
  ['PUBLIC_LIVE_REFRESH_INTERVAL_MS', '30000'],
  ['STATS_OVERVIEW_CACHE_TTL_MS', '0'],
  ['RATE_LIMIT_TTL', '60'],
  ['RATE_LIMIT_MAX', '100'],
  ['AUTH_RATE_LIMIT_TTL', '60'],
  ['AUTH_RATE_LIMIT_MAX', '10'],
  ['LOGIN_MAX_FAILED_ATTEMPTS', '5'],
  ['LOGIN_LOCKOUT_MINUTES', '10'],
  ['VITE_ENABLE_DEV_TOOLS', 'false'],
  ['ENABLE_ORG_MOVE', 'false'],
  ['ENABLE_PROCESSES', 'true'],
  ['TZ', (config) => config.timezone],
  ['BACKUP_RETENTION_DAYS', (config) => config.backupRetentionDays],
  ['BACKUP_INTERVAL_SECONDS', '86400'],
  ['BACKUP_COPY_DIR', './backup-export'],
  ['APP_ENV', 'production'],
  ['NODE_ENV', 'production'],
];

function valueFor(variable, config) {
  return typeof variable[1] === 'function' ? variable[1](config) : variable[1];
}

export function createRandomHex(byteLength, cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Der Browser unterstützt keine sichere Zufallsgenerierung.');
  }

  const bytes = new Uint8Array(byteLength);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createSecrets(cryptoApi = globalThis.crypto) {
  return {
    databasePassword: `StatoDb_${createRandomHex(24, cryptoApi)}_A9!`,
    jwtSecret: createRandomHex(48, cryptoApi),
    setupToken: createRandomHex(32, cryptoApi),
  };
}

function hasLineBreak(value) {
  return /[\r\n]/.test(value);
}

function validPort(value) {
  return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535;
}

function validOrigin(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.pathname === '/' && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function validHostname(value) {
  return /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(value) && value.includes('.') && !value.includes('..');
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function zimaVersion(config) {
  return String(config.imageTag || '').trim() || ZIMAOS_DEFAULT_VERSION;
}

function zimaOrigin(config) {
  const origin = new URL(config.appOrigin);
  if (origin.protocol === 'http:' && !origin.port) origin.port = config.httpPort;
  return origin.toString().replace(/\/$/, '');
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

export function validateConfig(config) {
  const errors = [];
  Object.entries(config).forEach(([key, value]) => {
    if (typeof value === 'string' && hasLineBreak(value)) {
      errors.push(`${key} darf keinen Zeilenumbruch enthalten.`);
    }
  });
  const requiredTextFields = [
    ['Superadmin-E-Mail', config.superadminEmail],
    ['Datenbankpasswort', config.databasePassword],
    ['JWT-Secret', config.jwtSecret],
    ['Einrichtungscode', config.setupToken],
  ];

  if (config.outputFormat !== 'zimaos') {
    requiredTextFields.unshift(['Organisation', config.organizationName], ['Anwendungsname', config.appName]);
    requiredTextFields.push(['Zeitzone', config.timezone]);
  }

  requiredTextFields.forEach(([label, value]) => {
    if (!value.trim()) errors.push(`${label} darf nicht leer sein.`);
  });

  if (!validOrigin(config.appOrigin)) errors.push('Die öffentliche Adresse muss eine vollständige HTTP(S)-Adresse ohne Pfad sein.');
  if (!validEmail(config.superadminEmail)) errors.push('Die Superadmin-E-Mail-Adresse ist ungültig.');
  if (!validPort(config.httpPort)) errors.push('Der HTTP-Port muss zwischen 1 und 65535 liegen.');
  if (!validPort(config.httpsPort)) errors.push('Der HTTPS-Port muss zwischen 1 und 65535 liegen.');
  if (config.jwtSecret.length < 64) errors.push('Das JWT-Secret muss mindestens 64 Zeichen lang sein.');
  if (!config.setupToken || config.setupToken.length < 32) errors.push('Der Einrichtungscode muss mindestens 32 Zeichen lang sein.');

  if (config.outputFormat === 'zimaos' && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(zimaVersion(config))) {
    errors.push('Die Image-Version muss eine gültige Versionsnummer wie 1.6.0 sein.');
  }

  if (config.installationMode === 'internal-tls') {
    if (!validHostname(config.publicHost)) errors.push('Für internes HTTPS ist ein gültiger DNS-Name ohne Protokoll oder Port erforderlich.');
    if (!config.appOrigin.startsWith('https://')) errors.push('Bei internem HTTPS muss die öffentliche Adresse mit https:// beginnen.');
    const expectedOrigin = `https://${config.publicHost}${config.httpsPort === '443' ? '' : `:${config.httpsPort}`}`;
    if (validHostname(config.publicHost) && config.appOrigin !== expectedOrigin) errors.push('Die öffentliche Adresse muss zum DNS-Namen und HTTPS-Port passen.');
  }

  if (config.enableEmail) {
    [['SMTP-Host', config.smtpHost], ['SMTP-Benutzer', config.smtpUser], ['SMTP-Passwort', config.smtpPass], ['SMTP-Absender', config.smtpFrom]].forEach(([label, value]) => {
      if (!value.trim()) errors.push(`${label} darf bei aktiviertem E-Mail-Versand nicht leer sein.`);
    });
    if (!validPort(config.smtpPort)) errors.push('Der SMTP-Port muss zwischen 1 und 65535 liegen.');
    if (config.smtpFrom && !validEmail(config.smtpFrom)) errors.push('Die SMTP-Absenderadresse ist ungültig.');
  }

  if (config.enableTwoFactor && !config.enableEmail) errors.push('Zwei-Faktor-Authentifizierung benötigt aktivierten E-Mail-Versand.');
  return errors;
}

export function renderEnvFile(config) {
  const errors = validateConfig(config);
  if (errors.length) throw new Error(errors.join('\n'));

  const lines = [
    '# StatO On-Prem configuration',
    '# Erstellt lokal im Browser – Secrets werden nicht übertragen.',
    '# Diese Datei sicher aufbewahren und niemals in Git committen.',
    '',
    '# Database',
  ];

  BASE_VARIABLES.forEach(([key, value]) => {
    if (key === 'HTTP_BIND_ADDRESS') lines.push('', '# Public address and Docker port');
    if (key === 'JWT_SECRET') lines.push('', '# Authentication and security');
    if (key === 'SUPERADMIN_EMAIL') lines.push('', '# Initial account for a new, empty database');
    if (key === 'DB_SYNCHRONIZE') lines.push('', '# Database schema and connection policy');
    if (key === 'PASSWORD_RESET_MODE') lines.push('', '# Password reset and email');
    if (key === 'STATO_IMAGE_TAG') lines.push('', '# Branding and runtime behavior');
    lines.push(`${key}=${valueFor([key, value], config)}`);
  });

  if (config.enableEmail) {
    lines.push('', '# SMTP (enabled)');
    lines.push(`SMTP_HOST=${config.smtpHost}`);
    lines.push(`SMTP_PORT=${config.smtpPort}`);
    lines.push(`SMTP_USER=${config.smtpUser}`);
    lines.push(`SMTP_PASS=${config.smtpPass}`);
    lines.push(`SMTP_FROM=${config.smtpFrom}`);
  }

  return `${lines.join('\n')}\n`;
}

export function renderZimaDeployFile(config) {
  const zimaConfig = { ...config, outputFormat: 'zimaos' };
  const errors = validateConfig(zimaConfig);
  if (errors.length) throw new Error(errors.join('\n'));

  const version = zimaVersion(config);
  const origin = zimaOrigin(config);
  const cookieSecure = String(origin.startsWith('https://'));

  return [
    '# StatO Docker-Compose-Deployment',
    '# Diese Datei enthält Secrets. Sicher aufbewahren und direkt in ZimaOS, Portainer oder Docker Compose verwenden.',
    '',
    'name: stato-zimaos',
    '',
    'x-hardened: &hardened',
    '  restart: unless-stopped',
    '  read_only: true',
    '  security_opt: [no-new-privileges:true]',
    '  cap_drop: [ALL]',
    '',
    'x-healthcheck: &healthcheck',
    '  interval: 30s',
    '  timeout: 5s',
    '  retries: 5',
    '',
    'x-casaos:',
    '  id: org.stato.zimaos',
    '  main: frontend',
    '  title:',
    '    de_DE: StatO',
    '    en_US: StatO',
    '  author: StatO',
    '  developer: StatO',
    '  category: Others',
    `  version: ${yamlString(version)}`,
    '  architectures: [amd64, arm64]',
    '  icon: https://raw.githubusercontent.com/Hubertoink/stato_okja/main/frontend/assets/Stato_Logo.png',
    '  description:',
    '    de_DE: Datenschutzfreundliche Statistik und Dokumentation für die Offene Kinder- und Jugendarbeit.',
    '    en_US: Privacy-friendly statistics and documentation for open child and youth work.',
    '  tagline:',
    '    de_DE: Statistik und Dokumentation für die OKJA',
    '    en_US: Statistics and documentation for open child and youth work',
    '  scheme: http',
    '  index: /',
    `  port_map: ${yamlString(config.httpPort)}`,
    '',
    'services:',
    '  postgres:',
    '    image: postgres:16-alpine',
    '    restart: unless-stopped',
    '    security_opt: [no-new-privileges:true]',
    '    environment:',
    '      POSTGRES_DB: stato_prod',
    '      POSTGRES_USER: stato_user',
    `      POSTGRES_PASSWORD: ${yamlString(config.databasePassword)}`,
    '      TZ: Europe/Berlin',
    '    volumes:',
    '      - postgres-data:/var/lib/postgresql/data',
    '    healthcheck:',
    '      test: [CMD-SHELL, "pg_isready -U stato_user -d stato_prod"]',
    '      interval: 10s',
    '      timeout: 5s',
    '      retries: 10',
    '',
    '  backend:',
    '    <<: *hardened',
    `    image: ${yamlString(`ghcr.io/hubertoink/stato-backend:${version}`)}`,
    '    tmpfs: [/tmp]',
    '    environment:',
    '      NODE_ENV: production',
    '      APP_ENV: production',
    '      TZ: Europe/Berlin',
    `      APP_ORIGIN: ${yamlString(origin)}`,
    `      CORS_ORIGINS: ${yamlString(origin)}`,
    `      AUTH_REFRESH_COOKIE_SECURE: ${yamlString(cookieSecure)}`,
    '      DB_HOST: postgres',
    '      DB_USERNAME: stato_user',
    `      DB_PASSWORD: ${yamlString(config.databasePassword)}`,
    '      DB_DATABASE: stato_prod',
    `      JWT_SECRET: ${yamlString(config.jwtSecret)}`,
    '      PASSWORD_RESET_MODE: admin_temp_password',
    '      USER_PROVISIONING_MODE: local',
    `      SUPERADMIN_EMAIL: ${yamlString(config.superadminEmail)}`,
    '      INITIAL_SETUP_ENABLED: "true"',
    `      INITIAL_SETUP_TOKEN: ${yamlString(config.setupToken)}`,
    '    depends_on:',
    '      postgres:',
    '        condition: service_healthy',
    '    volumes:',
    '      - backend-uploads:/app/uploads',
    '    healthcheck:',
    '      <<: *healthcheck',
    '      test: [CMD-SHELL, "node -e \\\"fetch(\'http://127.0.0.1:3000/api/health\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\\\""]',
    '      start_period: 20s',
    '',
    '  frontend:',
    '    <<: *hardened',
    `    image: ${yamlString(`ghcr.io/hubertoink/stato-frontend:onprem-${version}`)}`,
    '    tmpfs: [/tmp, /var/cache/nginx, /var/run]',
    '    # Do not wait for backend health: Compose front ends start services asynchronously.',
    '    depends_on: [backend]',
    '    ports:',
    '      - target: 8080',
    `        published: ${yamlString(config.httpPort)}`,
    '        protocol: tcp',
    '    healthcheck:',
    '      <<: *healthcheck',
    '      test: [CMD-SHELL, "wget -q --spider http://127.0.0.1:8080/healthz || exit 1"]',
    '      start_period: 10s',
    '',
    '  backup:',
    '    <<: *hardened',
    `    image: ${yamlString(`ghcr.io/hubertoink/stato-backup:${version}`)}`,
    '    tmpfs: [/tmp]',
    '    environment:',
    '      PGHOST: postgres',
    '      PGUSER: stato_user',
    `      PGPASSWORD: ${yamlString(config.databasePassword)}`,
    '      PGDATABASE: stato_prod',
    '      BACKUP_OUTPUT_DIR: /backups',
    '      BACKUP_UPLOADS_DIR: /mnt/uploads',
    '      BACKUP_RETENTION_DAYS: "14"',
    '      BACKUP_INTERVAL_SECONDS: "86400"',
    '    depends_on:',
    '      postgres:',
    '        condition: service_healthy',
    '    volumes:',
    '      - backend-uploads:/mnt/uploads:ro',
    '      - backup-data:/backups',
    '',
    'volumes:',
    '  postgres-data:',
    '  backend-uploads:',
    '  backup-data:',
    '',
  ].join('\n');
}

export function getGeneratedEnvironmentKeys(config) {
  return renderEnvFile(config)
    .split('\n')
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => line.split('=', 1)[0]);
}
