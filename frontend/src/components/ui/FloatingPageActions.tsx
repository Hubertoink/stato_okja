import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export const PAGE_ACTIONS_POSITION_EVENT = 'stato:page-actions-position';

/** Move the original controls into a desktop dock, preserving their state and focus. */
export function FloatingPageActions({ children, label }: { children: ReactNode; label?: ReactNode }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [floating, setFloating] = useState(false);

  useLayoutEffect(() => {
    // Release the placeholder only after React has put the controls back in
    // normal flow. Clearing it in the scroll callback briefly collapses the
    // header while the controls are still fixed, triggering scroll anchoring.
    if (!floating) {
      anchorRef.current?.style.removeProperty('width');
      anchorRef.current?.style.removeProperty('height');
    }
    // Popovers may be open already when the controls change position.
    window.dispatchEvent(new Event(PAGE_ACTIONS_POSITION_EVENT));
  }, [floating]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const controls = controlsRef.current;
    if (!anchor || !controls) return;
    let frame = 0;
    let docked = false;
    const update = () => {
      frame = 0;
      const desktop = window.innerWidth >= 768;
      const headerBottom = document.querySelector('.header-navigation-shell')?.getBoundingClientRect().bottom ?? 0;
      const shouldFloat = desktop && anchor.getBoundingClientRect().bottom < headerBottom;
      if (shouldFloat === docked) return;
      if (shouldFloat) {
        const rect = anchor.getBoundingClientRect();
        anchor.style.width = `${rect.width}px`;
        anchor.style.height = `${rect.height}px`;
      }
      docked = shouldFloat;
      setFloating(shouldFloat);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(anchor);
    const header = document.querySelector('.header-navigation-shell');
    if (header) observer?.observe(header);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <div ref={anchorRef} className="page-actions-anchor min-w-0">
      <div
        ref={controlsRef}
        className={floating ? 'page-actions-dock' : 'page-actions-inline'}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) {
            window.dispatchEvent(new Event(PAGE_ACTIONS_POSITION_EVENT));
          }
        }}
      >
        {floating && label ? <div className="page-actions-dock-label">{label}</div> : null}
        {children}
      </div>
    </div>
  );
}
