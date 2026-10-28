const {
  app,
  BrowserWindow,
  WebContentsView,
  Menu,
  ipcMain,
  dialog,
  shell,
  session,
  safeStorage,
  Notification,
} = require('electron');
const { attachWindowChrome } = require('./window-chrome.cjs');
const { autoUpdater } = require('electron-updater');
const { createUpdateController } = require('./updates.cjs');
const { join, basename } = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { checkServer, serverPartition, isServerNavigation, isExternalUrl } = require('./server.cjs');
const { readConfig, writeConfig } = require('./config.cjs');
const { createCredentialStore, isValidCredentials } = require('./credentials.cjs');
const { loginWorldId, installScript, takeScript } = require('./login-autofill.cjs');

const shellFile = join(__dirname, 'shell', 'index.html');
const shellUrl = pathToFileURL(shellFile).href;
const switchFile = join(__dirname, 'shell', 'server-switch.html');
const switchUrl = pathToFileURL(switchFile).href;
const updateFile = join(__dirname, 'shell', 'updates.html');
const updateUrl = pathToFileURL(updateFile).href;
const icon = join(__dirname, '..', 'assets', 'stato.ico');
const preferences = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
};
const footerHeight = 36;
const titlebarHeight = 36;
let window;
let remoteView;
let remoteSession;
let switchView;
let updateView;
let updateController;
let updateTimer;
let updateNotification;
const notifiedUpdates = new Set();
let configFile;
let credentialStore;
let pendingLogin;
let loginPromptDeclined = false;
let closing = false;
let externalDialogOpen = false;
const popups = new Set();
const downloads = new Set();
// 'starting' shows a neutral loading screen until a saved server is reached,
// so the server selection only appears when it is actually needed.
let state = {
  revision: 0,
  mode: 'starting',
  serverUrl: '',
  desktopVersion: app.getVersion(),
  busy: true,
  message: '',
  kind: '',
  credentialPrompt: null,
  credentialsSaved: false,
};

// Development/test launches may isolate app data. Packaged clients always use
// Electron's regular per-user app data directory.
const dataArg = process.argv.find((arg) => arg.startsWith('--stato-user-data='));
if (!app.isPackaged && dataArg) app.setPath('userData', dataArg.slice('--stato-user-data='.length));
const hiddenForTest = !app.isPackaged && process.argv.includes('--stato-hidden');

function updateState(patch) {
  state = { ...state, ...patch, revision: state.revision + 1 };
  if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
    window.webContents.send('stato:state-changed', state);
  }
  return state;
}

function layoutRemote() {
  if (!window || window.isDestroyed()) return;
  const [width, height] = window.getContentSize();
  window.webContents.send('stato:content-bottom', Math.max(titlebarHeight, height - footerHeight));
  switchView?.setBounds({ x: 0, y: 0, width, height });
  updateView?.setBounds({ x: 0, y: 0, width, height });
  remoteView?.setBounds({
    x: 0,
    y: titlebarHeight,
    width,
    height: Math.max(0, height - footerHeight - titlebarHeight),
  });
}

async function discardConnection() {
  closeUpdates(false);
  closeServerSwitch(false);
  const view = remoteView;
  const previousSession = remoteSession;
  remoteView = undefined;
  remoteSession = undefined;
  pendingLogin = undefined;
  if (state.credentialPrompt) updateState({ credentialPrompt: null });
  for (const popup of popups) if (!popup.isDestroyed()) popup.destroy();
  popups.clear();
  for (const item of downloads) item.cancel();
  downloads.clear();
  if (view) {
    if (window && !window.isDestroyed()) window.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }
  if (previousSession) {
    await Promise.allSettled([previousSession.clearStorageData(), previousSession.clearCache()]);
  }
}

async function connectionFailed(view, message) {
  if (remoteView !== view || closing) return;
  updateState({ mode: 'setup', busy: true, message, kind: 'error' });
  await discardConnection();
  updateState({ busy: false });
}

