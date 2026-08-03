export type DashboardTrendPeriod = 'week' | 'month' | 'year';

export type StatisticsViewPreferences = {
  from?: string;
  to?: string;
  projectId?: string;
  selectedType?: string;
  selectedYear?: string;
  selectedMonth?: number | null;
  filterMode?: 'year' | 'month';
};

const DASHBOARD_VIEW_PREFERENCES_KEY = 'stato:dashboard-view-preferences:v1';
const STATISTICS_VIEW_PREFERENCES_KEY = 'stato:statistics-view-preferences:v1';
const STATISTICS_TYPES = new Set(['open_door', 'project_open', 'project_closed', 'event', 'outreach']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readObject(key: string): Record<string, unknown> | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function writeObject(key: string, value: object) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Ignore unavailable or full session storage. */
  }
}

export function loadDashboardTrendPeriod(): DashboardTrendPeriod {
  const value = readObject(DASHBOARD_VIEW_PREFERENCES_KEY)?.trendPeriod;
  return value === 'week' || value === 'month' || value === 'year' ? value : 'year';
}

export function saveDashboardTrendPeriod(trendPeriod: DashboardTrendPeriod) {
  writeObject(DASHBOARD_VIEW_PREFERENCES_KEY, { trendPeriod });
}

export function loadStatisticsViewPreferences(): StatisticsViewPreferences {
  const stored = readObject(STATISTICS_VIEW_PREFERENCES_KEY);
  if (!stored) return {};

  return {
    from: typeof stored.from === 'string' && (!stored.from || DATE_PATTERN.test(stored.from)) ? stored.from : undefined,
    to: typeof stored.to === 'string' && (!stored.to || DATE_PATTERN.test(stored.to)) ? stored.to : undefined,
    projectId: typeof stored.projectId === 'string' ? stored.projectId : undefined,
    selectedType: typeof stored.selectedType === 'string' && STATISTICS_TYPES.has(stored.selectedType)
      ? stored.selectedType
      : '',
    selectedYear: typeof stored.selectedYear === 'string' && (!stored.selectedYear || /^\d{4}$/.test(stored.selectedYear))
      ? stored.selectedYear
      : undefined,
    selectedMonth: stored.selectedMonth === null
      ? null
      : typeof stored.selectedMonth === 'number' && Number.isInteger(stored.selectedMonth) && stored.selectedMonth >= 1 && stored.selectedMonth <= 12
        ? stored.selectedMonth
        : undefined,
    filterMode: stored.filterMode === 'month' || stored.filterMode === 'year' ? stored.filterMode : undefined,
  };
}

export function saveStatisticsViewPreferences(preferences: StatisticsViewPreferences) {
  writeObject(STATISTICS_VIEW_PREFERENCES_KEY, preferences);
}
