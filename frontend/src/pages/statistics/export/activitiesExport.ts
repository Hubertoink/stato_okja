import type jsPDF from 'jspdf';
import type { Activity } from '@/lib/activities';
import { colorForActivityType } from '@/lib/colors';
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';
import type { ActivityExportRow } from '../types';
import { addPdfPageHeader, loadPdfExportDependencies, PDF_MARGIN_MM } from './pdfCanvas';

type ActivityTypeLabel = (type?: string | null) => string;
type ProgressHandler = (message: string) => void;

export function getActivityParticipantTotal(activity: Activity) {
  return (
    (activity.countTotal ??
      (activity.countMale || 0) + (activity.countFemale || 0) + (activity.countDiverse || 0)) ||
    0
  );
}

export function getActivityDurationMinutes(activity: Activity): number | undefined {
  if (typeof activity.durationMinutes === 'number' && activity.durationMinutes >= 0)
    return activity.durationMinutes;
  const toMinutes = (time?: string | null) => {
    if (!time) return undefined;
    const [hours, minutes] = String(time)
      .split(':')
      .map((value) => parseInt(value, 10));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;
    return hours * 60 + minutes;
  };
  const start = toMinutes(activity.startTime);
  const end = toMinutes(activity.endTime);
  return start !== undefined && end !== undefined && end >= start ? end - start : undefined;
}

export function formatActivityDateGerman(date?: string | null) {
  const safeDate = String(date || '').slice(0, 10);
  const [year, month, day] = safeDate.split('-');
  if (!year || !month || !day) return safeDate;
  return `${day}.${month}.${year}`;
}

export function toActivityExportRows(
  activities: Activity[],
  getTypeLabel: ActivityTypeLabel,
): ActivityExportRow[] {
  return activities.map((activity) => ({
    date: formatActivityDateGerman(activity.date),
    type: getTypeLabel(activity.type),
    title: activity.title || '',
    project: activity.project?.title || '',
    total: getActivityParticipantTotal(activity),
    male: activity.countMale || 0,
    female: activity.countFemale || 0,
    diverse: activity.countDiverse || 0,
    duration: getActivityDurationMinutes(activity) ?? '',
  }));
}

export async function exportActivitiesAsExcel({
  activities,
  fileName,
  getTypeLabel,
  onProgress,
}: {
  activities: Activity[];
  fileName: string;
  getTypeLabel: ActivityTypeLabel;
  onProgress: ProgressHandler;
}) {
  onProgress(autoT('ui_fdc6078908bb'));
  await new Promise(requestAnimationFrame);
  const rows = toActivityExportRows(activities, getTypeLabel);
  const sheetRows: Array<Array<string | number>> = [
    [
      autoT('ui_df5c3008c765'),
      autoT('ui_edcaf9aaa282'),
      autoT('ui_950701e758d1'),
      autoT('ui_20bda6d2e725'),
      autoT('ui_a24fe1e6fcc2'),
      autoT('ui_6b0d31c0d563'),
      autoT('ui_aff024fe4ab0'),
      autoT('ui_3c363836cf4e'),
      autoT('ui_d62550d402f1'),
    ],
    ...rows.map((row) => [
      row.date,
      row.type,
      row.title,
      row.project,
      row.total,
      row.male,
      row.female,
      row.diverse,
      row.duration === '' ? '' : row.duration,
    ]),
  ];
  const xlsx = await import('xlsx-js-style');
  const { utils, writeFile } = xlsx as unknown as typeof import('xlsx-js-style');
  type CellStyle = { font?: { bold?: boolean; color?: { rgb: string } } };
  const worksheet = utils.aoa_to_sheet(sheetRows);
  (worksheet as unknown as { ['!autofilter']?: { ref: string } })['!autofilter'] = {
    ref: `A1:${utils.encode_col((sheetRows[0]?.length || 1) - 1)}1`,
  };
  worksheet['!cols'] = [
    { wch: 13 },
    { wch: 22 },
    { wch: 34 },
    { wch: 30 },
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
  ];
  for (let column = 0; column < (sheetRows[0]?.length || 0); column++) {
    const cell = worksheet[utils.encode_cell({ r: 0, c: column })] as unknown as
      { s?: CellStyle } | undefined;
    if (cell) cell.s = { ...(cell.s || {}), font: { ...(cell.s?.font || {}), bold: true } };
  }
  for (let rowIndex = 1; rowIndex < sheetRows.length; rowIndex++) {
    const activity = activities[rowIndex - 1];
    if (!activity) continue;
    const cell = worksheet[utils.encode_cell({ r: rowIndex, c: 1 })] as unknown as
      { s?: CellStyle } | undefined;
    if (cell) {
      const rgb = `FF${colorForActivityType(activity.type).replace('#', '').toUpperCase()}`;
      cell.s = { ...(cell.s || {}), font: { ...(cell.s?.font || {}), color: { rgb } } };
    }
  }
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, autoT('ui_b6bf5f1a2033'));
  onProgress(autoT('ui_69d8049e6f66'));
  await new Promise(requestAnimationFrame);
  writeFile(workbook, fileName);
}

