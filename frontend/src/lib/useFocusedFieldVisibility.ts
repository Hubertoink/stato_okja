import { useCallback, useEffect } from 'react';
import type { FocusEventHandler, RefObject } from 'react';

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

export function useFocusedFieldVisibility<T extends HTMLElement>(
  containerRef: RefObject<T>,
  enabled: boolean,
): FocusEventHandler<T> {
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

    const label = active.closest('label');
    const target = label instanceof HTMLElement && container.contains(label) ? label : active;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const topEdge = containerRect.top + 12;
    const bottomEdge = containerRect.bottom - 16;
    let top = 0;

    if (targetRect.top < topEdge) {
      top = targetRect.top - topEdge;
    } else if (targetRect.bottom > bottomEdge) {
      top = targetRect.bottom - bottomEdge;
    }

    if (top !== 0) {
      container.scrollBy({ top, behavior: 'smooth' });
    }
  }, [containerRef]);

  const scheduleReveal = useCallback(() => {
    if (!enabled) return;
    window.setTimeout(revealFocusedField, 50);
    window.setTimeout(revealFocusedField, 250);
  }, [enabled, revealFocusedField]);

  useEffect(() => {
    if (enabled) scheduleReveal();
  }, [enabled, scheduleReveal]);

  return scheduleReveal;
}
