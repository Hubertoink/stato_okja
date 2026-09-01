import type { Activity } from '@/lib/activities';
import { colorForActivityType } from '@/lib/colors';
import { autoT } from '@/i18n/auto';
import type { ActivityExportRow } from '../types';

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

function csvEscape(value: string | number) {
  const text = String(value);
  // Prevent formula execution when the file is opened in spreadsheet software.
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function serializeActivitiesAsCsv(activities: Activity[], getTypeLabel: ActivityTypeLabel) {
  const rows = toActivityExportRows(activities, getTypeLabel);
  const values: Array<Array<string | number>> = [
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
      row.duration,
    ]),
  ];

  return `\uFEFF${values.map((row) => row.map(csvEscape).join(';')).join('\r\n')}`;
}

export async function exportActivitiesAsCsv({
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
  const blob = new Blob([serializeActivitiesAsCsv(activities, getTypeLabel)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  onProgress(autoT('ui_69d8049e6f66'));
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