export async function exportActivitiesAsPdf({
  activities,
  fileName,
  orgName,
  exportRangeLabel,
  getTypeLabel,
  onProgress,
}: {
  activities: Activity[];
  fileName: string;
  orgName?: string | null;
  exportRangeLabel: string;
  getTypeLabel: ActivityTypeLabel;
  onProgress: ProgressHandler;
}) {
  onProgress(autoT('ui_27e7c797926f'));
  await new Promise(requestAnimationFrame);
  const rows = toActivityExportRows(activities, getTypeLabel);
  const { JsPDF } = await loadPdfExportDependencies();
  const pdf = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const tableTop = 34;
  const rowPaddingY = 1.5;
  const lineHeight = 3.8;
  const columns = [
    { key: 'date', label: autoT('ui_df5c3008c765'), width: 18, align: 'left' as const },
    { key: 'type', label: autoT('ui_edcaf9aaa282'), width: 31, align: 'left' as const },
    { key: 'title', label: autoT('ui_950701e758d1'), width: 64, align: 'left' as const },
    { key: 'project', label: autoT('ui_20bda6d2e725'), width: 58, align: 'left' as const },
    { key: 'total', label: autoT('ui_a24fe1e6fcc2'), width: 17, align: 'right' as const },
    { key: 'male', label: autoT('ui_6b0d31c0d563'), width: 11, align: 'right' as const },
    { key: 'female', label: autoT('ui_aff024fe4ab0'), width: 11, align: 'right' as const },
    { key: 'diverse', label: autoT('ui_3c363836cf4e'), width: 11, align: 'right' as const },
    { key: 'duration', label: autoT('ui_f6e58177bf91'), width: 18, align: 'right' as const },
  ];
  const totalTableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const orgTitle = orgName || autoT('ui_6e99c1d3b150');
  let pageNumber = 1;
  const drawTableHeader = (startY: number) => {
    let currentX = margin;
    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, startY, totalTableWidth, 7, 'F');
    pdf.setDrawColor(203, 213, 225);
    pdf.rect(margin, startY, totalTableWidth, 7);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    columns.forEach((column) => {
      pdf.rect(currentX, startY, column.width, 7);
      pdf.text(column.label, currentX + 1.5, startY + 4.6);
      currentX += column.width;
    });
    return startY + 7;
  };
  const drawPageFrame = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text(autoT('ui_44eeeedb9e8f'), margin, 15);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.5);
    pdf.text(orgTitle, margin, 21);
    pdf.text(exportRangeLabel, margin, 26);
    pdf.text(
      autoT('ui_9a3150b4e9ec', { value0: rows.length.toLocaleString(getCurrentIntlLocale()) }),
      pageWidth - margin,
      21,
      { align: 'right' },
    );
    pdf.text(`Seite ${pageNumber}`, pageWidth - margin, 26, { align: 'right' });
    return drawTableHeader(tableTop);
  };
  let currentY = drawPageFrame();
  if (rows.length === 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(autoT('ui_a64587b9ad76'), margin, currentY + 8);
    onProgress(autoT('ui_0acf469c6a6c'));
    await new Promise(requestAnimationFrame);
    pdf.save(fileName);
    return;
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  rows.forEach((row, rowIndex) => {
    const cellLines = columns.map((column) => {
      const rawValue = row[column.key as keyof ActivityExportRow];
      const text = rawValue === '' ? '' : String(rawValue);
      if (column.align === 'right') return [text];
      const lines = pdf.splitTextToSize(text || ' ', column.width - 3);
      return Array.isArray(lines) && lines.length > 0 ? lines : [' '];
    });
    const rowHeight =
      Math.max(...cellLines.map((lines) => lines.length), 1) * lineHeight + rowPaddingY * 2;
    if (currentY + rowHeight > pageHeight - margin) {
      pdf.addPage('a4', 'landscape');
      pageNumber += 1;
      currentY = drawPageFrame();
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
    }
    if (rowIndex % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, currentY, totalTableWidth, rowHeight, 'F');
    }
    let currentX = margin;
    pdf.setDrawColor(226, 232, 240);
    columns.forEach((column, columnIndex) => {
      pdf.rect(currentX, currentY, column.width, rowHeight);
      cellLines[columnIndex].forEach((line, lineIndex) => {
        const textY = currentY + rowPaddingY + 3.1 + lineIndex * lineHeight;
        if (column.align === 'right')
          pdf.text(line, currentX + column.width - 1.2, textY, { align: 'right' });
        else pdf.text(line, currentX + 1.2, textY);
      });
      currentX += column.width;
    });
    currentY += rowHeight;
  });
  onProgress(autoT('ui_0acf469c6a6c'));
  await new Promise(requestAnimationFrame);
  pdf.save(fileName);
}

