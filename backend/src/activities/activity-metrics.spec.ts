import {
  calculateActivityDurationMinutes,
  normalizeActivityMetrics,
} from './activity-metrics';

describe('activity metric invariants', () => {
  it('always derives countTotal from the gender counts', () => {
    const activity = {
      countMale: 7,
      countFemale: 8,
      countDiverse: 1,
      countTotal: 999,
    };

    normalizeActivityMetrics(activity);

    expect(activity).toMatchObject({
      countMale: 7,
      countFemale: 8,
      countDiverse: 1,
      countTotal: 16,
    });
  });

  it('derives duration from the time range instead of trusting stale input', () => {
    const activity = {
      startTime: '14:15',
      endTime: '17:45',
      durationMinutes: 5,
    };

    normalizeActivityMetrics(activity);

    expect(activity.durationMinutes).toBe(210);
  });

  it('supports activities that end after midnight', () => {
    expect(calculateActivityDurationMinutes('22:30', '01:00')).toBe(150);
  });

  it('keeps an explicit duration when the time range is incomplete', () => {
    const activity = { startTime: null, endTime: null, durationMinutes: 90 };

    normalizeActivityMetrics(activity);

    expect(activity.durationMinutes).toBe(90);
  });
});
