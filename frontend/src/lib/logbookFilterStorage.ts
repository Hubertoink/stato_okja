import type { LogbookFilters } from './logbook';

export type LogbookAdvancedFilters = Pick<
  LogbookFilters,
  'from' | 'to' | 'type' | 'status' | 'projectId' | 'includeArchived'
>;

type StoredLogbookFilters = {
  search: string;
  advanced: LogbookAdvancedFilters;
};

const STORAGE_KEY = 'stato_logbook_filters_v1';

const empty: StoredLogbookFilters = { search: '', advanced: {} };

export function loadLogbookFilters(): StoredLogbookFilters {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) || 'null',
    ) as Partial<StoredLogbookFilters> | null;
    if (!parsed || typeof parsed !== 'object') return empty;
    return {
      search: typeof parsed.search === 'string' ? parsed.search : '',
      advanced: parsed.advanced && typeof parsed.advanced === 'object' ? parsed.advanced : {},
    };
  } catch {
    return empty;
  }
}

export function saveLogbookFilters(value: StoredLogbookFilters) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Filtering must continue to work when browser storage is unavailable.
  }
}
