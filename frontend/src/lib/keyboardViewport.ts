/** Configure the measured Android Edge fallback before rendering the app. */
export function configureKeyboardViewport() {
  if (!/Android/i.test(navigator.userAgent) || !/EdgA\//.test(navigator.userAgent)) return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return;
  // Edge's collapsing bottom controls leave a smaller gap when both viewports
  // resize. Keep Chrome, desktop and iOS on their existing viewport behavior.
  const directives = meta.content.split(',').map((part) => part.trim())
    .filter((part) => part && !/^interactive-widget\s*=/i.test(part));
  meta.content = [...directives, 'interactive-widget=resizes-content'].join(', ');
}

export function getKeyboardViewport() {
  return {
    height: window.visualViewport?.height ?? window.innerHeight,
    offsetTop: window.visualViewport?.offsetTop ?? 0,
  };
}
