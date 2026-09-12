import { useRef, type HTMLAttributes } from 'react';

/** Add mouse dragging to a horizontal rail while preserving native touch scrolling. */
export function useMouseDragScroll(): HTMLAttributes<HTMLDivElement> {
  const gesture = useRef<{ id: number; x: number; y: number; scrollLeft: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);

  const finish = (element: HTMLDivElement) => {
    gesture.current = null;
    delete element.dataset.mouseDragging;
  };

  return {
    onPointerDownCapture(event) {
      suppressClick.current = false;
      const rail = event.currentTarget;
      if (event.pointerType !== 'mouse' || event.button !== 0
        || !window.matchMedia('(max-width: 767px)').matches
        || rail.scrollWidth <= rail.clientWidth) return;
      if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, scrollLeft: rail.scrollLeft, dragging: false };
    },
    onPointerMove(event) {
      const current = gesture.current;
      if (!current || current.id !== event.pointerId) return;
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      if (!current.dragging) {
        if (Math.abs(dx) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          finish(event.currentTarget);
          return;
        }
        current.dragging = true;
        suppressClick.current = true;
        event.currentTarget.dataset.mouseDragging = 'true';
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      event.currentTarget.scrollLeft = current.scrollLeft - dx;
    },
    onPointerUp(event) { finish(event.currentTarget); },
    onPointerCancel(event) { finish(event.currentTarget); },
    onLostPointerCapture(event) { finish(event.currentTarget); },
    onPointerLeave(event) {
      if (!gesture.current?.dragging) finish(event.currentTarget);
    },
    onDragStart(event) {
      if (gesture.current) event.preventDefault();
    },
    onClickCapture(event) {
      if (suppressClick.current && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }
    },
  };
}