async function openExternal(target) {
  if (!isExternalUrl(target) || externalDialogOpen || closing) return;
  externalDialogOpen = true;
  try {
    const { response } = await dialog.showMessageBox(window, {
      type: 'question',
      title: 'Link außerhalb von StatO öffnen?',
      message: 'Diesen Link mit der Standardanwendung öffnen?',
      detail: target,
      buttons: ['Abbrechen', 'Öffnen'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (response === 1) await shell.openExternal(target);
  } catch {
    /* The OS may have no handler for this link. */
  } finally {
    externalDialogOpen = false;
  }
}

function secureRemote(contents, serverUrl, isPopup = false) {
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.on('will-frame-navigate', (event) => {
    if (
      !isServerNavigation(event.url, serverUrl, {
        allowBlank: !event.isMainFrame || isPopup,
        allowBlob: true,
      })
    ) {
      event.preventDefault();
      if (event.isMainFrame) void openExternal(event.url);
    }
  });
  contents.on('will-redirect', (event, url) => {
    if (!isServerNavigation(url, serverUrl, { allowBlank: isPopup, allowBlob: true }))
      event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    // StatO opens blank windows and then fills them for QR printing and PDF
    // previews. These stay sandboxed, in the same isolated server session.
    if (isServerNavigation(url, serverUrl, { allowBlank: true, allowBlob: true })) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1000,
          height: 760,
          icon,
          autoHideMenuBar: true,
          show: !hiddenForTest,
          webPreferences: { ...preferences, session: contents.session, preload: undefined },
        },
      };
    }
    void openExternal(url);
    return { action: 'deny' };
  });
  contents.on('did-create-window', (popup) => {
    popups.add(popup);
    secureRemote(popup.webContents, serverUrl, true);
    popup.on('closed', () => popups.delete(popup));
  });
}

function secureSession(serverSession) {
  serverSession.setPermissionRequestHandler((_contents, permission, callback) =>
    callback(permission === 'clipboard-sanitized-write'),
  );
  serverSession.setPermissionCheckHandler(
    (_contents, permission) => permission === 'clipboard-sanitized-write',
  );
  serverSession.setDevicePermissionHandler(() => false);
  serverSession.on('will-download', (_event, item) => {
    downloads.add(item);
    // Control characters and Windows separators must not enter a default path.
    const filename =
      // eslint-disable-next-line no-control-regex
      basename(item.getFilename()).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'StatO-Export';
    item.setSaveDialogOptions({
      title: 'StatO-Datei speichern',
      defaultPath: join(app.getPath('downloads'), filename),
    });
    item.once('done', () => downloads.delete(item));
  });
}

function isCurrentView(view) {
  return remoteView === view && !closing && !view.webContents.isDestroyed();
}

async function syncLoginHelper(view, serverUrl) {
  if (!credentialStore.available() || !isCurrentView(view)) return;
  if (!isServerNavigation(view.webContents.getURL(), serverUrl)) return;
  const credentials = await credentialStore.get(serverUrl).catch(() => null);
  if (!isCurrentView(view)) return;
  await view.webContents
    .executeJavaScriptInIsolatedWorld(loginWorldId, [{ code: installScript(credentials) }])
    .catch(() => {});
}

async function checkLogin(view, serverUrl) {
  if (!credentialStore.available() || !isCurrentView(view) || loginPromptDeclined) return;
  let captured;
  try {
    captured = await view.webContents.executeJavaScriptInIsolatedWorld(loginWorldId, [
      { code: takeScript },
    ]);
  } catch {
    return;
  }
  if (!isCurrentView(view) || !isValidCredentials(captured)) return;
  const credentials = { email: captured.email, password: captured.password };
  const saved = await credentialStore.get(serverUrl).catch(() => null);
  if (!isCurrentView(view)) return;
  if (saved && saved.email === credentials.email && saved.password === credentials.password) return;
  pendingLogin = { view, serverUrl, credentials };
  updateState({
    credentialPrompt: {
      email: credentials.email,
      update: Boolean(saved && saved.email === credentials.email),
    },
  });
}

