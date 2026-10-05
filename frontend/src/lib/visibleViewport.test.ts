import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVisibleViewportReader } from './visibleViewport';

const EDGE_ANDROID = 'Mozilla/5.0 (Linux; Android 14) Chrome/140.0.0.0 Mobile Safari/537.36 EdgA/140.0.0.0';

function setup(userAgent = EDGE_ANDROID) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('innerHeight', 800);
  const viewport = { height: 800, offsetTop: 0, scale: 1 };
  vi.stubGlobal('visualViewport', viewport);
  const read = createVisibleViewportReader();
  read();
  return { read, viewport };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('visible viewport', () => {
  it('uses the resized Edge window instead of leaving a gap above the keyboard', () => {
    const { read, viewport } = setup();
    vi.stubGlobal('innerHeight', 450);
    viewport.height = 370;
    expect(read()).toEqual({ height: 450, offsetTop: 0 });
    // Blurring a field must not undo the correction before the keyboard closes.
    expect(read()).toEqual({ height: 450, offsetTop: 0 });
    vi.stubGlobal('innerHeight', 800);
    viewport.height = 800;
    expect(read()).toEqual({ height: 800, offsetTop: 0 });
  });

  it('does not extend the modal behind the keyboard when Edge has not resized the window', () => {
    const { read, viewport } = setup();
    viewport.height = 450;
    expect(read().height).toBe(450);
  });

  it.each([
    'Mozilla/5.0 (Linux; Android 14) Chrome/140.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
  ])('preserves VisualViewport sizing outside Edge Android (%s)', (userAgent) => {
    const { read, viewport } = setup(userAgent);
    vi.stubGlobal('innerHeight', 450);
    viewport.height = 370;
    expect(read().height).toBe(370);
  });

  it.each([{ scale: 2, offsetTop: 0 }, { scale: 1, offsetTop: 100 }])(
    'preserves zoomed or panned viewport geometry (%o)', (geometry) => {
      const { read, viewport } = setup();
      vi.stubGlobal('innerHeight', 450);
      Object.assign(viewport, { height: 300, ...geometry });
      expect(read()).toEqual({ height: 300, offsetTop: geometry.offsetTop });
    },
  );

  it('does not mistake a rotation or a small toolbar resize for the keyboard', () => {
    const { read, viewport } = setup();
    vi.stubGlobal('innerHeight', 750);
    viewport.height = 700;
    expect(read().height).toBe(700);
    vi.stubGlobal('innerWidth', 800);
    vi.stubGlobal('innerHeight', 390);
    viewport.height = 350;
    expect(read().height).toBe(350);
  });

  it('falls back to the window height without VisualViewport support', () => {
    const { read } = setup();
    vi.stubGlobal('visualViewport', undefined);
    expect(read()).toEqual({ height: 800, offsetTop: 0 });
  });
});
