import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPassword from './ResetPassword';
import { validateResetToken } from '@/lib/password';

vi.mock('@/lib/password', () => ({
  resetPassword: vi.fn(),
  validateResetToken: vi.fn(),
}));

describe('ResetPassword', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('hides the password form when the reset token is invalid', async () => {
    vi.mocked(validateResetToken).mockRejectedValue(new Error('expired'));

    render(
      <MemoryRouter initialEntries={['/reset-password?token=expired-token']}>
        <ResetPassword />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Dieser Passwort-Reset-Link ist abgelaufen/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Speichern' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Neuen Reset-Link anfordern' })).toHaveAttribute(
      'href',
      '/reset-password-request',
    );
  });
});
