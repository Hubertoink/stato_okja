import { DEFAULT_VALUES, ENV_GENERATOR_VERSION, createSecrets, renderEnvFile, renderZimaDeployFile, validateConfig } from './template.js';

const form = document.querySelector('#env-generator-form');
const output = document.querySelector('#env-output');
const errors = document.querySelector('#validation-errors');
const emailSettings = document.querySelector('#email-settings');
const tlsSettings = document.querySelector('#tls-settings');
const copyButton = document.querySelector('#copy-button');
const outputFilename = document.querySelector('#output-filename');
const installationModeField = document.querySelector('#installation-mode-field');
const originHelp = document.querySelector('#origin-help');

document.querySelector('#generator-version').textContent = `Generator ${ENV_GENERATOR_VERSION}`;

function getConfig() {
  const values = new FormData(form);
  const enableEmail = form.elements.enableEmail.checked;
  return {
    ...DEFAULT_VALUES,
    ...Object.fromEntries(values.entries()),
    provisioningMode: enableEmail ? values.get('provisioningMode') : 'local',
    enableEmail,
    enableTwoFactor: form.elements.enableTwoFactor.checked,
  };
}

function setInitialSecrets() {
  const secrets = createSecrets();
  form.elements.databasePassword.value = secrets.databasePassword;
  form.elements.jwtSecret.value = secrets.jwtSecret;
  form.elements.setupToken.value = secrets.setupToken;
}

function showErrors(validationErrors) {
  errors.replaceChildren();
  if (!validationErrors.length) {
    errors.hidden = true;
    return;
  }
  const list = document.createElement('ul');
  validationErrors.forEach((message) => {
    const item = document.createElement('li');
    item.textContent = message;
    list.append(item);
  });
  errors.append(list);
  errors.hidden = false;
}

function refreshVisibility(config) {
  const usingZima = config.outputFormat === 'zimaos';
  const usingTls = !usingZima && config.installationMode === 'internal-tls';
  document.querySelectorAll('[data-onprem-only]').forEach((element) => { element.hidden = usingZima; });
  installationModeField.hidden = usingZima;
  originHelp.hidden = usingZima;
  tlsSettings.hidden = !usingTls;
  emailSettings.hidden = usingZima || !config.enableEmail;
  form.elements.enableTwoFactor.disabled = !config.enableEmail;
  form.elements.provisioningMode.disabled = !config.enableEmail;
  if (!config.enableEmail) form.elements.enableTwoFactor.checked = false;
}

function syncTlsOrigin() {
  const usingTls = form.elements.outputFormat.value !== 'zimaos' && form.elements.installationMode.value === 'internal-tls';
  form.elements.appOrigin.readOnly = usingTls;
  if (!usingTls) return;

  const host = form.elements.publicHost.value.trim();
  const port = form.elements.httpsPort.value.trim();
  form.elements.appOrigin.value = host ? `https://${host}${port && port !== '443' ? `:${port}` : ''}` : '';
}

function refreshOutput() {
  syncTlsOrigin();
  const config = getConfig();
  refreshVisibility(config);
  const usingZima = config.outputFormat === 'zimaos';
  outputFilename.textContent = usingZima ? 'deploy.yaml' : 'stato.env';
  const validationErrors = validateConfig(config);
  showErrors(validationErrors);

  if (validationErrors.length) {
    output.textContent = '# Bitte die markierten Eingaben korrigieren.';
    copyButton.disabled = true;
    return;
  }

  output.textContent = usingZima ? renderZimaDeployFile(config) : renderEnvFile(config);
  copyButton.disabled = false;
}

function downloadOutput() {
  const blob = new Blob([output.textContent], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = getConfig().outputFormat === 'zimaos' ? 'deploy.yaml' : 'stato.env';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

async function copyOutput() {
  try {
    await navigator.clipboard.writeText(output.textContent);
    copyButton.textContent = 'Kopiert';
    window.setTimeout(() => { copyButton.textContent = 'In Zwischenablage kopieren'; }, 1500);
  } catch {
    copyButton.textContent = 'Kopieren nicht möglich';
  }
}

form.addEventListener('input', refreshOutput);
form.addEventListener('change', refreshOutput);
form.elements.outputFormat.addEventListener('change', () => {
  if (form.elements.outputFormat.value === 'zimaos') {
    if (form.elements.httpPort.value === '80') form.elements.httpPort.value = '8088';
    if (form.elements.appOrigin.value === 'http://localhost') form.elements.appOrigin.value = 'http://zimaos.local:8088';
  }
  refreshOutput();
});
document.querySelector('#regenerate-database-password').addEventListener('click', () => {
  form.elements.databasePassword.value = createSecrets().databasePassword;
  refreshOutput();
});
document.querySelector('#regenerate-jwt-secret').addEventListener('click', () => {
  form.elements.jwtSecret.value = createSecrets().jwtSecret;
  refreshOutput();
});
document.querySelector('#download-button').addEventListener('click', downloadOutput);
copyButton.addEventListener('click', copyOutput);

setInitialSecrets();
refreshOutput();
