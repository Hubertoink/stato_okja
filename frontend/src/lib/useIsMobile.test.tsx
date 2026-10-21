import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIsMobile } from './useIsMobile';

afterEach(() => vi.unstubAllGlobals());

describe('width-based layouts on touch-enabled desktops', () => {
  it('keeps statistics desktop controls on wide touch screens and switches at the CSS breakpoint', () => {
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { result } = renderHook(() => useIsMobile(768, { touchIsMobile: false }));
    expect(result.current).toBe(false);
    vi.stubGlobal('innerWidth', 767);
    fireEvent.resize(window);
    expect(result.current).toBe(true);
    vi.stubGlobal('innerWidth', 768);
    fireEvent.resize(window);
    expect(result.current).toBe(false);
  });

  it('preserves touch detection for existing callers', () => {
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { result } = renderHook(() => useIsMobile(768));
    expect(result.current).toBe(true);
  });
});
