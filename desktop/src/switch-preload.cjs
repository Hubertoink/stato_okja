const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('statoServerSwitch', {
  answer: (confirm) => ipcRenderer.invoke('stato:server-switch-answer', confirm === true),
  onTheme: (callback) => {
    ipcRenderer.once('stato:switch-theme', (_event, theme) => callback(theme));
  },
});
