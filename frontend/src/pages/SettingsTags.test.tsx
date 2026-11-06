import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsTags from './SettingsTags';

const state = vi.hoisted(() => ({ canCreateOwn: true, create: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { role: 'user' } }),
  canManageSettingsDestructiveActions: () => false,
}));
vi.mock('@/lib/taxonomy', () => ({
  useTags: () => ({ data: [{ id: 'tag-1', name: 'Bestehendes Tag', active: true }] }),
  useTaxonomyAccess: () => ({ data: { tags: { canCreateOwn: state.canCreateOwn } } }),
  useCreateTag: () => ({ mutate: state.create }),
  useUpdateTag: () => ({ mutate: vi.fn() }),
  useDeleteTag: () => ({ mutate: vi.fn() }),
}));

describe('tag creation for normal users', () => {
  beforeEach(() => {
    state.canCreateOwn = true;
    vi.clearAllMocks();
  });

  it('lets users create a tag without offering edit or delete actions', () => {
    render(<SettingsTags />);
    expect(screen.queryByRole('button', { name: /bearbeiten/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /löschen/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Neues Tag' }));
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Ausflug' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ausflug', active: true }), expect.any(Object),
    );
  });

  it('keeps creation disabled when the organization disallows local tags', () => {
    state.canCreateOwn = false;
    render(<SettingsTags />);
    expect(screen.getByRole('button', { name: 'Neues Tag' })).toBeDisabled();
  });
});
