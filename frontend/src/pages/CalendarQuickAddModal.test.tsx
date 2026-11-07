import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity } from '@/lib/activities';
import type { StaffMember } from '@/lib/staff';
import ActivityQuickAdd from './CalendarQuickAddModal';
import ActivityEditPage from './ActivityEditPage';
import ActivityCreatePage from './ActivityCreatePage';
import { MemoryRouter } from 'react-router-dom';

const state = vi.hoisted(() => ({ activity: undefined as Activity | undefined, mutate: vi.fn(), empty: [], categoryMode: 'multiple', categories: [{ id: 'c1', name: 'Sport' }, { id: 'c2', name: 'Musik' }], staff: [] as StaffMember[] }));
vi.mock('@/lib/activities', () => ({
  useActivity: () => ({ data: state.activity }),
  useCreateActivity: () => ({ mutate: state.mutate }),
  useUpdateActivity: () => ({ mutate: state.mutate }),
  useRemoveActivity: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/lib/publicConfig', () => ({ usePublicConfig: () => ({ data: { activityCategoryMode: state.categoryMode } }) }));
vi.mock('@/lib/projects', () => ({ useProjects: () => ({ data: state.empty }) }));
vi.mock('@/lib/staff', async () => {
  const { useMemo } = await import('react');
  return {
    useStaff: (params?: { active?: boolean }) => ({
      data: useMemo(() => params?.active ? state.staff.filter((s) => s.active !== false) : state.staff, [params?.active]),
    }),
    useCreateStaff: () => ({}),
  };
});
vi.mock('@/lib/locations', () => ({ useLocations: () => ({ data: state.empty }) }));
vi.mock('@/lib/taxonomy', () => ({
  useTags: () => ({ data: state.empty }), useCategories: () => ({ data: state.categories }),
  useCohorts: () => ({ data: [{ id: 'young', name: '6-9 Jahre' }, { id: 'older', name: '10-12 Jahre' }] }),
  useTaxonomyAccess: () => ({ data: {} }), useCreateCategory: () => ({}),
  useUpdateCategory: () => ({}), useCreateTag: () => ({}), useUpdateTag: () => ({}),
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { role: 'editor' } }), canManageSettingsDestructiveActions: () => true }));
vi.mock('@/lib/contributors', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/contributors')>(), useContributors: () => ({ isSuccess: true, data: [{ id: 'lea', name: 'Lea', active: true, color: '#123456' }] }), useSaveContributor: () => ({ mutateAsync: vi.fn() }) }));
vi.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/components/Modal', async importOriginal => ({ ...await importOriginal<typeof import('@/components/Modal')>(), useModalHistory: () => ({ dismiss: vi.fn(), dismissWithoutCallback: vi.fn() }) }));
vi.mock('@/lib/useActivityModalCountMode', () => ({ useActivityModalCountMode: () => ({ isMobile: false, tapModeEnabled: false }) }));
vi.mock('./useActivityInlineCreation', () => ({ useActivityInlineCreation: () => ({}) }));
vi.mock('./ProjectPickerModal', () => ({ default: () => null }));
vi.mock('@/components/ProtectedImage', () => ({ default: () => null }));

function activity(version: number, youngWomen: number): Activity {
  return {
    id: 'activity-1', version, date: '2026-09-05', type: 'event', title: 'Test', projectId: 'project-1',
    startTime: '16:15', endTime: '19:15', executionStatus: 'completed',
    cohorts: [{ cohortId: 'young', m: 0, w: youngWomen, d: 0 }, { cohortId: 'older', m: 0, w: 2, d: 0 }],
  } as Activity;
}

beforeEach(() => { state.categoryMode = 'multiple'; state.activity = undefined; state.staff = []; state.mutate.mockReset(); });

describe('activity editor refresh', () => {
  it('offers contributions in the calendar modal and saves explicit minutes', () => {
    const initial = activity(1, 4);
    render(<ActivityQuickAdd dateISO={initial.date} activity={initial} onClose={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Mitwirkende' }).closest('details')).not.toBeNull();
    expect(screen.getByRole('region', { name: 'Mitwirkende' }).closest('details')?.parentElement?.children).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Lea' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mitwirkungszeiten anpassen' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Lea: Mitwirkungszeit' }), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ contributions: [{ contributorId: 'lea', minutes: 45 }] }) }), expect.anything());
  });

  it('opens the standalone editor when its activity arrives after the initial render', async () => {
    const { rerender } = render(<MemoryRouter><ActivityEditPage /></MemoryRouter>);
    expect(screen.queryByLabelText('Notizen')).not.toBeInTheDocument();

    state.activity = { ...activity(1, 4), notes: 'Existing notes' };
    rerender(<MemoryRouter><ActivityEditPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText('Notizen')).toHaveValue('Existing notes'));
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled();
  });

  it.each(['single', 'multiple'])('saves the category selection in %s mode', (mode) => {
    state.categoryMode = mode;
    const initial = activity(1, 4);
    render(<ActivityQuickAdd dateISO={initial.date} activity={initial} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sport' }));
    fireEvent.click(screen.getByRole('button', { name: 'Musik' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ categoryIds: mode === 'single' ? ['c2'] : ['c1', 'c2'] }) }), expect.anything());
  });

  it('keeps existing multiple categories visible and blocks saving until reduced in single mode', () => {
    state.categoryMode = 'single';
    const initial = { ...activity(1, 4), categories: state.categories } as Activity;
    render(<ActivityQuickAdd dateISO={initial.date} activity={initial} onClose={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('nur eine Kategorie');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sport' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ categoryIds: ['c2'] }) }), expect.anything());
  });

  it('shows assigned archived staff, saves them unchanged, and lets users remove them', () => {
    state.staff = [
      { id: 'archived', name: 'Former member', role: 'employee', active: false },
      { id: 'other', name: 'Unassigned archive', role: 'employee', active: false },
    ];
    const initial = { ...activity(1, 4), staff: [state.staff[0]] } as Activity;
    const { unmount } = render(<ActivityQuickAdd dateISO={initial.date} activity={initial} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Unassigned archive/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.mutate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ staffIds: ['archived'] }) }), expect.anything());
    unmount();
    render(<ActivityQuickAdd dateISO={initial.date} activity={initial} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Former member (Archiviert)' }));
    expect(screen.queryByRole('button', { name: /Former member/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.mutate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ staffIds: [] }) }), expect.anything());
  });
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


describe('planned activity workflow', () => {
  const future = '2099-11-19';
  const plan = () => ({ ...activity(1, 0), date: future, executionStatus: 'planned', cohorts: [] }) as Activity;
  it('opens a future calendar entry as planned with disabled counts and saves that status', () => {
    render(<ActivityQuickAdd dateISO={future} project={{ id: 'project-1', title: 'Sport', type: 'event', defaultStartTime: '15:00', defaultEndTime: '17:00' } as never} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Geplant' })).toBeInTheDocument();
    expect(screen.getByLabelText('6-9 Jahre W')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Geplant' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Stattgefunden' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Geplant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ executionStatus: 'planned', countTotal: 0, cohorts: [] }), expect.anything());
  });
  it('uses the same planning default on the standalone create page', () => {
    render(<MemoryRouter initialEntries={['/activities/new?date=' + future]}><ActivityCreatePage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Geplant' })).toBeInTheDocument();
    expect(screen.getByLabelText('6-9 Jahre W')).toBeDisabled();
  });
  it('keeps overdue plans pending and unlocks counts only when documenting', () => {
    const initial = { ...plan(), date: '2020-11-01' };
    render(<ActivityQuickAdd dateISO={initial.date} activity={initial} onClose={vi.fn()} />);
    expect(screen.getByText('Dokumentation offen')).toBeInTheDocument();
    expect(screen.getByLabelText('6-9 Jahre W')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Durchführung dokumentieren' }));
    expect(screen.getByLabelText('6-9 Jahre W')).toBeEnabled();
    fireEvent.change(screen.getByLabelText('6-9 Jahre W'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ id: initial.id, data: expect.objectContaining({ executionStatus: 'completed', countTotal: 7 }) }), expect.anything());
  });
  it('does not silently discard attendance when an existing event is moved into the future', () => {
    const initial = activity(1, 4);
    render(<ActivityQuickAdd dateISO={initial.date} activity={initial} onClose={vi.fn()} />);
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: future } });
    expect(screen.getByLabelText('6-9 Jahre W')).toHaveValue(4);
    expect(screen.getByLabelText('6-9 Jahre W')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    fireEvent.click(screen.getByRole('button', { name: 'Besucherzahlen entfernen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ executionStatus: 'planned', countTotal: 0, cohorts: [] }) }), expect.anything());
  });
  it('can cancel a future plan without entering attendance', () => {
    const initial = plan();
    render(<ActivityQuickAdd dateISO={future} activity={initial} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Geplant' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Ausgefallen' }));
    expect(screen.getByLabelText('6-9 Jahre W')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ executionStatus: 'cancelled', countTotal: 0 }) }), expect.anything());
  });
});

