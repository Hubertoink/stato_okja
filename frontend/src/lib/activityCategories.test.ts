import { describe, expect, it } from 'vitest';
import { mergeActivityCategoryDefaults, selectActivityCategory } from './activityCategories';
import { getProjectCategoryIds } from '@/pages/activityEditorShared';
import type { Project } from '@/lib/projects';

describe('activity category selection', () => {
  it('replaces, clears and adds categories according to the mode', () => {
    expect(selectActivityCategory(['a'], 'b', 'single')).toEqual(['b']);
    expect(selectActivityCategory(['a'], 'a', 'single')).toEqual([]);
    expect(selectActivityCategory(['a'], 'b', 'multiple')).toEqual(['a', 'b']);
    expect(selectActivityCategory(['a'], 'a', 'single', false)).toEqual(['a']);
    expect(selectActivityCategory(['a'], 'b', 'single', false)).toEqual(['b']);
  });

  it('preserves existing activity assignments when applying defaults', () => {
    expect(mergeActivityCategoryDefaults([], ['a', 'b'], 'single')).toEqual([]);
    expect(mergeActivityCategoryDefaults([], ['a'], 'single')).toEqual(['a']);
    expect(mergeActivityCategoryDefaults(['a', 'b'], ['c'], 'single')).toEqual(['a', 'b']);
    expect(mergeActivityCategoryDefaults(['a'], ['a', 'b'], 'multiple')).toEqual(['a', 'b']);
  });

  it('uses only the single project category, preferring categoryId over legacy relations', () => {
    const project = { type: 'event', categoryId: 'primary', categories: [{ id: 'legacy' }] } as Project;
    expect(getProjectCategoryIds(project)).toEqual(['primary']);
    expect(getProjectCategoryIds({ ...project, categoryId: null })).toEqual(['legacy']);
    expect(getProjectCategoryIds({ ...project, type: 'open_door' })).toEqual([]);
  });
});
