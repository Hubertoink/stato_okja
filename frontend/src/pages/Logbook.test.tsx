import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/Toast';
import type { LogbookEntry, LogbookFilters } from '@/lib/logbook';
import Logbook from './Logbook';

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/lib/orgScope', () => ({
  useOrgScopeKey: () => 'test-org',
  useOrgScopedQueryState: () => ({ scopeKey: 'test-org', ready: true }),
}));
vi.mock('@/lib/organizationModules', () => ({
  useOrganizationModules: () => ({ data: { logbook: true } }),
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'author', role: 'user' } }) }));
vi.mock('@/lib/projects', () => ({ useProjects: () => ({ data: [] }) }));
vi.mock('@/components/LogbookEntryFlyout', () => ({
  default: ({ entryId }: { entryId: string | null }) => entryId ? <div role="dialog">{entryId}</div> : null,
}));

let entries: LogbookEntry[];
function entry(id: string, status: LogbookEntry['status']): LogbookEntry {
  return {
    id, title: `Eintrag ${id}`, status, orgId: 'test-org',
    occurredAt: status === 'archived' ? '2020-01-01T12:00:00' : new Date().toISOString(),
    type: 'observation', body: 'Dokumentation', visibility: 'team',
    createdByUserId: 'author', createdByName: 'Autor',
    createdAt: '2020-01-01T12:00:00', updatedAt: '2020-01-01T12:00:00',
  };
}

function renderLogbook() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/logbook']}>
        <ToastProvider><Logbook /></ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.removeItem('stato_logbook_filters_v1');
  entries = [entry('Aktuell', 'open'), entry('Archiviert', 'archived')];
  apiMock.get.mockReset().mockImplementation(async (url: string, config: { params: LogbookFilters & { page: number; limit: number } }) => {
    if (url !== '/logbook') throw new Error(`Unexpected GET ${url}`);
    const filters = config.params;
    const matching = entries.filter((item) =>
      (filters.includeArchived || item.status !== 'archived') &&
      (!filters.status || item.status === filters.status) &&
      (!filters.search || item.title.includes(filters.search)) &&
      (!filters.from || item.occurredAt.slice(0, 10) >= filters.from) &&
      (!filters.to || item.occurredAt.slice(0, 10) <= filters.to),
    );
    return { data: {
      data: matching.slice((filters.page - 1) * filters.limit, filters.page * filters.limit),
      total: matching.length, page: filters.page, pageSize: filters.limit,
    } };
  });
});

describe('Logbook archive navigation', () => {
  it('clears restrictive filters and displays only archived entries, including old entries', async () => {
    window.localStorage.setItem('stato_logbook_filters_v1', JSON.stringify({
      search: 'Kein Treffer', advanced: { status: 'open', from: '2026-01-01' }, tableView: false,
    }));
    const user = userEvent.setup();
    renderLogbook();
    await user.click(screen.getByRole('button', { name: 'Archiv' }));
    expect(screen.getByRole('heading', { name: 'Logbucharchiv' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Eintrag Archiviert' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Eintrag Aktuell' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Eintrag Archiviert/ }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Archiviert');
  });

  it('keeps the return button available for an empty archive search and clears it on return', async () => {
    const user = userEvent.setup();
    renderLogbook();
    await user.click(screen.getByRole('button', { name: 'Archiv' }));
    await screen.findByRole('heading', { name: 'Eintrag Archiviert' });
    await user.click(screen.getByRole('button', { name: 'Suche öffnen' }));
    await user.type(screen.getByRole('searchbox'), 'Kein Treffer');
    await screen.findByText('Keine passenden archivierten Einträge');
    expect(screen.queryByRole('button', { name: 'Ersten Eintrag erstellen' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zurück zum Logbuch' }));
    expect(screen.getByRole('heading', { name: 'Logbuch' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Eintrag Aktuell' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Eintrag Archiviert' })).not.toBeInTheDocument();
  });

  it('offers a working return button even when there are no archived entries', async () => {
    entries = [entry('Aktuell', 'open')];
    const user = userEvent.setup();
    renderLogbook();
    await user.click(screen.getByRole('button', { name: 'Archiv' }));
    await screen.findByText('Keine passenden archivierten Einträge');
    await user.click(screen.getByRole('button', { name: 'Zurück zum Logbuch' }));
    expect(await screen.findByRole('heading', { name: 'Eintrag Aktuell' })).toBeInTheDocument();
  });

  it('shows archived entries in the table and resets pagination when returning', async () => {
    entries = [entry('Aktuell', 'open'), ...Array.from({ length: 21 }, (_, index) => entry(`Archiv ${index}`, 'archived'))];
    const user = userEvent.setup();
    renderLogbook();
    await user.click(screen.getByRole('switch', { name: 'Tabellenansicht' }));
    await user.click(screen.getByRole('button', { name: 'Archiv' }));
    await screen.findByText('Eintrag Archiv 0');
    await user.click(screen.getByRole('button', { name: 'Nächste Seite' }));
    await screen.findByText('Eintrag Archiv 20');
    await user.click(screen.getByRole('button', { name: 'Zurück zum Logbuch' }));
    expect(await screen.findByText('Eintrag Aktuell')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Eintrag Archiv 20')).not.toBeInTheDocument());
    expect(screen.getByRole('switch', { name: 'Tabellenansicht' })).toHaveAttribute('aria-checked', 'true');
  });
});
