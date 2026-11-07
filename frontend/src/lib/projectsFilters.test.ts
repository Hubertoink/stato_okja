import { describe, expect, it } from 'vitest';
import type { Project } from './projects';
import { matchesProjectFilters, projectStaffNames } from './projectsFilters';

const project: Project = {
  id: '1', title: 'Treff', type: 'open_door', defaultStaff: ' Mara Nguyen, Tom Becker ',
  defaultVolunteers: 'Lea Sommer, Mara Nguyen', categoryId: 'legacy',
  categories: [{ id: 'music', name: 'Musik' }, { id: 'sport', name: 'Sport' }],
};
const empty = { types: [], staffNames: [], categoryIds: [] };

describe('project filters', () => {
  it('matches exact team names including volunteers, trims and deduplicates names', () => {
    expect(projectStaffNames(project)).toEqual(['Mara Nguyen', 'Tom Becker', 'Lea Sommer']);
    expect(matchesProjectFilters(project, { ...empty, staffNames: ['Lea Sommer'] })).toBe(true);
    expect(matchesProjectFilters(project, { ...empty, staffNames: ['Mara'] })).toBe(false);
  });
  it('combines groups with AND and selections within a group with OR', () => {
    expect(matchesProjectFilters(project, { types: ['event', 'open_door'], staffNames: ['Other', 'Tom Becker'], categoryIds: ['music', 'other'] })).toBe(true);
    expect(matchesProjectFilters(project, { ...empty, staffNames: ['Tom Becker'], categoryIds: ['other'] })).toBe(false);
    expect(matchesProjectFilters(project, { ...empty, types: ['event'] })).toBe(false);
  });
  it('supports legacy and multiple categories as well as projects without assignments', () => {
    expect(matchesProjectFilters(project, { ...empty, categoryIds: ['legacy'] })).toBe(true);
    expect(matchesProjectFilters(project, { ...empty, categoryIds: ['sport'] })).toBe(true);
    const unassigned = { id: '2', title: 'Neu', type: 'event' };
    expect(matchesProjectFilters(unassigned, empty)).toBe(true);
    expect(matchesProjectFilters(unassigned, { ...empty, staffNames: ['Tom Becker'] })).toBe(false);
  });
});
