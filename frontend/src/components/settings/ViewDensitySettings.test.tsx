import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth, type AuthUser } from '@/lib/auth';
import { api, getAuthSessionGeneration } from '@/lib/api';
import { applyStoredViewDensity, applyViewDensity } from '@/lib/viewDensity';
import ViewDensitySettings from './ViewDensitySettings';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { patch: vi.fn() }, getAuthSessionGeneration: vi.fn(() => 1) }));

const initialUser: AuthUser = { id: 'user-1', email: 'test@example.org', name: 'Test', role: 'user', viewDensity: 'compact' };

function Harness() {
  const [user, setUser] = useState(initialUser);
  vi.mocked(useAuth).mockReturnValue({ user, updateSessionUser: (next) => {
    setUser(next);
    applyViewDensity(next.viewDensity);
  } } as ReturnType<typeof useAuth>);
  return <ViewDensitySettings />;
}

describe('account view density', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthSessionGeneration).mockReturnValue(1);
    window.localStorage.clear();
    applyViewDensity('compact');
  });

  it('saves a selection, applies it immediately and restores it before the next render', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { ...initialUser, viewDensity: 'normal' } });
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Kompakt' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Normal' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked());
    expect(api.patch).toHaveBeenCalledExactlyOnceWith('/auth/me', { viewDensity: 'normal' });
    expect(document.documentElement.dataset.viewDensity).toBe('normal');
    document.documentElement.removeAttribute('data-view-density');
    applyStoredViewDensity();
    expect(document.documentElement.dataset.viewDensity).toBe('normal');
    // A different account overrides the last cached preference.
    applyViewDensity('compact');
    expect(document.documentElement.dataset.viewDensity).toBe('compact');
  });

  it('retains the selected mode on a failed save and allows retrying', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: { ...initialUser, viewDensity: 'normal' } });
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Normal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('konnte nicht gespeichert');
    expect(screen.getByRole('radio', { name: 'Kompakt' })).toBeChecked();
    expect(document.documentElement.dataset.viewDensity).toBe('compact');
    fireEvent.click(screen.getByRole('radio', { name: 'Normal' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked());
  });

  it('locks controls during saving and discards a response from a previous session', async () => {
    let resolve!: (value: { data: AuthUser }) => void;
    vi.mocked(api.patch).mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Normal' }));
    expect(screen.getByRole('radio', { name: 'Kompakt' })).toBeDisabled();
    vi.mocked(getAuthSessionGeneration).mockReturnValue(2);
    resolve({ data: { ...initialUser, viewDensity: 'normal' } });
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Normal' })).not.toBeDisabled());
    expect(screen.getByRole('radio', { name: 'Kompakt' })).toBeChecked();
    expect(document.documentElement.dataset.viewDensity).toBe('compact');
  });

  it('applies the default even if local storage is blocked', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    try {
      applyStoredViewDensity();
      expect(document.documentElement.dataset.viewDensity).toBe('compact');
      applyViewDensity('normal');
      expect(document.documentElement.dataset.viewDensity).toBe('normal');
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
});
