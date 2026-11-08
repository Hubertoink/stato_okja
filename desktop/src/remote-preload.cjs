/* global window, document, getComputedStyle, MutationObserver, ResizeObserver */
const { contextBridge, ipcRenderer } = require('electron');

// The title bar lives outside the server viewport. Keep its colors in sync
// without inserting window controls into the page or changing its scroll root.
if (process.isMainFrame) window.addEventListener('DOMContentLoaded', () => {
  let previous = '';
  let scheduled = false;
  let sidebar;
  const resizeObserver = new ResizeObserver(() => schedule());
  const syncTheme = () => {
    scheduled = false;
    const style = getComputedStyle(document.documentElement);
    const theme = Object.fromEntries(['--app-bg', '--surface-1', '--surface-elevated', '--input-bg', '--text-primary', '--text-muted', '--border-subtle', '--viridian', '--interactive-soft', '--focus-ring', '--desktop-sidebar-color']
      .map((name) => [name, style.getPropertyValue(name).trim()]));
    const nextSidebar = document.querySelector('.app-sidebar');
    if (sidebar !== nextSidebar) {
      resizeObserver.disconnect();
      sidebar = nextSidebar;
      if (sidebar) resizeObserver.observe(sidebar);
    }
    const rect = sidebar?.getBoundingClientRect();
    const visible = rect && rect.width > 0 && rect.height > 0 && rect.left >= -1 && rect.left < 1 &&
      getComputedStyle(sidebar).visibility !== 'hidden';
    theme['--desktop-sidebar-color'] = visible ? getComputedStyle(sidebar).backgroundColor : 'transparent';
    theme.sidebarWidth = visible ? rect.width : 0;
    theme.colorScheme = style.colorScheme;
    const serialized = JSON.stringify(theme);
    if (serialized !== previous) {
      previous = serialized;
      ipcRenderer.send('stato:chrome-theme', theme);
    }
  };
  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      window.requestAnimationFrame(syncTheme);
    }
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true,
    attributeFilter: ['class', 'style', 'hidden', 'data-theme'] });
  window.addEventListener('resize', schedule);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', schedule);
  window.addEventListener('load', schedule, { once: true });
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
