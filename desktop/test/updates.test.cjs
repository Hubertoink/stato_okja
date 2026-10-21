const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { selectDesktopRelease, discoverDesktopRelease, createUpdateController } = require('../src/updates.cjs');

function release(version, extra = {}) {
  return { tag_name: `desktop-v${version}`, prerelease: true, assets: [
    { name: 'latest.yml', state: 'uploaded' },
    { name: `StatO-Setup-${version}-x64.exe`, state: 'uploaded' },
  ], ...extra };
}

function fixture(options = {}) {
  const updater = new EventEmitter();
  let installs = 0;
  let downloads = 0;
  updater.setFeedURL = (feed) => { updater.feed = feed; };
  updater.checkForUpdates = async () => ({ updateInfo: { version: '1.17.0' } });
  updater.downloadUpdate = async () => {
    downloads += 1;
    updater.emit('download-progress', { percent: 52.6 });
    updater.emit('update-downloaded', { version: '1.17.0' });
  };
  updater.quitAndInstall = (silent, restart) => { assert.equal(silent, false); assert.equal(restart, true); installs += 1; };
  const states = [];
  const controller = createUpdateController({ updater, currentVersion: '1.16.0', enabled: true,
    discover: async () => selectDesktopRelease([release('1.17.0')]), onState: (state) => states.push(state), ...options });
  return { updater, controller, states, installs: () => installs, downloads: () => downloads };
}

test('only complete desktop releases are selected, including previews, in version order', () => {
  const selected = selectDesktopRelease([
    release('9.0.0', { tag_name: 'v9.0.0' }), release('2.0.0', { draft: true }),
    release('1.18.0', { assets: [] }), release('1.17.0-beta.1'), release('../evil'),
    release('1.9.0'), release('1.17.0'), release('1.16.0'),
  ]);
  assert.deepEqual(selected, { version: '1.17.0', url: 'https://github.com/Hubertoink/stato_okja/releases/download/desktop-v1.17.0/' });
  assert.equal(selectDesktopRelease([release('1.18.0', { assets: [{ name: 'latest.yml', state: 'new' }] })]), null);
});

test('release discovery paginates and surfaces HTTP failures', async () => {
  let calls = 0;
  const selected = await discoverDesktopRelease(async (url) => {
    calls += 1;
    assert.ok(url.endsWith(`page=${calls}`));
    return { ok: true, json: async () => calls === 1 ? Array.from({ length: 100 }, () => release('9.0.0', { tag_name: 'v9.0.0' })) : [release('1.17.0')] };
  });
  assert.equal(selected.version, '1.17.0');
  assert.equal(calls, 2);
  await assert.rejects(discoverDesktopRelease(async () => ({ ok: false, status: 403 })), /403/);
});

test('checking never downloads; only explicit download and install advance the update', async () => {
  const f = fixture();
  f.controller.install();
  await f.controller.download();
  assert.equal(f.installs(), 0);
  assert.equal(f.downloads(), 0);
  assert.equal((await f.controller.check()).status, 'available');
  assert.equal(f.updater.autoDownload, false);
  assert.equal(f.updater.autoInstallOnAppQuit, false);
  assert.equal(f.updater.allowDowngrade, false);
  assert.equal(f.downloads(), 0);
  await f.controller.download();
  assert.equal(f.controller.getState().status, 'downloaded');
  assert.ok(f.states.some((state) => state.percent === 53));
  await f.controller.check();
  assert.equal(f.controller.getState().status, 'downloaded');
  f.controller.install();
  f.controller.install();
  assert.equal(f.installs(), 1);
});

test('development builds, old versions and metadata mismatches cannot install', async () => {
  const disabled = fixture({ enabled: false, discover: () => { throw new Error('must not check'); } });
  assert.equal((await disabled.controller.check()).status, 'disabled');
  const older = fixture({ discover: async () => selectDesktopRelease([release('1.15.0')]) });
  assert.equal((await older.controller.check()).status, 'current');
  const mismatch = fixture();
  mismatch.updater.checkForUpdates = async () => ({ updateInfo: { version: '2.0.0' } });
  assert.equal((await mismatch.controller.check()).status, 'error');
  await mismatch.controller.download();
  assert.equal(mismatch.downloads(), 0);
});

test('checks are serialized and failures can be retried without automatic installation', async () => {
  let complete;
  let checks = 0;
  const f = fixture({ discover: () => { checks += 1; return new Promise((resolve) => { complete = resolve; }); } });
  const pending = f.controller.check();
  assert.equal((await f.controller.check()).status, 'checking');
  assert.equal(checks, 1);
  complete(selectDesktopRelease([release('1.17.0')]));
  await pending;
  f.updater.downloadUpdate = async () => { throw new Error('offline'); };
  await f.controller.download();
  assert.equal(f.controller.getState().status, 'error');
  const retry = f.controller.check();
  complete(selectDesktopRelease([release('1.17.0')]));
  await retry;
  assert.equal(f.controller.getState().status, 'available');
  assert.equal(f.installs(), 0);
});
