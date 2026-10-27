import { useEffect, useState } from 'react';
import { getKeyboardViewport, KEYBOARD_VIEWPORT_EVENT } from './keyboardViewport';

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
        const viewport = getKeyboardViewport();
        const { height, offsetTop } = viewport;
        const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight, height + offsetTop);
        if (Math.abs(viewportBaseline.width - window.innerWidth) > 40) {
          viewportBaseline = { width: window.innerWidth, height: layoutHeight };
        } else {
          viewportBaseline.height = Math.max(viewportBaseline.height, layoutHeight);
        }
        // Panning to a focused field changes offsetTop, not the keyboard height.
        // Subtracting that offset can incorrectly report a closed keyboard.
        const hiddenHeight = Math.max(
          0,
          layoutHeight - height,
          viewportBaseline.height - height,
        );
        const nextOpen = isEditableElement(document.activeElement) && hiddenHeight > threshold;
        const root = document.documentElement;

        root.style.setProperty('--visual-viewport-height', `${height}px`);
        // Keep overlays inside the visible area even while focus changes or the
        // keyboard animates. The document itself retains its layout viewport.
        root.style.setProperty('--visual-viewport-fixed-height', `${height}px`);
        root.style.setProperty('--visual-viewport-offset-top', `${offsetTop}px`);
        root.style.setProperty('--keyboard-inset-height', `${nextOpen ? hiddenHeight : 0}px`);
        // The native comparison also tests bottom anchoring. Chromium can move
        // bottom-fixed layers with browser controls independently of JS heights.
        // Keep this inset through blur until native geometry reports closure.
        if (viewport.source === 'virtual-keyboard' && viewport.bottomInset !== undefined) {
          root.dataset.keyboardViewport = 'native-bottom';
          root.style.setProperty('--native-keyboard-bottom', `${viewport.bottomInset}px`);
        } else {
          delete root.dataset.keyboardViewport;
          root.style.removeProperty('--native-keyboard-bottom');
        }
        root.dataset.keyboardOpen = String(nextOpen);
        setOpen(nextOpen);
      } catch {
        // Best-effort only
      }
    };

    compute();
    let focusChangeTimeout: number | null = null;
    const handleFocusChange = () => {
      if (focusChangeTimeout !== null) window.clearTimeout(focusChangeTimeout);
      focusChangeTimeout = window.setTimeout(() => {
        focusChangeTimeout = null;
        compute();
      }, 0);
    };
    window.addEventListener('focusin', compute);
    window.addEventListener('focusout', handleFocusChange);
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    window.addEventListener(KEYBOARD_VIEWPORT_EVENT, compute);
    if (vv) {
      vv.addEventListener('resize', compute);
      vv.addEventListener('scroll', compute);
      return () => {
        if (focusChangeTimeout !== null) window.clearTimeout(focusChangeTimeout);
        window.removeEventListener('focusin', compute);
        window.removeEventListener('focusout', handleFocusChange);
        window.removeEventListener('resize', compute);
        window.removeEventListener('orientationchange', compute);
        window.removeEventListener(KEYBOARD_VIEWPORT_EVENT, compute);
        vv.removeEventListener('resize', compute);
        vv.removeEventListener('scroll', compute);
      };
    }
    return () => {
      if (focusChangeTimeout !== null) window.clearTimeout(focusChangeTimeout);
      window.removeEventListener('focusin', compute);
      window.removeEventListener('focusout', handleFocusChange);
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
      window.removeEventListener(KEYBOARD_VIEWPORT_EVENT, compute);
    };
  }, [threshold]);

  return open;
}
