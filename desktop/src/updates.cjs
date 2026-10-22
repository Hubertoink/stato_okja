const releasesApi = 'https://api.github.com/repos/Hubertoink/stato_okja/releases';
const downloadsBase = 'https://github.com/Hubertoink/stato_okja/releases/download/';

function versionParts(version) {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
    ? version.split('.').map(Number) : null;
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) throw new Error('Ungültige Desktop-Version.');
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}

function selectDesktopRelease(releases) {
  return releases.flatMap((release) => {
    const version = /^desktop-v(.+)$/.exec(release.tag_name || '')?.[1];
    if (release.draft || !version || !versionParts(version)) return [];
    const names = new Set((release.assets || []).filter((asset) => asset.state === 'uploaded').map((asset) => asset.name));
    if (!names.has('latest.yml') || !names.has(`StatO-Setup-${version}-x64.exe`)) return [];
    return [{ version, url: `${downloadsBase}desktop-v${version}/` }];
  }).sort((a, b) => compareVersions(b.version, a.version))[0] || null;
}

async function discoverDesktopRelease(fetchImpl = fetch) {
  const releases = [];
  // Include prereleases and ignore the separate server release family.
  // Bound requests even for repositories with a long release history.
  for (let page = 1; page <= 5; page += 1) {
    const response = await fetchImpl(`${releasesApi}?per_page=100&page=${page}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'StatO-Desktop' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Update-Prüfung fehlgeschlagen (${response.status}).`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Ungültige Release-Antwort.');
    releases.push(...batch);
    if (batch.length < 100) return selectDesktopRelease(releases);
  }
  throw new Error('Release-Liste ist zu lang. Bitte später erneut prüfen.');
}

function createUpdateController({ updater, currentVersion, enabled, discover = discoverDesktopRelease, onState = () => {} }) {
  let state = { revision: 0, status: enabled ? 'idle' : 'disabled', currentVersion, version: null, percent: 0, checkedAt: null, message: '' };
  let busy = false;
  let expectedVersion;
  const publish = (patch) => {
    state = { ...state, ...patch, revision: state.revision + 1 };
    onState(state);
    return state;
  };
  const fail = () => publish({ status: 'error', message: 'Update nicht möglich. Internetverbindung prüfen und erneut versuchen.' });
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowDowngrade = false;
  updater.disableWebInstaller = true;
  updater.on('error', fail);
  updater.on('download-progress', ({ percent }) => {
    if (state.status === 'downloading') publish({ percent: Math.min(100, Math.max(0, Math.round(percent))) });
  });
  updater.on('update-downloaded', (info) => {
    if (state.status === 'downloading' && info.version === expectedVersion) publish({ status: 'downloaded', percent: 100 });
  });
  return {
    getState: () => state,
    async check() {
      if (!enabled || busy || ['available', 'downloaded', 'installing'].includes(state.status)) return state;
      busy = true;
      publish({ status: 'checking', message: '', percent: 0, version: null });
      try {
        const release = await discover();
        const checkedAt = new Date().toISOString();
        if (!release || compareVersions(release.version, currentVersion) <= 0) {
          return publish({ status: 'current', checkedAt });
        }
        expectedVersion = release.version;
        // Only a fixed GitHub repository and validated numeric desktop tags can supply updates.
        updater.setFeedURL({ provider: 'generic', url: release.url, useMultipleRangeRequest: false });
        const result = await updater.checkForUpdates();
        if (result?.updateInfo.version !== expectedVersion) throw new Error('Release metadata mismatch');
        return publish({ status: 'available', version: expectedVersion, checkedAt });
      } catch {
        return fail();
      } finally { busy = false; }
    },
    async download() {
      if (!enabled || busy || state.status !== 'available') return state;
      busy = true;
      publish({ status: 'downloading', percent: 0, message: '' });
      try { await updater.downloadUpdate(); } catch { fail(); }
      finally { busy = false; }
      return state;
    },
    install() {
      if (!enabled || busy || state.status !== 'downloaded') return state;
      publish({ status: 'installing' });
      try { updater.quitAndInstall(true, true); } catch { fail(); }
      return state;
    },
  };
}

module.exports = { compareVersions, selectDesktopRelease, discoverDesktopRelease, createUpdateController };
