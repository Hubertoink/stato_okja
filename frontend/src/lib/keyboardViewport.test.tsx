import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { enableNativeKeyboardViewport, getKeyboardViewport, nativeKeyboardViewportActive } from './keyboardViewport';
import { useKeyboardOpen } from './useKeyboardOpen';

const releases: Array<() => void> = [];
afterEach(() => {
  releases.splice(0).forEach((release) => release());
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-keyboard-open');
  document.documentElement.removeAttribute('data-keyboard-viewport');
  for (const property of ['--visual-viewport-height', '--visual-viewport-fixed-height', '--visual-viewport-offset-top', '--keyboard-inset-height', '--native-keyboard-bottom']) {
    document.documentElement.style.removeProperty(property);
  }
});

function setup(userAgent = 'Mozilla/5.0 (Linux; Android 10; K) EdgA/155.0.0.0') {
  const viewport = Object.assign(new EventTarget(), { height: 435.05, width: 411.43, offsetTop: 0, scale: 1 });
  const keyboard = Object.assign(new EventTarget(), { overlaysContent: false, boundingRect: new DOMRect() });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 723);
  vi.stubGlobal('navigator', { userAgent, virtualKeyboard: keyboard });
  return { viewport, keyboard };
}

it('keeps the supplied Edge measurement unchanged without explicit native activation', () => {
  const { keyboard } = setup();
  keyboard.boundingRect = new DOMRect(0, 518, 411.43, 205);
  expect(getKeyboardViewport()).toEqual({ height: 435.05, offsetTop: 0, source: 'visual-viewport' });
  expect(keyboard.overlaysContent).toBe(false);
});

it('uses native keyboard bounds on geometrychange and restores the default when leaving the test', () => {
  const { keyboard, viewport } = setup();
  const field = document.createElement('textarea');
  document.body.append(field);
  field.focus();
  const { result, unmount } = renderHook(() => useKeyboardOpen());
  try {
    act(() => releases.push(enableNativeKeyboardViewport()));
    expect(keyboard.overlaysContent).toBe(true);
    // A deliberately independent keyboard boundary, not derived from the faulty VV height.
    act(() => {
      keyboard.boundingRect = new DOMRect(0, 518, 411.43, 205);
      keyboard.dispatchEvent(new Event('geometrychange'));
    });
    expect(document.documentElement.style.getPropertyValue('--visual-viewport-fixed-height')).toBe('518px');
    expect(document.documentElement.dataset.keyboardViewport).toBe('native-bottom');
    expect(document.documentElement.style.getPropertyValue('--native-keyboard-bottom')).toBe('205px');
    expect(result.current).toBe(true);
    // Overlay mode normally leaves VV at full height; the modal must still clear the keyboard.
    act(() => {
      viewport.height = 723;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(getKeyboardViewport().height).toBe(518);
    act(() => {
      keyboard.boundingRect = new DOMRect();
      keyboard.dispatchEvent(new Event('geometrychange'));
    });
    expect(document.documentElement.style.getPropertyValue('--visual-viewport-fixed-height')).toBe('723px');
    expect(result.current).toBe(false);
    expect(document.documentElement.dataset.keyboardViewport).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue('--native-keyboard-bottom')).toBe('');
    act(() => releases[0]());
    expect(keyboard.overlaysContent).toBe(false);
    expect(nativeKeyboardViewportActive()).toBe(false);
  } finally {
    unmount();
    field.remove();
  }
});

it.each(['Chrome/155.0.0.0 Android', 'Edg/155.0.0.0 Windows'])('does not opt other browsers into overlay mode: %s', (ua) => {
  const { keyboard } = setup(ua);
  releases.push(enableNativeKeyboardViewport());
  expect(keyboard.overlaysContent).toBe(false);
  expect(nativeKeyboardViewportActive()).toBe(false);
});

it('handles missing support and restores a pre-existing overlay setting after the last subscriber', () => {
  vi.stubGlobal('navigator', { userAgent: 'Android EdgA/155' });
  releases.push(enableNativeKeyboardViewport());
  expect(nativeKeyboardViewportActive()).toBe(false);
  const { keyboard } = setup();
  keyboard.overlaysContent = true;
  const first = enableNativeKeyboardViewport();
  const second = enableNativeKeyboardViewport();
  releases.push(first, second);
  first();
  first();
  expect(nativeKeyboardViewportActive()).toBe(true);
  second();
  expect(nativeKeyboardViewportActive()).toBe(false);
  expect(keyboard.overlaysContent).toBe(true);
});

it('does not apply invalid geometry or mix pinch zoom with native client coordinates', () => {
  const { keyboard, viewport } = setup();
  releases.push(enableNativeKeyboardViewport());
  for (const top of [NaN, -1, 0, 900]) {
    keyboard.boundingRect = new DOMRect(0, top, 411, 205);
    expect(getKeyboardViewport().source).toBe('visual-viewport');
  }
  keyboard.boundingRect = new DOMRect(0, 518, 411, 205);
  viewport.scale = 2;
  expect(getKeyboardViewport().source).toBe('visual-viewport');
});
