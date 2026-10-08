import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnnualTargetActivities from './AnnualTargetActivities';
import { api } from '@/lib/api';
import { useTargetActivities } from '@/lib/annualTargets';
import type { Activity } from '@/lib/activities';

const scope = vi.hoisted(() => ({ scopeKey: 'org-1', ready: true }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
vi.mock('@/lib/orgScope', () => ({ useOrgScopedQueryState: () => scope }));
vi.mock('@/lib/publicConfig', () => ({
  usePublicConfig: () => ({ data: { annualTargetsEnabled: true } }),
}));

const activity = (id: string): Activity => ({
  id,
  title: `Angebot ${id}`,
  type: 'open_door',
  date: '2026-10-01',
  durationMinutes: 120,
  countTotal: 10,
});
const response = (ids: string[], total = 3) => ({
  data: { items: ids.map(activity), total, pageSize: 2 },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Annual target activity pagination', () => {
  let client: QueryClient;
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  beforeEach(() => {
    vi.resetAllMocks();
    scope.scopeKey = 'org-1';
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => {
    cleanup();
    client.clear();
  });

  it('prefetches the next page, retains rows during loading, and reuses cached pages', async () => {
    const next = deferred<ReturnType<typeof response>>();
    vi.mocked(api.get)
      .mockResolvedValueOnce(response(['1', '2']))
      .mockReturnValueOnce(next.promise);
    render(<AnnualTargetActivities id="t1" />, { wrapper });
    await screen.findByRole('link', { name: /Angebot 1/ });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(api.get).toHaveBeenLastCalledWith(
      '/stats/annual-targets/t1/activities',
      expect.objectContaining({ params: { page: 2 } }),
    );
    const list = screen.getByRole('region', { name: 'Aktivitätenliste' });
    list.scrollTop = 200;
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByRole('link', { name: /Angebot 1/ })).toBeInTheDocument();
    expect(screen.getByText('Seite 1 von 2 · 3 Aktivitäten')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Seite 2 wird geladen');
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
    expect(list.scrollTop).toBe(200);
    await act(async () => {
      next.resolve(response(['3']));
    });
    await screen.findByRole('link', { name: /Angebot 3/ });
    expect(screen.getByRole('region', { name: 'Aktivitätenliste' })).toBe(list);
    expect(list.scrollTop).toBe(0);
    expect(screen.getByText('Seite 2 von 2 · 3 Aktivitäten')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(screen.getByRole('link', { name: /Angebot 1/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByRole('link', { name: /Angebot 3/ })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('keeps the list container and navigation usable after a failed page request', async () => {
    const next = deferred<ReturnType<typeof response>>();
    vi.mocked(api.get)
      .mockResolvedValueOnce(response(['1', '2']))
      .mockReturnValueOnce(next.promise);
    render(<AnnualTargetActivities id="t1" />, { wrapper });
    await screen.findByRole('link', { name: /Angebot 1/ });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    const list = screen.getByRole('region', { name: 'Aktivitätenliste' });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    await act(async () => {
      next.reject(new Error('offline'));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Aktivitäten konnten nicht geladen werden',
    );
    expect(screen.getByRole('region', { name: 'Aktivitätenliste' })).toBe(list);
    expect(screen.getByRole('button', { name: 'Zurück' })).toBeEnabled();
    vi.mocked(api.get).mockResolvedValueOnce(response(['3']));
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByRole('link', { name: /Angebot 3/ });
    expect(screen.getByText('Seite 2 von 2 · 3 Aktivitäten')).toBeInTheDocument();
  });

  it.each(['target', 'organization'])(
    'does not retain activities when the %s changes',
    async (change) => {
      vi.mocked(api.get)
        .mockResolvedValueOnce(response(['1'], 1))
        .mockReturnValue(new Promise(() => {}));
      const { result, rerender } = renderHook(({ id }) => useTargetActivities(id, 1), {
        initialProps: { id: 't1' },
        wrapper,
      });
      await waitFor(() => expect(result.current.data?.items[0].id).toBe('1'));
      if (change === 'organization') scope.scopeKey = 'org-2';
      rerender({ id: change === 'target' ? 't2' : 't1' });
      expect(result.current.data).toBeUndefined();
      expect(result.current.isPlaceholderData).toBe(false);
    },
  );
});
