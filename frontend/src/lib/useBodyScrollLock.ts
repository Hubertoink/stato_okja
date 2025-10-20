import { useEffect } from 'react';

let lockCount = 0;
let restoreState: {
  scrollY: number;
  paddingRight: string;
  position: string;
  top: string;
  width: string;
} | null = null;

function lockBody() {
  const body = document.body;
  const docEl = document.documentElement;
  if (lockCount === 0) {
    const scrollBarWidth = window.innerWidth - docEl.clientWidth;
    restoreState = {
      scrollY: window.scrollY || window.pageYOffset || 0,
      paddingRight: body.style.paddingRight,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    if (scrollBarWidth > 0) body.style.paddingRight = `${scrollBarWidth}px`;
    // Prevent background scroll and retain visual position
    body.style.position = 'fixed';
    body.style.top = `-${restoreState.scrollY}px`;
    body.style.width = '100%';
    // Reduce overscroll effects on some mobile browsers
    body.style.setProperty('overscroll-behavior', 'contain');
    docEl.style.setProperty('overscroll-behavior-y', 'none');
    body.setAttribute('data-scroll-locked', 'true');
  }
  lockCount++;
}

function unlockBody() {
  if (lockCount === 0) return;
  lockCount--;
  if (lockCount === 0 && restoreState) {
    const body = document.body;
    const docEl = document.documentElement;
    body.style.paddingRight = restoreState.paddingRight;
    body.style.position = restoreState.position;
    body.style.top = restoreState.top;
    body.style.width = restoreState.width;
    body.removeAttribute('data-scroll-locked');
    document.body.style.removeProperty('overscroll-behavior');
    docEl.style.removeProperty('overscroll-behavior-y');
    window.scrollTo(0, restoreState.scrollY);
    restoreState = null;
  }
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockBody();
    return () => unlockBody();
  }, [active]);
}
