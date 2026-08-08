export type StoredProjectsFilters = {
  showArchived: boolean;
  types: string[];
};

const STORAGE_KEY = 'projects:filters:v1';

const DEFAULT_FILTERS: StoredProjectsFilters = {
  showArchived: false,
  types: [],
};

export function loadProjectsFilters(): StoredProjectsFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : undefined;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_FILTERS };

    const filters = parsed as Record<string, unknown>;
    return {
      showArchived: filters.showArchived === true,
      types: Array.isArray(filters.types)
        ? [...new Set(filters.types.filter((type): type is string => typeof type === 'string'))]
        : [],
    };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

export function saveProjectsFilters(filters: StoredProjectsFilters): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* ignore */
  }
}
