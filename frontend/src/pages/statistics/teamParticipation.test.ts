import { describe, expect, it } from 'vitest';
import { teamParticipation } from './teamParticipation';

describe('team participation', () => {
  it('adds completed assignments across days and types, keeping people with equal names separate', () => {
    expect(teamParticipation([
      { staffId: 'a', name: 'Alex', status: 'completed', assignments: 2 },
      { staffId: 'b', name: 'Alex', status: 'completed', assignments: 1 },
      { staffId: 'a', name: 'Alex', status: 'completed', assignments: 3 },
      { staffId: 'a', name: 'Alex', status: 'planned', assignments: 20 },
      { staffId: 'b', name: 'Alex', status: 'cancelled', assignments: 10 },
    ])).toEqual([
      { staffId: 'a', name: 'Alex', value: 5 },
      { staffId: 'b', name: 'Alex', value: 1 },
    ]);
  });

  it('has no slices for empty selections or selections without completed assignments', () => {
    expect(teamParticipation([])).toEqual([]);
    expect(teamParticipation([
      { staffId: 'a', name: 'Anna', status: 'planned', assignments: 2 },
      { staffId: 'b', name: 'Max', status: 'completed', assignments: 0 },
    ])).toEqual([]);
  });
});
