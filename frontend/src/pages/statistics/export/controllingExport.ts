import type { Activity } from '@/lib/activities';
import type { LogbookEntry } from '@/lib/logbook';
import type { Cohort } from '@/lib/taxonomy';
import { colorForActivityType } from '@/lib/colors';
import { formatWeeklyProfileTime, type WeeklyProfile } from '@/lib/weeklyProfile';
import { autoT } from '@/i18n/auto';
import type { ControllingExportRow } from '../types';
import {
  formatActivityDateGerman,
  getActivityDurationMinutes,
  getActivityParticipantTotal,
} from './activitiesExport';

type Project = { id: string; title?: string | null };
type CellStyle = {
  font?: { bold?: boolean; color?: { rgb: string } };
  fill?: { patternType: 'solid'; fgColor: { rgb: string } };
  alignment?: { horizontal?: 'left' | 'center'; vertical?: 'top' | 'center'; wrapText?: boolean };
};

export async function exportControllingDataAsExcel({
  activities,
  cohorts,
  projects,
  weeklyProfile,
  exportRangeLabel,
  fileName,
  fetchLogbookEntries,
  getTypeLabel,
  onProgress,
}: {
  activities: Activity[];
  cohorts: Cohort[];
  projects: Project[];
  weeklyProfile?: WeeklyProfile;
  exportRangeLabel: string;
  fileName: string;
  fetchLogbookEntries: () => Promise<LogbookEntry[]>;
  getTypeLabel: (type?: string | null) => string;
  onProgress: (message: string) => void;
}) {
  onProgress(autoT('ui_2395ed5ba683'));
  await new Promise(requestAnimationFrame);
  const xlsx = await import('xlsx-js-style');
  const { utils, writeFile } = xlsx as unknown as typeof import('xlsx-js-style');
  const rows = activities as ControllingExportRow[];
  const cohortOrder = cohorts
    .slice()
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
  const cohortIds = cohortOrder.map((cohort) => cohort.id);
  const cohortHeaders = cohortOrder.flatMap((cohort) => [
    `${cohort.name} (m)`,
    `${cohort.name} (w)`,
    `${cohort.name} (d)`,
  ]);
  const duration = (activity: ControllingExportRow) => getActivityDurationMinutes(activity) ?? '';
  const activityRows: Array<Array<string | number>> = [
    [
      autoT('ui_df5c3008c765'),
      autoT('ui_bae7d5be7082'),
      autoT('ui_edcaf9aaa282'),
      autoT('ui_950701e758d1'),
      autoT('ui_20bda6d2e725'),
      autoT('ui_a8a4d6b019af'),
      autoT('ui_6b0d31c0d563'),
      autoT('ui_aff024fe4ab0'),
      autoT('ui_3c363836cf4e'),
      ...cohortHeaders,
      autoT('ui_d62550d402f1'),
      autoT('ui_4e1e15e17610'),
      autoT('ui_848eed0fbd54'),
      autoT('ui_7e458d013900'),
    ],
    ...rows.map((activity) => {
      const perCohort: Record<string, { m: number; w: number; d: number }> = Object.fromEntries(
        cohortIds.map((id) => [id, { m: 0, w: 0, d: 0 }] as const),
      );
      (activity.cohorts || []).forEach((cohort) => {
        perCohort[cohort.cohortId] = {
          m: (perCohort[cohort.cohortId]?.m || 0) + (cohort.m || 0),
          w: (perCohort[cohort.cohortId]?.w || 0) + (cohort.w || 0),
          d: (perCohort[cohort.cohortId]?.d || 0) + (cohort.d || 0),
        };
      });
      return [
        formatActivityDateGerman(activity.date),
        activity.executionStatus === 'cancelled' ? 'Ausgefallen' : autoT('ui_f91abe615749'),
        getTypeLabel(activity.type),
        activity.title || '',
        activity.project?.title || '',
        getActivityParticipantTotal(activity),
        activity.countMale || 0,
        activity.countFemale || 0,
        activity.countDiverse || 0,
        ...cohortIds.flatMap((id) => {
          const cohort = perCohort[id] || { m: 0, w: 0, d: 0 };
          return [cohort.m, cohort.w, cohort.d];
        }),
        duration(activity),
        activity.project?.type === 'open_door'
          ? ''
          : (activity.categories || []).map((category) => category.name).join(', '),
        (activity.tags || []).map((tag) => tag.name).join(', '),
        activity.notes || '',
      ];
    }),
  ];
  const statusCol = 1;
  const typeCol = 2;
  const firstNumberCol = 5;
  const durationCol = 9 + cohortHeaders.length;
  const categoriesCol = durationCol + 1;
  const tagsCol = durationCol + 2;
  const notesCol = durationCol + 3;
  const activitySheet = utils.aoa_to_sheet(activityRows);
  (activitySheet as unknown as { ['!autofilter']?: { ref: string } })['!autofilter'] = {
    ref: `A1:${utils.encode_col(activityRows[0].length - 1)}1`,
  };
  activitySheet['!cols'] = activityRows[0].map((header, index) => {
    if (index === 0) return { wch: 14 };
    if (index === statusCol) return { wch: 16 };
    if (index === typeCol) return { wch: 22 };
    if (index === 3 || index === 4) return { wch: 28 };
    if (index === categoriesCol || index === tagsCol) return { wch: 30 };
    if (index === notesCol) return { wch: 42 };
    return { wch: Math.max(10, String(header).length + 2) };
  });
  const setStyle = (
    sheet: typeof activitySheet,
    rowIndex: number,
    colIndex: number,
    style: CellStyle,
  ) => {
    const cell = sheet[utils.encode_cell({ r: rowIndex, c: colIndex })] as unknown as
      { s?: CellStyle } | undefined;
    if (!cell) return;
    cell.s = {
      ...(cell.s || {}),
      ...style,
      font: { ...(cell.s?.font || {}), ...(style.font || {}) },
      fill: style.fill || cell.s?.fill,
      alignment: { ...(cell.s?.alignment || {}), ...(style.alignment || {}) },
    };
  };
  const styleHeader = (sheet: typeof activitySheet, columnCount: number) => {
    for (let column = 0; column < columnCount; column++)
      setStyle(sheet, 0, column, {
        font: { bold: true, color: { rgb: 'FFFFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'FF5B6CFF' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      });
  };
  styleHeader(activitySheet, activityRows[0].length);
  for (let rowIndex = 1; rowIndex < activityRows.length; rowIndex++) {
    setStyle(activitySheet, rowIndex, 0, {
      alignment: { horizontal: 'center', vertical: 'center' },
    });
    const isCancelled = String(activityRows[rowIndex][statusCol] ?? '') === 'Ausgefallen';
    setStyle(activitySheet, rowIndex, statusCol, {
      font: { bold: true, color: { rgb: isCancelled ? 'FFB42318' : 'FF027A48' } },
      fill: { patternType: 'solid', fgColor: { rgb: isCancelled ? 'FFFDECEC' : 'FFEAF7EE' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
    const typeRgb = `FF${colorForActivityType(rows[rowIndex - 1].type)
      .replace('#', '')
      .toUpperCase()}`;
    setStyle(activitySheet, rowIndex, typeCol, {
      font: { bold: true, color: { rgb: 'FFFFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: typeRgb } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    });
    for (let column = firstNumberCol; column <= durationCol; column++)
      setStyle(activitySheet, rowIndex, column, {
        alignment: { horizontal: 'center', vertical: 'center' },
      });
    for (const [column, color] of [
      [categoriesCol, 'FFF5F7FF'],
      [tagsCol, 'FFE8EBFF'],
      [notesCol, 'FFF8FAFC'],
    ] as const)
      if (activityRows[rowIndex][column])
        setStyle(activitySheet, rowIndex, column, {
          fill: { patternType: 'solid', fgColor: { rgb: color } },
          alignment: { vertical: 'top', wrapText: true },
        });
  }
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, activitySheet, autoT('ui_b6bf5f1a2033'));
  const usedSheetNames = new Set<string>([autoT('ui_b6bf5f1a2033')]);
  const uniqueSheetName = (value: string) => {
    const base = (value.replace(/[\\/?*[\]:]/g, ' ').trim() || autoT('ui_20bda6d2e725')).slice(
      0,
      31,
    );
    let name = base;
    let suffix = 2;
    while (usedSheetNames.has(name)) {
      name = `${base.slice(0, Math.max(1, 31 - String(suffix).length - 1))} ${suffix}`;
      suffix += 1;
    }
    usedSheetNames.add(name);
    return name;
  };
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const activitiesByProject = new Map<string, ControllingExportRow[]>();
  rows.forEach((activity) => {
    if (!activity.projectId) return;
    const projectActivities = activitiesByProject.get(activity.projectId) || [];
    projectActivities.push(activity);
    activitiesByProject.set(activity.projectId, projectActivities);
  });
  for (const [id, projectActivities] of activitiesByProject) {
    const totalParticipants = projectActivities.reduce(
      (sum, activity) => sum + getActivityParticipantTotal(activity),
      0,
    );
    const totalMale = projectActivities.reduce(
      (sum, activity) => sum + (activity.countMale || 0),
      0,
    );
    const totalFemale = projectActivities.reduce(
      (sum, activity) => sum + (activity.countFemale || 0),
      0,
    );
    const totalDiverse = projectActivities.reduce(
      (sum, activity) => sum + (activity.countDiverse || 0),
      0,
    );
    const durations = projectActivities
      .map(duration)
      .filter((value): value is number => typeof value === 'number');
    const project = projectsById.get(id);
    const ratio =
      totalParticipants > 0
        ? `${Math.round((totalMale / totalParticipants) * 100)} % m · ${Math.round((totalFemale / totalParticipants) * 100)} % w · ${Math.round((totalDiverse / totalParticipants) * 100)} % d`
        : autoT('ui_f489591ec2c6');
    const projectRows: Array<Array<string | number>> = [
      [autoT('ui_5347abc77ca3'), autoT('ui_9d3fb5bb5707')],
      [
        autoT('ui_20bda6d2e725'),
        project?.title || projectActivities[0].project?.title || autoT('ui_7ad11e328f86'),
      ],
      [autoT('ui_fe359159c8ad'), exportRangeLabel],
      [autoT('ui_b6bf5f1a2033'), projectActivities.length],
      [autoT('ui_59c83f1c873f'), totalParticipants],
      [
        'Ø Teilnahmen / Aktivität',
        projectActivities.length
          ? Math.round((totalParticipants / projectActivities.length) * 10) / 10
          : 0,
      ],
      [autoT('ui_0f4989b791e1'), ratio],
      [
        'Ø Dauer (min)',
        durations.length
          ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) /
            10
          : '–',
      ],
      [],
      [
        autoT('ui_df5c3008c765'),
        autoT('ui_edcaf9aaa282'),
        autoT('ui_950701e758d1'),
        autoT('ui_a8a4d6b019af'),
        autoT('ui_6b0d31c0d563'),
        autoT('ui_aff024fe4ab0'),
        autoT('ui_3c363836cf4e'),
        autoT('ui_d62550d402f1'),
      ],
      ...projectActivities.map((activity) => [
        formatActivityDateGerman(activity.date),
        getTypeLabel(activity.type),
        activity.title || '',
        getActivityParticipantTotal(activity),
        activity.countMale || 0,
        activity.countFemale || 0,
        activity.countDiverse || 0,
        duration(activity),
      ]),
    ];
    const projectSheet = utils.aoa_to_sheet(projectRows);
    styleHeader(projectSheet, 2);
    for (let column = 0; column < 8; column++)
      setStyle(projectSheet, 9, column, {
        font: { bold: true, color: { rgb: 'FFFFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'FF5B6CFF' } },
      });
    projectSheet['!cols'] = [
      { wch: 20 },
      { wch: 26 },
      { wch: 30 },
      { wch: 16 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 14 },
    ];
    utils.book_append_sheet(
      workbook,
      projectSheet,
      uniqueSheetName(
        project?.title || projectActivities[0].project?.title || autoT('ui_20bda6d2e725'),
      ),
    );
  }
  onProgress(autoT('ui_eb5ec187a1c8'));
  const logbookEntries = await fetchLogbookEntries();
  const logbookRows: Array<Array<string | number>> = [
    [
      autoT('ui_df5c3008c765'),
      autoT('ui_edcaf9aaa282'),
      autoT('ui_950701e758d1'),
      autoT('ui_bae7d5be7082'),
      autoT('ui_20bda6d2e725'),
      autoT('ui_d28fd7140d15'),
      autoT('ui_1f9c9c4e9b69'),
      autoT('ui_24cb5c6fa8e6'),
      autoT('ui_76231e1d047c'),
    ],
    ...logbookEntries.map((entry) => [
      formatActivityDateGerman(entry.occurredAt),
      entry.type,
      entry.title,
      entry.status,
      entry.project?.title || '',
      entry.body || '',
      entry.highlights || '',
      entry.challenges || '',
      entry.nextSteps || '',
    ]),
  ];
  const logbookSheet = utils.aoa_to_sheet(logbookRows);
  styleHeader(logbookSheet, logbookRows[0].length);
  (logbookSheet as unknown as { ['!autofilter']?: { ref: string } })['!autofilter'] = {
    ref: `A1:${utils.encode_col(logbookRows[0].length - 1)}1`,
  };
  logbookSheet['!cols'] = [
    { wch: 14 },
    { wch: 15 },
    { wch: 30 },
    { wch: 16 },
    { wch: 26 },
    { wch: 50 },
    { wch: 32 },
    { wch: 32 },
    { wch: 32 },
  ];
  utils.book_append_sheet(workbook, logbookSheet, uniqueSheetName('Logbuch'));
  if (weeklyProfile) {
    const dayLabels: Record<number, string> = {
      0: 'So',
      1: 'Mo',
      2: 'Di',
      3: 'Mi',
      4: 'Do',
      5: 'Fr',
      6: 'Sa',
    };
    const weeklyRows: Array<Array<string | number>> = [
      [
        'Wochentag',
        'Zeitfenster',
        'Angebotsminuten',
        'Abgedeckte Minuten',
        'Ø Angebote parallel',
        'Abdeckungsquote',
        'Angebote',
        'Ø Besucher:innen je Angebot',
      ],
      ...weeklyProfile.slots.map((slot) => [
        dayLabels[slot.weekday],
        `${formatWeeklyProfileTime(slot.startMinute)}–${formatWeeklyProfileTime(slot.endMinute)}`,
        slot.activityMinutes,
        slot.coveredMinutes,
        Number(slot.averageOffers.toFixed(2)),
        `${Math.round(slot.coverageFrequency * 100)} %`,
        slot.activityCount,
        slot.averageParticipants,
      ]),
    ];
    const weeklySheet = utils.aoa_to_sheet(weeklyRows);
    styleHeader(weeklySheet, weeklyRows[0].length);
    weeklySheet['!cols'] = [
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
      { wch: 16 },
      { wch: 12 },
      { wch: 24 },
    ];
    utils.book_append_sheet(workbook, weeklySheet, uniqueSheetName('Wochenprofil'));
  }
  onProgress(autoT('ui_69d8049e6f66'));
  await new Promise(requestAnimationFrame);
  writeFile(workbook, fileName);
}
