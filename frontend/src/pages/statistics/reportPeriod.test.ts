import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { formatDate } from '@/i18n/formatters';
import { autoT } from '@/i18n/auto';
import { useStatisticsFilters } from './useStatisticsFilters';
import { formatStatisticsReportPeriod } from './reportPeriod';

describe('statistics report period', () => {
  beforeEach(() => localStorage.clear());
  it('renders the export summary after selecting all years without an invalid date', () => {
    const { result } = renderHook(() => {
      const filters = useStatisticsFilters();
      return { ...filters, reportPeriod: formatStatisticsReportPeriod(filters.from, filters.to) };
    });
    act(() => result.current.selectYear(''));
    expect(result.current.from).toBe('');
    expect(result.current.to).toBe('');
    expect(result.current.reportPeriod).toBe(autoT('ui_eb3ab8ef013a'));
    act(() => result.current.selectYear('2026'));
    expect(result.current.reportPeriod).toBe(`${formatDate('2026-01-01T12:00:00')} – ${formatDate('2026-12-31T12:00:00')}`);
  });
  it('supports either open bound in a custom period', () => {
    expect(formatStatisticsReportPeriod('', '2026-09-10')).toBe(`… – ${formatDate('2026-09-10T12:00:00')}`);
    expect(formatStatisticsReportPeriod('2026-01-01', '')).toBe(`${formatDate('2026-01-01T12:00:00')} – …`);
  });
});
