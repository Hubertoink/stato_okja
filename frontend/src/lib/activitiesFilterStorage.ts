import type { ActivitiesFilter } from './activities';

export type ActivitiesFilterOrder = 'asc' | 'desc';

export type StoredActivitiesFilters = {
  advanced: ActivitiesFilter;
  order: ActivitiesFilterOrder;
  search: string;
};

export type ActivitiesPrefetchParams = {
  params: ActivitiesFilter;
  page: number;
  limit: number;
};

const ADVANCED_FILTERS_KEY = 'activities:advancedFilters:v1';
const ORDER_KEY = 'activities:order:v1';
const COMBINED_FILTERS_KEY = 'activitiesFilters_v1';

const DEFAULT_FILTERS: StoredActivitiesFilters = {
  advanced: {},
  order: 'desc',
  search: '',
};

function readJsonObject(key: string): Record<string, unknown> | undefined {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : undefined;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function readAdvancedFilters(): ActivitiesFilter {
  return (readJsonObject(ADVANCED_FILTERS_KEY) as ActivitiesFilter | undefined) || {};
}

function readOrder(): ActivitiesFilterOrder {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    return raw === 'asc' ? 'asc' : 'desc';
  } catch {
    return 'desc';
  }
}

export function loadActivitiesFilters(): StoredActivitiesFilters {
  const result: StoredActivitiesFilters = {
    advanced: readAdvancedFilters(),
    order: readOrder(),
    search: '',
  };

  const combined = readJsonObject(COMBINED_FILTERS_KEY);
  if (combined?.advanced && typeof combined.advanced === 'object' && !Array.isArray(combined.advanced)) {
    result.advanced = combined.advanced as ActivitiesFilter;
  }
  if (combined?.order === 'asc' || combined?.order === 'desc') {
    result.order = combined.order;
  }
  if (typeof combined?.search === 'string') {
    result.search = combined.search;
  }

  return result;
}

export function saveActivitiesFilters(filters: StoredActivitiesFilters): void {
  try {
    localStorage.setItem(ADVANCED_FILTERS_KEY, JSON.stringify(filters.advanced));
    localStorage.setItem(ORDER_KEY, filters.order);
    localStorage.setItem(COMBINED_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    /* ignore */
  }
}

export function clearActivitiesFilters(): StoredActivitiesFilters {
  try {
    localStorage.removeItem(ADVANCED_FILTERS_KEY);
    localStorage.removeItem(ORDER_KEY);
    localStorage.removeItem(COMBINED_FILTERS_KEY);
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_FILTERS };
}

export function getActivitiesPrefetchParams(): ActivitiesPrefetchParams {
  const { advanced, order } = loadActivitiesFilters();
  return { params: { ...advanced, order }, page: 1, limit: 50 };
}
