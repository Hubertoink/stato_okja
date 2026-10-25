import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth, type AuthUser } from '@/lib/auth';
import { api, getAuthSessionGeneration } from '@/lib/api';
import NavigationSettings from './NavigationSettings';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { patch: vi.fn() }, getAuthSessionGeneration: vi.fn(() => 1) }));
const initialUser: AuthUser = {
  id: 'user-1',
  email: 'test@example.org',
  name: 'Test',
  role: 'user',
};
function Harness() {
  const [user, setUser] = useState(initialUser);
  vi.mocked(useAuth).mockReturnValue({ user, updateSessionUser: setUser } as ReturnType<
    typeof useAuth
  >);
  return <NavigationSettings />;
}
describe('account navigation preference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthSessionGeneration).mockReturnValue(1);
  });
  it('defaults existing users to sidebar and saves the alternative in the account', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { ...initialUser, navigationLayout: 'top' } });
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Seitenleiste' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Obere Navigation' }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Obere Navigation' })).toBeChecked(),
    );
    expect(api.patch).toHaveBeenCalledExactlyOnceWith('/auth/me', { navigationLayout: 'top' });
  });
  it('keeps the current layout on failure and lets the user retry', async () => {
    vi.mocked(api.patch)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: { ...initialUser, navigationLayout: 'top' } });
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Obere Navigation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('fehlgeschlagen');
    expect(screen.getByRole('radio', { name: 'Seitenleiste' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Obere Navigation' }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Obere Navigation' })).toBeChecked(),
    );
  });
  it('ignores a response belonging to an earlier login session', async () => {
    let resolve!: (value: { data: AuthUser }) => void;
    vi.mocked(api.patch).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Obere Navigation' }));
    expect(screen.getByRole('radio', { name: 'Seitenleiste' })).toBeDisabled();
    vi.mocked(getAuthSessionGeneration).mockReturnValue(2);
    resolve({ data: { ...initialUser, navigationLayout: 'top' } });
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Seitenleiste' })).not.toBeDisabled(),
    );
    expect(screen.getByRole('radio', { name: 'Seitenleiste' })).toBeChecked();
  });
});
