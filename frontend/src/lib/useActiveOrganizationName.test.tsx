import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useActiveOrganizationName } from './useActiveOrganizationName';

const mocks = vi.hoisted(() => ({
  scope: undefined as string | null | undefined,
  user: { id: 'admin', role: 'superadmin', orgId: 'home', orgName: 'Home organization', memberships: [] },
  listOrgs: vi.fn(),
}));
vi.mock('./auth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('./orgScope', () => ({ useOrgScope: () => ({ scope: mocks.scope }) }));
vi.mock('./orgs', () => ({ listOrgs: mocks.listOrgs }));

function renderName() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(useActiveOrganizationName, {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

describe('report organization context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.role = 'superadmin';
    mocks.scope = null;
  });

  it('does not label an unscoped superadmin report with their home organization', () => {
    expect(renderName().result.current).toBeUndefined();
    expect(mocks.listOrgs).not.toHaveBeenCalled();
  });

  it('resolves the selected organization instead of the home organization', async () => {
    mocks.scope = 'selected';
    mocks.listOrgs.mockResolvedValue([{ id: 'selected', name: 'Jugendhaus Babu' }]);
    const { result } = renderName();
    expect(result.current).not.toBe('Home organization');
    await waitFor(() => expect(result.current).toBe('Jugendhaus Babu'));
  });

  it('uses the assigned organization for ordinary users without a scope override', () => {
    mocks.user.role = 'user';
    mocks.scope = undefined;
    expect(renderName().result.current).toBe('Home organization');
    expect(mocks.listOrgs).not.toHaveBeenCalled();
  });
});
