import { afterEach, describe, expect, it } from 'vitest';
import { loadProjectsFilters, saveProjectsFilters } from './projectsFilterStorage';

describe('projectsFilterStorage', () => {
  afterEach(() => localStorage.clear());

  it('returns the default filters when nothing is stored', () => {
    expect(loadProjectsFilters()).toEqual({ showArchived: false, types: [] });
  });

  it('stores and restores the archive and type filters', () => {
    saveProjectsFilters({ showArchived: true, types: ['event', 'project_open'] });

    expect(loadProjectsFilters()).toEqual({
      showArchived: true,
      types: ['event', 'project_open'],
    });
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem('projects:filters:v1', JSON.stringify({
      showArchived: 'true',
      types: ['event', 5, 'event'],
    }));

    expect(loadProjectsFilters()).toEqual({ showArchived: false, types: ['event'] });
  });
});
