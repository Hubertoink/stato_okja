import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamActivitiesTable } from './TeamActivitiesTable';
import { useActivitiesPaged } from '@/lib/activities';

vi.mock('@/lib/activities', () => ({
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
