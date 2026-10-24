(() => {
  const api = window.statoWindow;
  if (!api || document.getElementById('stato-window-controls')) return;
  const controls = document.createElement('div');
  controls.id = 'stato-window-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Fenstersteuerung');
  const makeButton = (label, path, action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;
    button.addEventListener('click', () => { void action(); });
    controls.append(button);
    return button;
  };
  makeButton('Fenster minimieren', 'M3 8h10', api.minimize);
  const maximize = makeButton('Fenster maximieren', 'M3.5 3.5h9v9h-9z', api.toggleMaximize);
  makeButton('Fenster schließen', 'm3.5 3.5 9 9m0-9-9 9', api.close).className = 'stato-window-close';
  const update = ({ maximized }) => {
    const label = maximized ? 'Fenster wiederherstellen' : 'Fenster maximieren';
    maximize.title = label;
    maximize.setAttribute('aria-label', label);
    maximize.querySelector('path').setAttribute('d', maximized
      ? 'M5.5 5.5h7v7h-7zM3.5 10.5v-7h7'
      : 'M3.5 3.5h9v9h-9z');
  };
  const unsubscribe = api.onState(update);
  void api.getState().then(update);
  const fallback = document.createElement('div');
  fallback.id = 'stato-window-titlebar';
  const title = document.createElement('span');
  title.textContent = 'StatO';
  fallback.append(title);
  let header;
  const place = () => {
    // Keep the menu presentation consistent on servers predating this client.
    const updateEntry = [...document.querySelectorAll('.mobile-header-user-menu button')]
      .find((button) => [...button.querySelectorAll('span')].some((span) => span.textContent.trim() === 'Desktop-Updates'));
    if (updateEntry && !updateEntry.hasAttribute('data-stato-desktop-updates')) {
      updateEntry.setAttribute('data-stato-desktop-updates', '');
    }
    const target = document.querySelector('.mobile-header-row');
    if (header !== target) {
      header?.classList.remove('stato-window-drag');
      header = target;
      header?.classList.add('stato-window-drag');
    }
    if (target) {
      // A sibling of the user menu keeps menu hover handlers off the controls.
      if (controls.parentElement !== target) target.append(controls);
      fallback.remove();
      document.documentElement.classList.remove('stato-window-fallback');
    } else {
      if (controls.parentElement !== fallback) fallback.append(controls);
      if (!fallback.isConnected) document.body.prepend(fallback);
      document.documentElement.classList.add('stato-window-fallback');
    }
  };
  place();
  const observer = new MutationObserver(place);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => { observer.disconnect(); unsubscribe(); }, { once: true });
})();
