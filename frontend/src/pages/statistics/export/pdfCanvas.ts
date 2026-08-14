import type jsPDF from 'jspdf';
import { autoT } from '@/i18n/auto';

export type PdfSlice = {
  startPx: number;
  endPx: number;
};

export const PDF_RENDER_SCALE = 2;
export const PDF_MARGIN_MM = 10;
export const PDF_HEADER_HEIGHT_MM = 40;
export const PDF_MIN_PAGE_FILL_RATIO = 0.58;
export const PDF_MAX_RENDER_HEIGHT_PX = 30000;
export const CHART_EXPORT_HEADER_HEIGHT_MM = 26;

let pdfExportDependenciesPromise: Promise<{ JsPDF: typeof import('jspdf').default }> | null = null;

export function loadPdfExportDependencies() {
  if (!pdfExportDependenciesPromise) {
    pdfExportDependenciesPromise = import('jspdf').then((jspdfModule) => ({
      JsPDF: jspdfModule.default,
    }));
  }

  return pdfExportDependenciesPromise;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('Canvas export failed.'));
    }, 'image/png');
  });
}

export async function renderParticipantsTrendCanvas(card: HTMLDivElement, title: string) {
  const sourceSvg = card.querySelector<SVGSVGElement>('svg.recharts-surface');
  if (!sourceSvg) throw new Error('Participant trend SVG is unavailable.');

  const bounds = sourceSvg.getBoundingClientRect();
  const chartWidth = Math.round(bounds.width);
  const chartHeight = Math.round(bounds.height);
  if (chartWidth <= 0 || chartHeight <= 0) {
    throw new Error('Participant trend SVG has no visible dimensions.');
  }

  const svg = sourceSvg.cloneNode(true) as SVGSVGElement;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(chartWidth));
  svg.setAttribute('height', String(chartHeight));
  svg.setAttribute(
    'viewBox',
    sourceSvg.getAttribute('viewBox') || `0 0 ${chartWidth} ${chartHeight}`,
  );
  svg.style.fontFamily = 'Inter, Arial, sans-serif';
  svg.querySelectorAll('text').forEach((element) => element.setAttribute('fill', '#475569'));
  svg
    .querySelectorAll('.recharts-cartesian-grid line')
    .forEach((element) => element.setAttribute('stroke', '#cbd5e1'));
  svg
    .querySelectorAll('.recharts-line-curve')
    .forEach((element) => element.setAttribute('stroke', '#10b981'));
  svg.querySelectorAll('.recharts-dot').forEach((element) => {
    element.setAttribute('fill', '#10b981');
    element.setAttribute('stroke', '#ffffff');
  });

  const serializedSvg = new XMLSerializer().serializeToString(svg);
  const blobUrl = URL.createObjectURL(
    new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Participant trend SVG could not be rendered.'));
      image.src = blobUrl;
    });

    const padding = 24;
    const titleHeight = 40;
    const canvas = document.createElement('canvas');
    canvas.width = (chartWidth + padding * 2) * PDF_RENDER_SCALE;
    canvas.height = (chartHeight + titleHeight + padding * 2) * PDF_RENDER_SCALE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Export canvas is unavailable.');

    context.scale(PDF_RENDER_SCALE, PDF_RENDER_SCALE);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width / PDF_RENDER_SCALE, canvas.height / PDF_RENDER_SCALE);
    context.fillStyle = '#1f2937';
    context.font = '600 18px Inter, Arial, sans-serif';
    context.fillText(title, padding, padding + 19);
    context.drawImage(image, padding, padding + titleHeight, chartWidth, chartHeight);
    return canvas;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export function addPdfPageHeader(pdf: jsPDF, orgTitle: string, dateRange: string) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(`Bericht: ${orgTitle}`, 14, 18);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text(
    dateRange ? autoT('ui_15fd2f861910', { value0: dateRange }) : autoT('ui_38fc1281b47b'),
    14,
    26,
  );
}

export function collectPdfBreakpoints(root: HTMLDivElement, canvas: HTMLCanvasElement) {
  const rootRect = root.getBoundingClientRect();
  const rootHeight = Math.max(rootRect.height, 1);
  const scaleY = canvas.height / rootHeight;
  const breakpoints = new Set<number>([0, canvas.height]);
  root.querySelectorAll<HTMLElement>('[data-pdf-section], [data-pdf-row]').forEach((node) => {
    const rect = node.getBoundingClientRect();
    const top = Math.round((rect.top - rootRect.top) * scaleY);
    if (top > 0 && top < canvas.height) breakpoints.add(top);
  });
  return Array.from(breakpoints).sort((left, right) => left - right);
}

export function buildPdfSlices(
  totalHeightPx: number,
  pageHeightPx: number,
  breakpoints: number[],
): PdfSlice[] {
  const slices: PdfSlice[] = [];
  const minFillPx = Math.floor(pageHeightPx * PDF_MIN_PAGE_FILL_RATIO);
  let startPx = 0;
  while (startPx < totalHeightPx) {
    const remainingPx = totalHeightPx - startPx;
    if (remainingPx <= pageHeightPx) {
      slices.push({ startPx, endPx: totalHeightPx });
      break;
    }
    const targetEndPx = Math.min(startPx + pageHeightPx, totalHeightPx);
    const candidateBreaks = breakpoints.filter(
      (point) => point > startPx + minFillPx && point < targetEndPx,
    );
    const endPx = candidateBreaks[candidateBreaks.length - 1] ?? targetEndPx;
    if (endPx <= startPx) {
      slices.push({ startPx, endPx: targetEndPx });
      startPx = targetEndPx;
      continue;
    }
    slices.push({ startPx, endPx });
    startPx = endPx;
  }
  return slices;
}

export function createCanvasSlice(sourceCanvas: HTMLCanvasElement, startPx: number, endPx: number) {
  const sliceHeight = Math.max(endPx - startPx, 1);
  const sliceCanvas = document.createElement('canvas');
  const context = sliceCanvas.getContext('2d');
  if (!context) return null;
  sliceCanvas.width = sourceCanvas.width;
  sliceCanvas.height = sliceHeight;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
  context.drawImage(
    sourceCanvas,
    0,
    startPx,
    sourceCanvas.width,
    sliceHeight,
    0,
    0,
    sourceCanvas.width,
    sliceHeight,
  );
  return sliceCanvas;
}
