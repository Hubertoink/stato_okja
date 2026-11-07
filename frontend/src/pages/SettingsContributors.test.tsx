import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SettingsContributors from './SettingsContributors';
const save = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { role: 'editor' } }), canManageSettingsDestructiveActions: () => true }));
vi.mock('@/lib/contributors', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/contributors')>(), useContributors: () => ({ isSuccess: true, data: [{ id: 'lea', name: 'Lea', color: '#123456', active: true }] }), useSaveContributor: () => ({ mutateAsync: save }) }));
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
});
