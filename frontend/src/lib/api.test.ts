import { AxiosHeaders, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, invalidateAuthSession, refreshAccessToken } from './api';
import {
  getStoredAuthToken,
  getStoredRefreshCsrfToken,
  storeAuthToken,
  storeRefreshCsrfToken,
} from './authStorage';

describe('refreshAccessToken', () => {
  it('does not clear a replacement session when an old refresh fails', async () => {
    let rejectRequest!: (error: Error) => void;
    vi.spyOn(api, 'request').mockReturnValue(new Promise((_resolve, reject) => { rejectRequest = reject; }));
    storeRefreshCsrfToken('old-csrf');
    const pending = refreshAccessToken();
    invalidateAuthSession();
    storeAuthToken('new-access');
    storeRefreshCsrfToken('new-csrf');
    rejectRequest(new Error('Expired'));
    await expect(pending).resolves.toBeNull();
    expect(getStoredAuthToken()).toBe('new-access');
    expect(getStoredRefreshCsrfToken()).toBe('new-csrf');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    invalidateAuthSession();
    window.sessionStorage.clear();
  });

  it('discards a refresh response that arrives after logout', async () => {
    let resolveRequest!: (response: AxiosResponse) => void;
    const request = new Promise<AxiosResponse>((resolve) => {
      resolveRequest = resolve;
    });
    vi.spyOn(api, 'request').mockReturnValue(request);
    storeRefreshCsrfToken('old-csrf-token');

    const refresh = refreshAccessToken();
    invalidateAuthSession();
    window.sessionStorage.clear();
    resolveRequest({
      data: {
        access_token: 'stale-access-token',
        refresh_csrf_token: 'stale-csrf-token',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    await expect(refresh).resolves.toBeNull();
    expect(getStoredAuthToken()).toBe('');
    expect(getStoredRefreshCsrfToken()).toBe('');
  });
});