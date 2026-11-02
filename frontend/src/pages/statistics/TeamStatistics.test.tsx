import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { cloneElement, useState, type ReactElement } from 'react';
import { TeamStatistics, TeamMemberChips, useTeamStatisticsQuery } from './TeamStatistics';
vi.mock('./TeamActivitiesTable', () => ({
  TeamActivitiesTable: ({ staffId }: { staffId: string }) => (
    <div data-testid="member-activities">{staffId}</div>
  ),
}));

// jsdom has no layout/ResizeObserver; keep the actual chart with a fixed viewport.
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({
    children,
  }: {
    children: ReactElement<{ width: number; height: number }>;
  }) => cloneElement(children, { width: 600, height: 420 }),
}));

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
  it('shows the member distribution for project/type selections and respects the member filter', () => {
    function Harness({ params, staffId }: { params: { type?: string; projectId?: string }; staffId?: string }) {
      const query = useTeamStatisticsQuery(params);
      return <TeamStatistics params={params} query={query} staffId={staffId} />;
    }
    const view = render(<Harness params={{}} />);
    expect(screen.queryByRole('region', { name: 'Durchgeführte Einsätze nach Teammitglied' })).not.toBeInTheDocument();
    view.rerender(<Harness params={{ projectId: 'p1' }} />);
    expect(screen.getByRole('table', { name: 'Durchgeführte Einsätze und Anteil je Teammitglied' })).toHaveTextContent('Anna');
    expect(screen.getByRole('table', { name: 'Durchgeführte Einsätze und Anteil je Teammitglied' })).not.toHaveTextContent('Max');
    expect(screen.getByText('100 %')).toBeInTheDocument();
    view.rerender(<Harness params={{ type: 'open_door' }} staffId="max" />);
    expect(screen.getByText('Keine durchgeführten Team-Einsätze für diese Auswahl.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Durchgeführte Einsätze und Anteil je Teammitglied' })).not.toBeInTheDocument();
  });

  it('keeps the selected member visible in a collapsed chip list', () => {
    const onChange = vi.fn();
    render(
      <TeamMemberChips
        people={Array.from({ length: 12 }, (_, index) => [String(index), `Person ${index}`])}
        selectedId="11"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('button', { name: 'Person 11' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Person 10' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '3 weitere anzeigen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Person 10' }));
    expect(onChange).toHaveBeenCalledWith('10');
  });
  it('shows separate status totals and updates both breakdowns when selecting a person', () => {
    function Harness() {
      const params = { from: '2026-11-01', to: '2026-11-30' };
      const query = useTeamStatisticsQuery(params);
      const [staffId, setStaffId] = useState('');
      return (
        <>
          <TeamMemberChips
            people={[
              ['anna', 'Anna'],
              ['max', 'Max'],
            ]}
            selectedId={staffId}
            onChange={setStaffId}
          />
          <TeamStatistics params={params} query={query} staffId={staffId} />
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('heading', { name: 'Personenstunden nach Typ' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nach Team-Mitglied' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('member-activities')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Ø Stunden je Einsatztag und Person' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1,5 Std.')).toBeInTheDocument();
    expect(screen.getByText('1 Std.')).toBeInTheDocument();
    expect(screen.getByText('0,5 Std.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anna' }));
    expect(screen.getByRole('button', { name: 'Anna' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Werte nach Typ anzeigen')).not.toBeInTheDocument();
    expect(screen.getByText('0 Std.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Max' })).not.toBeInTheDocument();
    expect(screen.getByTestId('member-activities')).toHaveTextContent('anna');
    expect(screen.getByRole('heading', { name: 'Stunden je Einsatztag' })).toBeInTheDocument();
  });
});

vi.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }), useProgressToast: vi.fn() }));
