import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import SettingsTeam from './SettingsTeam';

const mocks = vi.hoisted(() => ({ archive: vi.fn(), remove: vi.fn(), get: vi.fn() }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { role: 'editor' } }), canManageSettingsDestructiveActions: () => true }));
vi.mock('@/lib/api', () => ({ api: { get: mocks.get } }));
vi.mock('@/lib/staff', () => ({
  useStaff: (params?: { active?: boolean }) => ({ data: params?.active === false ? [{ id: 'old', name: 'Old', active: false }] : [{ id: 'lea', name: 'Lea', active: true }], refetch: vi.fn() }),
  useCreateStaff: () => ({}), useUpdateStaff: () => ({}),
  useArchiveStaff: () => ({ mutateAsync: mocks.archive }), useDeleteStaff: () => ({ mutateAsync: mocks.remove }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({ data: { total: 3 } });
  mocks.archive.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
});

it('uses the same archive label and removal choice as contributors', async () => {
  render(<SettingsTeam />);
  expect(screen.getByRole('switch', { name: 'Archiv (1)' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Lea.*löschen/i }));
  expect(mocks.archive).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(await screen.findByText('3')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Archivieren (empfohlen)' }));
  await waitFor(() => expect(mocks.archive).toHaveBeenCalledWith({ id: 'lea' }));
  expect(mocks.remove).not.toHaveBeenCalled();
});

it('does not silently treat failed usage queries as zero assignments', async () => {
  mocks.get.mockRejectedValue(new Error('offline'));
  render(<SettingsTeam />);
  fireEvent.click(screen.getByRole('button', { name: /Lea.*löschen/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent('nicht geprüft');
  expect(screen.getByRole('button', { name: 'Endgültig löschen' })).toBeDisabled();
});
