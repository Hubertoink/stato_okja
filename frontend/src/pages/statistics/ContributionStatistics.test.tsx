import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContributionStatistics from './ContributionStatistics';
import type { ContributionEntry } from '@/lib/contributors';
vi.mock('../StatisticsBarChartCard', () => ({ StatisticsBarChartCard: ({ data, barDataKey }: { data: { name: string; assignments: number }[]; barDataKey: string }) => <output data-testid="bar" data-metric={barDataKey}>{JSON.stringify(data.map(row => [row.name, row.assignments]))}</output> }));
vi.mock('../StatisticsPieChartCard', () => ({ StatisticsPieChartCard: ({ data }: { data: { name: string; value: number }[] }) => <output data-testid="pie">{JSON.stringify(data)}</output> }));
const entry: ContributionEntry = { contributorId: 'lea', name: 'Lea', color: '#123456', active: true, minutes: 45, activityId: 'a1', date: '2026-11-06', title: 'Theke', projectId: 'p1', projectTitle: 'Theke' };
describe('contribution statistics', () => {
  it('shows assignments and accumulated time as separate charts with no local controls or table', () => {
    render(<ContributionStatistics entries={[entry, { ...entry, activityId: 'a2', minutes: 60 }, { ...entry, contributorId: 'sam', name: 'Sam', minutes: 30 }]} />);
    expect(screen.getByTestId('bar')).toHaveAttribute('data-metric', 'assignments');
    expect(screen.getByTestId('bar')).toHaveTextContent('["Lea",2]');
    expect(screen.getByTestId('pie')).toHaveTextContent('"value":105');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('uses the selection from the advanced filter and hides both charts without matching entries', () => {
    const entries = [entry, { ...entry, contributorId: 'sam', name: 'Sam', minutes: 30 }];
    const { rerender } = render(<ContributionStatistics entries={entries} selectedIds={['lea']} />);
    expect(screen.getByTestId('bar')).toHaveTextContent('Lea');
    expect(screen.getByTestId('pie')).not.toHaveTextContent('Sam');
    rerender(<ContributionStatistics entries={entries} selectedIds={['missing']} />);
    expect(screen.queryByTestId('bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pie')).not.toBeInTheDocument();
    rerender(<ContributionStatistics entries={[]} />);
    expect(screen.queryByTestId('bar')).not.toBeInTheDocument();
  });
});
