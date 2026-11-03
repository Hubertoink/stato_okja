import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AcceptInvite from './AcceptInvite';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() }, setAuthToken: vi.fn() }));
vi.mock('@/lib/legalContent', () => ({ useLegalContent: () => ({ isError: false, isFetching: false }) }));
vi.mock('@/components/LegalModals', () => ({ TermsOfUseModal: () => null }));

describe('invitation acceptance', () => {
  beforeEach(() => vi.clearAllMocks());
  it('requires explicit consent and submits it as a boolean through the actual API helper', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} });
    render(<MemoryRouter initialEntries={['/accept-invite?token=fresh-invite']}><AcceptInvite /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: 'StrongPassword1!' } });
    const button = screen.getByRole('button', { name: 'Einladung aktivieren' });
    expect(button).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(api.post).toHaveBeenCalledExactlyOnceWith('/auth/accept-invite', {
      token: 'fresh-invite', password: 'StrongPassword1!', termsAccepted: true,
    }));
  });
});
