import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarLatestActivityAction } from './CalendarLatestActivityAction';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api', () => ({ api }));
vi.mock('@/lib/orgScope', () => ({
  useOrgScopedQueryState: () => ({ scope: 'org-1', scopeKey: 'org-1', ready: true }),
}));
afterEach(() => vi.resetAllMocks());
const october = { from: '2026-10-01', to: '2026-10-31' };

describe('jump to the latest calendar activity', () => {
  it.each(['month', 'week', 'analysis', 'three-day'] as const)('selects August 2026 instead of the first entry in 2024 in %s view', async (view) => {
    const records = [{ date: '2024-08-01' }, { date: '2026-08-21' }, { date: '2026-08-05' }];
    api.get.mockImplementation(async (_url, { params }) => {
      const sorted = records.filter((record) => !params.from || record.date >= params.from)
        .sort((a, b) => params.order === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
      return { data: { data: sorted.slice(0, params.limit), total: sorted.length } };
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const select = vi.fn();
    const { unmount } = render(<QueryClientProvider client={client}><CalendarLatestActivityAction currentPeriod={october} view={view} onSelect={select} /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    fireEvent.click(screen.getByRole('button'));
    expect(select).toHaveBeenCalledWith(new Date(2026, 7, 21));
    expect(api.get).toHaveBeenCalledWith('/activities', { params: { orgId: 'org-1', order: 'desc', page: 1, limit: 1 } });
    unmount();
    client.clear();
  });

  it('disables the jump when the organization has no activities', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0 } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(<QueryClientProvider client={client}><CalendarLatestActivityAction currentPeriod={october} view="month" onSelect={vi.fn()} /></QueryClientProvider>);
    expect(await screen.findByRole('button', { name: 'Keine Aktivität vorhanden' })).toBeDisabled();
    unmount();
    client.clear();
  });

  it.each([
    { view: 'month', from: '2026-08-01', to: '2026-08-31' },
    { view: 'week', from: '2026-08-17', to: '2026-08-23' },
    { view: 'analysis', from: '2026-08-17', to: '2026-08-23' },
    { view: 'three-day', from: '2026-08-19', to: '2026-08-21' },
    { view: 'three-day', from: '2026-08-21', to: '2026-08-23' },
  ] as const)('disables the jump within $view ($from – $to) and enables it after leaving the period', async ({ view, from, to }) => {
    api.get.mockResolvedValue({ data: { data: [{ date: '2026-08-21' }], total: 1 } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const select = vi.fn();
    const renderAction = (period: typeof october) => <QueryClientProvider client={client}><CalendarLatestActivityAction currentPeriod={period} view={view} onSelect={select} /></QueryClientProvider>;
    const { rerender, unmount } = render(renderAction({ from, to }));
    const button = await screen.findByRole('button', { name: 'Aktuellste Aktivität wird bereits angezeigt' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(select).not.toHaveBeenCalled();
    rerender(renderAction(october));
    expect(button).toBeEnabled();
    unmount();
    client.clear();
  });
});