async function answerCredentialPrompt(save) {
  const login = pendingLogin;
  pendingLogin = undefined;
  if (!login || !isCurrentView(login.view)) return updateState({ credentialPrompt: null });
  if (save !== true) {
    loginPromptDeclined = true;
    return updateState({ credentialPrompt: null });
  }
  try {
    await credentialStore.save(login.serverUrl, login.credentials);
  } catch {
    return updateState({ credentialPrompt: null });
  }
  await syncLoginHelper(login.view, login.serverUrl);
  return updateState({ credentialPrompt: null, credentialsSaved: true });
}

async function forgetCredentials() {
  if (!state.serverUrl) return state;
  await credentialStore.remove(state.serverUrl).catch(() => {});
  if (remoteView) await syncLoginHelper(remoteView, state.serverUrl);
  return updateState({ credentialsSaved: false });
}

async function probe(url) {
  // Separate in-memory session: connection checks never send server auth cookies.
  return checkServer(url, {
    fetchImpl: (target, options) =>
      session.fromPartition('stato-connection-check').fetch(target, options),
  });
}

async function performConnection(url, open) {
  if (state.busy || state.mode === 'connected') return state;
  let ownedView;
  updateState({ busy: true, message: 'Server wird geprüft …', kind: '' });
  try {
    const result = await probe(url);
    if (closing) return state;
    if (!open)
      return updateState({
        busy: false,
        message: `StatO ${result.version} ist erreichbar.${result.insecure ? ' Die Verbindung verwendet unverschlüsseltes HTTP.' : ''}`,
        kind: 'success',
      });
    await writeConfig(configFile, result.serverUrl);
    await discardConnection();
    if (closing) return state;
    // A unique non-persistent session per connection prevents stale service
    // workers, caches, refresh cookies and tokens from surviving a server switch.
    remoteSession = session.fromPartition(`${serverPartition(result.serverUrl)}-${randomUUID()}`);
    secureSession(remoteSession);
    const view = new WebContentsView({
      webPreferences: { ...preferences, session: remoteSession, preload: join(__dirname, 'remote-preload.cjs') },
    });
    ownedView = view;
    remoteView = view;
    loginPromptDeclined = false;
    // Stay hidden until the first load so the local loading screen is shown
    // instead of an empty white area.
    view.setVisible(false);
    secureRemote(view.webContents, result.serverUrl);
    view.webContents.on('did-finish-load', () => {
      if (!isCurrentView(view)) return;
      view.setVisible(true);
      void syncLoginHelper(view, result.serverUrl);
    });
    view.webContents.on('did-navigate-in-page', (_event, _url, isMainFrame) => {
      if (isMainFrame) void checkLogin(view, result.serverUrl);
    });
    view.webContents.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
      if (mainFrame && code !== -3)
        void connectionFailed(
          view,
          'Die StatO-Oberfläche konnte nicht geladen werden. Netzwerk, VPN und Server prüfen.',
        );
    });
    view.webContents.on('did-navigate', (_event, _url, statusCode) => {
      if (statusCode >= 400)
        void connectionFailed(
          view,
          `Die StatO-Oberfläche antwortet mit HTTP ${statusCode}. Bitte den Serverbetrieb prüfen.`,
        );
    });
    view.webContents.on(
      'render-process-gone',
      () =>
        void connectionFailed(view, 'Die StatO-Oberfläche wurde beendet. Bitte erneut verbinden.'),
    );
    window.contentView.addChildView(view);
    layoutRemote();
    const credentialsSaved = Boolean(
      await credentialStore.get(result.serverUrl).catch(() => null),
    );
    if (remoteView !== view || closing) return state;
    // Keep the local footer usable even when a server's page load hangs.
    updateState({
      mode: 'connected',
      serverUrl: result.serverUrl,
      busy: false,
      message: '',
      kind: '',
      credentialsSaved,
    });
    const loadTimeout = setTimeout(
      () =>
        void connectionFailed(
          view,
          'Die StatO-Oberfläche antwortet nicht rechtzeitig. Bitte erneut verbinden.',
        ),
      20000,
    );
    try {
      await view.webContents.loadURL(`${result.serverUrl}/`);
    } finally {
      clearTimeout(loadTimeout);
    }
  } catch (error) {
    if (closing) return state;
    if (ownedView && remoteView !== ownedView) return state;
    await discardConnection();
    updateState({
      mode: 'setup',
      busy: false,
      message: error.message || 'Die Verbindung konnte nicht hergestellt werden.',
      kind: 'error',
    });
  }
  return state;
}

