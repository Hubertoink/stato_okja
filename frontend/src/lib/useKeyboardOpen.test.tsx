import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardOpen } from './useKeyboardOpen';

class TestVisualViewport extends EventTarget {
  height = 800;
  offsetTop = 0;
}

describe('useKeyboardOpen', () => {
  afterEach(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    vi.useRealTimers();
  });

  it('tracks the visible viewport and only reports a keyboard for focused fields', () => {
    const viewport = new TestVisualViewport();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
    const input = document.createElement('input');
    document.body.append(input);
    const { result } = renderHook(() => useKeyboardOpen());

    expect(result.current).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--visual-viewport-height')).toBe('800px');
    expect(document.documentElement.style.getPropertyValue('--visual-viewport-fixed-height')).toBe('800px');

    input.focus();
    act(() => {
      viewport.height = 500;
      viewport.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(true);
    expect(document.documentElement.dataset.keyboardOpen).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--visual-viewport-height')).toBe('500px');
    expect(document.documentElement.style.getPropertyValue('--keyboard-inset-height')).toBe('300px');

    input.blur();
    act(() => {
      viewport.dispatchEvent(new Event('scroll'));
    });

    expect(result.current).toBe(false);
    input.remove();
  });

  it('clears keyboard state when the focused field is closed with its modal', () => {
    vi.useFakeTimers();
    const viewport = new TestVisualViewport();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const { result } = renderHook(() => useKeyboardOpen());

    act(() => {
      viewport.height = 500;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);

    input.blur();
    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(result.current).toBe(false);
    expect(document.documentElement.dataset.keyboardOpen).toBe('false');
    input.remove();
  });

  it('clears keyboard state when dismissal is reported by the window viewport', () => {
    const viewport = new TestVisualViewport();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const { result } = renderHook(() => useKeyboardOpen());

    act(() => {
      viewport.height = 500;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);

    act(() => {
      viewport.height = 800;
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(false);
    expect(document.documentElement.dataset.keyboardOpen).toBe('false');
    input.remove();
  });

  it('keeps the keyboard open and the modal within the visible area when the browser pans to a field', () => {
    const viewport = new TestVisualViewport();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const { result } = renderHook(() => useKeyboardOpen());

    act(() => {
      viewport.height = 500;
      viewport.dispatchEvent(new Event('resize'));
    });

    for (const offset of [150, 250, 300, 0]) {
      act(() => {
        viewport.offsetTop = offset;
        viewport.dispatchEvent(new Event('scroll'));
      });
      expect(result.current).toBe(true);
      expect(document.documentElement.style.getPropertyValue('--keyboard-inset-height')).toBe('300px');
      expect(document.documentElement.style.getPropertyValue('--visual-viewport-fixed-height')).toBe('500px');
      expect(document.documentElement.style.getPropertyValue('--visual-viewport-offset-top')).toBe(`${offset}px`);
    }
    input.remove();
  });

  it('keeps a modal within the visual viewport when the browser also resizes the layout viewport', () => {
    const viewport = new TestVisualViewport();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const { result } = renderHook(() => useKeyboardOpen());

    act(() => {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
      Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 500 });
      viewport.height = 480;
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--visual-viewport-fixed-height')).toBe('480px');
    input.remove();
  });

  it('does not expand the modal before the keyboard has finished closing after blur', () => {
    vi.useFakeTimers();
    const viewport = new TestVisualViewport();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const { result } = renderHook(() => useKeyboardOpen());

    act(() => {
      viewport.height = 500;
      viewport.dispatchEvent(new Event('resize'));
    });
    input.blur();
    act(() => { vi.runOnlyPendingTimers(); });

    expect(result.current).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--visual-viewport-fixed-height')).toBe('500px');

    act(() => {
      viewport.height = 800;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(document.documentElement.style.getPropertyValue('--visual-viewport-fixed-height')).toBe('800px');
    input.remove();
  });
});
