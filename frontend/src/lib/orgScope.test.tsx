import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { AuthProvider, useAuth, type AuthUser } from './auth';
import { storeAuthToken } from './authStorage';
import { OrgScopeProvider, useOrgScope } from './orgScope';

const account: AuthUser = {
  id: 'account', email: 'test@example.org', name: 'Test', role: 'user', orgId: 'home',
  memberships: [
    { orgId: 'home', orgName: 'Home', role: 'user' },
    { orgId: 'second', orgName: 'Second', role: 'editor' },
  ],
};

function ScopedChild({ record }: { record: (org: unknown, role: unknown) => void }) {
  const { scope, setScope } = useOrgScope();
  const { user } = useAuth();
  useEffect(() => {
    if (user) record(api.defaults.headers.common['X-Org-Scope'], user.role);
  }, [scope, user, record]);
  if (!user) return null;
  return <button onClick={() => setScope('second')}>{scope}</button>;
}

describe('tenant scope at session bootstrap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    delete api.defaults.headers.common['X-Org-Scope'];
  });

  it.each([
    [null, 'home', 'user'],
    ['revoked', 'home', 'user'],
    ['second', 'second', 'editor'],
  ])('restores a signed-in session with stored selection %s before mounting tenant data', async (stored, expectedScope, expectedRole) => {
    const record = vi.fn();
    storeAuthToken('example-session');
    if (stored) localStorage.setItem('x_org_scope:account', stored);
    const profile = vi.spyOn(api, 'get').mockResolvedValue({ data: account });
    render(<QueryClientProvider client={new QueryClient()}><AuthProvider><OrgScopeProvider>
      <ScopedChild record={record} />
    </OrgScopeProvider></AuthProvider></QueryClientProvider>);

    await screen.findByRole('button', { name: expectedScope! });
    expect(profile).toHaveBeenCalledWith('/auth/me');
    expect(record.mock.calls[0]).toEqual([expectedScope, expectedRole]);
    if (expectedScope === 'home') {
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => expect(record).toHaveBeenLastCalledWith('second', 'editor'));
    }
  });
});
