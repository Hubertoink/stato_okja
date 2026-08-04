import { useEffect, useState } from 'react';

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
let viewportBaseline = { width: 0, height: 0 };

function isEditableElement(element: Element | null): boolean {
  return element instanceof HTMLElement && element.matches(EDITABLE_SELECTOR);
}

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
        const height = vv?.height ?? window.innerHeight;
        const offsetTop = vv?.offsetTop ?? 0;
        const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight, height + offsetTop);
        if (Math.abs(viewportBaseline.width - window.innerWidth) > 40) {
          viewportBaseline = { width: window.innerWidth, height: layoutHeight };
        } else {
          viewportBaseline.height = Math.max(viewportBaseline.height, layoutHeight);
        }
        const hiddenHeight = Math.max(
          0,
          layoutHeight - height - offsetTop,
          viewportBaseline.height - height - offsetTop,
        );
        const nextOpen = isEditableElement(document.activeElement) && hiddenHeight > threshold;
        const root = document.documentElement;

        root.style.setProperty('--visual-viewport-height', `${height}px`);
        root.style.setProperty('--visual-viewport-offset-top', `${offsetTop}px`);
        root.style.setProperty('--keyboard-inset-height', `${nextOpen ? hiddenHeight : 0}px`);
        root.dataset.keyboardOpen = String(nextOpen);
        setOpen(nextOpen);
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
