import { useEffect } from 'react';

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const SCROLL_GESTURE_THRESHOLD = 10;

/** Dismiss the mobile keyboard on a deliberate swipe outside editable fields. */
export function useDismissKeyboardOnScroll() {
  useEffect(() => {
    let gesture: { identifier: number; x: number; y: number; field: HTMLElement } | null = null;

    const reset = () => { gesture = null; };
    const handleTouchStart = (event: TouchEvent) => {
      reset();
      const field = document.activeElement;
      const target = event.target;
      if (
        event.touches.length !== 1 ||
        !(field instanceof HTMLElement) ||
        !(field.matches(EDITABLE_SELECTOR) || field.isContentEditable) ||
        (target instanceof Element && target.closest(EDITABLE_SELECTOR))
      ) return;

      const touch = event.touches[0];
      gesture = { identifier: touch.identifier, x: touch.clientX, y: touch.clientY, field };
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!gesture) return;
      if (event.touches.length !== 1 || document.activeElement !== gesture.field) {
        reset();
        return;
      }
      const touch = event.touches[0];
      if (touch.identifier !== gesture.identifier) {
        reset();
        return;
      }
      if (Math.hypot(touch.clientX - gesture.x, touch.clientY - gesture.y) < SCROLL_GESTURE_THRESHOLD) return;

      const field = gesture.field;
      reset();
      field.blur();
    };

    // Capture also covers modal scrollers. Passive handlers preserve native scrolling.
    // Avoid scroll events: keyboard opening and focus visibility can scroll automatically.
    const options = { capture: true, passive: true };
    document.addEventListener('touchstart', handleTouchStart, options);
    document.addEventListener('touchmove', handleTouchMove, options);
    document.addEventListener('touchend', reset, options);
    document.addEventListener('touchcancel', reset, options);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('touchmove', handleTouchMove, true);
      document.removeEventListener('touchend', reset, true);
      document.removeEventListener('touchcancel', reset, true);
    };
  }, []);
}
