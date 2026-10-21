import { useLayoutEffect, useRef } from 'react';

/** Keep sticky content aligned with the actual, responsive navigation height. */
export function useShellHeaderHeight() {
  const headerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    const layout = header?.parentElement;
    if (!header || !layout) return;
    const update = () => {
      layout.style.setProperty('--app-header-height', `${header.getBoundingClientRect().height}px`);
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(header);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      layout.style.removeProperty('--app-header-height');
    };
  }, []);

  return headerRef;
}
