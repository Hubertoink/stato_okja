import { useTranslation } from 'react-i18next';
import { useActiveOrganizationName } from '@/lib/useActiveOrganizationName';
import { useMemo, useState } from 'react';
import Modal from './Modal';
import type { Activity } from '@/lib/activities';
import { useActivities } from '@/lib/activities';
import type { Cohort } from '@/lib/taxonomy';
import { useCohorts, useCategories } from '@/lib/taxonomy';
import { colorForActivityType } from '@/lib/colors';
import {
  ACTIVITY_EXECUTION_STATUS_LABELS,
  normalizeActivityExecutionStatus,
} from '@/lib/activityExecutionStatus';
import { autoT } from '@/i18n/auto';
import { useToast } from '@/components/Toast';

type ColInfo = { wch?: number };
type WorkSheet = Record<string, unknown> & {
  '!autofilter'?: { ref: string };
  '!cols'?: ColInfo[];
  '!merges'?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
};

function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  return '"' + s.replace(/"/g, '""') + '"';
}

const UTF8_BOM = '\uFEFF';

function computeDurationMinutes(a: Activity): number {
  if (typeof a.durationMinutes === 'number' && !Number.isNaN(a.durationMinutes))
    return a.durationMinutes;
  const parse = (t?: string | null) => {
    if (!t) return undefined;
    const [h, m] = t.split(':').map((v) => parseInt(v, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
    return h * 60 + m;
  };
  const s = parse(a.startTime);
  const e = parse(a.endTime);
  return s !== undefined && e !== undefined && e >= s ? e - s : 0;
}

function typeLabel(code?: string | null): string {
  const map: Record<string, string> = {
    open_door: autoT('ui_a80778b6b148'),
    project_open: autoT('ui_00d882fbb5d4'),
    project_closed: autoT('ui_8f256393653e'),
    event: 'Veranstaltung',
    outreach: 'Aufsuchend',
  };
  return code ? map[code] || code : '';
}

function executionStatusLabel(status?: string | null): string {
  return ACTIVITY_EXECUTION_STATUS_LABELS[normalizeActivityExecutionStatus(status)];
}

function countActivitiesByStatus(items: Activity[]) {
  return items.reduce(
    (counts, activity) => {
      const status = normalizeActivityExecutionStatus(activity.executionStatus);
      counts[status] += 1;
      return counts;
    },
    { completed: 0, cancelled: 0 },
  );
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

type DateRangePreset = {
  label: string;
  from: string;
  to: string;
};

function downloadBlob(blob: Blob, fileName: string): void {
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

export default function ExportModal({
  open,
  onClose,
  initialFrom,
  initialTo,
}: {
  open: boolean;
  onClose: () => void;
  initialFrom: string;
  initialTo: string;
}) {
  const { t } = useTranslation('common');
  const organizationName = useActiveOrganizationName();
  const todayDate = useMemo(() => new Date(), []);
  const today = useMemo(() => isoDate(todayDate), [todayDate]);
  const [from, setFrom] = useState<string>(initialFrom);
  const [to, setTo] = useState<string>(initialTo);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();
  const effectiveTo = from <= to ? to : from;
  const dateRangePresets = useMemo<DateRangePreset[]>(() => {
    const year = todayDate.getFullYear();
    const month = todayDate.getMonth();
    const day = todayDate.getDate();
    const lastMonthStart = new Date(year, month - 1, 1);
    const lastMonthEnd = new Date(year, month, 0);
    const lastYear = year - 1;

    return [
      {
        label: autoT('ui_903ce165f687'),
        from: isoDate(new Date(year, 0, 1)),
        to: today,
      },
      {
        label: autoT('ui_f172e749dcc9'),
        from: isoDate(new Date(year, month, 1)),
        to: today,
      },
      {
        label: autoT('ui_46ae17ce0436'),
        from: isoDate(lastMonthStart),
        to: isoDate(lastMonthEnd),
      },
      {
        label: autoT('ui_2c02931c55c8'),
        from: isoDate(new Date(year, month - 3, day)),
        to: today,
      },
      {
        label: autoT('ui_dca13e4c1f6d'),
        from: isoDate(new Date(year, month - 6, day)),
        to: today,
      },
      {
        label: autoT('ui_6e1af626e810'),
        from: isoDate(new Date(lastYear, 0, 1)),
        to: isoDate(new Date(lastYear, 11, 31)),
      },
    ];
  }, [today, todayDate]);
  const { data: activities = [] } = useActivities({ from, to });
  const { data: cohorts } = useCohorts({ active: true });
  const { data: categoriesList = [] } = useCategories({ active: true });

  const cohortIndex = useMemo(() => {
    const map = new Map<string, Cohort>();
    (cohorts || [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.minAge - b.minAge)
      .forEach((c) => map.set(c.id, c));
    return map;
  }, [cohorts]);

  // Use all active cohorts as dynamic columns in raw exports, ordered by sortOrder/minAge
  const cohortColumns = useMemo(() => Array.from(cohortIndex.values()), [cohortIndex]);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    categoriesList.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categoriesList]);

  const projectMainCategoryName = (a: Activity): string => {
    const project = a.project as
      | ({
          categoryId?: string | null;
          categories?: Array<{ name?: string }>;
          type?: string | null;
        })
      | null
      | undefined;
    if (project?.type === 'open_door') return '';
    const cid = project?.categoryId || null;
    if (cid && categoryNameById.has(cid)) return categoryNameById.get(cid) || '';
    const names = Array.isArray(project?.categories)
      ? (project?.categories || []).map((c) => c?.name).filter(Boolean)
      : [];
    return names.join(' | ');
  };

  const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : '');

  const getCohortTotal = (a: Activity, cohortId: string) => {
    if (!Array.isArray(a.cohorts)) return 0;
    let sum = 0;
    for (const c of a.cohorts) {
      if (c.cohortId === cohortId) sum += (c.m ?? 0) + (c.w ?? 0) + (c.d ?? 0);
    }
    return sum;
  };

  const exportRangeLabel = `${from}-bis-${effectiveTo}`;

  const applyDateRangePreset = (preset: DateRangePreset) => {
    setFrom(preset.from);
    setTo(preset.to);
  };

  const saveCsv = async (rows: string[][], fileName: string) => {
    const csv = rows.map((r) => r.map(csvEscape).join(';')).join('\r\n');
    const blob = new Blob([UTF8_BOM, csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, fileName);
  };

  const downloadRaw = async () => {
    const rows: string[][] = [];
    const header = [
      autoT('ui_34117b8ea553'),
      autoT('ui_48a3661d8464'),
      autoT('ui_2b020927d3c6'),
      autoT('ui_4c1e1f650759'),
      autoT('ui_a536e9cb79a2'),
      autoT('ui_2b88004726d6'),
      autoT('ui_b7d49c2f437c'),
      autoT('ui_d77644e1c62f'),
      autoT('ui_62f7a7aef8a4'),
      autoT('ui_f5cbdf65b7d5'),
      autoT('ui_9b6ef5a1a499'),
      autoT('ui_f99cb097dafb'),
      autoT('ui_445829d2c92b'),
      autoT('ui_ed9839e8f1c1'),
      autoT('ui_6b0d31c0d563'),
      autoT('ui_aff024fe4ab0'),
      autoT('ui_3c363836cf4e'),
      autoT('ui_7cb4078ba70e'),
      ...cohortColumns.map((c) => `kohorte:${c.name}`),
    ];
    rows.push(header);
    for (const a of activities) {
      const isOpenDoor = a.project?.type === 'open_door';
      const cats = isOpenDoor ? '' : a.categories?.map((c) => c.name).join(' | ') || '';
      const tags = a.tags?.map((t) => t.name).join(' | ') || '';
      const staff = a.staff?.map((s) => s.name).join(' | ') || '';
      const cohortTotals = cohortColumns.map((c) => String(getCohortTotal(a, c.id)));
      rows.push([
        a.date?.slice(0, 10) || '',
        executionStatusLabel(a.executionStatus),
        hhmm(a.startTime),
        hhmm(a.endTime),
        String(computeDurationMinutes(a)),
        typeLabel(a.type),
        a.title || '',
        a.project?.title || '',
        typeLabel(a.project?.type),
        cats,
        tags,
        a.location?.name || '',
        staff,
        String(a.countTotal ?? 0),
        String(a.countMale ?? 0),
        String(a.countFemale ?? 0),
        String(a.countDiverse ?? 0),
        a.notes || '',
        ...cohortTotals,
      ]);
    }
    await saveCsv(rows, `stato-rohdaten-${exportRangeLabel}.csv`);
  };

  const buildConsolidatedMatrix = () => {
    // Group by project (id). Activities without project grouped under 'ohne-projekt:<type>'
    const groups = new Map<
      string,
      { key: string; projekt: string; kategorie: string; typ: string; items: Activity[] }
    >();
    for (const a of activities) {
      const key = a.project?.id || autoT('ui_cef927f53a80', { value0: a.project?.title || a.type });
      const projekt = a.project?.title || autoT('ui_5b4a4a84148c');
      const kategorie = projectMainCategoryName(a);
      const typ = typeLabel(a.project?.type || a.type || '');
      const gk = groups.get(key);
      if (!gk) groups.set(key, { key, projekt, kategorie, typ, items: [a] });
      else gk.items.push(a);
    }

    // Dynamic cohort columns by name
    const cohortNames = Array.from(cohortIndex.values()).map((c) => c.name);
    const header = [
      autoT('ui_d77644e1c62f'),
      autoT('ui_f3649f6e7c37'),
      autoT('ui_2b88004726d6'),
      autoT('ui_e90a0a712c36'),
      autoT('ui_b098b52ea66a'),
      autoT('ui_7e0cccc305b3'),
      autoT('ui_05fd97d50ead'),
      autoT('ui_2af27cb5619b'),
      autoT('ui_ed2b859becc9'),
      autoT('ui_3ef29aafb867'),
      ...cohortNames.map((n) => `kohorte:${n}_avg`),
      autoT('ui_f974160ee3f9'),
    ];
    const rows: (string | number)[][] = [header];

    const apportion = (values: number[], target: number): number[] => {
      const floors = values.map((v) => Math.floor(v));
      let rem = target - floors.reduce((s, v) => s + v, 0);
      const fracs = values.map((v, i) => ({ i, f: v - Math.floor(v) }));
      fracs.sort((a, b) => b.f - a.f);
      for (let k = 0; k < fracs.length && rem > 0; k++) {
        floors[fracs[k].i]++;
        rem--;
      }
      return floors;
    };

    for (const g of groups.values()) {
      const n = g.items.length || 1;
      const statusCounts = countActivitiesByStatus(g.items);
      let sumDur = 0,
        sumM = 0,
        sumW = 0,
        sumD = 0;
      // cohort sum by cohortId of total (m+w+d)
      const cohortTotals = new Map<string, number>();
      for (const a of g.items) {
        sumDur += computeDurationMinutes(a);
        sumM += a.countMale ?? 0;
        sumW += a.countFemale ?? 0;
        sumD += a.countDiverse ?? 0;
        if (Array.isArray(a.cohorts)) {
          for (const c of a.cohorts) {
            const total = (c.m ?? 0) + (c.w ?? 0) + (c.d ?? 0);
            cohortTotals.set(c.cohortId, (cohortTotals.get(c.cohortId) || 0) + total);
          }
        }
      }
      const durAvg = sumDur / n;
      const mAvgF = sumM / n;
      const wAvgF = sumW / n;
      const dAvgF = sumD / n;
      const totalAvg = Math.round((sumM + sumW + sumD) / n);
      const [mAvg, wAvg, dAvg] = apportion([mAvgF, wAvgF, dAvgF], totalAvg);
      const cohortAvgFloat = Array.from(cohortIndex.values()).map((c) => {
        const total = cohortTotals.get(c.id) || 0;
        return total / n;
      });
      const cohortAvgByName = apportion(cohortAvgFloat, totalAvg);
      rows.push([
        g.projekt,
        g.kategorie,
        g.typ,
        n,
        statusCounts.completed,
        statusCounts.cancelled,
        Math.round(durAvg * 100) / 100,
        mAvg,
        wAvg,
        dAvg,
        ...cohortAvgByName,
        totalAvg,
      ]);
    }
    return rows;
  };

  const downloadConsolidated = async () => {
    const rows = buildConsolidatedMatrix();
    await saveCsv(
      rows.map((row) => row.map((cell) => String(cell ?? ''))),
      `stato-konsolidiert-${exportRangeLabel}.csv`,
    );
  };

  // Build consolidated matrix specifically for Excel with pretty headers and integer averages
  const buildConsolidatedMatrixExcel = () => {
    const groups = new Map<
      string,
      { key: string; projekt: string; kategorie: string; typ: string; items: Activity[] }
    >();
    for (const a of activities) {
      const key = a.project?.id || autoT('ui_cef927f53a80', { value0: a.project?.title || a.type });
      const projekt = a.project?.title || autoT('ui_5b4a4a84148c');
      const kategorie = projectMainCategoryName(a);
      const typ = typeLabel(a.project?.type || a.type || '');
      const gk = groups.get(key);
      if (!gk) groups.set(key, { key, projekt, kategorie, typ, items: [a] });
      else gk.items.push(a);
    }

    const cohortNames = Array.from(cohortIndex.values()).map((c) => c.name);
    // Two header rows: group labels (row 1) + column titles (row 2)
    const spacerColLabel = '';
    const subHeader = [
      autoT('ui_20bda6d2e725'),
      autoT('ui_358210386a4f'),
      autoT('ui_edcaf9aaa282'),
      autoT('ui_a0015435c276'),
      autoT('ui_3074a0ce7457'),
      autoT('ui_af6ed3ac625b'),
      autoT('ui_86cfa6aedf1a'),
      autoT('ui_42d7d7b3373e'),
      autoT('ui_578836fdf9b1'),
      autoT('ui_bed447b89d14'),
      spacerColLabel,
      ...cohortNames.map((n) => `Ø ${n}`),
      autoT('ui_923bb5d3bd98'),
    ];
    const topHeader: string[] = new Array(subHeader.length).fill('');
    // Place group labels: Geschlecht over m/w/d, Alterskohorten over cohort columns
    // Indexes: 0..6 base, 7..9 gender, 10 spacer, 11.. cohorts
    const genderStart = 7;
    const genderEnd = 9;
    const cohortStart = 11;
    const cohortEnd = cohortStart + cohortNames.length - 1;
    if (genderStart <= genderEnd) topHeader[genderStart] = 'Geschlecht';
    if (cohortStart <= cohortEnd) topHeader[cohortStart] = 'Alterskohorten';

    const rows: (string | number)[][] = [topHeader, subHeader];

    const apportion = (values: number[], target: number): number[] => {
      const floors = values.map((v) => Math.floor(v));
      let rem = target - floors.reduce((s, v) => s + v, 0);
      const fracs = values.map((v, i) => ({ i, f: v - Math.floor(v) }));
      fracs.sort((a, b) => b.f - a.f);
      for (let k = 0; k < fracs.length && rem > 0; k++) {
        floors[fracs[k].i]++;
        rem--;
      }
      return floors;
    };

    for (const g of groups.values()) {
      const n = g.items.length || 1;
      const statusCounts = countActivitiesByStatus(g.items);
      let sumDur = 0,
        sumM = 0,
        sumW = 0,
        sumD = 0;
      const cohortTotals = new Map<string, number>();
      for (const a of g.items) {
        sumDur += computeDurationMinutes(a);
        sumM += a.countMale ?? 0;
        sumW += a.countFemale ?? 0;
        sumD += a.countDiverse ?? 0;
        if (Array.isArray(a.cohorts)) {
          for (const c of a.cohorts) {
            const total = (c.m ?? 0) + (c.w ?? 0) + (c.d ?? 0);
            cohortTotals.set(c.cohortId, (cohortTotals.get(c.cohortId) || 0) + total);
          }
        }
      }
      const durAvg = Math.round(sumDur / n);
      const totalAvg = Math.round((sumM + sumW + sumD) / n);
      const [mAvg, wAvg, dAvg] = apportion([sumM / n, sumW / n, sumD / n], totalAvg);
      const cohortFloat = Array.from(cohortIndex.values()).map((c) => {
        const total = cohortTotals.get(c.id) || 0;
        return total / n;
      });
      const cohortAvgByName = apportion(cohortFloat, totalAvg);

      rows.push([
        g.projekt,
        g.kategorie,
        g.typ,
        n,
        statusCounts.completed,
        statusCounts.cancelled,
        durAvg,
        mAvg,
        wAvg,
        dAvg,
        '',
        ...cohortAvgByName,
        totalAvg,
      ]);
    }
    return rows;
  };

  const downloadExcel = async () => {
    const xlsx = await import('xlsx-js-style');
    const { utils, write } = xlsx as unknown as typeof import('xlsx-js-style');
    type CellStyle = {
      font?: { bold?: boolean; color?: { rgb: string } };
      fill?: { patternType: 'solid'; fgColor: { rgb: string } };
    };
    // Raw sheet
    const rawHeader = [
      autoT('ui_df5c3008c765'),
      autoT('ui_bae7d5be7082'),
      autoT('ui_952f375412e8'),
      autoT('ui_920e9c468e40'),
      autoT('ui_3e2b606422c8'),
      autoT('ui_edcaf9aaa282'),
      autoT('ui_950701e758d1'),
      autoT('ui_20bda6d2e725'),
      autoT('ui_34fb1b25fac4'),
      autoT('ui_4e1e15e17610'),
      autoT('ui_848eed0fbd54'),
      autoT('ui_d95f9e67114d'),
      autoT('ui_93d76ef57f64'),
      autoT('ui_1fd116ed38b8'),
      autoT('ui_c63ae6dd4fc9'),
      autoT('ui_e2415cb7f63d'),
      autoT('ui_50c9e8d5fc98'),
      autoT('ui_7e458d013900'),
      ...cohortColumns.map((c) => `Kohorte: ${c.name}`),
    ];
    const rawRows = activities.map((a) => {
      const isOpenDoor = a.project?.type === 'open_door';
      const cats = isOpenDoor ? '' : a.categories?.map((c) => c.name).join(' | ') || '';
      const tags = a.tags?.map((t) => t.name).join(' | ') || '';
      const staff = a.staff?.map((s) => s.name).join(' | ') || '';
      const cohortTotals = cohortColumns.map((c) => getCohortTotal(a, c.id));
      return [
        a.date?.slice(0, 10) || '',
        executionStatusLabel(a.executionStatus),
        hhmm(a.startTime),
        hhmm(a.endTime),
        computeDurationMinutes(a),
        typeLabel(a.type),
        a.title || '',
        a.project?.title || '',
        typeLabel(a.project?.type),
        cats,
        tags,
        a.location?.name || '',
        staff,
        a.countTotal ?? 0,
        a.countMale ?? 0,
        a.countFemale ?? 0,
        a.countDiverse ?? 0,
        a.notes || '',
        ...cohortTotals,
      ];
    });
    const rawSheet = utils.aoa_to_sheet([rawHeader, ...rawRows]) as WorkSheet;
    // Autofilter and reasonable column widths
    rawSheet['!autofilter'] = { ref: `A1:${utils.encode_col(rawHeader.length - 1)}1` };
    const rawCols: ColInfo[] = rawHeader.map((h, i) => ({
      wch: Math.max(12, i < 2 ? 18 : 0, h.length + 2),
    }));
    rawSheet['!cols'] = rawCols;

    // Consolidated sheet
    const matrix = buildConsolidatedMatrixExcel();
    const consSheet = utils.aoa_to_sheet(matrix) as WorkSheet;
    // Merges to create group headers in row 1
    const consHeaderTop = matrix[0] as string[];
    const consHeaderSub = matrix[1] as string[];
    const genderStart = 7;
    const genderEnd = 9; // H..J
    const cohortStart = 11;
    const cohortEnd = consHeaderSub.length - 2; // cohort columns end before final Ø Gesamt
    const merges = [] as Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
    if (genderEnd >= genderStart)
      merges.push({ s: { r: 0, c: genderStart }, e: { r: 0, c: genderEnd } });
    if (cohortEnd >= cohortStart)
      merges.push({ s: { r: 0, c: cohortStart }, e: { r: 0, c: cohortEnd } });
    consSheet['!merges'] = merges;

    // Autofilter on the second header row (row 2 in Excel)
    consSheet['!autofilter'] = { ref: `A2:${utils.encode_col(consHeaderSub.length - 1)}2` };

    // Column widths (spacer column narrower)
    const consCols: ColInfo[] = consHeaderSub.map((h, i) => ({
      wch: i === 10 ? 3 : i <= 2 ? 22 : Math.max(10, h.length + 2),
    }));
    consSheet['!cols'] = consCols;

    // Optional styling (xlsx-js-style supports cell styles)
    const setCellStyle = (r: number, c: number, style: CellStyle) => {
      const addr = utils.encode_cell({ r, c });
      const cell = consSheet[addr] as unknown as { s?: CellStyle } | undefined;
      if (cell) {
        cell.s = { ...(cell.s || {}), ...style };
      }
    };
    // Bold header text
    for (let c = 0; c < consHeaderSub.length; c++) {
      setCellStyle(1, c, { font: { bold: true } });
    }
    // Shade gender header (F2..H2) light gray and cohorts (J2..last) light green; also group titles in row 1
    const grayFill: CellStyle = { fill: { patternType: 'solid', fgColor: { rgb: 'FFF2F2F2' } } };
    const greenFill: CellStyle = { fill: { patternType: 'solid', fgColor: { rgb: 'FFE8F5E9' } } };
    for (let c = genderStart; c <= genderEnd; c++) setCellStyle(1, c, grayFill);
    for (let c = cohortStart; c <= cohortEnd; c++) setCellStyle(1, c, greenFill);
    // Group titles (row 0)
    if (consHeaderTop[genderStart])
      setCellStyle(0, genderStart, { font: { bold: true }, ...grayFill });
    if (consHeaderTop[cohortStart])
      setCellStyle(0, cohortStart, { font: { bold: true }, ...greenFill });

    // Colorize the Typ column (index 2) using app type colors (font color)
    const typeColIndex = 2;
    for (let r = 2; r < matrix.length; r++) {
      const typeText = String(matrix[r][typeColIndex] ?? '');
      // Map back to code by inverse label match is tricky; instead, inspect first item's type of group during build
      // We will approximate by deriving color from the visible label using known mapping
      const labelToCode: Record<string, string> = {
        'Offene Tür': 'open_door',
        'Projekt (offen)': 'project_open',
        'Projekt (geschlossen)': 'project_closed',
        Veranstaltung: 'event',
        Aufsuchend: 'outreach',
      };
      const code = labelToCode[typeText] || undefined;
      const hex = colorForActivityType(code);
      const rgb = 'FF' + hex.replace('#', '').toUpperCase();
      setCellStyle(r, typeColIndex, { font: { color: { rgb } } });
    }

    // Bold the final "Ø Gesamt" values
    const totalColIndex = consHeaderSub.length - 1;
    for (let r = 2; r < matrix.length; r++) {
      setCellStyle(r, totalColIndex, { font: { bold: true } });
    }

    const wb = utils.book_new();
    utils.book_append_sheet(wb, rawSheet, autoT('ui_ba3d8c7e9fce'));
    utils.book_append_sheet(wb, consSheet, autoT('ui_c0d622468344'));
    const arrayBuffer = write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(blob, `stato-export-${exportRangeLabel}.xlsx`);
  };

  const runExport = async (
    exporter: () => Promise<void>,
    successLabel: string,
  ) => {
    if (!from || !to) {
      showToast(autoT('ui_15ec3fbfb3f5'), { type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      await exporter();
      showToast(`${successLabel} heruntergeladen. Der Speicherort wird vom Browser bestimmt.`, {
        type: 'success',
        durationMs: 4500,
      });
    } catch {
      showToast('Export konnte nicht heruntergeladen werden.', { type: 'error', durationMs: 4500 });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={autoT('ui_03423082c4e8')} maxWidth="lg">
      <p className="mb-2 text-sm font-medium">{t('workflow.organization')}: {organizationName || t('workflow.noOrganization')}</p>
      <p className="mb-4 text-sm text-[var(--text-secondary)]">{t('workflow.statisticsOnly')}</p>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-gray-600">{autoT('ui_a4b078f9eb7b')}<input
              type="date"
              className="block mt-1 w-full border rounded px-3 py-2"
              value={from}
              max={today}
              onChange={(e) => {
                const nextFrom = e.target.value;
                setFrom(nextFrom);
                if (to < nextFrom) setTo(nextFrom);
              }}
            />
          </label>
          <label className="text-sm text-gray-600">{autoT('ui_0afaa0e566a1')}<input
              type="date"
              className="block mt-1 w-full border rounded px-3 py-2"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500">{autoT('ui_37b72d9d418d')}</div>
          <div className="flex flex-wrap gap-2">
            {dateRangePresets.map((preset) => {
              const active = from === preset.from && to === preset.to;
              return (
                <button
                  key={preset.label}
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-viridian text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  onClick={() => applyDateRangePreset(preset)}
                  aria-pressed={active}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="text-xs text-gray-500">{autoT('ui_deec288a9b9b')}{from}{' '}{autoT('ui_1094cd06521b')}{' '}{effectiveTo}{' '}{autoT('ui_fd8ac07baabd')}{' '}{activities.length}
        </div>
        <div>
          <h4 className="font-semibold text-viridian mb-1">{autoT('ui_42b453dcfd49')}</h4>
          <p className="text-sm text-gray-600 mb-3">{autoT('ui_7400b87b587a')}</p>
          <button
            className="px-4 py-2 rounded bg-viridian text-white hover:bg-cambridge-blue disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() => void runExport(downloadRaw, 'CSV-Rohdaten')}
            disabled={isSaving}
          >{autoT('ui_dc7957624c14')}</button>
        </div>
        <div className="border-t pt-4">
          <h4 className="font-semibold text-viridian mb-1">{autoT('ui_6f58664227a9')}</h4>
          <p className="text-sm text-gray-600 mb-3">{autoT('ui_4189c160fbd9')}</p>
          <button
            className="px-4 py-2 rounded bg-cambridge-blue text-white hover:bg-viridian disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() => void runExport(downloadConsolidated, 'Konsolidierte CSV')}
            disabled={isSaving}
          >{autoT('ui_dc7957624c14')}</button>
        </div>
        <div className="border-t pt-4">
          <h4 className="font-semibold text-viridian mb-1">{autoT('ui_0e2d6a433d92')}</h4>
          <p className="text-sm text-gray-600 mb-3">{autoT('ui_f992f9605f17')}</p>
          <button
            className="export-xlsx-button px-4 py-2 rounded bg-azure-web text-viridian hover:bg-mint-green disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() => void runExport(downloadExcel, 'Excel-Datei')}
            disabled={isSaving}
          >{autoT('ui_d53e67acd6a6')}</button>
        </div>
      </div>
    </Modal>
  );
}
