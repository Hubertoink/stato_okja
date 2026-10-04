const { contextBridge, ipcRenderer } = require('electron');

// Only the packaged local shell receives this preload. No generic IPC API and
// no Electron/Node objects are exposed to either renderer.
contextBridge.exposeInMainWorld('statoDesktop', {
  getState: () => ipcRenderer.invoke('stato:state'),
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
});
