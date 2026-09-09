import { act, renderHook, waitFor } from '@testing-library/react';
import { dehydrate, hydrate, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useActivity, useUpdateActivity } from './activities';

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock('./api', () => ({ api }));
vi.mock('./orgScope', () => ({
  useOrgScopeKey: () => 'org-1',
  useOrgScopedQueryState: () => ({ scopeKey: 'org-1', ready: true }),
}));
vi.mock('./publicConfig', () => ({ usePublicConfig: () => ({ data: { liveRefreshIntervalMs: 0 } }) }));
afterEach(() => vi.resetAllMocks());

const key = ['activity', 'org-1', 'activity-1'];
function setup() {
  const previous = new QueryClient();
  previous.setQueryData(key, { id: 'activity-1', version: 1, countFemale: 6 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300000 } } });
  hydrate(client, dehydrate(previous));
  previous.clear();
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}

it('revalidates a recently persisted detail record after a reload', async () => {
  const { client, wrapper } = setup();
  api.get.mockResolvedValue({ data: { id: 'activity-1', version: 2, countFemale: 8 } });
  const { result, unmount } = renderHook(() => useActivity('activity-1'), { wrapper });
  await waitFor(() => expect(result.current.data?.countFemale).toBe(8));
  expect(api.get).toHaveBeenCalledWith('/activities/activity-1');
  unmount();
  client.clear();
});

it('fetches the latest detail after a conflict without retrying the write', async () => {
  const { client, wrapper } = setup();
  api.get.mockResolvedValueOnce({ data: { id: 'activity-1', version: 1, countFemale: 6 } });
  const { result, unmount } = renderHook(() => ({ detail: useActivity('activity-1'), update: useUpdateActivity() }), { wrapper });
  await waitFor(() => expect(result.current.detail.isFetching).toBe(false));
  const conflict = { response: { status: 409 } };
  api.patch.mockRejectedValue(conflict);
  api.get.mockResolvedValue({ data: { id: 'activity-1', version: 2, countFemale: 8 } });
  await act(async () => {
    await expect(result.current.update.mutateAsync({ id: 'activity-1', data: { expectedVersion: 1 } })).rejects.toEqual(conflict);
  });
  await waitFor(() => expect(result.current.detail.data?.countFemale).toBe(8));
  expect(api.patch).toHaveBeenCalledTimes(1);
  unmount();
  client.clear();
});
