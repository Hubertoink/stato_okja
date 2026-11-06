import { validateActivityContributions } from './activity-contributions';
import { ActivityExecutionStatus } from '../common/enums';
import type { Contributor } from '../contributors/contributor.entity';

describe('activity contributions', () => {
  const person: Contributor = { id: 'person', name: 'Lea', color: '#7aa39a', active: true, orgId: 'org-a' };
  const entry = { contributorId: person.id, minutes: 45 };
  const activity = () => ({ orgId: 'org-a', durationMinutes: 120, executionStatus: ActivityExecutionStatus.COMPLETED, contributions: [entry] });

  it('accepts an explicit duration without changing participant or staff totals', async () => {
    const value = { ...activity(), countTotal: 9, staffTimes: [{ staffId: 'staff', minutes: 120 }] };
    const before = structuredClone(value);
    await validateActivityContributions(value, async () => [person]);
    expect(value).toEqual(before);
  });

  it.each([0, -1, 121, 1441, 1.5, NaN])('rejects invalid duration %s', async minutes => {
    await expect(validateActivityContributions({ ...activity(), contributions: [{ ...entry, minutes }] }, async () => [person])).rejects.toThrow();
  });

  it('rejects duplicate people, missing people and foreign organizations', async () => {
    await expect(validateActivityContributions({ ...activity(), contributions: [entry, entry] }, async () => [person])).rejects.toThrow();
    await expect(validateActivityContributions(activity(), async () => [])).rejects.toThrow();
    await expect(validateActivityContributions(activity(), async () => [{ ...person, orgId: 'org-b' }])).rejects.toThrow();
  });

  it('preserves archived assignments but rejects new assignments of archived people', async () => {
    const load = async () => [{ ...person, active: false }];
    await expect(validateActivityContributions(activity(), load)).rejects.toThrow();
    await expect(validateActivityContributions(activity(), load, [entry])).resolves.toBeUndefined();
  });

  it.each([ActivityExecutionStatus.PLANNED, ActivityExecutionStatus.CANCELLED])('does not credit %s activities', async executionStatus => {
    await expect(validateActivityContributions({ ...activity(), executionStatus }, async () => [person])).rejects.toThrow();
  });

  it('allows explicitly clearing contributions', async () => {
    const load = jest.fn();
    await validateActivityContributions({ ...activity(), contributions: [] }, load, [entry]);
    expect(load).not.toHaveBeenCalled();
  });
});
