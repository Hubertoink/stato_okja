const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('statoUpdates', {
  getState: () => ipcRenderer.invoke('stato:update-state'),
  check: () => ipcRenderer.invoke('stato:update-check'),
  download: () => ipcRenderer.invoke('stato:update-download'),
  install: () => ipcRenderer.invoke('stato:update-install'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('stato:update-state-changed', listener);
    return () => ipcRenderer.removeListener('stato:update-state-changed', listener);
  },
});
