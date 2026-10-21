import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { PAGE_ACTIONS_POSITION_EVENT } from './FloatingPageActions';

/** Keep header and dock flyouts inside the usable viewport, including on resize. */
export function useAnchoredPopoverPosition(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  anchorRef?: RefObject<HTMLElement | null>,
) {
  const [style, setStyle] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    // Inline filter drawers sit beside their trigger in a relative wrapper.
    const anchor = anchorRef?.current ?? panel?.parentElement;
    if (!panel || !anchor) return;
    const dock = anchor.closest('.page-actions-dock');
    const header = document.querySelector('.header-navigation-shell');
    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = window.innerHeight;
      const topEdge = Math.max(16, (header?.getBoundingClientRect().bottom ?? 0) + 8);
      const width = Math.min(panel.getBoundingClientRect().width, viewportWidth - 32);
      const dockTop = anchor.closest('.page-actions-dock')?.getBoundingClientRect().top;
      const aboveEnd = Math.min(dockTop ?? rect.top, viewportHeight - 8) - 8;
      const belowStart = Math.max(topEdge, rect.bottom + 8);
      const above = Math.max(0, aboveEnd - topEdge);
      const below = Math.max(0, viewportHeight - 16 - belowStart);
      const opensAbove = dockTop !== undefined || (below < Math.min(panel.scrollHeight, 320) && above > below);
      setStyle({
        position: 'fixed',
        left: Math.max(16, Math.min(rect.right - width, viewportWidth - width - 16)),
        right: 'auto',
        top: opensAbove ? 'auto' : belowStart,
        bottom: opensAbove ? viewportHeight - Math.max(topEdge, aboveEnd) : 'auto',
        maxWidth: viewportWidth - 32,
        maxHeight: opensAbove ? above : below,
        margin: 0,
        overflowY: 'auto',
      });
    };
    updatePosition();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updatePosition);
    observer?.observe(anchor);
    observer?.observe(panel);
    if (dock) observer?.observe(dock);
    if (header) observer?.observe(header);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener(PAGE_ACTIONS_POSITION_EVENT, updatePosition);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener(PAGE_ACTIONS_POSITION_EVENT, updatePosition);
    };
  }, [anchorRef, open, panelRef]);

  return style;
}
