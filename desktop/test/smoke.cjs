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
    assert.equal(await remote.evaluate(() => typeof window.statoDesktop), 'undefined');
    assert.equal(await remote.evaluate(() => typeof window.require), 'undefined');
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

    await application.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 0 });
    });
    await local.locator('#change-server').click();
    await waitState(local, 'connected');
    assert.equal(
      await remote.evaluate(() => sessionStorage.getItem('auth_token')),
      'server-Server A',
    );
    await application.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1 });
    });
    await local.locator('#change-server').click();
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
    await local.locator('#change-server').click();
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

    await local.locator('#change-server').click();
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
    await writeFile(
      join(artifacts, 'smoke-result.json'),
      JSON.stringify(
        {
          status: 'passed',
          checks: [
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
