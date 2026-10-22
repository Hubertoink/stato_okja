import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { monthlyActivityCounts, MonthActivityIndicator } from './MonthActivityIndicator';

describe('month activity indicators', () => {
  it('aggregates daily counts within the selected year and keeps empty months at zero', () => {
    expect(monthlyActivityCounts([
      { date: '2026-01-02', activityCount: 2 }, { date: '2026-01-03', activityCount: 3 },
      { date: '2026-03-01', activityCount: 10 }, { date: '2025-01-01', activityCount: 100 },
    ], '2026')).toEqual([5, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
  it('shows proportional fill and no fill for missing or zero counts', () => {
    const { container, rerender } = render(<MonthActivityIndicator count={5} max={10} active={false} />);
    expect(container.querySelector('span span')).toHaveStyle({ width: '50%' });
    rerender(<MonthActivityIndicator count={0} max={0} active />);
    expect(container.querySelector('span span')).toBeNull();
    rerender(<MonthActivityIndicator max={10} active={false} />);
    expect(container.querySelector('span span')).toBeNull();
  });
});
