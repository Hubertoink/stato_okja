import { useEffect, useState } from 'react';

/**
 * Lightweight mobile detector based on viewport width and pointer type.
 * Returns true for small screens or coarse pointers (touch devices).
 */
export function useIsMobile(breakpointPx: number = 1024) {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  useEffect(() => {
    const check = () => {
      try {
        const coarse = window.matchMedia?.('(pointer: coarse)').matches;
        const small = window.innerWidth < breakpointPx;
        setIsMobile(coarse || small);
      } catch {
        setIsMobile(window.innerWidth < breakpointPx);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpointPx]);
  return isMobile;
}
