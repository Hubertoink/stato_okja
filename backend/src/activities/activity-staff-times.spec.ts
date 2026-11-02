import { validateActivityStaffTimes } from './activity-staff-times';
import { normalizeActivityMetrics } from './activity-metrics';
import type { Activity } from './entities/activity.entity';

const makeActivity = (minutes: number): Partial<Activity> => ({
  durationMinutes: 120,
  staff: [{ id: 'anna' }] as Activity['staff'],
  staffTimes: [{ staffId: 'anna', minutes }],
});
describe('individual staff times', () => {
  it.each([0, 45, 120])('accepts %s minutes within the activity', (minutes) => {
    const activity = makeActivity(minutes);
    validateActivityStaffTimes(activity);
    expect(activity.staffTimes![0].minutes).toBe(minutes);
  });
  it.each([-1, 121, 1.5, NaN])('rejects invalid minutes %s', (minutes) =>
    expect(() => validateActivityStaffTimes(makeActivity(minutes))).toThrow(),
  );
  it('requires explicit correction when the activity is shortened', () => {
    const activity = { ...makeActivity(120), startTime: '11:00', endTime: '12:00' };
    normalizeActivityMetrics(activity);
    expect(() => validateActivityStaffTimes(activity)).toThrow('Aktivitätsdauer');
  });
  it('removes overrides for deselected staff', () => {
    const activity = { ...makeActivity(45), staff: [] };
    validateActivityStaffTimes(activity);
    expect(activity.staffTimes).toEqual([]);
  });
  it('rejects duplicate overrides', () => {
    const activity = makeActivity(45);
    activity.staffTimes!.push({ staffId: 'anna', minutes: 30 });
    expect(() => validateActivityStaffTimes(activity)).toThrow();
  });
});