function fitPdfTableCell(pdf: jsPDF, value: string | number, width: number) {
  const text = String(value ?? '');
  if (pdf.getTextWidth(text) <= width) return text;
  let end = text.length;
  while (end > 0 && pdf.getTextWidth(`${text.slice(0, end)}…`) > width) end -= 1;
  return `${text.slice(0, end)}…`;
}

export function appendActivitiesTableToPdf(
  pdf: jsPDF,
  activities: Activity[],
  orgTitle: string,
  dateRange: string,
  getTypeLabel: ActivityTypeLabel,
) {
  const columns = [
    { label: 'Datum', width: 20, align: 'left' as const },
    { label: 'Typ', width: 23, align: 'left' as const },
    { label: 'Titel', width: 39, align: 'left' as const },
    { label: 'Projekt', width: 41, align: 'left' as const },
    { label: 'Gesamt', width: 12, align: 'right' as const },
    { label: 'M', width: 12, align: 'right' as const },
    { label: 'W', width: 12, align: 'right' as const },
    { label: 'D', width: 12, align: 'right' as const },
    { label: 'Min.', width: 19, align: 'right' as const },
  ];
  const pageBottom = pdf.internal.pageSize.getHeight() - PDF_MARGIN_MM;
  const headerHeight = 7;
  const rowHeight = 6;
  let rowY = 0;
  const drawTableHeader = () => {
    addPdfPageHeader(pdf, orgTitle, dateRange);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(31, 41, 55);
    pdf.text(`Aktivitätenliste (${activities.length})`, PDF_MARGIN_MM, 35);
    pdf.setFillColor(245, 247, 255);
    pdf.rect(
      PDF_MARGIN_MM,
      41,
      columns.reduce((sum, column) => sum + column.width, 0),
      headerHeight,
      'F',
    );
    pdf.setFontSize(7.5);
    let columnX = PDF_MARGIN_MM;
    for (const column of columns) {
      pdf.text(
        column.label,
        column.align === 'right' ? columnX + column.width - 1 : columnX + 1,
        45.5,
        { align: column.align },
      );
      columnX += column.width;
    }
    rowY = 48;
  };
  pdf.addPage('a4', 'portrait');
  drawTableHeader();
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  for (const activity of toActivityExportRows(activities, getTypeLabel)) {
    if (rowY + rowHeight > pageBottom) {
      pdf.addPage('a4', 'portrait');
      drawTableHeader();
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
    }
    const values = [
      activity.date,
      activity.type,
      activity.title,
      activity.project,
      activity.total,
      activity.male,
      activity.female,
      activity.diverse,
      activity.duration,
    ];
    let columnX = PDF_MARGIN_MM;
    for (const [index, column] of columns.entries()) {
      const text = fitPdfTableCell(pdf, values[index], column.width - 2);
      pdf.text(
        text,
        column.align === 'right' ? columnX + column.width - 1 : columnX + 1,
        rowY + 4,
        { align: column.align },
      );
      columnX += column.width;
    }
    pdf.setDrawColor(226, 232, 240);
    pdf.line(PDF_MARGIN_MM, rowY + rowHeight, PDF_MARGIN_MM + 190, rowY + rowHeight);
    rowY += rowHeight;
  }
}
