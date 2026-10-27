/** The native keyboard path is only enabled by the master-data diagnostic link. */
export const KEYBOARD_VIEWPORT_EVENT = 'stato:keyboard-viewport';

export interface NativeKeyboard extends EventTarget {
  overlaysContent: boolean;
  readonly boundingRect: DOMRectReadOnly;
}

export function getNativeKeyboard(): NativeKeyboard | undefined {
  return (navigator as Navigator & { virtualKeyboard?: NativeKeyboard }).virtualKeyboard;
}

let nativeSession: { keyboard: NativeKeyboard; previous: boolean; users: number } | null = null;
const notify = () => window.dispatchEvent(new Event(KEYBOARD_VIEWPORT_EVENT));

export function nativeKeyboardViewportActive() {
  return nativeSession !== null;
}

export function enableNativeKeyboardViewport(): () => void {
  const keyboard = getNativeKeyboard();
  if (!keyboard || !/Android/i.test(navigator.userAgent) || !/EdgA\//.test(navigator.userAgent)) return () => {};
  if (!nativeSession) {
    const previous = keyboard.overlaysContent;
    try {
      keyboard.overlaysContent = true;
      if (!keyboard.overlaysContent) return () => {};
    } catch {
      return () => {};
    }
    nativeSession = { keyboard, previous, users: 0 };
    keyboard.addEventListener('geometrychange', notify);
  }
  const session = nativeSession;
  session.users++;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--session.users > 0) return;
    session.keyboard.removeEventListener('geometrychange', notify);
    nativeSession = null;
    session.keyboard.overlaysContent = session.previous;
    notify();
  };
}

export function getKeyboardViewport() {
  const vv = window.visualViewport;
  const offsetTop = vv?.offsetTop ?? 0;
  const height = vv?.height ?? window.innerHeight;
  const rect = nativeSession?.keyboard.boundingRect;
  const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight, height + offsetTop);
  // boundingRect uses client CSS coordinates. Never add a guessed toolbar inset.
  // Keep the visual-viewport path for pinch zoom or unusable native geometry.
  if (rect && (vv?.scale ?? 1) === 1 && rect.height > 0 && rect.width > 0 &&
    Number.isFinite(rect.top) && rect.top > offsetTop && rect.top < layoutHeight) {
    return { height: rect.top - offsetTop, offsetTop, source: 'virtual-keyboard' };
  }
  return { height, offsetTop, source: 'visual-viewport' };
}
