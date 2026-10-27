import { useCallback, useEffect, useRef } from 'react';
import type { FocusEventHandler, RefObject } from 'react';
import { getKeyboardViewport, KEYBOARD_VIEWPORT_EVENT } from './keyboardViewport';

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

export function useFocusedFieldVisibility<T extends HTMLElement>(
  containerRef: RefObject<T>,
  enabled: boolean,
  scrollMode: 'container' | 'document' = 'container',
): FocusEventHandler<T> {
  const frame = useRef<number | null>(null);
  const timeout = useRef<number | null>(null);
  const revealFocusedField = useCallback(() => {
    const container = containerRef.current;
    const active = document.activeElement;
    if (
      !container ||
      (scrollMode === 'document' && document.body.hasAttribute('data-scroll-locked')) ||
      !(active instanceof HTMLElement) ||
      !active.matches(EDITABLE_SELECTOR) ||
      !container.contains(active)
    ) {
      return;
    }

    // Structured modals scroll their body; regular dialogs scroll the panel.
    // Only standalone editors opt into scrolling the document itself.
    let scroller = scrollMode === 'document'
      ? (document.scrollingElement as HTMLElement | null) ?? document.documentElement
      : container;
    for (let parent = active.parentElement; parent && parent !== container; parent = parent.parentElement) {
      if (parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(getComputedStyle(parent).overflowY)) {
        scroller = parent;
        break;
      }
    }
    const label = active.closest('label');
    const target = label instanceof HTMLElement && scroller.contains(label) ? label : active;
    const containerRect = container.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const viewport = getKeyboardViewport();
    const viewportTop = viewport.offsetTop;
    const viewportBottom = viewportTop + viewport.height;
    const topEdge = Math.max(containerRect.top, scrollerRect.top, viewportTop) + 12;
    let bottomEdge = Math.min(containerRect.bottom, scrollerRect.bottom, viewportBottom) - 16;
    // Sticky actions occupy part of the scroller's visible area. A field is
    // only visible when it clears the action bar as well as the keyboard.
    for (const footer of container.querySelectorAll<HTMLElement>('[data-scroll-footer]')) {
      if (footer.contains(active) || !/^(sticky|fixed)$/.test(getComputedStyle(footer).position)) continue;
      const footerRect = footer.getBoundingClientRect();
      if (footerRect.bottom > topEdge && footerRect.top < bottomEdge) {
        bottomEdge = footerRect.top - 16;
      }
    }
    if (bottomEdge <= topEdge) return;
    let top = 0;

    if (targetRect.height > bottomEdge - topEdge) {
      // A tall textarea cannot fit entirely. Keep its top visible instead of
      // alternating between its two edges on successive viewport events.
      top = targetRect.top - topEdge;
    } else if (targetRect.top < topEdge) {
      top = targetRect.top - topEdge;
    } else if (targetRect.bottom > bottomEdge) {
      top = targetRect.bottom - bottomEdge;
    }

    if (top !== 0) {
      if (scroller === document.scrollingElement || scroller === document.documentElement) {
        window.scrollBy({ top, behavior: 'instant' });
      } else {
        scroller.scrollBy({ top, behavior: 'instant' });
      }
    }
  }, [containerRef, scrollMode]);

  const scheduleReveal = useCallback(() => {
    if (!enabled) return;
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null;
      revealFocusedField();
    });
    // Some mobile browsers finish moving the viewport after the focus event.
    timeout.current = window.setTimeout(() => {
      timeout.current = null;
      revealFocusedField();
    }, 250);
  }, [enabled, revealFocusedField]);

  useEffect(() => {
    if (!enabled) return;
    scheduleReveal();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', scheduleReveal);
    viewport?.addEventListener('scroll', scheduleReveal);
    window.addEventListener('resize', scheduleReveal);
    window.addEventListener(KEYBOARD_VIEWPORT_EVENT, scheduleReveal);
    // The dialog can finish laying out after the viewport event, for example
    // when keyboard detection switches the activity editor's scroll container.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleReveal);
    if (containerRef.current) observer?.observe(containerRef.current);
    return () => {
      observer?.disconnect();
      viewport?.removeEventListener('resize', scheduleReveal);
      viewport?.removeEventListener('scroll', scheduleReveal);
      window.removeEventListener('resize', scheduleReveal);
      window.removeEventListener(KEYBOARD_VIEWPORT_EVENT, scheduleReveal);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      if (timeout.current !== null) window.clearTimeout(timeout.current);
    };
  }, [containerRef, enabled, scheduleReveal]);

  return scheduleReveal;
}
