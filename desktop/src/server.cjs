const { createHash } = require('node:crypto');

function normalizeServerUrl(input) {
  if (typeof input !== 'string' || input.trim().length > 2048) {
    throw new Error('Bitte eine vollständige Serveradresse eingeben.');
  }
  const value = input.trim();
  if (!/^https?:\/\//i.test(value) || /[\\\s]/.test(value)) {
    throw new Error('Bitte eine Adresse mit https:// oder http:// eingeben.');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Die Serveradresse ist ungültig.');
  }
  if (
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error(
      'Bitte nur die Serveradresse mit optionalem Port eingeben, ohne Zugangsdaten, Pfad oder Parameter.',
    );
  }
  return url.origin;
}

function serverPartition(serverUrl) {
  // Intentionally in memory: every connection starts with fresh auth, cookies,
  // local/session storage and service workers. Nothing is shared across servers.
  return `stato-${createHash('sha256').update(normalizeServerUrl(serverUrl)).digest('hex')}`;
}

function isServerNavigation(target, serverUrl, { allowBlank = false, allowBlob = false } = {}) {
  if (allowBlank && target === 'about:blank') return true;
  try {
    const url = new URL(target);
    return (
      (['http:', 'https:'].includes(url.protocol) || (allowBlob && url.protocol === 'blob:')) &&
      url.origin === normalizeServerUrl(serverUrl) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isExternalUrl(target) {
  // Prevent control characters from reaching OS protocol handlers.
  // eslint-disable-next-line no-control-regex
  if (typeof target !== 'string' || target.length > 4096 || /[\r\n\x00]/.test(target)) return false;
  try {
    const url = new URL(target);
    return (
      (['http:', 'https:'].includes(url.protocol) &&
        Boolean(url.hostname) &&
        !url.username &&
        !url.password) ||
      (url.protocol === 'mailto:' && Boolean(url.pathname))
    );
  } catch {
    return false;
  }
}

async function checkServer(input, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const serverUrl = normalizeServerUrl(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${serverUrl}/api/health`, {
      signal: controller.signal,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok)
      throw new Error(
        `Der Server antwortet mit HTTP ${response.status}. Bitte Adresse und Serverbetrieb prüfen.`,
      );
    if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      throw new Error('Unter dieser Adresse wurde keine StatO-API gefunden (/api/health).');
    }
    // Bound both response size and read time for arbitrary configured servers.
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16384)
          throw new Error('Die Serverantwort ist keine gültige StatO-Statusantwort.');
        chunks.push(Buffer.from(value));
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    let health;
    try {
      health = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new Error('Die Serverantwort ist keine gültige StatO-Statusantwort.');
    }
    if (
      health?.status !== 'ok' ||
      health?.service !== 'backend' ||
      typeof health.version !== 'string' ||
      !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(health.version)
    ) {
      throw new Error('Unter dieser Adresse wurde keine passende StatO-API gefunden.');
    }
    return { serverUrl, version: health.version, insecure: serverUrl.startsWith('http:') };
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error('Der Server antwortet nicht rechtzeitig. Netzwerk oder VPN prüfen.');
    if (
      error instanceof TypeError ||
      /ERR_|certificate|fetch failed|redirect/i.test(error.message)
    ) {
      throw new Error(
        'Verbindung fehlgeschlagen. Adresse, Netzwerk/VPN und TLS-Zertifikat prüfen. Die Adresse muss direkt auf StatO zeigen.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  normalizeServerUrl,
  serverPartition,
  isServerNavigation,
  isExternalUrl,
  checkServer,
};
