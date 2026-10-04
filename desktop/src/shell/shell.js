const desktop = window.statoDesktop;
const form = document.getElementById('connection-form');
const input = document.getElementById('server-url');
const checkButton = document.getElementById('check');
const connectButton = document.getElementById('connect');
const status = document.getElementById('status');
let mode = 'starting';
let revision = -1;

function render(state) {
  // IPC responses can arrive after a newer state event (e.g. a failed page load).
  if (state.revision < revision) return;
  revision = state.revision;
  const wasSetup = mode === 'setup';
  mode = state.mode;
  document.getElementById('setup').hidden = state.mode !== 'setup';
  // In connected mode the splash stays behind the server view until it has loaded.
  document.getElementById('splash').hidden = state.mode === 'setup';
  document.getElementById('splash-text').textContent =
    state.mode === 'connected' ? 'StatO wird geladen …' : 'Verbindung wird hergestellt …';
  document.getElementById('splash-server').textContent = state.serverUrl || '';
  document.getElementById('desktop-footer').hidden = state.mode !== 'connected';
  document.getElementById('active-server').textContent = state.serverUrl;
  document.getElementById('active-server').title = state.serverUrl;
  document.getElementById('desktop-version').textContent = state.desktopVersion;
  const prompt = state.credentialPrompt;
  document.getElementById('credential-prompt').hidden = !prompt;
  if (prompt) {
    document.getElementById('credential-question').textContent = prompt.update
      ? `Gespeichertes Passwort für ${prompt.email} aktualisieren?`
      : `Passwort für ${prompt.email} auf diesem Gerät speichern?`;
    document.getElementById('credential-question').title = prompt.email;
    document.getElementById('credential-save').textContent = prompt.update
      ? 'Aktualisieren'
      : 'Speichern';
  }
  document.getElementById('forget-credentials').hidden = !state.credentialsSaved || Boolean(prompt);
  if (!wasSetup || !input.value) input.value = state.serverUrl || '';
  input.disabled = state.busy;
  checkButton.disabled = state.busy;
  connectButton.disabled = state.busy;
  connectButton.textContent = state.busy ? 'Verbindung wird hergestellt …' : 'Verbinden';
  status.textContent = state.message || '';
  status.dataset.kind = state.kind || '';
  document.getElementById('http-hint').hidden = !input.value.trim().startsWith('http://');
  if (state.mode === 'setup' && !state.busy && !wasSetup) input.focus();
}

async function run(action) {
  try {
    render(await action());
  } catch {
    status.textContent = 'Die Aktion konnte nicht ausgeführt werden. Bitte erneut versuchen.';
    status.dataset.kind = 'error';
  }
}

checkButton.addEventListener('click', () => {
  if (form.reportValidity()) void run(() => desktop.checkServer(input.value));
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void run(() => desktop.connect(input.value));
});
input.addEventListener('input', () => {
  status.textContent = '';
  document.getElementById('http-hint').hidden = !input.value.trim().startsWith('http://');
});
document
  .getElementById('change-server')
  .addEventListener('click', () => void run(() => desktop.changeServer()));
document.getElementById('reload').addEventListener('click', () => void run(() => desktop.reload()));
document
  .getElementById('credential-save')
  .addEventListener('click', () => void run(() => desktop.answerCredentialPrompt(true)));
document
  .getElementById('credential-dismiss')
  .addEventListener('click', () => void run(() => desktop.answerCredentialPrompt(false)));
document
  .getElementById('forget-credentials')
  .addEventListener('click', () => void run(() => desktop.forgetCredentials()));
desktop.onState(render);
desktop.onServerSwitchClosed(() => document.getElementById('change-server').focus());
void run(() => desktop.getState());
