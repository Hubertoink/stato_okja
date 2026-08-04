import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useKeyboardOpen } from './useKeyboardOpen';

class TestVisualViewport extends EventTarget {
  height = 800;
  offsetTop = 0;
}

describe('useKeyboardOpen', () => {
  afterEach(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
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
});
