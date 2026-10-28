const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { mkdtemp, mkdir, readFile, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { _electron: electron } = require('playwright-core');

const directory = resolve(__dirname, '..');
const artifacts = join(directory, 'dist', 'test-artifacts');
const requests = [];
let failPage = false;

async function fixture(name) {
  const server = createServer((req, res) => {
    requests.push({ name, path: req.url, cookie: req.headers.cookie || '' });
    if (req.url === '/api/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', service: 'backend', version: '1.12.0' }));
      return;
    }
    if (failPage) {
      res.writeHead(503);
      res.end('Unavailable');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="de"><meta charset="UTF-8"><title>${name}</title>
      <h1>${name}</h1><button id="remember">Testsitzung anlegen</button>
      <form id="login"><input id="email" type="email" autocomplete="username">
        <input id="password" type="password" autocomplete="current-password">
        <button type="submit">Anmelden</button></form>
      <button id="download">PDF herunterladen</button><button id="preview">Vorschau öffnen</button>
      <script>
        document.getElementById('login').onsubmit = (event) => {
          event.preventDefault();
          event.target.remove();
          history.pushState({}, '', '/dashboard');
        };
        document.getElementById('remember').onclick = () => {
          localStorage.setItem('test-auth', 'server-${name}');
          sessionStorage.setItem('auth_token', 'server-${name}');
          document.cookie = 'stato_refresh_token=server-${name}; SameSite=Lax; Path=/';
        };
        document.getElementById('download').onclick = () => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob(['%PDF-1.4\\nStatO fixture export'], { type: 'application/pdf' }));
          a.download = 'stato-export.pdf'; a.click();
        };
        document.getElementById('preview').onclick = () => {
          const popup = window.open('', '_blank');
          popup.document.write('<!doctype html><title>StatO Vorschau</title><h1>QR-Druckvorschau</h1>');
          popup.document.close();
        };
      </script></html>`);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function launch(userData) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return electron.launch({
    executablePath: require('electron'),
    args: [directory, `--stato-user-data=${userData}`, '--stato-hidden'],
    env,
    timeout: 30000,
  });
}

async function waitState(page, mode) {
  await page.waitForFunction(async (expected) => {
    const state = await window.statoDesktop.getState();
    return state.mode === expected && !state.busy;
  }, mode);
}

async function capture(application, file) {
  const png = await application.evaluate(async ({ BrowserWindow }) => {
    const local = BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().startsWith('file:'),
    );
    return (await local.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }))
      .toPNG()
      .toString('base64');
  });
  await writeFile(join(artifacts, file), Buffer.from(png, 'base64'));
}

async function remotePage(application, url) {
  const find = () =>
    application
      .context()
      .pages()
      .find((page) => page.url().startsWith(`${url}/`));
  const existing = find();
  if (existing) {
    await existing.waitForLoadState();
    return existing;
  }
  return new Promise((done, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(interval);
      reject(new Error('Remote page did not appear'));
    }, 15000);
    const interval = setInterval(() => {
      const page = find();
      if (page) {
        clearInterval(interval);
        clearTimeout(timeout);
        done(page);
      }
    }, 50);
  });
}

async function switchModal(application, local) {
  await local.locator('#change-server').click();
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const page = application.context().pages().find((candidate) =>
      candidate.url().endsWith('/server-switch.html'));
    if (page) {
      await page.getByRole('dialog').waitFor();
      return page;
    }
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error('Server switch modal did not appear');
}

(async () => {
  const userData = await mkdtemp(join(tmpdir(), 'stato-desktop-smoke-'));
  const first = await fixture('Server A');
  const second = await fixture('Server B');
  let application;
  let local;
  try {
    await mkdir(artifacts, { recursive: true });
    application = await launch(userData);
    local = await application.firstWindow();
    local.setDefaultTimeout(15000);
    await waitState(local, 'setup');
    await local.locator('#stato-window-titlebar button[aria-label="Fenster schließen"]').waitFor();
    await application.evaluate(async ({ app }) => {
      const require = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`);
      const { createServer } = require('node:http');
      const { createHash } = require('node:crypto');
      const { mkdir, writeFile } = require('node:fs/promises');
      const { join } = require('node:path');
      const { NsisUpdater, autoUpdater } = require('electron-updater');
      const { createUpdateController } = require(join(app.getAppPath(), 'src/updates.cjs'));
      const payload = Buffer.from('StatO test payload, never executed');
      const sha512 = createHash('sha512').update(payload).digest('base64');
      let corrupt = false;
      const server = createServer((req, res) => {
        if (req.url.startsWith('/latest.yml')) {
          res.end(`version: 1.17.0\nfiles:\n  - url: StatO-Setup-1.17.0-x64.exe\n    sha512: ${sha512}\n    size: ${payload.length}\npath: StatO-Setup-1.17.0-x64.exe\nsha512: ${sha512}\n`);
        } else {
          const body = corrupt ? Buffer.from('corrupt download') : payload;
          res.setHeader('Content-Length', body.length);
          res.end(body);
        }
      });
      await new Promise((done) => server.listen(0, '127.0.0.1', done));
      try {
        for (const damaged of [false, true]) {
          corrupt = damaged;
          const data = join(app.getPath('userData'), damaged ? 'bad-update' : 'good-update');
          await mkdir(data, { recursive: true });
          await writeFile(join(data, 'app-update.yml'), 'updaterCacheDirName: stato-test-updater\n');
          const adapter = { version: '1.16.0', name: 'stato-test', isPackaged: true,
            userDataPath: data, baseCachePath: data, appUpdateConfigPath: join(data, 'app-update.yml'),
            whenReady: async () => {}, onQuit: () => { throw new Error('Automatic install must be disabled'); },
            quit: () => { throw new Error('Test must not quit the app'); } };
          const updater = new NsisUpdater(null, adapter);
          let updateError;
          updater.on('error', (error) => { updateError = error; });
          updater.httpExecutor = autoUpdater.httpExecutor;
          updater.logger = null;
          updater.disableDifferentialDownload = true;
          const controller = createUpdateController({ updater, currentVersion: '1.16.0', enabled: true,
            discover: async () => ({ version: '1.17.0', url: `http://127.0.0.1:${server.address().port}/` }) });
          if ((await controller.check()).status !== 'available') throw new Error('Real updater did not read metadata');
          const result = await controller.download();
          if (result.status !== (damaged ? 'error' : 'downloaded')) throw new Error(`Unexpected real download state: ${result.status}: ${updateError?.stack}`);
          if (!damaged) {
            let installArgs;
            updater.spawnLog = async (_file, args) => { installArgs = args; };
            updater.doInstall({ isSilent: true, isForceRunAfter: true, isAdminRightsRequired: false });
            if (!installArgs?.includes('/S') || !installArgs.includes('--force-run')) {
              throw new Error('NSIS update must silently install and relaunch');
            }
          }
        }
      } finally { await new Promise((done) => server.close(done)); }
    });
    console.log('PASS: real NSIS updater metadata, download, SHA-512 validation and corrupt download rejection');
    await local.locator('#server-url').fill(first.url);
    await local.locator('#check').click();
    await local.waitForFunction(() => document.getElementById('status').dataset.kind === 'success');
    await capture(application, 'server-selection.png');
    assert.equal(requests.filter((r) => r.path === '/api/health').length, 1);
    await local.locator('#connect').click();
    await waitState(local, 'connected');
    const remote = await remotePage(application, first.url);
    await remote.waitForSelector('h1');
    assert.equal(await remote.locator('h1').textContent(), 'Server A');
    await remote.locator('#stato-window-titlebar').waitFor();
    await remote.evaluate(() => {
      const header = document.createElement('header');
      header.className = 'mobile-header-row container';
      const style = document.createElement('style');
      style.textContent = `body { margin: 0; font-family: system-ui, sans-serif; }
        .container { width: 84%; max-width: 1100px; margin: 0 auto; }
        .mobile-header-row { display:flex; align-items:center; gap:12px; padding:16px; background:#eef0ff; }
        .mobile-header-user { display:flex; align-items:center; }
        @media(max-width:767px) {
          .mobile-header-row { display:grid; grid-template-columns:1fr 1fr 44px; }
          .mobile-header-user { grid-column:3; grid-row:1; }
        }`;
      document.head.append(style);
      header.innerHTML = '<strong>StatO</strong><div class="mobile-header-user"><button id="avatar">Avatar</button></div>';
      document.body.prepend(header);
    });
    await remote.locator('.mobile-header-row #stato-window-controls').waitFor();
    assert.equal(await remote.locator('#stato-window-titlebar').count(), 0);
    assert.equal(await remote.locator('#avatar').evaluate((el) => getComputedStyle(el).webkitAppRegion), 'no-drag');
    assert.equal(await remote.locator('.mobile-header-row').evaluate((el) => getComputedStyle(el).webkitAppRegion), 'drag');
    const assertRightAligned = async () => {
      await remote.waitForFunction(() => {
        const rect = document.getElementById('stato-window-controls').getBoundingClientRect();
        return Math.abs(document.documentElement.clientWidth - rect.right) < 1 && Math.abs(rect.top) < 1;
      });
      const geometry = await remote.evaluate(() => {
        const controls = document.getElementById('stato-window-controls').getBoundingClientRect();
        const avatar = document.getElementById('avatar').getBoundingClientRect();
        // Fixed UI aligns with the usable viewport, excluding a native scrollbar.
        return { gap: document.documentElement.clientWidth - controls.right, left: controls.left, avatarRight: avatar.right,
          top: controls.top };
      });
      assert.ok(Math.abs(geometry.gap) < 1, 'Controls must touch the right window edge');
      assert.ok(geometry.left >= geometry.avatarRight, 'Controls must not overlap the avatar');
      assert.ok(Math.abs(geometry.top) < 1, 'Controls must touch the top window edge');
    };
    for (const width of [720, 900, 1200, 1600]) {
      await application.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 850), width);
      await remote.waitForFunction((width) => innerWidth === width, width);
      await assertRightAligned();
    }
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1200, 850));
    await remote.getByRole('button', { name: 'Fenster maximieren', exact: true }).click();
    await remote.getByRole('button', { name: 'Fenster wiederherstellen', exact: true }).waitFor();
    assert.equal(await remote.evaluate(async () => (await window.statoWindow.getState()).maximized), true);
    await assertRightAligned();
    await remote.getByRole('button', { name: 'Fenster wiederherstellen', exact: true }).click();
    await remote.getByRole('button', { name: 'Fenster maximieren', exact: true }).waitFor();
    await assertRightAligned();
    await remote.getByRole('button', { name: 'Fenster minimieren', exact: true }).click();
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()), true);
    await application.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].restore(); });
    await remote.screenshot({ path: join(artifacts, 'integrated-window-controls.png') });
    // The sidebar leaves the original header mounted under display:none.
    // Attribute-only navigation changes must move controls out of that subtree.
    await remote.evaluate(() => {
      const row = document.querySelector('.mobile-header-row');
      const shell = document.createElement('div');
      shell.id = 'test-header-shell';
      row.before(shell);
      shell.append(row);
      shell.style.display = 'none';
      const sidebar = document.createElement('div');
      sidebar.className = 'app-shell-sidebar';
      sidebar.innerHTML = '<aside class="app-sidebar">Seitenleiste</aside>';
      document.body.append(sidebar);
      const style = document.createElement('style');
      style.textContent = '.app-sidebar { position:fixed; inset:0 auto 0 0; width:64px; height:100dvh; }';
      document.head.append(style);
    });
    await remote.locator('#stato-window-titlebar #stato-window-controls').waitFor();
    await assertRightAligned();
    assert.equal(await remote.locator('.app-sidebar').evaluate((el) => el.getBoundingClientRect().top), 36);
    await remote.getByRole('button', { name: 'Fenster maximieren', exact: true }).click();
    await remote.getByRole('button', { name: 'Fenster wiederherstellen', exact: true }).waitFor();
    assert.equal(await remote.evaluate(async () => (await window.statoWindow.getState()).maximized), true);
    await remote.getByRole('button', { name: 'Fenster wiederherstellen', exact: true }).click();
    await remote.getByRole('button', { name: 'Fenster maximieren', exact: true }).waitFor();
    await remote.getByRole('button', { name: 'Fenster minimieren', exact: true }).click();
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()), true);
    await application.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].restore(); });
    await remote.screenshot({ path: join(artifacts, 'sidebar-window-controls.png') });
    await remote.evaluate(() => { document.getElementById('test-header-shell').style.display = ''; });
    await remote.locator('.mobile-header-row #stato-window-controls').waitFor();
    assert.equal(await remote.locator('#stato-window-titlebar').count(), 0);
    await remote.evaluate(() => document.querySelector('.app-shell-sidebar').remove());
    await remote.evaluate(() => document.querySelector('.mobile-header-row').remove());
    await remote.locator('#stato-window-titlebar').waitFor();
    console.log('PASS: integrated and sidebar window controls, drag exclusions, maximize/restore/minimize and SPA fallback');

    const footer = await local.locator('#desktop-footer').boundingBox();
    const remoteBounds = await application.evaluate(({ BrowserWindow }, url) => {
      const localWindow = BrowserWindow.getAllWindows().find((win) =>
        win.webContents.getURL().startsWith('file:'),
      );
      return localWindow.contentView.children
        .find((view) => view.webContents?.getURL().startsWith(`${url}/`))
        .getBounds();
    }, first.url);
    assert.equal(remoteBounds.y, 0);
    assert.equal(remoteBounds.height, footer.y);
    assert.equal(
      (await local.getByRole('button', { name: 'Neu laden', exact: true }).textContent()).trim(),
      '',
    );
    await capture(application, 'connected-footer.png');
    await application.evaluate(({ webContents }) => {
      const shell = webContents.getAllWebContents().find((wc) => wc.getURL().endsWith('/shell/index.html'));
      shell.send('stato:update-state-changed', { revision: 100, status: 'available', version: '99.0.0', percent: 0 });
    });
    await local.locator('#desktop-updates.update-ready').waitFor();
    assert.equal(await local.locator('#desktop-updates').textContent(), 'Update verfügbar');
    assert.equal(await local.locator('#desktop-updates').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(91, 95, 255)');
    await capture(application, 'desktop-update-highlight.png');
    await application.evaluate(({ webContents }) => {
      const shell = webContents.getAllWebContents().find((wc) => wc.getURL().endsWith('/shell/index.html'));
      shell.send('stato:update-state-changed', { revision: 101, status: 'downloaded', version: '99.0.0', percent: 100 });
    });
    await local.getByRole('button', { name: 'Update installieren', exact: true }).waitFor();

    assert.equal(await remote.evaluate(() => typeof window.statoDesktop), 'undefined');
    assert.equal(await remote.evaluate(() => typeof window.require), 'undefined');
    assert.deepEqual(await remote.evaluate(() => Object.keys(window.statoDesktopUpdates).sort()), ['getState', 'onState', 'open']);
    assert.equal(await remote.evaluate(async () => (await window.statoDesktopUpdates.getState()).status), 'disabled');
    await remote.evaluate(() => {
      document.documentElement.style.setProperty('--viridian', '#5b5fff');
      document.documentElement.style.setProperty('--surface-elevated', '#ffffff');
      return window.statoDesktopUpdates.open();
    });
    const updatePanel = application.context().pages().find((page) => page.url().endsWith('/updates.html'));
    await updatePanel.getByRole('heading', { name: 'Desktop-Updates' }).waitFor();
    assert.equal(await updatePanel.locator('#check-update').isDisabled(), true);
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
    await updatePanel.getByRole('dialog').waitFor();
    assert.equal(await updatePanel.locator('#check-update').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(91, 95, 255)');
    for (const [revision, status] of [[200, 'current'], [201, 'available'], [202, 'downloading'], [203, 'downloaded']]) {
      await application.evaluate(({ webContents }, { revision, status }) => {
        webContents.getAllWebContents().find((wc) => wc.getURL().endsWith('/updates.html'))
          .send('stato:update-state-changed', { revision, status, currentVersion: '1.18.3', version: '99.0.0', percent: 42, checkedAt: null });
      }, { revision, status });
      await updatePanel.waitForFunction((status) => {
        if (status === 'current') return document.getElementById('status').textContent.includes('neuesten Stand');
        if (status === 'available') return !document.getElementById('download-update').hidden;
        if (status === 'downloading') return !document.getElementById('progress').hidden;
        return !document.getElementById('install-update').hidden;
      }, status);
      assert.equal(await updatePanel.locator('#save-hint').isVisible(), status === 'downloaded');
      assert.equal(await updatePanel.locator('#check-update').isVisible(), status === 'current');
    }
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 750));
    await updatePanel.waitForFunction(() => innerWidth === 900 && innerHeight === 750);
    const dialogBox = await updatePanel.getByRole('dialog').boundingBox();
    assert.ok(Math.abs(dialogBox.x + dialogBox.width / 2 - 450) < 1);
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1200, 850));
    const updatePng = await application.evaluate(async ({ webContents }) => {
      const contents = webContents.getAllWebContents().find((wc) => wc.getURL().endsWith('/updates.html'));
      return (await contents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64');
    });
    await writeFile(join(artifacts, 'desktop-updates.png'), Buffer.from(updatePng, 'base64'));
    const panelClosed = updatePanel.waitForEvent('close');
    await updatePanel.getByRole('button', { name: 'Schließen', exact: true }).click();
    await panelClosed;
    await remote.evaluate(() => window.statoDesktopUpdates.open());
    const reopened = application.context().pages().find((page) => page.url().endsWith('/updates.html'));
    await reopened.getByRole('dialog').waitFor();
    const escapeClosed = reopened.waitForEvent('close');
    await reopened.keyboard.press('Escape').catch((error) => { if (!reopened.isClosed()) throw error; });
    await escapeClosed;
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
    console.log('PASS: in-app update dialog, theme, states, resizing, close and Escape');
    const security = await application.evaluate(({ webContents }, url) => {
      const contents = webContents
        .getAllWebContents()
        .find((wc) => wc.getURL().startsWith(`${url}/`));
      const prefs = contents.getLastWebPreferences();
      return {
        sandbox: prefs.sandbox,
        nodeIntegration: prefs.nodeIntegration,
        contextIsolation: prefs.contextIsolation,
        webSecurity: prefs.webSecurity,
        preload: prefs.preload || '',
      };
    }, first.url);
    assert.deepEqual(security, {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: '',
    });
    await application.evaluate(({ dialog, shell }) => {
      globalThis.__statoExternalLinks = [];
      dialog.showMessageBox = async () => ({ response: 1 });
      shell.openExternal = async (url) => {
        globalThis.__statoExternalLinks.push(url);
      };
    });
    await remote.evaluate(() => {
      window.open('file:///C:/Windows/system32/cmd.exe', '_blank');
      window.open('ms-settings:privacy', '_blank');
    });
    assert.deepEqual(await application.evaluate(() => globalThis.__statoExternalLinks), []);
    await remote.evaluate(() => {
      window.open('https://example.org/stato-help', '_blank');
    });
    await local.waitForFunction(() => new Promise((done) => setTimeout(() => done(true), 100)));
    assert.deepEqual(await application.evaluate(() => globalThis.__statoExternalLinks), [
      'https://example.org/stato-help',
    ]);
    await remote.locator('#remember').click();
    assert.match(await remote.evaluate(() => document.cookie), /server-Server A/);
    console.log('PASS: connection check, local shell, remote isolation and sandbox');

    const output = join(userData, 'stato-export.pdf');
    await application.evaluate(
      ({ webContents }, { url, output }) => {
        const wc = webContents
          .getAllWebContents()
          .find((contents) => contents.getURL().startsWith(`${url}/`));
        wc.session.once('will-download', (_event, item) => {
          globalThis.__statoSaveOptions = item.getSaveDialogOptions();
          item.setSavePath(output); // Test fixture only: avoid opening a native save dialog.
        });
      },
      { url: first.url, output },
    );
    await remote.locator('#download').click();
    await local.waitForFunction(async () => !(await window.statoDesktop.getState()).busy);
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await readFile(output, 'utf8')).startsWith('%PDF-1.4')) break;
      } catch {
        /* not downloaded yet */
      }
      await new Promise((done) => setTimeout(done, 50));
    }
    assert.match(await readFile(output, 'utf8'), /^%PDF-1.4/);
    assert.equal(
      await application.evaluate(() => globalThis.__statoSaveOptions.title),
      'StatO-Datei speichern',
    );
    const popupPromise = application.waitForEvent('window');
    await remote.locator('#preview').click();
    const popup = await popupPromise;
    await popup.waitForSelector('h1');
    assert.equal(await popup.locator('h1').textContent(), 'QR-Druckvorschau');
    assert.equal(await popup.evaluate(() => typeof window.statoDesktop), 'undefined');
    const blobUrl = await remote.evaluate(() =>
      URL.createObjectURL(
        new Blob(['<!doctype html><title>Blob Vorschau</title><h1>Dateivorschau</h1>'], {
          type: 'text/html',
        }),
      ),
    );
    await popup.evaluate((url) => {
      window.location.href = url;
    }, blobUrl);
    await popup.waitForSelector('h1');
    await popup.waitForFunction(() => document.querySelector('h1').textContent === 'Dateivorschau');
    await application.evaluate(async ({ webContents, ipcMain }, url) => {
      const wc = webContents
        .getAllWebContents()
        .find((contents) => contents.getURL().startsWith(`${url}/`));
      const handler = ipcMain._invokeHandlers.get('stato:state');
      let rejected = false;
      try {
        await handler({ sender: wc, senderFrame: wc.mainFrame });
      } catch {
        rejected = true;
      }
      if (!rejected) throw new Error('Remote renderer was allowed to invoke desktop IPC');
      for (const channel of ['stato:update-check', 'stato:update-download', 'stato:update-install', 'stato:update-close']) {
        let blocked = false;
        try { await ipcMain._invokeHandlers.get(channel)({ sender: wc, senderFrame: wc.mainFrame }); }
        catch { blocked = true; }
        if (!blocked) throw new Error(`Server renderer was allowed to invoke ${channel}`);
      }
      for (const channel of ['stato:update-state', 'stato:update-open', 'stato:window-state', 'stato:window-minimize', 'stato:window-maximize', 'stato:window-close']) {
        let blocked = false;
        try { await ipcMain._invokeHandlers.get(channel)({ sender: wc, senderFrame: { url: wc.getURL() } }); }
        catch { blocked = true; }
        if (!blocked) throw new Error(`Child frame was allowed to invoke ${channel}`);
      }
    }, first.url);
    const printed = await application.evaluate(async ({ BrowserWindow }) => {
      const preview = BrowserWindow.getAllWindows().find((win) =>
        win.webContents.getURL().startsWith('blob:'),
      );
      const pdf = await preview.webContents.printToPDF({ pageSize: 'A4' });
      return pdf.subarray(0, 5).toString();
    });
    assert.equal(printed, '%PDF-');
    console.log('PASS: blob download, blank/blob previews and IPC sender guard');

    await remote.evaluate(() => {
      document.documentElement.style.setProperty('--viridian', '#8839ef');
    });
    let switchPage = await switchModal(application, local);
    await switchPage.waitForFunction(() =>
      getComputedStyle(document.querySelector('h1')).color === 'rgb(136, 57, 239)');
    assert.equal(await switchPage.evaluate(() => document.activeElement.id), 'cancel');
    await switchPage.keyboard.press('Tab');
    assert.equal(await switchPage.evaluate(() => document.activeElement.id), 'confirm');
    await switchPage.keyboard.press('Tab');
    assert.equal(await switchPage.evaluate(() => document.activeElement.id), 'close');
    const modalPng = await application.evaluate(async ({ webContents }) => {
      const contents = webContents.getAllWebContents().find((wc) =>
        wc.getURL().endsWith('/server-switch.html'));
      return (await contents.capturePage(undefined, { stayHidden: true, stayAwake: true }))
        .toPNG().toString('base64');
    });
    await writeFile(join(artifacts, 'server-switch-modal.png'), Buffer.from(modalPng, 'base64'));
    await switchPage.keyboard.press('Escape').catch((error) => {
      if (!switchPage.isClosed()) throw error;
    });
    await local.waitForFunction(() => document.activeElement.id === 'change-server');
    await waitState(local, 'connected');
    assert.equal(
      await remote.evaluate(() => sessionStorage.getItem('auth_token')),
      'server-Server A',
    );
    switchPage = await switchModal(application, local);
    await switchPage.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    await local.waitForFunction(() => document.activeElement.id === 'change-server');
    switchPage = await switchModal(application, local);
    await switchPage.getByRole('button', { name: 'Schließen', exact: true }).click();
    await local.waitForFunction(() => document.activeElement.id === 'change-server');
    switchPage = await switchModal(application, local);
    await switchPage.getByRole('button', { name: 'Server wechseln', exact: true }).click();
    await waitState(local, 'setup');
    assert.equal(popup.isClosed(), true);
    await local.locator('#server-url').fill(second.url);
    await local.locator('#connect').click();
    await waitState(local, 'connected');
    const other = await remotePage(application, second.url);
    await other.waitForSelector('h1');
    assert.equal(await other.locator('h1').textContent(), 'Server B');
    assert.equal(await other.evaluate(() => sessionStorage.getItem('auth_token')), null);
    assert.equal(await other.evaluate(() => localStorage.getItem('test-auth')), null);
    assert.equal(await other.evaluate(() => document.cookie), '');
    switchPage = await switchModal(application, local);
    await switchPage.getByRole('button', { name: 'Server wechseln', exact: true }).click();
    await waitState(local, 'setup');
    await local.locator('#server-url').fill(first.url);
    await local.locator('#connect').click();
    await waitState(local, 'connected');
    const fresh = await remotePage(application, first.url);
    assert.equal(await fresh.evaluate(() => localStorage.getItem('test-auth')), null);
    assert.equal(await fresh.evaluate(() => document.cookie), '');
    assert.ok(requests.filter((r) => r.path === '/api/health').every((r) => r.cookie === ''));
    console.log(
      'PASS: cancel/switch, closed previews, clean sessions and cookie-free health checks',
    );

    switchPage = await switchModal(application, local);
    await switchPage.getByRole('button', { name: 'Server wechseln', exact: true }).click();
    await waitState(local, 'setup');
    failPage = true;
    await local.locator('#connect').click();
    await local.waitForFunction(
      async () => (await window.statoDesktop.getState()).kind === 'error',
    );
    await waitState(local, 'setup');
    await local.waitForFunction(() =>
      document.getElementById('status').textContent.includes('503'),
    );
    assert.match(await local.locator('#status').textContent(), /503/);
    failPage = false;
    await local.locator('#connect').click();
    await waitState(local, 'connected');
    assert.equal(
      JSON.parse(await readFile(join(userData, 'connection.json'), 'utf8')).serverUrl,
      first.url,
    );
    const login = await remotePage(application, first.url);
    await login.waitForSelector('#login');
    await login.locator('#email').fill('nutzer@example.org');
    await login.locator('#password').fill('Test-Passwort-123');
    await login.locator('#login button').click();
    await local.waitForFunction(
      async () => Boolean((await window.statoDesktop.getState()).credentialPrompt),
    );
    assert.match(await local.locator('#credential-question').textContent(), /nutzer@example\.org/);
    await local.locator('#credential-prompt').waitFor();
    await capture(application, 'credential-prompt.png');
    await local.locator('#credential-save').click();
    await local.waitForFunction(
      async () => (await window.statoDesktop.getState()).credentialsSaved,
    );
    const storedCredentials = await readFile(join(userData, 'credentials.json'), 'utf8');
    assert.doesNotMatch(storedCredentials, /Test-Passwort-123|nutzer@example\.org/);
    assert.deepEqual(Object.keys(JSON.parse(storedCredentials).entries), [first.url]);
    assert.equal(await login.evaluate(() => typeof window.__statoLoginHelper), 'undefined');
    await application.close();
    application = await launch(userData);
    local = await application.firstWindow();
    // A saved server opens via the loading screen, never the server selection.
    assert.equal(await local.locator('#setup').isHidden(), true);
    await waitState(local, 'connected');
    assert.equal((await local.evaluate(() => window.statoDesktop.getState())).serverUrl, first.url);
    const autofilled = await remotePage(application, first.url);
    await autofilled.waitForFunction(
      () => document.getElementById('password').value === 'Test-Passwort-123',
    );
    assert.equal(await autofilled.locator('#email').inputValue(), 'nutzer@example.org');
    assert.equal(await local.locator('#forget-credentials').isVisible(), true);
    await local.locator('#forget-credentials').click();
    await local.waitForFunction(
      async () => !(await window.statoDesktop.getState()).credentialsSaved,
    );
    assert.deepEqual(
      JSON.parse(await readFile(join(userData, 'credentials.json'), 'utf8')).entries,
      {},
    );
    console.log('PASS: remembered password, encrypted storage, autofill and removal');
    await application.close();
    application = undefined;

    first.server.closeAllConnections();
    await new Promise((done) => first.server.close(done));
    application = await launch(userData);
    local = await application.firstWindow();
    await local.waitForFunction(
      async () => (await window.statoDesktop.getState()).kind === 'error',
    );
    await waitState(local, 'setup');
    await local.waitForFunction(() =>
      document.getElementById('status').textContent.includes('Verbindung fehlgeschlagen'),
    );
    assert.match(await local.locator('#status').textContent(), /Verbindung fehlgeschlagen/);
    await capture(application, 'offline-server.png');
    console.log('PASS: HTTP page errors, saved address, restart and offline recovery');
    const closed = application.waitForEvent('close');
    await local.getByRole('button', { name: 'Fenster schließen', exact: true }).click();
    await closed;
    application = undefined;
    console.log('PASS: custom close button quits the application');
    await writeFile(
      join(artifacts, 'smoke-result.json'),
      JSON.stringify(
        {
          status: 'passed',
          checks: [
            'window-controls',
            'connection',
            'sandbox',
            'download',
            'previews',
            'ipc',
            'server-switch',
            'session-isolation',
            'restart',
            'saved-password',
            'offline',
          ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (local && !local.isClosed()) await capture(application, 'failure.png').catch(() => {});
    throw error;
  } finally {
    if (application) await application.close().catch(() => {});
    for (const { server } of [first, second]) {
      server.closeAllConnections();
      server.close();
    }
    // Only the unique directory created by this test is removed.
    await rm(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
