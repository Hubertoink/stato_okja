import { describe, expect, it } from 'vitest';
import type { Activity } from '@/lib/activities';
import {
  formatActivityDateGerman,
  getActivityDurationMinutes,
  getActivityParticipantTotal,
  toActivityExportRows,
} from './activitiesExport';

describe('activitiesExport helpers', () => {
  it('uses recorded totals and derives a duration from start and end time', () => {
    const activity = {
      date: '2026-08-14',
      type: 'event',
      title: 'Sommerfest',
      startTime: '13:30',
      endTime: '15:00',
      countTotal: 24,
      countMale: 8,
      countFemale: 13,
      countDiverse: 3,
      project: { title: 'Jugendtreff' },
    } as Activity;

    expect(getActivityParticipantTotal(activity)).toBe(24);
    expect(getActivityDurationMinutes(activity)).toBe(90);
    expect(
      toActivityExportRows([activity], (type) => (type === 'event' ? 'Veranstaltung' : '')),
    ).toEqual([
      {
        date: '14.08.2026',
        type: 'Veranstaltung',
        title: 'Sommerfest',
        project: 'Jugendtreff',
        total: 24,
        male: 8,
        female: 13,
        diverse: 3,
        duration: 90,
      },
    ]);
  });

  it('falls back to gender counts and keeps malformed dates unchanged', () => {
    const activity = { countMale: 2, countFemale: 3, countDiverse: 1 } as Activity;

    expect(getActivityParticipantTotal(activity)).toBe(6);
    expect(
      getActivityDurationMinutes({ ...activity, startTime: '17:00', endTime: '16:00' }),
    ).toBeUndefined();
    expect(formatActivityDateGerman('2026')).toBe('2026');
  });
});
