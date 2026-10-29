import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteUserAccountApi, removeUserMembershipApi } from '@/lib/users';
import RemoveUserModal from './RemoveUserModal';

vi.mock('@/lib/users', () => ({ deleteUserAccountApi: vi.fn(), removeUserMembershipApi: vi.fn() }));
const onRemoved = vi.fn();
const user = { id: 'user', name: 'Person', email: 'person@example.org', role: 'user' as const, orgId: null };
beforeEach(() => { vi.resetAllMocks(); });

describe('account deletion versus organization access removal', () => {
  it('deletes an unassigned account globally and explains reinvitation', async () => {
    render(<RemoveUserModal user={user} deleteAccount onClose={vi.fn()} onRemoved={onRemoved} />);
    expect(screen.getByText(/Dieselbe E-Mail-Adresse kann anschließend erneut eingeladen werden/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Benutzerkonto löschen' }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalled());
    expect(deleteUserAccountApi).toHaveBeenCalledWith('user');
    expect(removeUserMembershipApi).not.toHaveBeenCalled();
  });

  it('removes only the displayed organization membership in scoped mode', async () => {
    render(<RemoveUserModal user={{ ...user, orgId: 'org', org: { id: 'org', name: 'House' } }} deleteAccount={false} onClose={vi.fn()} onRemoved={onRemoved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Organisationszugang entziehen' }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalled());
    expect(removeUserMembershipApi).toHaveBeenCalledWith('user', 'org');
    expect(deleteUserAccountApi).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and shows a rejected deletion inline', async () => {
    vi.mocked(deleteUserAccountApi).mockRejectedValue({ response: { data: { message: 'Der letzte Organisationsadmin kann nicht gelöscht werden.' } } });
    render(<RemoveUserModal user={user} deleteAccount onClose={vi.fn()} onRemoved={onRemoved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Benutzerkonto löschen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('letzte Organisationsadmin');
    expect(onRemoved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Benutzerkonto löschen' })).toBeEnabled();
  });
});
