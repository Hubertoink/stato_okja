import { getCurrentIntlLocale } from '@/i18n/formatters';
import { autoT } from '@/i18n/auto';
type StatisticsTimeseriesEntry = {
  date: string;
  totalParticipants: number;
  activityCount: number;
};

type StatisticsSelectableItem = {
  id: string;
};

type WeekdayChartOption = {
  value: number;
  shortLabel: string;
  label: string;
};

type StatisticsTimeAggregation = 'day' | 'week' | 'month';

type TopDayChartEntry = {
  weekday: number;
  name: string;
  fullName: string;
  count: number;
  activityCount: number;
  id: string;
  chartValue: number;
};

const WEEKDAY_CHART_OPTIONS: WeekdayChartOption[] = [
  { value: 0, shortLabel: 'So', label: autoT('ui_f8e9c756eaa2') },
  { value: 1, shortLabel: 'Mo', label: autoT('ui_8bb0f19f592e') },
  { value: 2, shortLabel: 'Di', label: autoT('ui_b2ce6b5d7cb1') },
  { value: 3, shortLabel: 'Mi', label: autoT('ui_ea3552526134') },
  { value: 4, shortLabel: 'Do', label: autoT('ui_7c3df2c5fe25') },
  { value: 5, shortLabel: 'Fr', label: autoT('ui_0ca5853904f5') },
  { value: 6, shortLabel: 'Sa', label: autoT('ui_85ad5644425c') },
];

function parseStatisticsCalendarDate(value?: string | null) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function getInclusiveWeekSpan(from?: string, to?: string) {
  const start = parseStatisticsCalendarDate(from);
  const end = parseStatisticsCalendarDate(to);
  if (!start || !end) return 0;

  const startTime = start.getTime();
  const endTime = end.getTime();
  const first = Math.min(startTime, endTime);
  const last = Math.max(startTime, endTime);
  const inclusiveDays = Math.floor((last - first) / 86400000) + 1;

  return Math.max(inclusiveDays / 7, 1);
}

function formatStatisticsDateCompact(iso: string) {
  const safeIso = String(iso || '').slice(0, 10);
  const [yearValue, monthValue, dayValue] = safeIso.split('-');
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  if (!year || !month || !day) return safeIso || String(iso || '');

  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const shortYear = String(year).slice(-2);
  const shortMonth = new Intl.DateTimeFormat(getCurrentIntlLocale(), { month: 'short' })
    .format(date)
    .replace('.', '');
  const paddedDay = String(day).padStart(2, '0');
  return `${shortYear} ${shortMonth} ${paddedDay}`;
}

export function formatStatisticsAggregationTickLabel(
  value: string,
  aggregation: StatisticsTimeAggregation,
) {
  const safeValue = String(value || '');

  if (aggregation === 'week') {
    const match = safeValue.match(/^\d{4}-W(\d{2})$/);
    return match ? `KW ${match[1]}` : safeValue;
  }

  if (aggregation === 'month') {
    const [year, month] = safeValue.split('-');
    const date = new Date(Number(year), Number(month) - 1, 15);
    if (!isNaN(date.getTime())) {
      const monthLabel = new Intl.DateTimeFormat(getCurrentIntlLocale(), { month: 'short' })
        .format(date)
        .replace('.', '');
      return `${monthLabel} ${year.slice(-2)}`;
    }
    return safeValue;
  }

  return formatStatisticsDateCompact(safeValue);
}

export function formatStatisticsAggregationTooltipLabel(
  value: string,
  aggregation: StatisticsTimeAggregation,
) {
  const safeValue = String(value || '');

  if (aggregation === 'week') {
    const match = safeValue.match(/^(\d{4})-W(\d{2})$/);
    return match ? `Kalenderwoche ${match[2]}, ${match[1]}` : safeValue;
  }

  if (aggregation === 'month') {
    const match = safeValue.match(/^(\d{4})-(\d{2})$/);
    if (!match) return safeValue;

    const date = new Date(Number(match[1]), Number(match[2]) - 1, 15);
    if (isNaN(date.getTime())) return safeValue;

    const monthLabel = new Intl.DateTimeFormat(getCurrentIntlLocale(), { month: 'long' }).format(date);
    return `${monthLabel} ${match[1]}`;
  }

  return autoT('ui_1ae0fe72e0f6', { value0: formatStatisticsDateCompact(safeValue) });
}

export function buildTopDayChartData(
  timeseries: StatisticsTimeseriesEntry[] | undefined,
  showAverage: boolean,
): TopDayChartEntry[] {
  const list = Array.isArray(timeseries) ? timeseries : [];
  const weekdayTotals = new Map<number, Omit<TopDayChartEntry, 'id' | 'chartValue'>>(
    WEEKDAY_CHART_OPTIONS.map((weekday) => [
      weekday.value,
      {
        weekday: weekday.value,
        name: weekday.shortLabel,
        fullName: weekday.label,
        count: 0,
        activityCount: 0,
      },
    ]),
  );

  for (const entry of list) {
    if (!entry || typeof entry.totalParticipants !== 'number') continue;
    const parsedDate = parseStatisticsCalendarDate(entry.date);
    if (!parsedDate) continue;

    const weekday = parsedDate.getUTCDay();
    const bucket = weekdayTotals.get(weekday);
    if (!bucket) continue;

    bucket.count += entry.totalParticipants;
    bucket.activityCount += entry.activityCount;
  }

  return Array.from(weekdayTotals.values())
    .filter((entry) => entry.activityCount > 0 || entry.count > 0)
    .map((entry) => ({
      ...entry,
      id: String(entry.weekday),
      chartValue:
        entry.activityCount > 0 ? Math.round((entry.count / entry.activityCount) * 10) / 10 : 0,
    }))
    .sort((left, right) => {
      const leftValue = showAverage ? left.chartValue : left.count;
      const rightValue = showAverage ? right.chartValue : right.count;
      if (rightValue !== leftValue) return rightValue - leftValue;
      return left.weekday - right.weekday;
    });
}

export function getVisibleSelectedItems<T extends StatisticsSelectableItem>({
  items,
  selectedId,
  expanded,
  visibleCount,
}: {
  items: T[];
  selectedId?: string | null;
  expanded: boolean;
  visibleCount: number;
}) {
  if (expanded) return items;

  const initialItems = items.slice(0, visibleCount);
  if (!selectedId || initialItems.some((item) => item.id === selectedId)) return initialItems;

  const selectedItem = items.find((item) => item.id === selectedId);
  return selectedItem ? [...initialItems, selectedItem] : initialItems;
}