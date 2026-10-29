import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/lib/auth';
import OrganizationAssignmentGate from './OrganizationAssignmentGate';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));

describe('accounts without an organization', () => {
  it.each(['user', 'editor', 'org_admin'] as const)('blocks organization pages for an unassigned %s', (role) => {
    vi.mocked(useAuth).mockReturnValue({ user: { role, orgId: null, memberships: [] } } as unknown as ReturnType<typeof useAuth>);
    render(<MemoryRouter initialEntries={['/admin/orgs']}><OrganizationAssignmentGate><p>Protected content</p></OrganizationAssignmentGate></MemoryRouter>);
    expect(screen.getByText('Keine Organisation zugeordnet')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it.each([
    { role: 'superadmin', orgId: null, memberships: [], path: '/admin/orgs' },
    { role: 'editor', orgId: 'org', memberships: [], path: '/dashboard' },
    { role: 'editor', orgId: null, memberships: [{ orgId: 'other' }], path: '/dashboard' },
    { role: 'editor', orgId: null, memberships: [], path: '/me' },
  ])('preserves allowed access for $role at $path', ({ path, ...user }) => {
    vi.mocked(useAuth).mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>);
    render(<MemoryRouter initialEntries={[path]}><OrganizationAssignmentGate><p>Allowed content</p></OrganizationAssignmentGate></MemoryRouter>);
    expect(screen.getByText('Allowed content')).toBeInTheDocument();
  });
});