function closeServerSwitch(restoreFocus = true) {
  const view = switchView;
  switchView = undefined;
  if (!view) return;
  if (window && !window.isDestroyed()) window.contentView.removeChildView(view);
  if (!view.webContents.isDestroyed()) view.webContents.close();
  if (restoreFocus && window && !window.isDestroyed() && !closing) {
    window.webContents.focus();
    window.webContents.send('stato:server-switch-closed');
  }
}

async function changeServer() {
  if (state.busy || switchView || closing) return state;
  closeUpdates(false);
  if (remoteView) {
    const view = new WebContentsView({
      webPreferences: { ...preferences, preload: join(__dirname, 'switch-preload.cjs') },
    });
    attachWindowChrome(view.webContents);
    switchView = view;
    view.setBackgroundColor('#00000000');
    view.setVisible(false);
    view.webContents.on('will-navigate', (event) => event.preventDefault());
    view.webContents.on('will-attach-webview', (event) => event.preventDefault());
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('render-process-gone', () => {
      if (switchView === view) closeServerSwitch();
    });
    window.contentView.addChildView(view);
    layoutRemote();
    try {
      // Copy only presentation tokens from the server, without giving its page IPC access.
      const theme = await remoteView.webContents.executeJavaScriptInIsolatedWorld(loginWorldId, [{
        code: `(() => {
          const style = getComputedStyle(document.documentElement);
          return Object.fromEntries(['--viridian', '--surface-elevated', '--text-primary',
            '--text-muted', '--border-subtle', '--interactive-soft', '--overlay-backdrop',
            '--focus-ring'].map(name => [name, style.getPropertyValue(name).trim()]));
        })()`,
      }]).catch(() => ({}));
      if (switchView !== view || closing) return state;
      await view.webContents.loadFile(switchFile);
      if (switchView !== view || closing) return state;
      view.webContents.send('stato:switch-theme', theme);
      view.setVisible(true);
      view.webContents.focus();
    } catch {
      if (switchView === view) closeServerSwitch();
    }
    return state;
  }
  return finishServerSwitch();
}

async function finishServerSwitch() {
  updateState({ busy: true });
  await discardConnection();
  return updateState({ mode: 'setup', busy: false, message: '', kind: '' });
}

