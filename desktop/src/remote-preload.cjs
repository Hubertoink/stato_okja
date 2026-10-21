const { contextBridge, ipcRenderer } = require('electron');

// The server may read update status and open the local UI. It cannot download,
// install, choose a feed, or access any connection/credential IPC.
if (process.isMainFrame) contextBridge.exposeInMainWorld('statoDesktopUpdates', {
  getState: () => ipcRenderer.invoke('stato:update-state'),
  open: () => ipcRenderer.invoke('stato:update-open'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('stato:update-state-changed', listener);
    return () => ipcRenderer.removeListener('stato:update-state-changed', listener);
  },
});
