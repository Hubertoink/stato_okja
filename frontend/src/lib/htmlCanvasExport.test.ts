import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureExportNode } from './htmlCanvasExport';

const { html2canvasMock } = vi.hoisted(() => ({
  html2canvasMock: vi.fn(),
}));

vi.mock('html2canvas', () => ({ default: html2canvasMock }));

describe('captureExportNode', () => {
  afterEach(() => {
    html2canvasMock.mockReset();
    document.head.replaceChildren();
    document.body.replaceChildren();
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
