import express from 'express';
import type { AddressInfo } from 'net';
import { getTrustProxySetting } from './rate-limit.config';

describe('getTrustProxySetting', () => {
  it('requires explicit configuration and limits legacy true to one hop', () => {
    expect(getTrustProxySetting()).toBe(false);
    expect(getTrustProxySetting('false')).toBe(false);
    expect(getTrustProxySetting('true')).toBe(1);
    expect(getTrustProxySetting('1')).toBe(1);
    expect(getTrustProxySetting('2')).toBe(2);
    expect(getTrustProxySetting('127.0.0.1/32')).toBe('127.0.0.1/32');
  });

  it.each(['203.0.113.5', '192.168.1.25', '10.0.0.7'])('does not trust client %s as another proxy', async (clientIp) => {
    const app = express();
    app.set('trust proxy', getTrustProxySetting('1'));
    app.get('/', (request, response) => response.json({ ip: request.ip }));
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    try {
      const port = (server.address() as AddressInfo).port;
      for (const spoofed of ['198.51.100.10', '198.51.100.11']) {
        const response = await fetch(`http://127.0.0.1:${port}`, {
          headers: { 'X-Forwarded-For': `${spoofed}, ${clientIp}` },
        });
        await expect(response.json()).resolves.toEqual({ ip: clientIp });
      }
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
