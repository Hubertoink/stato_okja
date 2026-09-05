import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
  ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const digest = `sha256:${'a'.repeat(64)}`;
const mockCommands = `
trivy() {
  printf 'scan %s\\n' "$*" >> "$TEST_LOG"
  if [[ -n "$FAIL_MATCH" && "$*" == *"$FAIL_MATCH"* ]]; then return 1; fi
}
docker() {
  if [[ "$*" == *'imagetools inspect'* ]]; then
    printf '%s\\n' "$TEST_DIGEST"
  elif [[ "$*" == *'imagetools create'* ]]; then
    printf 'promote %s\\n' "$*" >> "$TEST_LOG"
  else
    return 2
  fi
}
export -f trivy docker
bash "$@"
`;

function run(script, args, failMatch = '') {
  const dir = mkdtempSync(join(tmpdir(), 'stato-security-test-'));
  const log = join(dir, 'commands.log');
  try {
    const result = spawnSync(bash, ['-c', mockCommands, 'test', script, ...args], {
      encoding: 'utf8',
      env: { ...process.env, TEST_LOG: log.replaceAll('\\', '/'), TEST_DIGEST: digest, FAIL_MATCH: failMatch },
    });
    assert.ifError(result.error);
    return { ...result, lines: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [] };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('mutable references are rejected before scanning', () => {
  const result = run('scripts/check-container-security.sh', ['example/backend:latest', 'linux/amd64']);
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.lines, []);
});

test('a failed architecture blocks the gate and every architecture is checked', () => {
  const result = run('scripts/check-container-security.sh', [`example/backend@${digest}`, 'linux/amd64,linux/arm64'], 'linux/amd64');
  assert.notEqual(result.status, 0);
  assert.equal(result.lines.length, 2);
  assert.match(result.lines[1], /--platform linux\/arm64/);
  for (const line of result.lines) {
    assert.match(line, /--severity HIGH,CRITICAL --ignore-unfixed --exit-code 1/);
  }
});

test('successful scans allow the gate', () => {
  const result = run('scripts/check-container-security.sh', [`example/backend@${digest}`, 'linux/amd64,linux/arm64']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.lines.length, 2);
});

test('a failure in a later image prevents every latest promotion', () => {
  const result = run('scripts/promote-scanned-release.sh', ['1.9.1', 'example/backend', 'example/backup'], 'example/backup@');
  assert.notEqual(result.status, 0);
  assert.equal(result.lines.filter((line) => line.startsWith('scan ')).length, 4);
  assert.equal(result.lines.filter((line) => line.startsWith('promote ')).length, 0);
});

test('promotion reuses the scanned digests after all images pass', () => {
  const result = run('scripts/promote-scanned-release.sh', ['1.9.1', 'Example/Backend', 'example/backup']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.lines.map((line) => line.split(' ')[0]), ['scan', 'scan', 'scan', 'scan', 'promote', 'promote']);
  assert.equal(result.lines[4], `promote buildx imagetools create --tag example/backend:latest example/backend@${digest}`);
  assert.equal(result.lines[5], `promote buildx imagetools create --tag example/backup:latest example/backup@${digest}`);
});

test('invalid release versions cannot be promoted', () => {
  const result = run('scripts/promote-scanned-release.sh', ['1.9.1;invalid', 'example/backend']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Release version must be a stable version/);
  assert.deepEqual(result.lines, []);
});

test('missing image repositories produce an actionable error', () => {
  const result = run('scripts/promote-scanned-release.sh', ['1.9.1']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /At least one image repository is required/);
  assert.deepEqual(result.lines, []);
});
