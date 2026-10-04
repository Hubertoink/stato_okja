const { readFile, writeFile, rename, mkdir } = require('node:fs/promises');
const { dirname } = require('node:path');
const { normalizeServerUrl } = require('./server.cjs');

async function readConfig(file) {
  try {
    const config = JSON.parse(await readFile(file, 'utf8'));
    return { serverUrl: normalizeServerUrl(config.serverUrl), warning: '' };
  } catch (error) {
    if (error.code === 'ENOENT') return { serverUrl: '', warning: '' };
    return {
      serverUrl: '',
      warning:
        'Die gespeicherte Verbindung konnte nicht gelesen werden. Bitte die Serveradresse erneut eingeben.',
    };
  }
}

async function writeConfig(file, input) {
  const serverUrl = normalizeServerUrl(input);
  await mkdir(dirname(file), { recursive: true });
  const temporaryFile = `${file}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify({ schemaVersion: 1, serverUrl }, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporaryFile, file);
  return serverUrl;
}

module.exports = { readConfig, writeConfig };
