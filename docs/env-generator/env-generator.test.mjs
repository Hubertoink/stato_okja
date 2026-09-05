import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { DEFAULT_VALUES, ZIMAOS_DEFAULT_VERSION, createSecrets, getGeneratedEnvironmentKeys, renderEnvFile, renderZimaDeployFile, validateConfig } from './template.js';

const cryptoApi = {
  getRandomValues(bytes) {
    bytes.forEach((_, index) => { bytes[index] = index; });
    return bytes;
  },
};

function validConfig() {
  return { ...DEFAULT_VALUES, ...createSecrets(cryptoApi) };
}

test('generates the same required environment keys as the on-prem example', async () => {
  const example = await readFile(new URL('../../deploy/onprem/stato.env.example', import.meta.url), 'utf8');
  const expectedKeys = example
    .split(/\r?\n/)
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => line.split('=', 1)[0]);

  assert.deepEqual(getGeneratedEnvironmentKeys(validConfig()), expectedKeys);
});

test('uses secure random values and renders the expected secrets', () => {
  const secrets = createSecrets(cryptoApi);
  assert.match(secrets.databasePassword, /^StatoDb_000102030405060708090a0b0c0d0e0f1011121314151617_A9!$/);
  assert.equal(secrets.jwtSecret.length, 96);
  assert.match(renderEnvFile({ ...DEFAULT_VALUES, ...secrets }), /JWT_SECRET=00010203/);
});

test('rejects insecure or incompatible values', () => {
  const errors = validateConfig({ ...validConfig(), installationMode: 'internal-tls', appOrigin: 'http://stato.intern.example.de', publicHost: 'invalid host' });
  assert.ok(errors.some((message) => message.includes('DNS-Name')));
  assert.ok(errors.some((message) => message.includes('https://')));
});

test('requires the TLS origin to match its host and port', () => {
  const errors = validateConfig({ ...validConfig(), installationMode: 'internal-tls', publicHost: 'stato.intern.example.de', appOrigin: 'https://other.example.de' });
  assert.ok(errors.some((message) => message.includes('DNS-Namen und HTTPS-Port')));
});

test('includes SMTP settings only when email is enabled', () => {
  const config = { ...validConfig(), enableEmail: true, smtpHost: 'mail.example.org', smtpUser: 'mailer@example.org', smtpPass: 'secret', smtpFrom: 'no-reply@example.org' };
  assert.match(renderEnvFile(config), /SMTP_HOST=mail.example.org/);
  assert.doesNotMatch(renderEnvFile(validConfig()), /SMTP_HOST=/);
  assert.match(renderEnvFile(validConfig()), /USER_PROVISIONING_MODE=local/);
});

test('uses secure cookies for HTTPS behind an external proxy', () => {
  assert.match(renderEnvFile({ ...validConfig(), appOrigin: 'https://stato.example.org' }), /AUTH_REFRESH_COOKIE_SECURE=true/);
});

test('requires a separate setup code and preserves it in both formats', () => {
  const config = validConfig();
  assert.notEqual(config.setupToken, config.jwtSecret);
  assert.ok(validateConfig({ ...config, setupToken: '' }).length);
  assert.ok(renderEnvFile(config).includes(`INITIAL_SETUP_TOKEN=${config.setupToken}`));
  assert.ok(renderZimaDeployFile({ ...config, outputFormat: 'zimaos' }).includes(`INITIAL_SETUP_TOKEN: "${config.setupToken}"`));
});

test('renders a self-contained ZimaOS deployment file and derives the HTTP port', () => {
  const config = {
    ...validConfig(),
    outputFormat: 'zimaos',
    appOrigin: 'https://stato.example.org',
    httpPort: '8088',
    imageTag: '',
  };
  const output = renderZimaDeployFile(config);

  assert.match(output, /^name: stato-zimaos/m);
  assert.ok(output.includes(`image: "ghcr.io/hubertoink/stato-backend:${ZIMAOS_DEFAULT_VERSION}"`));
  assert.match(output, /APP_ORIGIN: "https:\/\/stato\.example\.org"/);
  assert.match(output, /AUTH_REFRESH_COOKIE_SECURE: "true"/);
  assert.match(output, /POSTGRES_PASSWORD: "StatoDb_00010203/);
  assert.match(output, /frontend:[\s\S]*?depends_on: \[backend\]/);
  assert.doesNotMatch(output, /frontend:[\s\S]*?condition: service_healthy[\s\S]*?ports:/);
  assert.doesNotMatch(output, /backend-db/);
  assert.doesNotMatch(output, /^networks:/m);
  assert.doesNotMatch(output, /\$\{(?:STATO_VERSION|POSTGRES_PASSWORD|JWT_SECRET)/);
});

test('adds the selected port to a ZimaOS HTTP address without one', () => {
  const output = renderZimaDeployFile({
    ...validConfig(),
    outputFormat: 'zimaos',
    appOrigin: 'http://192.168.178.53',
    httpPort: '8088',
  });

  assert.match(output, /APP_ORIGIN: "http:\/\/192\.168\.178\.53:8088"/);
});
