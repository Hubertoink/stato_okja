import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsContributors from './SettingsContributors';
const save = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const remove = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const usage = vi.hoisted(() => vi.fn().mockResolvedValue(2));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { role: 'editor' } }), canManageSettingsDestructiveActions: () => true }));
vi.mock('@/lib/contributors', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/contributors')>(),
  useContributors: () => ({ isSuccess: true, data: [{ id: 'lea', name: 'Lea', color: '#123456', active: true }, { id: 'sam', name: 'Sam', active: false }] }),
  useSaveContributor: () => ({ mutateAsync: save }), useDeleteContributor: () => ({ mutateAsync: remove }), contributorUsage: usage,
}));

beforeEach(() => { vi.clearAllMocks(); usage.mockResolvedValue(2); remove.mockResolvedValue(undefined); });
describe('contributor master data', () => {
  it('uses a modal with a color picker and keeps reports out of master data', async () => {
    render(<SettingsContributors />);
    expect(screen.queryByText('Monatsübersicht')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lea bearbeiten' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Farbe')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Lea M.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ id: 'lea', name: 'Lea M.', color: '#123456' }));
  });

  it('uses the short archive label and lets archived people be restored', async () => {
    render(<SettingsContributors />);
    fireEvent.click(screen.getByRole('switch', { name: 'Archiv (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sam reaktivieren' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ id: 'sam', active: true }));
    expect(screen.getByRole('button', { name: 'Mitwirkende anlegen' })).toBeInTheDocument();
  });

  it('opens a choice first and archives only after confirmation', async () => {
    render(<SettingsContributors />);
    fireEvent.click(screen.getByRole('button', { name: 'Lea löschen' }));
    expect(save).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(await screen.findByText('2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Archivieren (empfohlen)' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ id: 'lea', active: false }));
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes only after checking usage and explicit confirmation', async () => {
    render(<SettingsContributors />);
    fireEvent.click(screen.getByRole('button', { name: 'Lea löschen' }));
    expect(screen.getByRole('button', { name: 'Endgültig löschen' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Endgültig löschen' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('lea'));
    expect(save).not.toHaveBeenCalled();
  });

  it('blocks deletion when the usage check fails but still offers archiving', async () => {
    usage.mockRejectedValue(new Error('offline'));
    render(<SettingsContributors />);
    fireEvent.click(screen.getByRole('button', { name: 'Lea löschen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('nicht geprüft');
    expect(screen.getByRole('button', { name: 'Endgültig löschen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Archivieren (empfohlen)' })).toBeEnabled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps a failed delete open for retry', async () => {
    remove.mockRejectedValueOnce(new Error('offline'));
    render(<SettingsContributors />);
    fireEvent.click(screen.getByRole('button', { name: 'Lea löschen' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Endgültig löschen' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('nicht gespeichert');
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
