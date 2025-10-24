import { useEffect, useState } from 'react';

/**
 * Detects if the on-screen keyboard is likely open.
 * Uses VisualViewport when available for better accuracy on mobile browsers.
 */
export function useKeyboardOpen(threshold = 120): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const w = window as unknown as { visualViewport?: VisualViewport };
    const vv = w.visualViewport;

    const compute = () => {
      try {
        if (vv) {
          const diff = window.innerHeight - vv.height;
          setOpen(diff > threshold);
        } else {
          // Fallback: heuristic based on window height changes
          const diff = screen.height - window.innerHeight;
          setOpen(diff > threshold);
        }
      } catch {
        // Best-effort only
      }
    };

    compute();
    if (vv) {
      vv.addEventListener('resize', compute);
      vv.addEventListener('scroll', compute);
      return () => {
        vv.removeEventListener('resize', compute);
        vv.removeEventListener('scroll', compute);
      };
    }
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [threshold]);

  return open;
}
