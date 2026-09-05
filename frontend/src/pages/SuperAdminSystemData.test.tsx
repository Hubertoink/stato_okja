import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SuperAdminSystemData from './SuperAdminSystemData';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { role: 'superadmin' } }) }));
vi.mock('@/lib/orgScope', () => ({ useOrgScope: () => ({ scope: null, setScope: vi.fn() }) }));
vi.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/components/system-data/DatabaseExplorerModal', () => ({ default: () => null }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(() => new Promise(() => undefined)) } }));

describe('data management navigation before uploads have been loaded', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/admin/system-data');
    // Turn React's update-loop warning into a failure so a regression cannot
    // hang the test worker indefinitely.
    const originalError = console.error;
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('Maximum update depth exceeded')) {
        throw new Error('Data management entered an infinite update loop');
      }
      originalError(...args);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    { target: 'dashboard', summaryLoaded: false },
    { target: 'activities', summaryLoaded: false },
    { target: 'dashboard', summaryLoaded: true },
    { target: 'activities', summaryLoaded: true },
  ])('leaves for $target without opening uploads (summary loaded: $summaryLoaded)', async ({ target, summaryLoaded }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    if (summaryLoaded) {
      client.setQueryData(['system-data-summary'], {
        generatedAt: '2026-09-05T12:00:00Z',
        confirmationText: 'PURGE',
        restoreConfirmationText: 'RESTORE',
        totals: { managedTables: 27, databaseRows: 13, uploadFiles: 2, uploadBytes: 131379 },
        superadmins: [{ id: 'admin', name: 'Super Admin', email: 'admin@example.test' }],
        tables: [{ tableName: 'users', rowCount: 2 }],
      });
    }
    render(
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <Link to={`/${target}`}>Leave data management</Link>
          <Routes>
            <Route path="/admin/system-data" element={<SuperAdminSystemData />} />
            <Route path={`/${target}`} element={<h1>Destination content</h1>} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Datenverwaltung' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Leave data management' }));
    expect(await screen.findByRole('heading', { name: 'Destination content' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Datenverwaltung' })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe(`/${target}`);
    client.clear();
  });
});
