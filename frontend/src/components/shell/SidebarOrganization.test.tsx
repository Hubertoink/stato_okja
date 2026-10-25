import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/lib/auth';
import { useOrgScope } from '@/lib/orgScope';
import { listAccessibleOrgs, listOrgs } from '@/lib/orgs';
import SidebarOrganization from './SidebarOrganization';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/orgScope', () => ({ useOrgScope: vi.fn() }));
vi.mock('@/lib/orgs', () => ({ listAccessibleOrgs: vi.fn(), listOrgs: vi.fn() }));
const setScope = vi.fn();
function renderSwitcher(canSwitch = true) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SidebarOrganization activeOrgName="Hochi" canSwitch={canSwitch} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'user', role: 'org_admin' } } as ReturnType<
    typeof useAuth
  >);
  vi.mocked(useOrgScope).mockReturnValue({
    scope: 'one',
    ready: true,
    clear: vi.fn(),
    setScope,
    switching: false,
  } as ReturnType<typeof useOrgScope>);
  vi.mocked(listAccessibleOrgs).mockResolvedValue([
    { id: 'one', name: 'Hochi' },
    { id: 'two', name: 'Zweites Haus' },
  ]);
  vi.mocked(listOrgs).mockResolvedValue([{ id: 'one', name: 'Hochi' }]);
});
describe('direct sidebar organization switching', () => {
  it('loads only accessible organizations and switches immediately without a dialog', async () => {
    renderSwitcher();
    await screen.findByRole('option', { name: 'Zweites Haus' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'two' } });
    expect(setScope).toHaveBeenCalledWith('two');
    expect(listOrgs).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('offers the global scope only to superadmins', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'admin', role: 'superadmin' } } as ReturnType<
      typeof useAuth
    >);
    renderSwitcher();
    await screen.findByRole('option', { name: 'Hochi' });
    expect(screen.getByRole('option', { name: 'Superadmin-Bereich' })).toBeInTheDocument();
    expect(listOrgs).toHaveBeenCalled();
    expect(listAccessibleOrgs).not.toHaveBeenCalled();
  });
  it('shows a static organization for accounts without switching permission', () => {
    renderSwitcher(false);
    expect(screen.getByText('Hochi')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(listAccessibleOrgs).not.toHaveBeenCalled();
  });
  it('keeps the current organization and offers retry on a loading error', async () => {
    vi.mocked(listAccessibleOrgs).mockRejectedValueOnce(new Error('offline'));
    renderSwitcher();
    await screen.findByRole('button', { name: 'Organisationen erneut laden' });
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Hochi' })).toBeInTheDocument();
    expect(setScope).not.toHaveBeenCalled();
  });
});
