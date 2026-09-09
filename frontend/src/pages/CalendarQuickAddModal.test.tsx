import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity } from '@/lib/activities';
import ActivityQuickAdd from './CalendarQuickAddModal';

const state = vi.hoisted(() => ({ activity: undefined as Activity | undefined, mutate: vi.fn(), empty: [] }));
vi.mock('@/lib/activities', () => ({
  useActivity: () => ({ data: state.activity }),
  useCreateActivity: () => ({ mutate: state.mutate }),
  useUpdateActivity: () => ({ mutate: state.mutate }),
  useRemoveActivity: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/lib/projects', () => ({ useProjects: () => ({ data: state.empty }) }));
vi.mock('@/lib/staff', () => ({ useStaff: () => ({ data: state.empty }), useCreateStaff: () => ({}) }));
vi.mock('@/lib/locations', () => ({ useLocations: () => ({ data: state.empty }) }));
vi.mock('@/lib/taxonomy', () => ({
  useTags: () => ({ data: state.empty }), useCategories: () => ({ data: state.empty }),
  useCohorts: () => ({ data: [{ id: 'young', name: '6-9 Jahre' }, { id: 'older', name: '10-12 Jahre' }] }),
  useTaxonomyAccess: () => ({ data: {} }), useCreateCategory: () => ({}),
  useUpdateCategory: () => ({}), useCreateTag: () => ({}), useUpdateTag: () => ({}),
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { role: 'editor' } }) }));
vi.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/components/Modal', () => ({ useModalHistory: () => ({ dismiss: vi.fn() }) }));
vi.mock('@/lib/useActivityModalCountMode', () => ({ useActivityModalCountMode: () => ({ isMobile: false, tapModeEnabled: false }) }));
vi.mock('./useActivityInlineCreation', () => ({ useActivityInlineCreation: () => ({}) }));
vi.mock('./ProjectPickerModal', () => ({ default: () => null }));
vi.mock('@/components/ProtectedImage', () => ({ default: () => null }));
vi.mock('@/components/ConfirmModal', () => ({ default: () => null }));

function activity(version: number, youngWomen: number): Activity {
  return {
    id: 'activity-1', version, date: '2026-09-05', type: 'event', title: 'Test', projectId: 'project-1',
    startTime: '16:15', endTime: '19:15', executionStatus: 'completed',
    cohorts: [{ cohortId: 'young', m: 0, w: youngWomen, d: 0 }, { cohortId: 'older', m: 0, w: 2, d: 0 }],
  } as Activity;
}

beforeEach(() => { state.activity = undefined; state.mutate.mockReset(); });

describe('activity editor refresh', () => {
  it('replaces cached 4+2 with fetched 6+2 and saves the matching version', async () => {
    const initial = activity(1, 4);
    const { rerender } = render(<ActivityQuickAdd dateISO={initial.date} activity={initial} onClose={vi.fn()} />);
    expect(screen.getByLabelText('6-9 Jahre W')).toHaveValue(4);
    state.activity = activity(2, 6);
    rerender(<ActivityQuickAdd dateISO={initial.date} activity={initial} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('6-9 Jahre W')).toHaveValue(6));
    expect(screen.getByLabelText('10-12 Jahre W')).toHaveValue(2);
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ expectedVersion: 2 }) }), expect.anything());
  });

  it('preserves local edits and their original version when remote data changes', async () => {
    const initial = activity(1, 4);
    const { rerender } = render(<ActivityQuickAdd dateISO={initial.date} activity={initial} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('6-9 Jahre W'), { target: { value: '5' } });
    expect(screen.getByLabelText('6-9 Jahre W')).toHaveValue(5);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    state.activity = activity(2, 6);
    rerender(<ActivityQuickAdd dateISO={initial.date} activity={initial} onClose={vi.fn()} />);
    expect(screen.getByLabelText('6-9 Jahre W')).toHaveValue(5);
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ expectedVersion: 1 }) }), expect.anything());
  });
});
