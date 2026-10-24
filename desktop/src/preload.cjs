const { contextBridge, ipcRenderer } = require('electron');

// Only the packaged local shell receives this preload. No generic IPC API and
// no Electron/Node objects are exposed to either renderer.
contextBridge.exposeInMainWorld('statoDesktop', {
  getState: () => ipcRenderer.invoke('stato:state'),
  getUpdateState: () => ipcRenderer.invoke('stato:update-state'),
  openUpdates: () => ipcRenderer.invoke('stato:update-open'),
  onUpdateState: (callback) => {
    ipcRenderer.on('stato:update-state-changed', (_event, state) => callback(state));
  },
  checkServer: (url) => ipcRenderer.invoke('stato:check', url),
  connect: (url) => ipcRenderer.invoke('stato:connect', url),
  changeServer: () => ipcRenderer.invoke('stato:change-server'),
  reload: () => ipcRenderer.invoke('stato:reload'),
  answerCredentialPrompt: (save) => ipcRenderer.invoke('stato:credential-answer', save === true),
  forgetCredentials: () => ipcRenderer.invoke('stato:forget-credentials'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('stato:state-changed', listener);
    return () => ipcRenderer.removeListener('stato:state-changed', listener);
  },
  onServerSwitchClosed: (callback) => {
    ipcRenderer.on('stato:server-switch-closed', () => callback());
  },
});

// Narrow window API; the main process validates the sender and main frame.
if (process.isMainFrame) contextBridge.exposeInMainWorld('statoWindow', {
  getState: () => ipcRenderer.invoke('stato:window-state'),
  minimize: () => ipcRenderer.invoke('stato:window-minimize'),
  toggleMaximize: () => ipcRenderer.invoke('stato:window-maximize'),
  close: () => ipcRenderer.invoke('stato:window-close'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('stato:window-state-changed', listener);
    return () => ipcRenderer.removeListener('stato:window-state-changed', listener);
  },
});
