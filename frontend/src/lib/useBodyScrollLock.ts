import { useEffect } from 'react';

let lockCount = 0;
let restoreState: {
  scrollY: number;
  scrollElement: HTMLElement | null;
  paddingRight: string;
  position: string;
  top: string;
  width: string;
  bodyOverflowX: string;
  htmlOverflow: string;
  htmlOverflowX: string;
  htmlOverscroll: string;
  historyScrollRestoration: ScrollRestoration;
} | null = null;

function currentScrollY() {
  const scrollingElement = document.scrollingElement as HTMLElement | null;
  return Math.max(
    window.scrollY || window.pageYOffset || 0,
    scrollingElement?.scrollTop || 0,
  );
}

function restoreScrollPosition(scrollY: number, scrollElement: HTMLElement | null) {
  const restore = () => {
    // Some browsers restore the document through <html>, others through window.
    // Updating both keeps the position stable while the fixed body is released.
    window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
    if (scrollElement) scrollElement.scrollTop = scrollY;
  };

  restore();
  window.requestAnimationFrame(() => {
    if (lockCount !== 0) return;
    restore();
    window.setTimeout(() => {
      if (lockCount === 0) restore();
    }, 0);
  });
}

function lockBody() {
  const body = document.body;
  const docEl = document.documentElement;
  if (lockCount === 0) {
    const scrollBarWidth = window.innerWidth - docEl.clientWidth;
    restoreState = {
      scrollY: currentScrollY(),
      scrollElement: document.scrollingElement as HTMLElement | null,
      paddingRight: body.style.paddingRight,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      bodyOverflowX: body.style.overflowX,
      htmlOverflow: docEl.style.overflow,
      htmlOverflowX: docEl.style.overflowX,
      htmlOverscroll: docEl.style.getPropertyValue('overscroll-behavior-y') || '',
      historyScrollRestoration: window.history.scrollRestoration,
    };
    if (scrollBarWidth > 0) body.style.paddingRight = `${scrollBarWidth}px`;
    // Prevent background scroll and retain visual position
    body.style.position = 'fixed';
    body.style.top = `-${restoreState.scrollY}px`;
    body.style.width = '100%';
    body.style.overflowX = 'hidden';
    // Additionally block root scrolling (covers browsers that scroll <html>)
    docEl.style.overflow = 'hidden';
    docEl.style.overflowX = 'hidden';
    // Reduce overscroll effects on some browsers
    docEl.style.setProperty('overscroll-behavior-y', 'none');
    // The modal uses its own history entry. Do not let the browser apply a
    // second, unrelated history scroll restoration after the entry is removed.
    window.history.scrollRestoration = 'manual';
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
    body.style.overflowX = restoreState.bodyOverflowX;
    body.removeAttribute('data-scroll-locked');
    docEl.style.overflow = restoreState.htmlOverflow;
    docEl.style.overflowX = restoreState.htmlOverflowX;
    if (restoreState.htmlOverscroll)
      docEl.style.setProperty('overscroll-behavior-y', restoreState.htmlOverscroll);
    else docEl.style.removeProperty('overscroll-behavior-y');
    const { scrollY, scrollElement, historyScrollRestoration } = restoreState;
    restoreScrollPosition(scrollY, scrollElement);
    window.setTimeout(() => {
      if (lockCount === 0) window.history.scrollRestoration = historyScrollRestoration;
    }, 50);
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
