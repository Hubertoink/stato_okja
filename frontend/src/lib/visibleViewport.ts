/** Read the viewport used by both modal layout and focused-field scrolling. */
export function createVisibleViewportReader() {
  let baseline = { width: 0, height: 0 };

  return (keyboardThreshold = 120) => {
    const viewport = window.visualViewport;
    const height = viewport?.height ?? window.innerHeight;
    const offsetTop = viewport?.offsetTop ?? 0;
    const scale = viewport?.scale ?? 1;

    if (Math.abs(baseline.width - window.innerWidth) > 40) {
      baseline = { width: window.innerWidth, height: window.innerHeight };
    } else {
      baseline.height = Math.max(baseline.height, window.innerHeight);
    }

    // Edge Android can under-report VisualViewport height while its native
    // window has already resized for the keyboard. Only trust innerHeight
    // after observing that resize: on Chrome/iOS it can still include the
    // keyboard. Do not override legitimate viewport reduction from zoom/pan.
    // Related Edge report: https://learn.microsoft.com/en-us/answers/questions/2069280/does-edge-pay-attention-to-the-interactive-widget
    const edgeWindowAlreadyResized =
      /Android/i.test(navigator.userAgent) && /EdgA\//.test(navigator.userAgent) &&
      Math.abs(scale - 1) < 0.01 && Math.abs(offsetTop) < 1 &&
      baseline.height - window.innerHeight > keyboardThreshold &&
      window.innerHeight > height;

    return { height: edgeWindowAlreadyResized ? window.innerHeight : height, offsetTop };
  };
}

export const readVisibleViewport = createVisibleViewportReader();
