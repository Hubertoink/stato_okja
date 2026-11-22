import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { useStatisticsAudienceQueries } from './useStatisticsAudienceQueries';

const state = vi.hoisted(() => ({ scope: 'org-a', ready: false, get: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { get: state.get } }));
vi.mock('@/lib/orgScope', () => ({
  useOrgScopedQueryState: () => ({ scope: state.scope, scopeKey: state.scope, ready: state.ready }),
}));

it('loads only the active audience and derives year options and empty states within the current organization', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  state.get.mockImplementation(async (path: string) => {
    const years = state.scope === 'org-a' ? ['2025'] : [];
    if (path === '/stats/years') return { data: years };
    if (path === '/stats/overview') return { data: { availableYears: years } };
    if (path === '/stats/team') return { data: [] };
    if (path === '/activities') return { data: { data: [], total: 0 } };
    throw new Error(path);
  });
  type Props = { audience: 'team' | 'visitors'; from?: string };
  const initialProps: Props = { audience: 'team' };
  const { result, rerender, unmount } = renderHook(({ audience, from }: Props) => useStatisticsAudienceQueries({
    audience, statsParams: { from }, activitiesParams: { from }, page: 1, limit: 25,
  }), {
    initialProps,
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  const requests = () => state.get.mock.calls.map(([path]) => path).sort();
  expect(requests()).toEqual([]);
  expect(result.current.firstActivity).toBe(false);

  state.ready = true;
  rerender(initialProps);
  await waitFor(() => expect(result.current.activityYears).toEqual(['2025']));
  expect(result.current.firstActivity).toBe(false);
  expect(requests()).toEqual(['/stats/team', '/stats/years']);
  state.get.mockClear();
  rerender({ audience: 'team', from: '2026-01-01' });
  await waitFor(() => expect(result.current.teamQuery.isSuccess).toBe(true));
  expect(requests()).toEqual(['/stats/team']);

  state.get.mockClear();
  rerender({ audience: 'visitors' });
  await waitFor(() => expect(result.current.activitiesPageQ.isSuccess && result.current.overviewQ.isSuccess).toBe(true));
  expect(result.current.activityYears).toEqual(['2025']);
  expect(requests()).toEqual(['/activities', '/stats/overview']);
  state.get.mockClear();
  await act(async () => { await client.invalidateQueries(); });
  expect(requests()).toEqual(['/activities', '/stats/overview']);

  state.scope = 'org-b';
  state.get.mockClear();
  rerender({ audience: 'team' });
  expect(result.current.activityYears).toEqual([]);
  expect(result.current.firstActivity).toBe(false);
  await waitFor(() => expect(result.current.firstActivity).toBe(true));
  expect(requests()).toEqual(['/stats/team', '/stats/years']);
  state.scope = 'org-a';
  rerender({ audience: 'visitors' });
  await waitFor(() => expect(result.current.activityYears).toEqual(['2025']));
  state.scope = 'org-b';
  rerender({ audience: 'visitors' });
  expect(result.current.activityYears).toEqual([]);
  expect(result.current.activitiesPageQ.data).toBeUndefined();
  await waitFor(() => expect(result.current.firstActivity).toBe(true));
  unmount();
  client.clear();
});
