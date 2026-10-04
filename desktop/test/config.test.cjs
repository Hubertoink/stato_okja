const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { readConfig, writeConfig } = require('../src/config.cjs');

test('configuration is recoverable and stores only a validated server URL', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'stato-config-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'app', 'connection.json');
  assert.deepEqual(await readConfig(file), { serverUrl: '', warning: '' });
  await writeConfig(file, 'https://stato.example.org/');
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), {
    schemaVersion: 1,
    serverUrl: 'https://stato.example.org',
  });
  assert.equal((await readConfig(file)).serverUrl, 'https://stato.example.org');
  await assert.rejects(writeConfig(file, 'https://user:password@stato.example.org'));
  assert.equal((await readConfig(file)).serverUrl, 'https://stato.example.org');
  await writeFile(file, '{ broken');
  assert.ok((await readConfig(file)).warning);
  await writeFile(file, JSON.stringify({ serverUrl: 'file:///C:/secret' }));
  assert.equal((await readConfig(file)).serverUrl, '');
  await writeConfig(file, 'http://127.0.0.1:8080');
  assert.equal((await readConfig(file)).warning, '');
});
