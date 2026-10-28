/* global window, document, getComputedStyle, MutationObserver */
const { contextBridge, ipcRenderer } = require('electron');

// The title bar lives outside the server viewport. Keep its colors in sync
// without inserting window controls into the page or changing its scroll root.
if (process.isMainFrame) window.addEventListener('DOMContentLoaded', () => {
  const syncTheme = () => {
    const style = getComputedStyle(document.documentElement);
    const theme = Object.fromEntries(['--surface-elevated', '--text-primary', '--interactive-soft', '--focus-ring']
      .map((name) => [name, style.getPropertyValue(name).trim()]));
    ipcRenderer.send('stato:chrome-theme', theme);
  };
  const observer = new MutationObserver(syncTheme);
  observer.observe(document.documentElement, { attributes: true });
  window.addEventListener('load', syncTheme, { once: true });
  syncTheme();
}, { once: true });

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
