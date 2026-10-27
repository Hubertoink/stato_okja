import { useCallback, useEffect, useRef } from 'react';
import type { FocusEventHandler, RefObject } from 'react';

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

export function useFocusedFieldVisibility<T extends HTMLElement>(
  containerRef: RefObject<T>,
  enabled: boolean,
): FocusEventHandler<T> {
  const frame = useRef<number | null>(null);
  const timeout = useRef<number | null>(null);
  const revealFocusedField = useCallback(() => {
    const container = containerRef.current;
    const active = document.activeElement;
    if (
      !container ||
      !(active instanceof HTMLElement) ||
      !active.matches(EDITABLE_SELECTOR) ||
      !container.contains(active)
    ) {
      return;
    }

    // Structured modals scroll their body; regular dialogs scroll the panel.
    // Never scroll an ancestor outside the dialog (which would move the page).
    let scroller: HTMLElement = container;
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
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
    const topEdge = Math.max(containerRect.top, scrollerRect.top, viewportTop) + 12;
    const bottomEdge = Math.min(containerRect.bottom, scrollerRect.bottom, viewportBottom) - 16;
    let top = 0;

    if (targetRect.top < topEdge) {
      top = targetRect.top - topEdge;
    } else if (targetRect.bottom > bottomEdge) {
      top = targetRect.bottom - bottomEdge;
    }

    if (top !== 0) {
      scroller.scrollBy({ top, behavior: 'auto' });
    }
  }, [containerRef]);

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
    return () => {
      viewport?.removeEventListener('resize', scheduleReveal);
      viewport?.removeEventListener('scroll', scheduleReveal);
      window.removeEventListener('resize', scheduleReveal);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      if (timeout.current !== null) window.clearTimeout(timeout.current);
    };
  }, [enabled, scheduleReveal]);

  return scheduleReveal;
}
