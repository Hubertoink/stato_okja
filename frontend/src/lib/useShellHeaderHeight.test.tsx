import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShellHeaderHeight } from './useShellHeaderHeight';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Example() {
  const ref = useShellHeaderHeight();
  return <div data-testid="layout"><div ref={ref} /></div>;
}

describe('sticky table header offset', () => {
  it('follows the collapsing header and navigation wrapping instead of keeping the expanded offset', () => {
    let height = 124;
    let resized = () => {};
    const disconnect = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ height }) as DOMRect);
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resized = callback; }
      observe = vi.fn();
      disconnect = disconnect;
    });
    const { unmount } = render(<Example />);
    const layout = screen.getByTestId('layout');
    expect(layout.style.getPropertyValue('--app-header-height')).toBe('124px');
    height = 92;
    act(resized);
    expect(layout.style.getPropertyValue('--app-header-height')).toBe('92px');
    height = 140;
    fireEvent.resize(window);
    expect(layout.style.getPropertyValue('--app-header-height')).toBe('140px');
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(layout.style.getPropertyValue('--app-header-height')).toBe('');
  });
});
