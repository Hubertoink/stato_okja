import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth, type AuthUser } from '@/lib/auth';
import UserMenu, { type UserMenuProps } from './UserMenu';
import { administrationItems } from './navigationItems';
import i18n from '@/i18n';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/desktopUpdates', () => ({ useDesktopUpdates: () => ({ available: false }) }));
vi.mock('@/lib/devToolsConfig', () => ({
  devToolsFeatureEnabled: true,
  canAccessDevTools: (role: string) => role === 'superadmin',
}));
const user: AuthUser = { id: '1', name: 'Alex', email: 'alex@example.org', role: 'org_admin' };
const props: UserMenuProps = {
  activeOrgName: 'Jugendhaus',
  orgSwitching: false,
  canSwitchOrganization: true,
  onSwitchOrganization: vi.fn(),
  showDemoGuideRestore: false,
  onRestoreDemoGuides: vi.fn(),
};
function renderMenu(sidebar = false) {
  return render(
    <MemoryRouter>
      <UserMenu {...props} sidebar={sidebar} />
    </MemoryRouter>,
  );
}
describe('shared user menu and administration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user, logout: vi.fn() } as unknown as ReturnType<
      typeof useAuth
    >);
  });
  it('closes with Escape, restores focus and closes on an outside click', () => {
    renderMenu(true);
    const trigger = screen.getByRole('button', { name: 'Benutzermenü öffnen' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
  it('keeps administration in the header menu, but delegates it to the sidebar in sidebar mode', () => {
    const view = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü öffnen' }));
    expect(document.querySelector('a[href="/admin/users"]')).not.toBeNull();
    view.unmount();
    renderMenu(true);
    fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü öffnen' }));
    expect(document.querySelector('a[href="/admin/users"]')).toBeNull();
    expect(document.querySelector('a[href="/me"]')).not.toBeNull();
  });
  it.each([true, false])(
    'shows role information below the avatar and can open it while the user menu is open (sidebar=%s)',
    (sidebar) => {
      renderMenu(sidebar);
      const role = screen.getByRole('button', { name: 'Berechtigungen: Org-Admin' });
      fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü öffnen' }));
      fireEvent.click(role);
      const info = screen.getByRole('dialog', { name: 'Org-Admin' });
      expect(info).toHaveTextContent('organisationsweite Vorgaben');
      expect(info).toHaveTextContent('aktuellen Organisationskontext');
      expect(screen.getByRole('button', { name: 'Benutzermenü öffnen' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      fireEvent.keyDown(info, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(role).toHaveFocus();
    },
  );
  it('preserves role guards for administration links', () => {
    const t = i18n.getFixedT('de', 'common');
    expect(administrationItems('user', t)).toEqual([]);
    expect(administrationItems('editor', t)).toEqual([]);
    expect(administrationItems('org_admin', t).map((item) => item.to)).toEqual([
      '/admin/users',
      '/admin/orgs',
    ]);
    expect(administrationItems('superadmin', t).map((item) => item.to)).toContain(
      '/admin/system-data',
    );
  });
  it('does not expose administrative actions during a required password change', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { ...user, mustChangePassword: true },
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü öffnen' }));
    expect(document.querySelector('a[href="/admin/users"]')).toBeNull();
  });
});
