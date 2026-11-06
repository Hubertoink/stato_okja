import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRow } from './OrgUserManagement';
import { resendUserInvitation } from '@/lib/users';
import { DEFAULT_PUBLIC_CONFIG } from '@/lib/publicConfig';
import type { UserDto } from '@/lib/users';

vi.mock('@/lib/users', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/users')>(),
  resendUserInvitation: vi.fn(),
}));

describe('pending invitations in the user list', () => {
  const onReload = vi.fn();
  const showToast = vi.fn();
  const pending: UserDto = { id: 'pending', name: 'Mara', email: 'mara@example.org', role: 'editor', orgId: 'org-1', accountStatus: 'invited' };
  const view = (isMobile = false, userData = pending) => render(<UserRow
    userData={userData} currentUser={{ id: 'admin', role: 'org_admin' }} isMobile={isMobile}
    onReload={onReload} onAssign={vi.fn()} onDelete={vi.fn()} resetConfig={DEFAULT_PUBLIC_CONFIG} showToast={showToast}
  />);
  beforeEach(() => vi.clearAllMocks());

  it.each([false, true])('shows pending status and resends on desktop/mobile (%s)', async (isMobile) => {
    let finish!: () => void;
    vi.mocked(resendUserInvitation).mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    view(isMobile);
    expect(screen.getByText('Einladung offen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut einladen' }));
    expect(screen.getByRole('button', { name: 'Wird gesendet …' })).toBeDisabled();
    expect(resendUserInvitation).toHaveBeenCalledExactlyOnceWith('pending');
    finish();
    await waitFor(() => expect(onReload).toHaveBeenCalledOnce());
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('erneut gesendet'), { type: 'success' });
  });

  it('does not show an invitation action for an activated account', () => {
    view(false, { ...pending, accountStatus: 'active' });
    expect(screen.queryByText('Einladung offen')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Erneut einladen' })).not.toBeInTheDocument();
  });

  it('keeps resend available and reports delivery errors', async () => {
    vi.mocked(resendUserInvitation).mockRejectedValueOnce({ response: { status: 503, data: { message: 'Versand fehlgeschlagen' } } });
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut einladen' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Erneut einladen' })).toBeEnabled());
    expect(showToast).toHaveBeenCalledWith('Versand fehlgeschlagen', { type: 'error' });
    expect(onReload).not.toHaveBeenCalled();
  });

  it('refreshes stale pending status when the invitation has already been accepted', async () => {
    vi.mocked(resendUserInvitation).mockRejectedValueOnce({ response: { status: 409 } });
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut einladen' }));
    await waitFor(() => expect(onReload).toHaveBeenCalledOnce());
    expect(showToast).toHaveBeenCalledWith(expect.any(String), { type: 'error' });
  });
});
