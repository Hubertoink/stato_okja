const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createCredentialStore } = require('../src/credentials.cjs');

function fakeSafeStorage(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (text) => Buffer.from(`enc:${Buffer.from(text).toString('hex')}`),
    decryptString: (buffer) => {
      const value = buffer.toString();
      if (!value.startsWith('enc:')) throw new Error('decrypt failed');
      return Buffer.from(value.slice(4), 'hex').toString();
    },
  };
}

test('credentials are stored encrypted per server and can be removed', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'stato-credentials-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'app', 'credentials.json');
  const store = createCredentialStore(file, fakeSafeStorage());
  assert.equal(store.available(), true);
  assert.equal(await store.get('https://stato.example.org'), null);

  await store.save('https://stato.example.org/', { email: 'a@example.org', password: 'geheim' });
  await store.save('http://127.0.0.1:8080', { email: 'b@example.org', password: 'anders' });
  const raw = await readFile(file, 'utf8');
  assert.doesNotMatch(raw, /geheim|a@example\.org/);
  assert.deepEqual(Object.keys(JSON.parse(raw).entries).sort(), [
    'http://127.0.0.1:8080',
    'https://stato.example.org',
  ]);
  assert.deepEqual(await store.get('https://stato.example.org'), {
    email: 'a@example.org',
    password: 'geheim',
  });

  await store.save('https://stato.example.org', { email: 'a@example.org', password: 'neu' });
  assert.equal((await store.get('https://stato.example.org')).password, 'neu');
  await assert.rejects(store.save('https://stato.example.org', { email: '', password: 'x' }));

  await store.remove('https://stato.example.org');
  assert.equal(await store.get('https://stato.example.org'), null);
  assert.equal((await store.get('http://127.0.0.1:8080')).email, 'b@example.org');

  await writeFile(file, JSON.stringify({ entries: { 'http://127.0.0.1:8080': 'broken' } }));
  assert.equal(await store.get('http://127.0.0.1:8080'), null);
  await writeFile(file, '{ broken');
  assert.equal(await store.get('http://127.0.0.1:8080'), null);
});

test('nothing is stored without OS encryption', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'stato-credentials-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = createCredentialStore(join(directory, 'credentials.json'), fakeSafeStorage(false));
  assert.equal(store.available(), false);
  await assert.rejects(
    store.save('https://stato.example.org', { email: 'a@example.org', password: 'geheim' }),
  );
  assert.equal(await store.get('https://stato.example.org'), null);
});