it('leaves missing project times empty and requires both before saving', () => {
  render(<ActivityQuickAdd dateISO="2026-11-03" project={{ id: 'project-1', title: 'Ohne Zeiten', type: 'event' } as import('@/lib/projects').Project} onClose={vi.fn()} />);
  expect(screen.getByLabelText('Start')).toHaveValue('');
  expect(screen.getByLabelText('Ende')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Start'), { target: { value: '10:00' } });
  expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Ende'), { target: { value: '12:00' } });
  expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ startTime: '10:00', endTime: '12:00', durationMinutes: 120 }), expect.anything());
});

it('uses configured project times but keeps manually cleared fields empty', () => {
  render(<ActivityQuickAdd dateISO="2026-11-03" project={{ id: 'project-1', title: 'Mit Zeiten', type: 'event', defaultStartTime: '09:30', defaultEndTime: '11:45' } as import('@/lib/projects').Project} onClose={vi.fn()} />);
  expect(screen.getByLabelText('Start')).toHaveValue('09:30');
  expect(screen.getByLabelText('Ende')).toHaveValue('11:45');
  fireEvent.change(screen.getByLabelText('Start'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Ende'), { target: { value: '' } });
  expect(screen.getByLabelText('Start')).toHaveValue('');
  expect(screen.getByLabelText('Ende')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
});

it('requires times on the standalone activity create and edit pages', () => {
  const view = render(<MemoryRouter><ActivityCreatePage /></MemoryRouter>);
  expect(screen.getByLabelText('Start')).toHaveValue('');
  expect(screen.getByLabelText('Ende')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  view.unmount();
  state.activity = activity(1, 0);
  render(<MemoryRouter><ActivityEditPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Start'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Ende'), { target: { value: '' } });
  expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  expect(state.mutate).not.toHaveBeenCalled();
});
