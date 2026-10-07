import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsLocations from './SettingsLocations';
import { api } from '@/lib/api';
import { useLocations } from '@/lib/locations';

vi.mock('@/lib/api', () => ({ api: { delete: vi.fn(), patch: vi.fn(), post: vi.fn() } }));
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

describe('location saving', () => {
  const refetch = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLocations).mockReturnValue({
      data: [{
        id: 'location-1', name: 'Jugendhaus', address: 'Alte Adresse', roomType: 'Haus',
        active: true, orgId: 'org-1', createdAt: '2026-10-01', updatedAt: '2026-10-02',
        description: 'Existing description', org: { id: 'org-1' },
      }], refetch,
    } as unknown as ReturnType<typeof useLocations>);
  });

  it('updates only editable fields, including a cleared address', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    render(<SettingsLocations />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByDisplayValue('Jugendhaus'), { target: { value: 'Neuer Name' } });
    fireEvent.change(screen.getByDisplayValue('Alte Adresse'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(refetch).toHaveBeenCalledOnce());
    expect(api.patch).toHaveBeenCalledExactlyOnceWith('/locations/location-1', {
      name: 'Neuer Name', address: '', roomType: 'Haus',
    });
  });

  it('retains edits on failure and allows retrying', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(new Error('400')).mockResolvedValueOnce({ data: {} });
    render(<SettingsLocations />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByDisplayValue('Jugendhaus'), { target: { value: 'Neuer Name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Speichern fehlgeschlagen.');
    expect(screen.getByDisplayValue('Neuer Name')).toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(refetch).toHaveBeenCalledOnce());
  });

  it('creates active locations without metadata', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    render(<SettingsLocations />);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Einrichtung' }));
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Neues Haus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(refetch).toHaveBeenCalledOnce());
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/locations', {
      name: 'Neues Haus', address: undefined, roomType: undefined, active: true,
    });
  });
});
