export type ActivityCategoryMode = 'single' | 'multiple';

export const SINGLE_CATEGORY_MESSAGE = 'Pro Aktivität ist nur eine Kategorie erlaubt. Bitte eine Kategorie auswählen.';

export function selectActivityCategory(ids: string[] = [], id: string, mode: ActivityCategoryMode, toggle = true): string[] {
  if (toggle && ids.includes(id)) return ids.filter((value) => value !== id);
  return mode === 'single' ? [id] : Array.from(new Set([...ids, id]));
}

// Keep an existing activity selection when applying the project's category.
export function mergeActivityCategoryDefaults(ids: string[] = [], defaults: string[], mode: ActivityCategoryMode): string[] {
  if (mode === 'single') return ids.length ? ids : defaults.length === 1 ? defaults : [];
  return Array.from(new Set([...ids, ...defaults]));
}
