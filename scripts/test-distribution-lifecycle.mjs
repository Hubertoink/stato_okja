// Real Docker integration test. Every resource has a random test-only name.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'stato-distribution-test-'));
const name = `stato-distribution-test-${randomBytes(6).toString('hex')}`;
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', timeout: 300_000, ...options });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout || result.error}`);
  return result.stdout.trim();
}
const docker = (...args) => run('docker', args);
mkdirSync(join(directory, 'config'));
cpSync(join(root, 'legal'), join(directory, 'config/legal'), { recursive: true });
cpSync(join(root, 'scripts/onprem-runtime.sh'), join(directory, 'onprem-runtime.sh'));
cpSync(join(root, 'scripts/onprem-runtime.ps1'), join(directory, 'onprem-runtime.ps1'));
const token = randomBytes(32).toString('hex');
let env = readFileSync(join(root, 'deploy/onprem/stato.env.example'), 'utf8')
  .replace(/^POSTGRES_PASSWORD=.*$/m, `POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}`)
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(48).toString('hex')}`)
  .replace(/^INITIAL_SETUP_TOKEN=.*$/m, `INITIAL_SETUP_TOKEN=${token}`);
writeFileSync(join(directory, 'config/stato.env'), env);
const runtime = JSON.parse(docker('compose', '--env-file', join(directory, 'config/stato.env'), '-f', join(root, 'deploy/onprem/compose.yaml'), 'config', '--format', 'json'));
runtime.name = name;
delete runtime.services.caddy;
for (const [key, volume] of Object.entries(runtime.volumes)) volume.name = `${name}-${key}`;
for (const [key, network] of Object.entries(runtime.networks)) network.name = `${name}-${key}`;
for (const service of ['backend', 'frontend', 'backup']) runtime.services[service].image = `stato-${service}:distribution-review`;
runtime.services.frontend.ports = [{ target: 8080, published: '0', host_ip: '127.0.0.1', protocol: 'tcp' }];
for (const service of Object.values(runtime.services)) {
  for (const volume of service.volumes || []) {
    if (volume.type !== 'bind') continue;
    volume.source = volume.target === '/app/legal' ? join(directory, 'config/legal') :
      volume.target === '/mnt/config' ? join(directory, 'config') : join(directory, 'backup-export');
    mkdirSync(volume.source, { recursive: true });
  }
}
runtime.services.backup.environment.STATO_BACKUP_VERSION = 'distribution-review';
writeFileSync(join(directory, 'compose.yaml'), JSON.stringify(runtime));
const compose = (...args) => docker('compose', '-f', 'compose.yaml', ...args);
const query = sql => compose('exec', '-T', 'postgres', 'psql', '-U', 'stato_user', '-d', 'stato_prod', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql);
const status = [];
try {
  console.log(`Isolated test directory: ${directory}`);
  compose('up', '-d', '--wait', '--wait-timeout', '180');
  let address = `http://${compose('port', 'frontend', '8080')}`;
  assert.equal((await fetch(`${address}/api/health`)).status, 200);
  assert.match(await (await fetch(`${address}/start/`)).text(), /Ein einfacher Start/);
  const generator = await (await fetch(`${address}/env-generator/template.js`)).text();
  assert.ok(generator.includes(`ZIMAOS_DEFAULT_VERSION = "${readFileSync(join(root, 'VERSION'), 'utf8').trim()}"`));
  // Compose waits for running containers, not for the first asynchronous backup.
  compose('exec', '-T', 'backup', 'sh', '-ec', 'for attempt in $(seq 1 60); do if test -s /backups/last-success.txt; then exit 0; fi; sleep 1; done; echo "First automatic backup did not finish" >&2; exit 1');
  const setup = body => fetch(`${address}/api/auth/initial-setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const password = 'DistributionTest_9!Secure';
  assert.equal((await setup({ password, setupToken: 'x'.repeat(64), email: 'pilot@stato.local' })).status, 403);
  const concurrent = await Promise.all([
    setup({ password, setupToken: token, email: 'pilot@stato.local' }),
    setup({ password, setupToken: token, email: 'other@stato.local' }),
  ]);
  assert.deepEqual(concurrent.map(response => response.status).sort(), [201, 409]);
  assert.equal(query("SELECT count(*) FROM users WHERE role = 'superadmin'"), '1');
  status.push('Fresh install, API proxy, wrong setup code, concurrent one-time setup');
  query('CREATE TABLE distribution_fixture (id integer PRIMARY KEY, value text); INSERT INTO distribution_fixture VALUES (1, \'before-update\')');
  compose('exec', '-T', 'backend', 'sh', '-ec', 'printf "original upload" > /app/uploads/distribution-fixture.txt');
  compose('exec', '-T', 'backup', '/usr/local/bin/stato-container-backup');
  const backups = readdirSync(join(directory, 'backup-export')).filter(entry => entry.startsWith('stato-container-')).sort();
  const backupDirectory = join(directory, 'backup-export', backups.at(-1));
  for (const file of ['postgres.dump', 'uploads.tar.gz', 'config.tar.gz', 'VERSION', 'SHA256SUMS']) {
    assert.ok(readFileSync(join(backupDirectory, file)).length > 0);
  }
  status.push('Backup, configuration archive, version, second destination');
  compose('up', '-d', '--force-recreate', '--wait', '--wait-timeout', '180', 'backend', 'frontend');
  address = `http://${compose('port', 'frontend', '8080')}`;
  assert.equal(query('SELECT value FROM distribution_fixture WHERE id = 1'), 'before-update');
  query("UPDATE distribution_fixture SET value = 'after-update'");
  compose('exec', '-T', 'backend', 'sh', '-ec', 'printf "modified upload" > /app/uploads/distribution-fixture.txt');
  const restoreArgs = process.platform === 'win32'
    ? ['-NoProfile', '-File', join(directory, 'onprem-runtime.ps1'), 'restore', '-BackupDirectory', backupDirectory, '-ConfirmText', 'RESTORE STATO BACKUP']
    : [join(directory, 'onprem-runtime.sh'), 'restore', backupDirectory, 'RESTORE STATO BACKUP'];
  const restoreCommand = process.platform === 'win32' ? 'pwsh' : 'sh';
  const checksumFile = join(backupDirectory, 'SHA256SUMS');
  const checksums = readFileSync(checksumFile, 'utf8');
  writeFileSync(checksumFile, checksums.replace(/^[a-f0-9]{64}/, '0'.repeat(64)));
  assert.throws(() => run(restoreCommand, restoreArgs));
  assert.equal(query('SELECT value FROM distribution_fixture WHERE id = 1'), 'after-update');
  assert.equal((await fetch(`${address}/api/health`)).status, 200);
  writeFileSync(checksumFile, checksums);
  run(restoreCommand, restoreArgs);
  assert.equal(query('SELECT value FROM distribution_fixture WHERE id = 1'), 'before-update');
  assert.equal(compose('exec', '-T', 'backend', 'cat', '/app/uploads/distribution-fixture.txt'), 'original upload');
  query("UPDATE distribution_fixture SET value = 'legacy-restore-test'");
  writeFileSync(checksumFile, checksums.replace(/  ([^\n]+)/g, '  /backups/stato-container-fixture/$1'));
  run(restoreCommand, restoreArgs);
  assert.equal(query('SELECT value FROM distribution_fixture WHERE id = 1'), 'before-update');
  status.push('Container replacement preserves data; packaged restore restores DB and uploads');
  status.push('Corrupt backup rejected without stopping app; historical checksum paths restored');
  console.log(status.join('\n'));
} catch (error) {
  // Backup logs contain paths/status only, never configuration or dump contents.
  try { console.error(compose('logs', '--no-color', '--tail', '80', 'backup')); } catch { /* Preserve original failure. */ }
  throw error;
} finally {
  // The generated Compose file exclusively names resources with this random prefix.
  compose('down', '--volumes', '--remove-orphans');
  console.log(`Test logs/config retained locally in ${directory}; all test containers/volumes removed.`);
}
