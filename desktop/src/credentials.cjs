const { readFile, writeFile, rename, mkdir } = require('node:fs/promises');
const { dirname } = require('node:path');
const { normalizeServerUrl } = require('./server.cjs');

const maxLength = 1024;

function isValidCredentials(value) {
  return (
    value &&
    typeof value.email === 'string' &&
    typeof value.password === 'string' &&
    value.email.trim().length > 0 &&
    value.password.length > 0 &&
    value.email.length <= maxLength &&
    value.password.length <= maxLength
  );
}

// Login data is stored per server and encrypted with the OS user key
// (DPAPI on Windows). Without OS encryption nothing is stored at all.
function createCredentialStore(file, safeStorage) {
  async function readEntries() {
    try {
      const data = JSON.parse(await readFile(file, 'utf8'));
      return data && typeof data.entries === 'object' && data.entries ? data.entries : {};
    } catch {
      return {};
    }
  }

  async function writeEntries(entries) {
    await mkdir(dirname(file), { recursive: true });
    const temporaryFile = `${file}.tmp`;
    await writeFile(temporaryFile, `${JSON.stringify({ schemaVersion: 1, entries }, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporaryFile, file);
  }

  function available() {
    try {
      if (!safeStorage.isEncryptionAvailable()) return false;
      // Linux may fall back to a hard-coded key, which is no real protection.
      return !(
        process.platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text'
      );
    } catch {
      return false;
    }
  }

  async function get(serverUrl) {
    if (!available()) return null;
    const entry = (await readEntries())[normalizeServerUrl(serverUrl)];
    if (typeof entry !== 'string') return null;
    try {
      const value = JSON.parse(safeStorage.decryptString(Buffer.from(entry, 'base64')));
      return isValidCredentials(value) ? { email: value.email, password: value.password } : null;
    } catch {
      return null;
    }
  }

  async function save(serverUrl, credentials) {
    if (!available()) throw new Error('Die sichere Speicherung ist auf diesem Gerät nicht verfügbar.');
    if (!isValidCredentials(credentials)) throw new Error('Ungültige Anmeldedaten.');
    const entries = await readEntries();
    entries[normalizeServerUrl(serverUrl)] = safeStorage
      .encryptString(JSON.stringify({ email: credentials.email, password: credentials.password }))
      .toString('base64');
    await writeEntries(entries);
  }

  async function remove(serverUrl) {
    const entries = await readEntries();
    const key = normalizeServerUrl(serverUrl);
    if (!(key in entries)) return;
    delete entries[key];
    await writeEntries(entries);
  }

  return { available, get, save, remove };
}

module.exports = { createCredentialStore, isValidCredentials };
