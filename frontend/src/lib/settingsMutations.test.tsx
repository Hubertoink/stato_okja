import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { useCreateStaff, useUpdateStaff } from './staff';
import { useCreateCategory, useCreateTag, useUpdateCategory, useUpdateTag } from './taxonomy';
import { StaffFormModal } from '@/components/settings/EntityFormModals';

vi.mock('./api', () => ({ api: { post: vi.fn(), patch: vi.fn() } }));
vi.mock('./orgScope', () => ({ useOrgScopeKey: () => 'org-1' }));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>;
}

const metadata = {
  id: 'entity-1', orgId: 'org-1', org: { id: 'org-1' },
  createdAt: '2026-10-01', updatedAt: '2026-10-02', lastLogin: '2026-10-03',
};

describe('settings mutation payloads', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
  });

  it('strips staff response metadata and uses the selected role when updating', async () => {
    const { result } = renderHook(() => useUpdateStaff(), { wrapper });
    await act(() => result.current.mutateAsync({ id: 'entity-1', data: {
      ...metadata, name: 'New name', role: 'employee', roles: ['volunteer'],
      email: null, phone: '', notes: null, active: false,
    } }));
    expect(api.patch).toHaveBeenCalledExactlyOnceWith('/staff/entity-1', {
      name: 'New name', role: 'volunteer', email: null, phone: '', notes: null, active: false,
    });
  });

  it('creates staff without response metadata or the unsupported roles field', async () => {
    const { result } = renderHook(() => useCreateStaff(), { wrapper });
    await act(() => result.current.mutateAsync({ ...metadata, name: 'New person', roles: 'helper', active: true }));
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/staff', {
      name: 'New person', role: 'helper', active: true, email: undefined, phone: undefined, notes: undefined,
    });
  });

  it.each([
    ['categories', useCreateCategory, useUpdateCategory],
    ['tags', useCreateTag, useUpdateTag],
  ] as const)('keeps %s create and update payloads free of taxonomy metadata', async (path, useCreate, useUpdate) => {
    const { lastLogin: _lastLogin, ...taxonomyMetadata } = metadata;
    void _lastLogin;
    const data = { ...taxonomyMetadata, sourceOrgId: 'parent', sourceOrgName: 'Parent',
      isInherited: false, canManage: true, name: 'New label', color: '#123456', description: 'Description', active: true };
    const expected = { name: 'New label', color: '#123456', description: 'Description', active: true };
    const create = renderHook(() => useCreate(), { wrapper });
    const update = renderHook(() => useUpdate(), { wrapper });
    await act(() => create.result.current.mutateAsync(data));
    await act(() => update.result.current.mutateAsync({ id: 'entity-1', data }));
    expect(api.post).toHaveBeenCalledExactlyOnceWith(`/taxonomy/${path}`, expected);
    expect(api.patch).toHaveBeenCalledExactlyOnceWith(`/taxonomy/${path}/entity-1`, expected);
  });

  it('retains staff edits after a failed save, then clears optional values on retry', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(new Error('400')).mockResolvedValueOnce({ data: {} });
    const saved = vi.fn();
    function Editor() {
      const update = useUpdateStaff();
      return <StaffFormModal initial={{ ...metadata, name: 'Team member', email: 'team@example.org', role: 'employee', active: true }}
        onCancel={vi.fn()} onSubmit={async (data) => { await update.mutateAsync({ id: 'entity-1', data }); saved(); }} />;
    }
    render(<Editor />, { wrapper });
    fireEvent.change(screen.getByDisplayValue('Team member'), { target: { value: 'Edited name' } });
    fireEvent.change(screen.getByDisplayValue('team@example.org'), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'helper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Speichern fehlgeschlagen.');
    expect(saved).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Edited name')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(api.patch).toHaveBeenLastCalledWith('/staff/entity-1', {
      name: 'Edited name', role: 'helper', email: null, phone: null, notes: null, active: undefined,
    });
  });
});
