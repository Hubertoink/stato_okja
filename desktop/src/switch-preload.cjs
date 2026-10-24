const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('statoServerSwitch', {
  answer: (confirm) => ipcRenderer.invoke('stato:server-switch-answer', confirm === true),
  onTheme: (callback) => {
    ipcRenderer.once('stato:switch-theme', (_event, theme) => callback(theme));
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
