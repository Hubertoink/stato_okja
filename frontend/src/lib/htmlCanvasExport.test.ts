import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureExportNode } from './htmlCanvasExport';

const { html2canvasMock } = vi.hoisted(() => ({
  html2canvasMock: vi.fn(),
}));

vi.mock('html2canvas', () => ({ default: html2canvasMock }));

describe('captureExportNode', () => {
  afterEach(() => {
    html2canvasMock.mockReset();
    vi.restoreAllMocks();
    document.head.replaceChildren();
    document.body.replaceChildren();
  });

  it('preserves computed heatmap backgrounds as sRGB with intensity and transparency', async () => {
    const node = document.createElement('div');
    const backgrounds = ['color(srgb 0.4 0.4 1 / 0.88)', 'color(srgb 0.1 0.7 0.6 / 0.1)', 'rgba(0, 0, 0, 0)'];
    const pixels = [
      [102, 102, 255, 224],
      [26, 179, 153, 26],
      [0, 0, 0, 0],
    ];
    backgrounds.forEach(() => {
      const cell = document.createElement('button');
      cell.dataset.exportPreserveBackground = 'true';
      cell.style.setProperty('--weekly-profile-slot-intensity', '88%');
      node.appendChild(cell);
    });
    document.body.appendChild(node);

    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const computed = getComputedStyle(element);
      const index = Array.from(node.children).indexOf(element);
      if (index >= 0) {
        Object.defineProperty(computed, 'backgroundColor', { value: backgrounds[index] });
      }
      return computed;
    });
    const context: Partial<CanvasRenderingContext2D> = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(pixels[backgrounds.indexOf(String(context.fillStyle))]),
        width: 1,
        height: 1,
        colorSpace: 'srgb' as const,
      })),
    };
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    getContext.mockReturnValue(context as CanvasRenderingContext2D);

    html2canvasMock.mockImplementation(async (_node, options) => {
      const clonedDocument = document.implementation.createHTMLDocument();
      const clone = node.cloneNode(true) as HTMLElement;
      clonedDocument.body.appendChild(clone);
      options.onclone(clonedDocument);
      const cells = Array.from(clone.children) as HTMLElement[];
      expect(cells.map((cell) => cell.style.backgroundColor)).toEqual([
        'rgba(102, 102, 255, 0.878)',
        'rgba(26, 179, 153, 0.102)',
        'rgba(0, 0, 0, 0)',
      ]);
      expect(cells.every((cell) => cell.style.getPropertyPriority('background-color') === 'important')).toBe(true);
      expect(clone.style.backgroundColor).toBe('rgb(255, 255, 255)');
      return document.createElement('canvas');
    });

    await captureExportNode(node, { scale: 2 });
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(context.clearRect).toHaveBeenCalledTimes(3);
    expect(node.children[0].hasAttribute('data-export-capture-root')).toBe(false);
    expect(node.hasAttribute('data-export-capture-id')).toBe(false);
  });

  it('suspends injected remote font styles during capture and restores them afterwards', async () => {
    const remoteFontStyle = document.createElement('style');
    remoteFontStyle.textContent =
      '@font-face { font-family: FabricIcons; src: url(https://res-1.cdn.office.net/font.woff2); }';
    document.head.appendChild(remoteFontStyle);

    const localFontStyle = document.createElement('style');
    localFontStyle.textContent =
      '@font-face { font-family: Inter; src: url(/assets/inter.woff2); }';
    document.head.appendChild(localFontStyle);

    const node = document.createElement('div');
    document.body.appendChild(node);
    const canvas = document.createElement('canvas');

    html2canvasMock.mockImplementation(async () => {
      expect(remoteFontStyle.getAttribute('media')).toBe('not all');
      expect(localFontStyle.hasAttribute('media')).toBe(false);
      return canvas;
    });

    await expect(captureExportNode(node, { scale: 2 })).resolves.toBe(canvas);
    expect(remoteFontStyle.hasAttribute('media')).toBe(false);
    expect(localFontStyle.hasAttribute('media')).toBe(false);
  });
});
