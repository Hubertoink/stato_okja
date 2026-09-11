import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { LogbookEntry } from '@/lib/logbook';
import LogbookEntryFlyout from './LogbookEntryFlyout';
import { Button } from './ui/Button';

const mock = vi.hoisted(() => ({ entry: {} as LogbookEntry, save: vi.fn(), status: vi.fn(), toast: vi.fn(), refetch: vi.fn() }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'author', role: 'org_admin' } }) }));
vi.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: mock.toast }) }));
vi.mock('@/lib/useBodyScrollLock', () => ({ useBodyScrollLock: () => {} }));
vi.mock('@/components/Modal', () => ({
  ModalBackdrop: () => null,
  useModalHistory: (onClose: () => void) => ({ dismiss: onClose }),
}));
vi.mock('@/components/ConfirmModal', () => ({ default: ({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) => open ? <div role="alertdialog"><Button onClick={onConfirm}>Verwerfen bestätigen</Button><Button onClick={onCancel}>Weiter bearbeiten</Button></div> : null }));
vi.mock('./ProtectedImage', () => ({ default: () => null }));
vi.mock('./LogbookEditableConnections', () => ({ default: () => <div>Verknüpfungen bearbeiten</div> }));
vi.mock('@/lib/logbook', () => ({
  useLogbookEntry: () => ({ data: mock.entry, isLoading: false, refetch: mock.refetch }),
  useUpdateLogbookEntry: () => ({ mutateAsync: mock.save }),
  useSetLogbookStatus: () => ({ mutate: mock.status }),
  useArchiveLogbookEntry: () => ({ mutate: vi.fn() }),
  useRestoreLogbookEntry: () => ({ mutate: vi.fn() }),
  useCreateLogbookComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveLogbookComment: () => ({ mutate: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mock.entry = { id: 'entry', orgId: 'org', title: 'Kochabend', body: 'Dokumentation', type: 'observation', status: 'open', visibility: 'team', occurredAt: '2026-09-08T08:30:00', createdByUserId: 'author', createdByName: 'Demo Admin', createdAt: '2026-09-08T08:30:00', updatedAt: '2026-09-08T08:30:00', comments: [] };
  mock.save.mockImplementation(async ({ data }) => { mock.entry = { ...mock.entry, ...data }; return mock.entry; });
  mock.refetch.mockResolvedValue({});
});

describe('editing inside logbook details', () => {
  it('saves in the same dialog while keeping comments available', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<LogbookEntryFlyout entryId="entry" onClose={close} />, { wrapper: MemoryRouter });
    const dialog = screen.getByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(screen.getByRole('heading', { name: 'Kommentare (0)' })).toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: 'Titel' });
    await user.clear(title); await user.type(title, 'Neuer Kochabend');
    fireEvent.submit(title.closest('form')!);
    expect(await screen.findByRole('heading', { name: 'Neuer Kochabend' })).toBeInTheDocument();
    expect(mock.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'entry', data: expect.objectContaining({ title: 'Neuer Kochabend' }) }));
    expect(close).not.toHaveBeenCalled();
  });

  it('preserves a draft on refetch and discards without writing to the server', async () => {
    const user = userEvent.setup();
    const view = render(<LogbookEntryFlyout entryId="entry" onClose={vi.fn()} />, { wrapper: MemoryRouter });
    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    await user.type(screen.getByRole('textbox', { name: 'Titel' }), ' geändert');
    mock.entry = { ...mock.entry, commentCount: 1 };
    view.rerender(<LogbookEntryFlyout entryId="entry" onClose={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Titel' })).toHaveValue('Kochabend geändert');
    await user.click(screen.getByRole('button', { name: 'Verwerfen' }));
    await user.click(screen.getByRole('button', { name: 'Verwerfen bestätigen' }));
    expect(screen.getByRole('heading', { name: 'Kochabend' })).toBeInTheDocument();
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('retains entered data when saving fails', async () => {
    const user = userEvent.setup();
    mock.save.mockRejectedValueOnce(new Error('offline'));
    render(<LogbookEntryFlyout entryId="entry" onClose={vi.fn()} startEditing />, { wrapper: MemoryRouter });
    const title = screen.getByRole('textbox', { name: 'Titel' });
    await user.type(title, ' Entwurf');
    fireEvent.submit(title.closest('form')!);
    await vi.waitFor(() => expect(mock.toast).toHaveBeenCalled());
    expect(title).toHaveValue('Kochabend Entwurf');
    expect(screen.getByRole('button', { name: 'Verwerfen' })).toBeEnabled();
  });

  it('stages status changes until saving and protects closing a dirty draft', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<LogbookEntryFlyout entryId="entry" onClose={close} startEditing />, { wrapper: MemoryRouter });
    await user.click(screen.getByRole('button', { name: 'Offen' }));
    await user.click(screen.getByRole('button', { name: 'Nachverfolgung' }));
    expect(mock.status).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    // Closing the modal must ask before discarding an unsaved status change.
    fireEvent.click(screen.getAllByRole('button', { name: 'Schließen' })[0]);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }));
    fireEvent.submit(screen.getByRole('textbox', { name: 'Titel' }).closest('form')!);
    await vi.waitFor(() => expect(mock.save).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'follow_up' }) })));
  });
});
