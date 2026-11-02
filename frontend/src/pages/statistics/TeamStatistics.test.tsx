import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamStatistics } from './TeamStatistics';

vi.mock('@/lib/orgScope', () => ({
  useOrgScopedQueryState: () => ({ scope: 'org-a', scopeKey: 'org-a', ready: true }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: [
      {
        staffId: 'anna',
        name: 'Anna',
        type: 'open_door',
        status: 'completed',
        minutes: 90,
        assignments: 2,
      },
      {
        staffId: 'max',
        name: 'Max',
        type: 'event',
        status: 'planned',
        minutes: 60,
        assignments: 1,
      },
      {
        staffId: 'anna',
        name: 'Anna',
        type: 'event',
        status: 'cancelled',
        minutes: 30,
        assignments: 1,
      },
    ],
  }),
}));

describe('team statistics view', () => {
  it('shows separate status totals and updates both breakdowns when selecting a person', () => {
    render(<TeamStatistics params={{ from: '2026-11-01', to: '2026-11-30' }} />);
    expect(screen.getByRole('heading', { name: 'Nach Typ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nach Team-Mitglied' })).toBeInTheDocument();
    expect(screen.getByText('1,5 Std.')).toBeInTheDocument();
    expect(screen.getByText('1 Std.')).toBeInTheDocument();
    expect(screen.getByText('0,5 Std.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Team-Mitglied'), { target: { value: 'anna' } });
    expect(screen.getByText('0 Std.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Max' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Offene Tür' })).toBeInTheDocument();
  });
});
