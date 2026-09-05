import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsLocations from './SettingsLocations';
import { api } from '@/lib/api';
import { useLocations } from '@/lib/locations';

vi.mock('@/lib/api', () => ({ api: { delete: vi.fn() } }));
vi.mock('@/lib/locations', () => ({ useLocations: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { role: 'org_admin' } }),
  canManageSettingsDestructiveActions: () => true,
}));

describe('location deletion', () => {
  const refetch = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLocations).mockReturnValue({
      data: [{ id: 'location-1', name: 'Jugendhaus', active: true }], refetch,
    } as unknown as ReturnType<typeof useLocations>);
  });

  it('names the facility and lets the user cancel without deleting', async () => {
    render(<SettingsLocations />);
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(screen.getByText('Möchtest du die Einrichtung „Jugendhaus“ wirklich löschen?')).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    fireEvent.popState(window, { state: {} });
    await waitFor(() => expect(screen.queryByText('Einrichtung löschen?')).not.toBeInTheDocument());
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('deletes only after confirmation and refreshes the list', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    render(<SettingsLocations />);
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[1]);
    fireEvent.popState(window, { state: {} });
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    expect(api.delete).toHaveBeenCalledExactlyOnceWith('/locations/location-1');
    expect(screen.queryByText('Einrichtung löschen?')).not.toBeInTheDocument();
  });

  it('keeps a failed deletion visible and allows retrying', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: {} });
    render(<SettingsLocations />);
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[1]);
    fireEvent.popState(window, { state: {} });
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Einrichtung konnte nicht gelöscht werden.');
    expect(refetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[1]);
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    expect(api.delete).toHaveBeenCalledTimes(2);
  });
});
