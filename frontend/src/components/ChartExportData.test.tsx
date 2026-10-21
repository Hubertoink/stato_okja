import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChartExportData } from './ChartExportData';

vi.mock('@/i18n/formatters', () => ({ getCurrentIntlLocale: () => 'de-DE' }));

describe('ChartExportData', () => {
  it('keeps full names, zeroes and formatted averages without changing the interactive view', () => {
    const name = 'Ein sehr langer Projektname ohne abgeschnittene Bezeichnung';
    const { container } = render(
      <ChartExportData bars valueLabel="Aktivitaeten" rows={[
        { name, value: 1234.5, color: '#7c3aed' },
        { name: 'Null', value: 0 },
      ]} />,
    );
    expect(container.querySelector('[data-export-only]')).toHaveStyle({ display: 'none' });
    expect(container.textContent).toContain(name);
    expect(container.textContent).toContain('1.234,5');
    expect(container.querySelectorAll('tbody td')[5]).toHaveTextContent('0');
    const bars = container.querySelectorAll<HTMLElement>('[data-export-preserve-background]');
    expect(bars[0]).toHaveStyle({ width: '100%', backgroundColor: '#7c3aed' });
    expect(bars[1]).toHaveStyle({ width: '0%' });
  });

  it('pairs every pie category with its absolute value and share, including zero totals', () => {
    const { container, rerender } = render(
      <ChartExportData percentages valueLabel="Teilnahmen" rows={[
        { name: 'A', value: 3 }, { name: 'B', value: 1 },
      ]} />,
    );
    expect(container.querySelector('tbody tr')).toHaveTextContent('A375 %');
    expect(container.querySelectorAll('tbody tr')[1]).toHaveTextContent('B125 %');
    rerender(<ChartExportData percentages valueLabel="Teilnahmen" rows={[{ name: 'A', value: 0 }]} />);
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
    expect(container.querySelector('tbody tr')).toHaveTextContent('A00 %');
  });

  it('reports an empty dataset explicitly', () => {
    const { container } = render(<ChartExportData rows={[]} valueLabel="Anzahl" />);
    expect(container.textContent).toContain('Keine Daten');
  });
});