function registerIpc() {
  ipcMain.on('stato:chrome-theme', (event, theme) => {
    if (!window || window.isDestroyed() || closing || !remoteView) return;
    if (event.sender !== remoteView.webContents || event.senderFrame !== remoteView.webContents.mainFrame ||
      !isServerNavigation(event.senderFrame.url, state.serverUrl)) return;
    // Only a bounded list of presentation colors crosses into the local shell.
    const colors = {};
    for (const name of ['--surface-elevated', '--text-primary', '--interactive-soft', '--focus-ring']) {
      if (typeof theme?.[name] === 'string' && theme[name].length < 128) colors[name] = theme[name];
    }
    window.webContents.send('stato:chrome-theme', colors);
  });
  const windowHandlers = {
    'stato:window-state': () => ({ maximized: window.isMaximized() }),
    'stato:window-minimize': () => window.minimize(),
    'stato:window-maximize': () => window.isMaximized() ? window.unmaximize() : window.maximize(),
    'stato:window-close': () => window.close(),
  };
  for (const [channel, handler] of Object.entries(windowHandlers)) {
    ipcMain.handle(channel, (event) => {
      if (!window || window.isDestroyed() || closing) return;
      const frame = event.senderFrame;
      const local = event.sender === window.webContents && frame === window.webContents.mainFrame && frame.url === shellUrl;
      const remote = remoteView && event.sender === remoteView.webContents &&
        frame === remoteView.webContents.mainFrame && isServerNavigation(frame.url, state.serverUrl);
      const switching = switchView && event.sender === switchView.webContents &&
        frame === switchView.webContents.mainFrame && frame.url === switchUrl;
      if (!local && !remote && !switching) throw new Error('Nicht autorisierter Desktop-Aufruf.');
      return handler();
    });
  }

  const updateHandlers = {
    'stato:update-state': () => updateController.getState(),
    'stato:update-open': () => openUpdates(),
    'stato:update-close': () => closeUpdates(),
    'stato:update-check': () => updateController.check(),
    'stato:update-download': () => updateController.download(),
    'stato:update-install': () => closing ? updateController.getState() : updateController.install(),
  };
  for (const [channel, handler] of Object.entries(updateHandlers)) {
    ipcMain.handle(channel, (event) => {
      const frame = event.senderFrame;
      const trustedPanel = updateView && !updateView.webContents.isDestroyed() && event.sender === updateView.webContents &&
        frame === updateView.webContents.mainFrame && frame.url === updateUrl;
      const trustedShell = window && event.sender === window.webContents &&
        frame === window.webContents.mainFrame && frame.url === shellUrl;
      const currentServer = remoteView && event.sender === remoteView.webContents &&
        frame === remoteView.webContents.mainFrame && isServerNavigation(frame.url, state.serverUrl);
      const readOnly = channel === 'stato:update-state' || channel === 'stato:update-open';
      if (!trustedPanel && !(readOnly && (trustedShell || currentServer))) {
        throw new Error('Nicht autorisierter Desktop-Aufruf.');
      }
      return handler();
    });
  }
  ipcMain.handle('stato:server-switch-answer', (event, confirm) => {
    if (!switchView || event.sender !== switchView.webContents ||
      event.senderFrame !== switchView.webContents.mainFrame || event.senderFrame.url !== switchUrl) {
      throw new Error('Nicht autorisierter Desktop-Aufruf.');
    }
    if (confirm !== true || closing) {
      closeServerSwitch();
      return state;
    }
    closeServerSwitch(false);
    return finishServerSwitch();
  });
  const handlers = {
    'stato:state': () => state,
    'stato:check': (url) => performConnection(url, false),
    'stato:connect': (url) => performConnection(url, true),
    'stato:change-server': () => changeServer(),
    'stato:credential-answer': (save) => answerCredentialPrompt(save === true),
    'stato:forget-credentials': () => forgetCredentials(),
    'stato:reload': () => {
      if (remoteView && !state.busy) remoteView.webContents.reload();
      return state;
    },
  };
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args) => {
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame.url !== shellUrl
      ) {
        throw new Error('Nicht autorisierter Desktop-Aufruf.');
      }
      if (switchView && channel !== 'stato:state') return state;
      return handler(...args);
    });
  }
}

function closeUpdates(restoreFocus = true) {
  const view = updateView;
  updateView = undefined;
  if (!view) return;
  if (window && !window.isDestroyed()) window.contentView.removeChildView(view);
  if (!view.webContents.isDestroyed()) view.webContents.close();
  if (restoreFocus && window && !window.isDestroyed() && !closing) {
    (remoteView?.webContents ?? window.webContents).focus();
  }
}

