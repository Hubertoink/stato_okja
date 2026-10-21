import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDesktopUpdates, type DesktopUpdateState } from './desktopUpdates';

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock('@/components/Toast', () => ({ useToast: () => ({ showToast }) }));

afterEach(() => { delete window.statoDesktopUpdates; vi.clearAllMocks(); });

describe('desktop updates', () => {
  it('does not show the feature in a browser', () => {
    const { result } = renderHook(() => useDesktopUpdates());
    expect(result.current.available).toBe(false);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('keeps newer events over a stale initial response, toasts once and cleans up', async () => {
    let receive!: (state: DesktopUpdateState) => void;
    let resolve!: (state: DesktopUpdateState) => void;
    const unsubscribe = vi.fn();
    const state: DesktopUpdateState = { revision: 2, status: 'available', currentVersion: '1.16.0', version: '1.17.0', percent: 0 };
    window.statoDesktopUpdates = {
      getState: () => new Promise((done) => { resolve = done; }),
      onState: (callback) => { receive = callback; return unsubscribe; },
      open: vi.fn(async () => state),
    };
    const { result, unmount } = renderHook(() => useDesktopUpdates());
    act(() => { receive(state); receive({ ...state, revision: 3 }); });
    await act(async () => { resolve({ ...state, revision: 1, status: 'idle' }); });
    expect(result.current.state?.status).toBe('available');
    expect(showToast).toHaveBeenCalledTimes(1);
    act(() => result.current.open());
    expect(window.statoDesktopUpdates.open).toHaveBeenCalledOnce();
    act(() => receive({ ...state, revision: 4, status: 'downloaded', percent: 100 }));
    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(2));
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
