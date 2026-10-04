const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const {
  normalizeServerUrl,
  serverPartition,
  isServerNavigation,
  isExternalUrl,
  checkServer,
} = require('../src/server.cjs');

test('server addresses accept domains, IPs, ports and IPv6 without storing secrets or paths', () => {
  assert.equal(normalizeServerUrl(' https://StatO.Example.org:443/ '), 'https://stato.example.org');
  assert.equal(normalizeServerUrl('http://192.168.1.50:8080'), 'http://192.168.1.50:8080');
  assert.equal(normalizeServerUrl('https://[::1]:8443/'), 'https://[::1]:8443');
  for (const value of [
    '',
    null,
    {},
    'stato.example.org',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://user:secret@stato.example.org',
    'https://stato.example.org/api',
    'https://stato.example.org/?token=secret',
    'https://stato.example.org/#token',
    'https://stato.example.org\\@evil.example',
    'https://sta to.example.org',
  ]) {
    assert.throws(() => normalizeServerUrl(value), undefined, String(value));
  }
  assert.notEqual(
    serverPartition('https://stato.example.org'),
    serverPartition('https://stato.example.org:8443'),
  );
});

test('remote navigation and external links cannot escape into local protocols or other server credentials', () => {
  const origin = 'https://stato.example.org';
  assert.equal(isServerNavigation(`${origin}/login`, origin), true);
  assert.equal(isServerNavigation('https://stato.example.org.evil.example', origin), false);
  assert.equal(isServerNavigation('https://user:secret@stato.example.org', origin), false);
  assert.equal(isServerNavigation('http://stato.example.org', origin), false);
  assert.equal(isServerNavigation('about:blank', origin), false);
  assert.equal(isServerNavigation('about:blank', origin, { allowBlank: true }), true);
  assert.equal(isServerNavigation(`blob:${origin}/abc`, origin, { allowBlob: true }), true);
  assert.equal(
    isServerNavigation('blob:https://evil.example/abc', origin, { allowBlob: true }),
    false,
  );
  assert.equal(isExternalUrl('mailto:support@okja-stato.de'), true);
  assert.equal(isExternalUrl('https://example.org/help'), true);
  for (const url of [
    'file:///C:/Windows/system32/cmd.exe',
    'ms-settings:privacy',
    'javascript:alert(1)',
    'https://user:pass@example.org',
    'mailto:test@example.org\r\nBcc:other@example.org',
  ])
    assert.equal(isExternalUrl(url), false);
});

test('connection check validates the real StatO health contract and limits failures', async (t) => {
  const server = createServer((req, res) => {
    const route = req.headers['x-test-route'];
    if (route === 'timeout') return;
    if (route === 'redirect') {
      res.writeHead(302, { location: '/login' });
      res.end();
      return;
    }
    if (route === 'unavailable') {
      res.writeHead(503);
      res.end();
      return;
    }
    res.setHeader('content-type', route === 'html' ? 'text/html' : 'application/json');
    if (route === 'oversize') {
      res.end('x'.repeat(20000));
      return;
    }
    if (route === 'invalid') {
      res.end('{');
      return;
    }
    res.end(
      JSON.stringify({
        status: 'ok',
        service: route === 'wrong' ? 'other' : 'backend',
        version: '1.12.0',
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const result = await checkServer(origin);
  assert.deepEqual(result, { serverUrl: origin, version: '1.12.0', insecure: true });
  for (const route of [
    'wrong',
    'html',
    'oversize',
    'invalid',
    'unavailable',
    'redirect',
    'timeout',
  ]) {
    await assert.rejects(
      checkServer(origin, {
        timeoutMs: 100,
        fetchImpl: (url, options) => {
          assert.equal(url, `${origin}/api/health`);
          assert.equal(options.credentials, 'omit');
          return fetch(url, { ...options, headers: { ...options.headers, 'x-test-route': route } });
        },
      }),
      route === 'timeout' ? /rechtzeitig/ : undefined,
      route,
    );
  }
});
