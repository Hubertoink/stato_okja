import type html2canvasType from 'html2canvas';

type ExportCaptureOptions = {
  scale: number;
  ignoreElements?: (element: Element) => boolean;
};

type Html2Canvas = typeof html2canvasType;

let html2canvasPromise: Promise<Html2Canvas> | null = null;
let exportCaptureSequence = 0;

type SuspendedStyle = {
  element: HTMLStyleElement;
  media: string | null;
};

const REMOTE_FONT_FACE_PATTERN = /@font-face[\s\S]*?url\(\s*["']?https?:\/\//i;

const LAYOUT_PROPERTIES = [
  'display', 'position', 'box-sizing', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'top', 'right', 'bottom', 'left', 'z-index', 'overflow', 'overflow-x', 'overflow-y',
  'flex', 'flex-basis', 'flex-grow', 'flex-shrink', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content', 'align-self', 'gap', 'row-gap', 'column-gap',
  'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'place-items',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'white-space', 'word-break',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'opacity', 'visibility', 'transform', 'transform-origin', 'vertical-align', 'list-style-type',
] as const;

function loadHtml2Canvas() {
  if (!html2canvasPromise) {
    html2canvasPromise = import('html2canvas').then((module) => module.default);
  }
  return html2canvasPromise;
}

function suspendInjectedRemoteFontStyles(): SuspendedStyle[] {
  return Array.from(document.querySelectorAll<HTMLStyleElement>('style'))
    .filter((element) => REMOTE_FONT_FACE_PATTERN.test(element.textContent || ''))
    .map((element) => {
      const suspended = { element, media: element.getAttribute('media') };
      // html2canvas clones the complete document and waits for clone.fonts.ready
      // before onclone runs. Mark third-party font styles inactive up front so
      // extension-injected Office/Fabric fonts are neither fetched nor awaited.
      element.setAttribute('media', 'not all');
      return suspended;
    });
}

function restoreSuspendedStyles(styles: SuspendedStyle[]) {
  styles.forEach(({ element, media }) => {
    if (media === null) element.removeAttribute('media');
    else element.setAttribute('media', media);
  });
}

function copyExportLayout(source: Element, target: HTMLElement | SVGElement) {
  const computed = window.getComputedStyle(source);
  target.removeAttribute('style');
  for (const property of LAYOUT_PROPERTIES) {
    const value = computed.getPropertyValue(property);
    if (value && !value.includes('color(') && !value.includes('var(')) {
      target.style.setProperty(property, value, 'important');
    }
  }

  target.style.setProperty('color', '#334155', 'important');
  target.style.setProperty('background-color', target === target.ownerDocument?.querySelector('[data-export-capture-root]') ? '#ffffff' : 'transparent', 'important');
  if (source instanceof HTMLElement && source.dataset.exportPreserveBackground === 'true') {
    const inlineBackground = source.style.getPropertyValue('background-color');
    if (inlineBackground && !inlineBackground.includes('var(') && !inlineBackground.includes('color(')) {
      target.style.setProperty('background-color', inlineBackground, 'important');
    }
  }
  target.style.setProperty('background-image', 'none', 'important');
  target.style.setProperty('border-color', '#cbd5e1', 'important');
  target.style.setProperty('box-shadow', 'none', 'important');
  target.style.setProperty('text-shadow', 'none', 'important');
  target.style.setProperty('outline-color', '#94a3b8', 'important');
}

function normalizeSvgPaint(root: HTMLElement) {
  root.querySelectorAll<SVGElement>('svg, svg *').forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (tag === 'svg') {
      element.setAttribute('color', '#334155');
      return;
    }
    const fill = element.getAttribute('fill');
    if (fill && fill !== 'none' && (fill.includes('var(') || fill.includes('color('))) {
      element.setAttribute('fill', '#0f766e');
    }
    const stroke = element.getAttribute('stroke');
    if (stroke && stroke !== 'none' && (stroke.includes('var(') || stroke.includes('color('))) {
      element.setAttribute('stroke', '#94a3b8');
    }
    if (element.classList.contains('recharts-text') || element.classList.contains('recharts-cartesian-axis-tick-value')) {
      element.setAttribute('fill', '#334155');
    }
    if (element.classList.contains('recharts-cartesian-axis-line') || element.classList.contains('recharts-cartesian-axis-tick-line')) {
      element.setAttribute('stroke', '#94a3b8');
    }
  });
}

function prepareSafeExportClone(sourceRoot: HTMLElement, cloneRoot: HTMLElement, options: ExportCaptureOptions) {
  cloneRoot.ownerDocument.querySelectorAll('style, link[rel="stylesheet"]').forEach((element) => element.remove());
  cloneRoot.setAttribute('data-export-capture-root', 'true');

  const sourceElements = [sourceRoot, ...sourceRoot.querySelectorAll('*')];
  const clonedElements = [cloneRoot, ...cloneRoot.querySelectorAll('*')];
  sourceElements.forEach((source, index) => {
    const target = clonedElements[index];
    if (!target) return;
    if (options.ignoreElements?.(source) || source instanceof HTMLImageElement || source instanceof HTMLCanvasElement || source instanceof HTMLVideoElement) {
      target.remove();
      return;
    }
    copyExportLayout(source, target as HTMLElement | SVGElement);
  });
  normalizeSvgPaint(cloneRoot);
}

/**
 * Captures a CSS-isolated clone. The clone keeps only static layout values and
 * a simple export palette, so html2canvas never has to parse CSS Color 4
 * functions such as color() or color-mix().
 */
export async function captureExportNode(node: HTMLElement, options: ExportCaptureOptions) {
  const html2canvas = await loadHtml2Canvas();
  const captureId = `export-${++exportCaptureSequence}`;
  const suspendedStyles = suspendInjectedRemoteFontStyles();
  node.setAttribute('data-export-capture-id', captureId);
  try {
    return await html2canvas(node, {
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      scale: options.scale,
      useCORS: true,
      onclone: (clonedDocument) => {
        const clone = clonedDocument.querySelector<HTMLElement>(`[data-export-capture-id="${captureId}"]`);
        if (clone) prepareSafeExportClone(node, clone, options);
      },
    });
  } finally {
    node.removeAttribute('data-export-capture-id');
    restoreSuspendedStyles(suspendedStyles);
  }
}
