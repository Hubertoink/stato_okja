import { useEffect, useState } from 'react';

/**
 * Lightweight mobile detector based on viewport width and pointer type.
 * Returns true for small screens or, by default, coarse pointers (touch devices).
 * Disable touch detection for layouts that must match a CSS width breakpoint.
 */
export function useIsMobile(breakpointPx: number = 1024, { touchIsMobile = true } = {}) {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  useEffect(() => {
    const check = () => {
      try {
        const coarse = window.matchMedia?.('(pointer: coarse)').matches;
        const small = window.innerWidth < breakpointPx;
        setIsMobile((touchIsMobile && coarse) || small);
      } catch {
        setIsMobile(window.innerWidth < breakpointPx);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpointPx, touchIsMobile]);
  return isMobile;
}
