import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteOrgApi, listUsersByOrg } from '@/lib/orgs';
import DeleteOrgModal from './DeleteOrgModal';

const setScope = vi.fn();
vi.mock('@/lib/orgs', () => ({ deleteOrgApi: vi.fn(), listUsersByOrg: vi.fn() }));
vi.mock('@/lib/orgScope', () => ({ useOrgScope: () => ({ scope: 'org', setScope }) }));
vi.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['sidebar-organizations', 'admin'], [{ id: 'org' }]);
  const onDeleted = vi.fn();
  render(<QueryClientProvider client={client}><DeleteOrgModal orgId="org" orgName="Test" open onClose={vi.fn()} onDeleted={onDeleted} /></QueryClientProvider>);
  return { client, onDeleted };
}

describe('organization deletion', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows linked accounts and refreshes the switcher after deleting the active organization', async () => {
    vi.mocked(listUsersByOrg).mockResolvedValue([{ id: 'user', email: 'test@example.org', name: 'Test', role: 'editor' }]);
    vi.mocked(deleteOrgApi).mockResolvedValue({ ok: true });
    const { client, onDeleted } = setup();
    expect(await screen.findByText(/1 verknüpfte Benutzerkonten/)).toBeInTheDocument();
    expect(screen.getByText(/Dies ist keine vollständige Datenbereinigung/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ja, löschen' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteOrgApi).toHaveBeenCalledWith('org');
    expect(setScope).toHaveBeenCalledWith(null);
    expect(client.getQueryState(['sidebar-organizations', 'admin'])?.isInvalidated).toBe(true);
  });

  it('prevents deletion if linked accounts could not be loaded', async () => {
    vi.mocked(listUsersByOrg).mockRejectedValue(new Error('offline'));
    setup();
    expect(await screen.findByText(/Benutzerverknüpfungen konnten nicht geladen werden/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ja, löschen' })).toBeDisabled();
    expect(deleteOrgApi).not.toHaveBeenCalled();
  });
});
