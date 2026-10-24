const updates = window.statoUpdates;
let revision = -1;
function render(state) {
  if (state.revision < revision) return;
  revision = state.revision;
  document.getElementById('current-version').textContent = state.currentVersion;
  const messages = {
    idle: 'Nach einer neuen Version suchen.',
    disabled: 'Updates sind in der installierten Windows-App verfügbar.',
    checking: 'Neue Version wird gesucht …',
    current: 'Du bist auf dem neuesten Stand.',
    available: `Version ${state.version} ist verfügbar.`,
    downloading: `Version ${state.version} wird heruntergeladen … ${state.percent} %`,
    downloaded: `Version ${state.version} ist bereit zur Installation.`,
    installing: 'Die Installation wird gestartet …',
    error: state.message,
  };
  document.getElementById('status').textContent = messages[state.status];
  document.getElementById('status').dataset.kind = state.status === 'error' ? 'error' : '';
  document.getElementById('save-hint').hidden = state.status !== 'downloaded';
  document.getElementById('check-update').hidden = ['available', 'downloading', 'downloaded', 'installing'].includes(state.status);
  document.getElementById('check-update').disabled = !['idle', 'current', 'error'].includes(state.status);
  document.getElementById('download-update').hidden = state.status !== 'available';
  document.getElementById('install-update').hidden = state.status !== 'downloaded';
  document.getElementById('progress').hidden = state.status !== 'downloading';
  document.getElementById('progress').value = state.percent;
  document.getElementById('last-check').textContent = state.checkedAt
    ? `Zuletzt geprüft: ${new Date(state.checkedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}` : '';
}
async function run(action) {
  try { render(await action()); } catch {
    document.getElementById('status').textContent = 'Aktion fehlgeschlagen. Bitte den Dialog erneut öffnen.';
  }
}
document.getElementById('check-update').onclick = () => void run(() => updates.check());
document.getElementById('download-update').onclick = () => void run(() => updates.download());
document.getElementById('install-update').onclick = () => void run(() => updates.install());
updates.onState(render);
void run(() => updates.getState());

const modal = document.querySelector('dialog');
updates.onTheme((theme) => {
  for (const [name, value] of Object.entries(theme)) {
    if (value && name.startsWith('--')) document.documentElement.style.setProperty(name, value);
  }
});
const close = () => { void updates.close(); };
document.getElementById('close').onclick = close;
modal.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
modal.addEventListener('click', (event) => {
  const bounds = modal.getBoundingClientRect();
  if (event.target === modal && (event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom)) close();
});
modal.showModal();
