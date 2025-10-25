import { useEffect } from 'react';

/**
 * Keeps a CSS variable --vvh updated with the current VisualViewport height (in px).
 * Falls back to window.innerHeight when VisualViewport is unavailable.
 *
 * Usage: call once near the app root (e.g., in Layout). Then use
 * style={{ minHeight: 'var(--vvh, 100vh)' }} to size containers to the real visible height.
 */
export function useVisualViewportCssVar() {
  useEffect(() => {
    const root = document.documentElement;
    const w = window as unknown as { visualViewport?: VisualViewport };
    const vv = w.visualViewport;

    const set = () => {
      try {
        const h = vv?.height || window.innerHeight;
        root.style.setProperty('--vvh', `${Math.round(h)}px`);
      } catch {
        /* noop */
      }
    };

    set();
    if (vv) {
      vv.addEventListener('resize', set);
      vv.addEventListener('scroll', set);
      window.addEventListener('orientationchange', set);
      return () => {
        vv.removeEventListener('resize', set);
        vv.removeEventListener('scroll', set);
        window.removeEventListener('orientationchange', set);
      };
    }
    window.addEventListener('resize', set);
    window.addEventListener('orientationchange', set);
    return () => {
      window.removeEventListener('resize', set);
      window.removeEventListener('orientationchange', set);
    };
  }, []);
}
