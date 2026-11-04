import type { Project } from './projects';

export function projectStaffNames(project: Project): string[] {
  return [...new Set([project.defaultStaff, project.defaultVolunteers]
    .flatMap(value => (value || '').split(','))
    .map(name => name.trim()).filter(Boolean))];
}

export function matchesProjectFilters(project: Project, filters: {
  types: string[]; staffNames: string[]; categoryIds: string[];
}): boolean {
  const categories = new Set([project.categoryId, ...(project.categories || []).map(category => category.id)]);
  return (!filters.types.length || filters.types.includes(project.type))
    && (!filters.staffNames.length || projectStaffNames(project).some(name => filters.staffNames.includes(name)))
    && (!filters.categoryIds.length || filters.categoryIds.some(id => categories.has(id)));
}
