import { useEffect } from 'react';

let lockCount = 0;
let restoreState: {
  scrollY: number;
  paddingRight: string;
  position: string;
  top: string;
  width: string;
  htmlOverflow: string;
  htmlOverscroll: string;
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
      htmlOverflow: docEl.style.overflow,
      htmlOverscroll: docEl.style.getPropertyValue('overscroll-behavior-y') || '',
    };
    if (scrollBarWidth > 0) body.style.paddingRight = `${scrollBarWidth}px`;
    // Prevent background scroll and retain visual position
    body.style.position = 'fixed';
    body.style.top = `-${restoreState.scrollY}px`;
    body.style.width = '100%';
    // Additionally block root scrolling (covers browsers that scroll <html>)
    docEl.style.overflow = 'hidden';
    // Reduce overscroll effects on some browsers
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
    docEl.style.overflow = restoreState.htmlOverflow;
    if (restoreState.htmlOverscroll)
      docEl.style.setProperty('overscroll-behavior-y', restoreState.htmlOverscroll);
    else docEl.style.removeProperty('overscroll-behavior-y');
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
