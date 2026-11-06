import { describe, expect, it } from 'vitest';
import { networkOnlyNavigationPatterns } from './pwaNavigation';

describe('public token links bypass the offline app shell', () => {
  it.each([
    '/accept-invite', '/accept-invite?token=test', '/accept-invite/?token=test',
    '/reset-password?token=test', '/reset-password-request', '/survey/public-token',
  ])('loads %s from the network', (path) => {
    const url = new URL(path, 'https://example.org');
    expect(networkOnlyNavigationPatterns.some((pattern) => pattern.test(url.pathname + url.search))).toBe(true);
  });

  it.each(['/', '/activities?search=test', '/accept-invite-other', '/reset-password-other'])('preserves normal navigation for %s', (path) => {
    expect(networkOnlyNavigationPatterns.some((pattern) => pattern.test(path))).toBe(false);
  });
});
