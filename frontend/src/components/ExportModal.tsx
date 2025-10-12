import { useMemo, useState } from 'react';
import type { WorkSheet, ColInfo } from 'xlsx';
import Modal from './Modal';
import type { Activity } from '@/lib/activities';
import { useActivities } from '@/lib/activities';
import type { Cohort } from '@/lib/taxonomy';
import { useCohorts } from '@/lib/taxonomy';

function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  return '"' + s.replace(/"/g, '""') + '"';
}

function computeDurationMinutes(a: Activity): number {
  if (typeof a.durationMinutes === 'number' && !Number.isNaN(a.durationMinutes)) return a.durationMinutes;
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
    open_door: 'Offene Tür',
    project_open: 'Projekt (offen)',
    project_closed: 'Projekt (geschlossen)',
    event: 'Veranstaltung',
    outreach: 'Aufsuchend',
  };
  return code ? (map[code] || code) : '';
}

export default function ExportModal({
  open,
  onClose,
  initialYear,
  initialMonth,
}: {
  open: boolean;
  onClose: () => void;
  initialYear: number;
  initialMonth: number; // 0 = ganzes Jahr, sonst 1-12
}) {
  const [year, setYear] = useState<number>(initialYear);
  const [month, setMonth] = useState<number>(initialMonth);
  // Support exporting a whole year when month === 0
  const from = month === 0 ? `${year}-01-01` : `${year}-${String(month).padStart(2, '0')}-01`;
  const to = month === 0
    ? `${year}-12-31`
    : `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const { data: activities = [] } = useActivities({ from, to });
  const { data: cohorts } = useCohorts({ active: true });

  const cohortIndex = useMemo(() => {
    const map = new Map<string, Cohort>();
    (cohorts || [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.minAge - b.minAge)
      .forEach((c) => map.set(c.id, c));
    return map;
  }, [cohorts]);

  const downloadRaw = () => {
    const rows: string[][] = [];
    const header = [
      'id','datum','start','ende','dauer_min','typ','titel',
      'projekt_id','projekt','projekt_typ',
      'kategorie_ids','kategorien','tags','ort_id','ort',
      'mitarbeitende','teilnehmende_total','m','w','d','notizen','cohorts_json'
    ];
    rows.push(header);
    for (const a of activities) {
      const cats = a.categories?.map((c) => c.name).join(' | ') || '';
      const catIds = a.categories?.map((c) => c.id).join('|') || '';
      const tags = a.tags?.map((t) => t.name).join(' | ') || '';
      const staff = a.staff?.map((s) => s.name).join(' | ') || '';
      const cohortsJson = a.cohorts ? JSON.stringify(a.cohorts) : '';
      rows.push([
        a.id,
        a.date?.slice(0, 10) || '',
        a.startTime || '',
        a.endTime || '',
  String(computeDurationMinutes(a)),
  typeLabel(a.type),
        a.title || '',
        a.project?.id || '',
  a.project?.title || '',
  typeLabel(a.project?.type),
        catIds,
        cats,
        tags,
        a.location?.id || '',
        a.location?.name || '',
        staff,
        String(a.countTotal ?? 0),
        String(a.countMale ?? 0),
        String(a.countFemale ?? 0),
        String(a.countDiverse ?? 0),
        a.notes || '',
        cohortsJson,
      ]);
    }
    const csv = rows.map((r) => r.map(csvEscape).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stato-rohdaten-${from}-bis-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildConsolidatedMatrix = () => {
    // Group by project (id). Activities without project grouped under 'ohne-projekt:<type>'
    const groups = new Map<string, { key: string; projekt: string; kategorie: string; typ: string; items: Activity[] }>();
    for (const a of activities) {
      const key = a.project?.id || `ohne-projekt:${a.project?.title || a.type}`;
      const projekt = a.project?.title || 'Ohne Projekt';
      const kategorie = a.project?.categories?.map((c) => c.name).join(' | ') || '';
      const typ = typeLabel(a.project?.type || a.type || '');
      const gk = groups.get(key);
      if (!gk) groups.set(key, { key, projekt, kategorie, typ, items: [a] });
      else gk.items.push(a);
    }

    // Dynamic cohort columns by name
    const cohortNames = Array.from(cohortIndex.values()).map((c) => c.name);
    const header = [
      'projekt','kategorie','typ','anzahl','dauer_avg_min','m_avg','w_avg','d_avg',
      ...cohortNames.map((n) => `kohorte:${n}_avg`),
    ];
    const rows: (string|number)[][] = [header];

    for (const g of groups.values()) {
      const n = g.items.length || 1;
      let sumDur = 0, sumM = 0, sumW = 0, sumD = 0;
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
      const mAvg = sumM / n;
      const wAvg = sumW / n;
      const dAvg = sumD / n;
      const cohortAvgByName = Array.from(cohortIndex.values()).map((c) => {
        const total = cohortTotals.get(c.id) || 0;
        return total / n;
      });
      rows.push([
        g.projekt,
        g.kategorie,
        g.typ,
        n,
        Math.round(durAvg * 100) / 100,
        Math.round(mAvg * 100) / 100,
        Math.round(wAvg * 100) / 100,
        Math.round(dAvg * 100) / 100,
        ...cohortAvgByName.map((v) => Math.round(v * 100) / 100),
      ]);
    }
    return rows;
  };

  const downloadConsolidated = () => {
    const rows = buildConsolidatedMatrix();
    const csv = rows.map((r) => r.map(csvEscape).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stato-konsolidiert-${from}-bis-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build consolidated matrix specifically for Excel with pretty headers and integer averages
  const buildConsolidatedMatrixExcel = () => {
    const groups = new Map<string, { key: string; projekt: string; kategorie: string; typ: string; items: Activity[] }>();
    for (const a of activities) {
      const key = a.project?.id || `ohne-projekt:${a.project?.title || a.type}`;
      const projekt = a.project?.title || 'Ohne Projekt';
      const kategorie = a.project?.categories?.map((c) => c.name).join(' | ') || '';
      const typ = typeLabel(a.project?.type || a.type || '');
      const gk = groups.get(key);
      if (!gk) groups.set(key, { key, projekt, kategorie, typ, items: [a] });
      else gk.items.push(a);
    }

    const cohortNames = Array.from(cohortIndex.values()).map((c) => c.name);
    // Two header rows: group labels (row 1) + column titles (row 2)
    const spacerColLabel = '';
    const subHeader = [
      'Projekt', 'Kategorie', 'Typ', 'Anzahl', 'Ø Dauer (Min.)', 'Ø m', 'Ø w', 'Ø d', spacerColLabel,
      ...cohortNames.map((n) => `Ø ${n}`),
    ];
    const topHeader: string[] = new Array(subHeader.length).fill('');
    // Place group labels: Geschlecht over m/w/d, Alterskohorten over cohort columns
    // Indexes: 0..4 base, 5..7 gender, 8 spacer, 9.. cohorts
    const genderStart = 5;
    const genderEnd = 7;
    const cohortStart = 9;
    const cohortEnd = cohortStart + cohortNames.length - 1;
    if (genderStart <= genderEnd) topHeader[genderStart] = 'Geschlecht';
    if (cohortStart <= cohortEnd) topHeader[cohortStart] = 'Alterskohorten';

    const rows: (string|number)[][] = [topHeader, subHeader];

    for (const g of groups.values()) {
      const n = g.items.length || 1;
      let sumDur = 0, sumM = 0, sumW = 0, sumD = 0;
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
      // Round to whole numbers for Excel readability
      const durAvg = Math.round(sumDur / n);
      const mAvg = Math.round(sumM / n);
      const wAvg = Math.round(sumW / n);
      const dAvg = Math.round(sumD / n);
      const cohortAvgByName = Array.from(cohortIndex.values()).map((c) => {
        const total = cohortTotals.get(c.id) || 0;
        return Math.round(total / n);
      });

      rows.push([
        g.projekt,
        g.kategorie,
        g.typ,
        n,
        durAvg,
        mAvg,
        wAvg,
        dAvg,
        '',
        ...cohortAvgByName,
      ]);
    }
    return rows;
  };

  const downloadExcel = async () => {
    const xlsx = await import('xlsx');
    const { utils, writeFile } = xlsx;
    // Raw sheet
    const rawHeader = [
      'ID','Datum','Start','Ende','Dauer (Minuten)','Typ','Titel','Projekt-ID','Projekt','Projekt-Typ','Kategorie-IDs','Kategorien','Tags','Ort-ID','Ort','Mitarbeitende','Teilnehmende (Total)','M','W','D','Notizen','Kohorten (JSON)'
    ];
    const rawRows = activities.map((a) => {
      const cats = a.categories?.map((c) => c.name).join(' | ') || '';
      const catIds = a.categories?.map((c) => c.id).join('|') || '';
      const tags = a.tags?.map((t) => t.name).join(' | ') || '';
      const staff = a.staff?.map((s) => s.name).join(' | ') || '';
      const cohortsJson = a.cohorts ? JSON.stringify(a.cohorts) : '';
      return [
        a.id,
        a.date?.slice(0, 10) || '',
        a.startTime || '',
        a.endTime || '',
        computeDurationMinutes(a),
        typeLabel(a.type),
        a.title || '',
        a.project?.id || '',
        a.project?.title || '',
        typeLabel(a.project?.type),
        catIds,
        cats,
        tags,
        a.location?.id || '',
        a.location?.name || '',
        staff,
        a.countTotal ?? 0,
        a.countMale ?? 0,
        a.countFemale ?? 0,
        a.countDiverse ?? 0,
        a.notes || '',
        cohortsJson,
      ];
    });
  const rawSheet = utils.aoa_to_sheet([rawHeader, ...rawRows]) as WorkSheet;
  // Autofilter and reasonable column widths
  rawSheet['!autofilter'] = { ref: `A1:${utils.encode_col(rawHeader.length - 1)}1` };
  const rawCols: ColInfo[] = rawHeader.map((h, i) => ({ wch: Math.max(12, (i < 2 ? 18 : 0), h.length + 2) }));
  rawSheet['!cols'] = rawCols;

    // Consolidated sheet
    const matrix = buildConsolidatedMatrixExcel();
    const consSheet = utils.aoa_to_sheet(matrix) as WorkSheet;
    // Merges to create group headers in row 1
    const consHeaderTop = matrix[0] as string[];
    const consHeaderSub = matrix[1] as string[];
    const genderStart = 5; const genderEnd = 7; // F..H
    const cohortStart = 9; const cohortEnd = consHeaderSub.length - 1; // J..last
    const merges = [] as Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
    if (genderEnd >= genderStart) merges.push({ s: { r: 0, c: genderStart }, e: { r: 0, c: genderEnd } });
    if (cohortEnd >= cohortStart) merges.push({ s: { r: 0, c: cohortStart }, e: { r: 0, c: cohortEnd } });
    consSheet['!merges'] = merges;

    // Autofilter on the second header row (row 2 in Excel)
    consSheet['!autofilter'] = { ref: `A2:${utils.encode_col(consHeaderSub.length - 1)}2` };

    // Column widths (spacer column narrower)
    const consCols: ColInfo[] = consHeaderSub.map((h, i) => ({ wch: i === 8 ? 3 : (i <= 2 ? 22 : Math.max(10, h.length + 2)) }));
    consSheet['!cols'] = consCols;

    // Optional styling (may be ignored by some Excel writers, but supported in many viewers)
    const setCellStyle = (r: number, c: number, style: Record<string, unknown>) => {
      const addr = utils.encode_cell({ r, c });
      const cell = consSheet[addr] as unknown as { s?: Record<string, unknown> } | undefined;
      if (cell) {
        cell.s = { ...(cell.s || {}), ...style };
      }
    };
    // Bold header text
    for (let c = 0; c < consHeaderSub.length; c++) {
      setCellStyle(1, c, { font: { bold: true } });
    }
    // Shade gender header (F2..H2) light gray and cohorts (J2..last) light green; also group titles in row 1
    const grayFill = { fill: { patternType: 'solid', fgColor: { rgb: 'FFF2F2F2' } } };
    const greenFill = { fill: { patternType: 'solid', fgColor: { rgb: 'FFE8F5E9' } } };
    for (let c = genderStart; c <= genderEnd; c++) setCellStyle(1, c, grayFill);
    for (let c = cohortStart; c <= cohortEnd; c++) setCellStyle(1, c, greenFill);
    // Group titles (row 0)
    if (consHeaderTop[genderStart]) setCellStyle(0, genderStart, { font: { bold: true }, ...grayFill });
    if (consHeaderTop[cohortStart]) setCellStyle(0, cohortStart, { font: { bold: true }, ...greenFill });

    const wb = utils.book_new();
    utils.book_append_sheet(wb, rawSheet, 'Rohdaten');
    utils.book_append_sheet(wb, consSheet, 'Konsolidiert');
    writeFile(wb, `stato-export-${from}-bis-${to}.xlsx`);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => currentYear - 6 + i);
  const months = [
    { value: 0, label: 'Ganzes Jahr' },
    { value: 1, label: 'Januar' },
    { value: 2, label: 'Februar' },
    { value: 3, label: 'März' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Dezember' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Datenexport" maxWidth="lg">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-gray-600">
            Jahr
            <select className="block mt-1 border rounded px-2 py-1" value={year} onChange={(e)=> setYear(parseInt(e.target.value,10))}>
              {years.map((y)=> <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="text-sm text-gray-600">
            Monat
            <select className="block mt-1 border rounded px-2 py-1" value={month} onChange={(e)=> setMonth(parseInt(e.target.value,10))}>
              {months.map((m)=> <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
        </div>
        <div className="text-xs text-gray-500">Zeitraum: {from} bis {to} · Aktivitäten: {activities.length}</div>
        <div>
          <h4 className="font-semibold text-viridian mb-1">Rohdaten (CSV)</h4>
          <p className="text-sm text-gray-600 mb-3">Alle Felder je Aktivität. Geeignet für eigene Auswertungen.</p>
          <button className="px-4 py-2 rounded bg-viridian text-white hover:bg-cambridge-blue" onClick={downloadRaw}>
            CSV herunterladen
          </button>
        </div>
        <div className="border-t pt-4">
          <h4 className="font-semibold text-viridian mb-1">Konsolidiert (CSV)</h4>
          <p className="text-sm text-gray-600 mb-3">Gruppiert nach Projekt mit Anzahl, durchschnittlicher Dauer, Ø m/w/d und Ø je Alterskohorte.</p>
          <button className="px-4 py-2 rounded bg-cambridge-blue text-white hover:bg-viridian" onClick={downloadConsolidated}>
            CSV herunterladen
          </button>
        </div>
        <div className="border-t pt-4">
          <h4 className="font-semibold text-viridian mb-1">Excel (XLSX)</h4>
          <p className="text-sm text-gray-600 mb-3">Zwei Blätter: Rohdaten und Konsolidiert. Bessere Darstellung in Excel.</p>
          <button className="px-4 py-2 rounded bg-azure-web text-viridian hover:bg-mint-green" onClick={downloadExcel}>
            XLSX herunterladen
          </button>
        </div>
      </div>
    </Modal>
  );
}