async function openUpdates() {
  if (closing || !window || switchView) return updateController.getState();
  if (updateView && !updateView.webContents.isDestroyed()) {
    updateView.webContents.focus();
    return updateController.getState();
  }
  const panel = new WebContentsView({
    webPreferences: { ...preferences, preload: join(__dirname, 'update-preload.cjs') },
  });
  updateView = panel;
  panel.setBackgroundColor('#00000000');
  panel.setVisible(false);
  panel.webContents.on('will-navigate', (event) => event.preventDefault());
  panel.webContents.on('will-attach-webview', (event) => event.preventDefault());
  panel.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  panel.webContents.on('render-process-gone', () => { if (updateView === panel) closeUpdates(); });
  window.contentView.addChildView(panel);
  layoutRemote();
  try {
    // Only presentation tokens cross from the server to the trusted local dialog.
    const source = remoteView?.webContents ?? window.webContents;
    const theme = await source.executeJavaScriptInIsolatedWorld(loginWorldId, [{
      code: `(() => {
        const style = getComputedStyle(document.documentElement);
        const tokens = Object.fromEntries(['--viridian', '--surface-elevated', '--text-primary',
          '--text-muted', '--border-subtle', '--interactive-soft', '--overlay-backdrop',
          '--focus-ring'].map(name => [name, style.getPropertyValue(name).trim()]));
        return { ...tokens, '--desktop-font': getComputedStyle(document.body).fontFamily };
      })()`,
    }]).catch(() => ({}));
    if (updateView !== panel || closing) return updateController.getState();
    await panel.webContents.loadFile(updateFile);
    if (updateView !== panel || closing) return updateController.getState();
    panel.webContents.send('stato:update-theme', theme);
    panel.setVisible(true);
    panel.webContents.focus();
  } catch {
    if (updateView === panel) closeUpdates();
  }
  return updateController.getState();
}

function startUpdates() {
  updateController = createUpdateController({
    updater: autoUpdater, currentVersion: app.getVersion(), enabled: app.isPackaged && process.platform === 'win32',
    onState: (update) => {
      for (const contents of [window?.webContents, remoteView?.webContents, updateView?.webContents]) {
        if (contents && !contents.isDestroyed()) contents.send('stato:update-state-changed', update);
      }
      const notice = `${update.status}:${update.version}`;
      if (['available', 'downloaded'].includes(update.status) && !notifiedUpdates.has(notice)) {
        notifiedUpdates.add(notice);
        if (!hiddenForTest && Notification.isSupported()) {
          updateNotification = new Notification({ title: 'StatO Desktop-Update',
            body: update.status === 'available' ? `Version ${update.version} ist verfügbar.` : `Version ${update.version} ist bereit zur Installation.`, icon });
          updateNotification.on('click', () => { void openUpdates(); });
          updateNotification.show();
        }
      }
    },
  });
  if (app.isPackaged && process.platform === 'win32') {
    updateTimer = setInterval(() => void updateController.check(), 4 * 60 * 60 * 1000);
    updateTimer.unref();
  }
}

async function createWindow() {
  closing = false;
  window = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 720,
    minHeight: 700,
    icon,
    title: 'StatO',
    frame: false,
    show: false,
    backgroundColor: '#f3f7f5',
    webPreferences: { ...preferences, preload: join(__dirname, 'preload.cjs') },
  });
  attachWindowChrome(window.webContents);
  for (const event of ['maximize', 'unmaximize']) window.on(event, () => {
    for (const contents of [window.webContents, remoteView?.webContents, switchView?.webContents]) {
      if (contents && !contents.isDestroyed()) contents.send('stato:window-state-changed', { maximized: window.isMaximized() });
    }
  });
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.on('resize', layoutRemote);
  window.on('close', () => {
    closing = true;
    void discardConnection();
  });
  window.on('closed', () => {
    window = undefined;
  });
  window.once('ready-to-show', () => {
    if (!hiddenForTest) window.show();
  });
  await window.loadFile(shellFile);
  // Check as soon as the local UI is ready, independently of the server connection.
  void updateController.check();
  configFile = join(app.getPath('userData'), 'connection.json');
  credentialStore = createCredentialStore(
    join(app.getPath('userData'), 'credentials.json'),
    safeStorage,
  );
  const config = await readConfig(configFile);
  updateState({
    mode: config.serverUrl ? 'starting' : 'setup',
    busy: false,
    serverUrl: config.serverUrl,
    message: config.warning,
    kind: config.warning ? 'error' : '',
  });
  if (config.serverUrl) await performConnection(config.serverUrl, true);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      app.setAppUserModelId('de.okja.stato.desktop');
      Menu.setApplicationMenu(null);
      startUpdates();
      registerIpc();
      await createWindow();
    })
    .catch((error) => {
      dialog.showErrorBox('StatO konnte nicht gestartet werden', error.message);
      app.quit();
    });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => clearInterval(updateTimer));
}
