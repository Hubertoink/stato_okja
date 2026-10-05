import { useEffect } from 'react';
import { readVisibleViewport } from './visibleViewport';

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** Reveal focused fields in both shared and custom dialogs after keyboard resizing. */
export function useModalFieldVisibility() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;
    let timeout = 0;
    const reveal = () => {
      const field = document.activeElement;
      if (!(field instanceof HTMLElement) || !field.matches(EDITABLE_SELECTOR)) return;
      const modal = field.closest('.modal-overlay, [role="dialog"]');
      if (!modal) return;
      const { height, offsetTop: viewportTop } = readVisibleViewport();
      const viewportBottom = viewportTop + height;
      const header = modal.querySelector('.editor-modal-header, .logbook-reading-toolbar');
      const headerBottom = header?.getBoundingClientRect().bottom ?? viewportTop;
      const label = field.closest('label') ??
        ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)
          ? field.labels?.[0] : null);

      for (let container = field.parentElement; container && modal.contains(container); container = container.parentElement) {
        if (!/^(auto|scroll)$/.test(window.getComputedStyle(container).overflowY) || container.scrollHeight <= container.clientHeight) continue;
        const bounds = container.getBoundingClientRect();
        const top = Math.max(bounds.top, viewportTop, headerBottom) + 12;
        const bottom = Math.min(bounds.bottom, viewportBottom) - 16;
        if (bottom <= top) continue;
        const fieldBounds = field.getBoundingClientRect();
        let targetTop = fieldBounds.top;
        if (label && container.contains(label)) targetTop = Math.min(targetTop, label.getBoundingClientRect().top);
        // A tall textarea must show its beginning rather than scroll its top away.
        const targetBottom = Math.min(fieldBounds.bottom, targetTop + bottom - top);
        const delta = targetTop < top ? targetTop - top : targetBottom > bottom ? targetBottom - bottom : 0;
        if (delta !== 0) container.scrollBy({ top: delta, behavior: 'auto' });
      }
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      frame = window.requestAnimationFrame(reveal);
      // Mobile browsers may finish panning after the resize/focus event.
      timeout = window.setTimeout(reveal, 250);
    };
    document.addEventListener('focusin', schedule);
    window.addEventListener('resize', schedule);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      document.removeEventListener('focusin', schedule);
      window.removeEventListener('resize', schedule);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
    };
  }, []);
}
