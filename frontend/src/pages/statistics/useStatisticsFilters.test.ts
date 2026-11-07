import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useStatisticsFilters } from './useStatisticsFilters';

describe('advanced contributor filter', () => {
  it('keeps drafts separate, applies selections, and clears them with other advanced filters', () => {
    localStorage.clear();
    const { result } = renderHook(() => useStatisticsFilters());
    act(() => result.current.setTempContributorIds(['lea']));
    expect(result.current.selectedContributorIds).toEqual([]);
    act(() => result.current.applyCustomRange());
    expect(result.current.selectedContributorIds).toEqual(['lea']);
    expect(result.current.hasAdvancedFilter).toBe(true);
    expect(result.current.formatAdvancedFilterDisplay([])).toContain('Mitwirkende: 1');
    act(() => result.current.resetAdvancedFilters());
    expect(result.current.selectedContributorIds).toEqual([]);
    expect(result.current.tempContributorIds).toEqual([]);
    expect(result.current.hasAdvancedFilter).toBe(false);
  });
});
