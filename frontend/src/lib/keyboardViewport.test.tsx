import { afterEach, expect, it, vi } from 'vitest';
import { configureKeyboardViewport, getKeyboardViewport } from './keyboardViewport';

afterEach(() => {
  vi.unstubAllGlobals();
  document.querySelector('meta[name="viewport"]')?.remove();
});

function setup(userAgent: string) {
  vi.stubGlobal('navigator', { userAgent });
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
  document.head.append(meta);
  return meta;
}

it('enables content resizing in Android Edge while preserving other viewport settings', () => {
  const meta = setup('Mozilla/5.0 (Linux; Android 10; K) Chrome/158.0.0.0 EdgA/158.0.0.0');
  meta.content += ', interactive-widget=overlays-content';
  configureKeyboardViewport();
  configureKeyboardViewport();
  expect(meta.content).toBe('width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content');
});

it.each([
  'Mozilla/5.0 (Linux; Android 10; K) Chrome/158.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0) Chrome/158.0.0.0 Edg/158.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) EdgiOS/158.0',
])('preserves viewport behavior in other browsers: %s', (userAgent) => {
  const meta = setup(userAgent);
  const content = meta.content;
  configureKeyboardViewport();
  expect(meta.content).toBe(content);
});

it('uses the actual visual viewport and falls back when it is unavailable', () => {
  vi.stubGlobal('visualViewport', { height: 487.24, offsetTop: 12 });
  expect(getKeyboardViewport()).toEqual({ height: 487.24, offsetTop: 12 });
  vi.stubGlobal('visualViewport', undefined);
  vi.stubGlobal('innerHeight', 723);
  expect(getKeyboardViewport()).toEqual({ height: 723, offsetTop: 0 });
});
