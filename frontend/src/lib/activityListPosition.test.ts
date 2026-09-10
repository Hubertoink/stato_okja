import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getActivityListPosition, saveActivityListPosition, useRestoreActivityListPosition } from './activityListPosition';

describe('activity list return position', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(845);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('retains the page and offset for the originating history entry', () => {
    saveActivityListPosition('page-three', 3);
    expect(getActivityListPosition('page-three')).toEqual({ page: 3, y: 845 });
    expect(getActivityListPosition('unrelated-entry')).toBeUndefined();
  });

  it('waits for the list data, then restores after route scroll resets', () => {
    const position = { page: 3, y: 845 };
    const { rerender } = renderHook(({ ready }) => useRestoreActivityListPosition(position, ready), { initialProps: { ready: false } });
    act(() => vi.advanceTimersByTime(50));
    expect(window.scrollTo).not.toHaveBeenCalled();
    rerender({ ready: true });
    act(() => vi.advanceTimersByTime(50));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 845, left: 0, behavior: 'auto' });
    rerender({ ready: false });
    rerender({ ready: true });
    act(() => vi.advanceTimersByTime(50));
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('cancels a scheduled restoration when the list unmounts', () => {
    const { unmount } = renderHook(() => useRestoreActivityListPosition({ page: 1, y: 500 }, true));
    unmount();
    act(() => vi.advanceTimersByTime(50));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
