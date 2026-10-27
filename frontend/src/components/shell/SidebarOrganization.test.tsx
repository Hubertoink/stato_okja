import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Organisation auswählen' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Organisation auswählen' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Zweites Haus' }));
    expect(setScope).toHaveBeenCalledWith('two');
    expect(listOrgs).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('focuses the selection, supports arrow keys and restores focus on Escape', async () => {
    renderSwitcher();
    const trigger = screen.getByRole('button', { name: 'Organisation auswählen' });
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitemradio', { name: 'Hochi' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitemradio', { name: 'Zweites Haus' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(setScope).not.toHaveBeenCalled();
  });
  it('offers the global scope only to superadmins', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'admin', role: 'superadmin' } } as ReturnType<
      typeof useAuth
    >);
    renderSwitcher();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Organisation auswählen' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Organisation auswählen' }));
    expect(screen.getByRole('menuitemradio', { name: 'Superadmin-Bereich' })).toBeInTheDocument();
    expect(listOrgs).toHaveBeenCalled();
    expect(listAccessibleOrgs).not.toHaveBeenCalled();
  });
  it('shows a static organization for accounts without switching permission', () => {
    renderSwitcher(false);
    expect(screen.getByText('Hochi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Organisation auswählen' })).not.toBeInTheDocument();
    expect(listAccessibleOrgs).not.toHaveBeenCalled();
  });
  it('keeps the current organization and offers retry on a loading error', async () => {
    vi.mocked(listAccessibleOrgs).mockRejectedValueOnce(new Error('offline'));
    renderSwitcher();
    await screen.findByRole('button', { name: 'Organisationen erneut laden' });
    expect(screen.getByRole('button', { name: 'Organisation auswählen' })).toBeDisabled();
    expect(screen.getByText('Hochi')).toBeInTheDocument();
    expect(setScope).not.toHaveBeenCalled();
  });
});
