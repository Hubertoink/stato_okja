import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatisticsPieChartCard } from './StatisticsPieChartCard';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pie: ({ label, children }: { label: unknown; children: ReactNode }) =>
    <div data-testid="pie" data-labels={label !== false}>{children}</div>,
  Cell: () => null,
  Legend: () => <div data-testid="legend" />,
  Tooltip: () => null,
}));

describe('pie export layout', () => {
  it('reserves the full plot area for export and leaves interactive labels and legend intact', () => {
    const props = {
      title: 'Alterskohorten', exportActions: null, bodyClassName: 'h-80',
      data: [{ name: 'Kohorte', value: 12, color: '#7c3aed' }],
      createLabelRenderer: vi.fn(() => () => <text>100 %</text>),
      formatValue: String, separatorColor: '#ffffff', cellKeyPrefix: 'cohort',
      valueLabel: 'Teilnahmen',
    };
    const { rerender, container } = render(<StatisticsPieChartCard {...props} showAbsoluteValueLabels={false} />);
    expect(screen.getByTestId('pie')).toHaveAttribute('data-labels', 'true');
    expect(screen.getByTestId('legend')).toBeInTheDocument();
    expect(props.createLabelRenderer).toHaveBeenCalledWith(false);
    rerender(<StatisticsPieChartCard {...props} showAbsoluteValueLabels />);
    expect(screen.getByTestId('pie')).toHaveAttribute('data-labels', 'false');
    expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
    expect(container.querySelector('[data-export-only]')).toHaveTextContent('Kohorte12100 %');
    expect(container.querySelector('[data-export-preserve-background]')).toHaveStyle({ backgroundColor: '#7c3aed' });
  });
});
