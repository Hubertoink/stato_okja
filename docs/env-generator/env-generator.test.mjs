import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { DEFAULT_VALUES, createSecrets, getGeneratedEnvironmentKeys, renderEnvFile, validateConfig } from './template.js';

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
});
