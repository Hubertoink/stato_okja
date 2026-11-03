import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamActivitiesTable } from './TeamActivitiesTable';
import { fetchAllActivities, useActivitiesPaged } from '@/lib/activities';

vi.mock('@/lib/activities', () => ({
  fetchAllActivities: vi.fn(async () => [{ id: 'all-pages' }]),
  useActivitiesPaged: vi.fn(() => ({
    data: {
      total: 1,
      data: [
        {
          id: 'activity',
          date: '2026-11-02',
          type: 'event',
          durationMinutes: 120,
          executionStatus: 'completed',
          staffTimes: [{ staffId: 'anna', minutes: 45 }],
        },
      ],
    },
    isPending: false,
    isError: false,
  })),
}));

describe('individual team activities', () => {
  it('filters by person and period and displays their individual time alongside the activity duration', () => {
    render(
      <TeamActivitiesTable
        params={{ from: '2026-11-01', to: '2026-11-30', projectId: 'project', type: 'event' }}
        staffId="anna"
      />,
    );
    expect(useActivitiesPaged).toHaveBeenCalledWith(
      expect.objectContaining({
        staffIds: ['anna'],
        projectIds: ['project'],
        from: '2026-11-01',
        to: '2026-11-30',
        type: 'event',
        executionStatuses: ['completed', 'planned', 'cancelled'],
      }),
      1,
      50,
    );
    expect(screen.getByRole('columnheader', { name: 'Einsatzzeit (min)' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '45' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '120' })).toBeInTheDocument();
  });
});

vi.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }), useProgressToast: vi.fn() }));

vi.mock('@/lib/orgScope', () => ({ useOrgScopedQueryState: () => ({ scope: 'org-a' }) }));
vi.mock('./export/activitiesExport', async (original) => ({
  ...(await original<typeof import('./export/activitiesExport')>()),
  exportActivitiesAsCsv: vi.fn(), exportActivitiesAsExcel: vi.fn(),
}));
import { exportActivitiesAsCsv, exportActivitiesAsExcel } from './export/activitiesExport';

it.each(['csv', 'xlsx'] as const)('exports all filtered activities as %s with individual time', async (format) => {
  render(<TeamActivitiesTable params={{ type: 'event', projectId: 'project', from: '2026-11-01', to: '2026-11-30', weekdays: [1], closureState: 'open' }} staffId="anna" />);
  fireEvent.click(screen.getByRole('button', { name: format === 'csv' ? 'CSVKomplett' : 'Als ExcelKomplett' }));
  await waitFor(() => expect(format === 'csv' ? exportActivitiesAsCsv : exportActivitiesAsExcel).toHaveBeenCalledWith(expect.objectContaining({
    activities: [{ id: 'all-pages' }], staffId: 'anna', fileName: expect.stringContaining(`.${format}`),
  })));
  expect(fetchAllActivities).toHaveBeenCalledWith(expect.objectContaining({ staffIds: ['anna'], projectIds: ['project'], type: 'event', weekdays: [1], closureState: 'open', from: '2026-11-01', to: '2026-11-30', executionStatuses: ['completed', 'planned', 'cancelled'] }), 'org-a');
});
