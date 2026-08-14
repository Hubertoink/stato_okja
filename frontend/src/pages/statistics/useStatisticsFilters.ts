import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity } from '@/lib/activities';
import type { ActivityExecutionStatus } from '@/lib/activityExecutionStatus';
import {
  DEFAULT_ACTIVITY_EXECUTION_STATUS,
  formatActivityExecutionStatusList,
  isDefaultActivityExecutionStatusFilter,
  normalizeActivityExecutionStatuses,
} from '@/lib/activityExecutionStatus';
import type { OrganizationClosureStateFilter } from '@/lib/orgs';
import {
  loadStatisticsViewPreferences,
  saveStatisticsViewPreferences,
} from '@/lib/statisticsViewPreferences';
import { autoT } from '@/i18n/auto';

const weekdayOptions = [
  { value: 1, shortLabel: 'Mo' },
  { value: 2, shortLabel: 'Di' },
  { value: 3, shortLabel: 'Mi' },
  { value: 4, shortLabel: 'Do' },
  { value: 5, shortLabel: 'Fr' },
  { value: 6, shortLabel: 'Sa' },
  { value: 0, shortLabel: 'So' },
] as const;

const closureLabels: Record<OrganizationClosureStateFilter, string> = {
  closed: autoT('ui_9a7a7c0c602f'),
  open: autoT('ui_032b3f37a45b'),
};

function normalizeWeekdays(weekdays: number[]) {
  return Array.from(
    new Set(
      weekdays.filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6),
    ),
  ).sort((left, right) => left - right);
}

export function useStatisticsFilters() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [storedViewPreferences] = useState(loadStatisticsViewPreferences);
  const [from, setFrom] = useState(storedViewPreferences.from ?? `${currentYear}-01-01`);
  const [to, setTo] = useState(storedViewPreferences.to ?? `${currentYear}-12-31`);
  const [projectId, setProjectId] = useState(storedViewPreferences.projectId ?? '');
  const [selectedType, setSelectedType] = useState<Activity['type'] | ''>(
    (storedViewPreferences.selectedType as Activity['type'] | '') || '',
  );
  const [selectedYear, setSelectedYear] = useState(
    storedViewPreferences.selectedYear ?? String(currentYear),
  );
  const [selectedMonth, setSelectedMonth] = useState<number | null>(
    storedViewPreferences.selectedMonth ?? null,
  );
  const [filterMode, setFilterMode] = useState<'year' | 'month'>(
    storedViewPreferences.filterMode ?? 'year',
  );
  const [customFilterOpen, setCustomFilterOpen] = useState(false);
  const customFilterTriggerRef = useRef<HTMLDivElement | null>(null);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(from);
  const [tempTo, setTempTo] = useState(to);
  const [desktopProjectFilterExpanded, setDesktopProjectFilterExpanded] = useState(false);
  const [mobileFiltersExpanded, setMobileFiltersExpanded] = useState(false);
  const [mobileTypeFilterExpanded, setMobileTypeFilterExpanded] = useState(false);
  const [mobileProjectFilterExpanded, setMobileProjectFilterExpanded] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [tempSelectedWeekdays, setTempSelectedWeekdays] = useState<number[]>([]);
  const [selectedExecutionStatuses, setSelectedExecutionStatuses] = useState<
    ActivityExecutionStatus[] | undefined
  >();
  const [tempSelectedExecutionStatuses, setTempSelectedExecutionStatuses] = useState<
    ActivityExecutionStatus[]
  >([DEFAULT_ACTIVITY_EXECUTION_STATUS]);
  const [selectedClosureState, setSelectedClosureState] = useState<
    OrganizationClosureStateFilter | undefined
  >();
  const [tempSelectedClosureState, setTempSelectedClosureState] = useState<
    OrganizationClosureStateFilter | undefined
  >();
  const [activitiesPage, setActivitiesPage] = useState(1);

  useEffect(() => {
    saveStatisticsViewPreferences({
      from,
      to,
      projectId,
      selectedType,
      selectedYear,
      selectedMonth,
      filterMode,
    });
  }, [filterMode, from, projectId, selectedMonth, selectedType, selectedYear, to]);

  const updateDateRange = (year: string, month: number | null) => {
    if (!year) {
      setFrom('');
      setTo('');
      return;
    }
    if (month === null) {
      setFrom(`${year}-01-01`);
      setTo(`${year}-12-31`);
      return;
    }
    const lastDay = new Date(Number(year), month, 0).getDate();
    setFrom(`${year}-${String(month).padStart(2, '0')}-01`);
    setTo(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };
  const selectYear = (year: string) => {
    setSelectedYear(year);
    setSelectedMonth(null);
    setFilterMode('year');
    updateDateRange(year, null);
  };
  const selectMonth = (month: number) => {
    const year = selectedYear || String(currentYear);
    setSelectedYear(year);
    setSelectedMonth(month);
    setFilterMode('month');
    updateDateRange(year, month);
  };
  const switchToYearView = () => {
    const year = selectedYear || String(currentYear);
    setSelectedYear(year);
    setSelectedMonth(null);
    setFilterMode('year');
    updateDateRange(year, null);
  };
  const switchToMonthView = () => selectMonth(selectedMonth ?? currentMonth);
  const navigateMonth = (direction: 'prev' | 'next') => {
    let year = Number(selectedYear || currentYear);
    let month = selectedMonth ?? currentMonth;
    if (direction === 'prev') {
      month -= 1;
      if (month < 1) {
        month = 12;
        year -= 1;
      }
    } else {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    setSelectedYear(String(year));
    setSelectedMonth(month);
    setFilterMode('month');
    updateDateRange(String(year), month);
  };
  const isCustomRange = useMemo(
    () => Boolean(from || to) && !selectedYear && selectedMonth === null,
    [from, selectedMonth, selectedYear, to],
  );
  const applyCustomRange = () => {
    const weekdays = normalizeWeekdays(tempSelectedWeekdays);
    const executionStatuses = normalizeActivityExecutionStatuses(tempSelectedExecutionStatuses);
    const nextFrom = tempFrom.trim() || '';
    const nextTo = tempTo.trim() || '';
    setSelectedWeekdays(weekdays);
    setSelectedExecutionStatuses(
      isDefaultActivityExecutionStatusFilter(executionStatuses) ? undefined : executionStatuses,
    );
    setSelectedClosureState(tempSelectedClosureState);
    if (!nextFrom && !nextTo) {
      if (isCustomRange) {
        setFrom('');
        setTo('');
        setSelectedYear('');
        setSelectedMonth(null);
        setFilterMode('year');
      }
      setCustomFilterOpen(false);
      return;
    }
    const range =
      nextFrom && nextTo && nextFrom > nextTo
        ? { from: nextTo, to: nextFrom }
        : { from: nextFrom, to: nextTo };
    setFrom(range.from);
    setTo(range.to);
    setSelectedYear('');
    setSelectedMonth(null);
    setFilterMode('year');
    setCustomFilterOpen(false);
  };
  const resetAdvancedFilters = () => {
    setSelectedWeekdays([]);
    setTempSelectedWeekdays([]);
    setSelectedExecutionStatuses(undefined);
    setTempSelectedExecutionStatuses([DEFAULT_ACTIVITY_EXECUTION_STATUS]);
    setSelectedClosureState(undefined);
    setTempSelectedClosureState(undefined);
    if (isCustomRange) selectYear(String(currentYear));
  };
  const hasWeekdayFilter = selectedWeekdays.length > 0;
  const hasExecutionStatusFilter =
    !isDefaultActivityExecutionStatusFilter(selectedExecutionStatuses);
  const hasClosureStateFilter = typeof selectedClosureState !== 'undefined';
  const hasAdvancedFilter =
    isCustomRange || hasWeekdayFilter || hasExecutionStatusFilter || hasClosureStateFilter;
  const formatRangeDisplay = (monthNames: string[]) => {
    if (isCustomRange) {
      const formatDate = (value: string) => {
        const [year, month, day] = value.split('-');
        return value ? `${day}.${month}.${year}` : '';
      };
      return `${formatDate(from)} – ${formatDate(to)}`;
    }
    if (!selectedYear) return autoT('ui_eb3ab8ef013a');
    return selectedMonth !== null
      ? `${monthNames[selectedMonth - 1]} ${selectedYear}`
      : selectedYear;
  };
  const formatAdvancedFilterDisplay = (monthNames: string[]) =>
    [
      isCustomRange ? formatRangeDisplay(monthNames) : '',
      hasExecutionStatusFilter ? formatActivityExecutionStatusList(selectedExecutionStatuses) : '',
      hasClosureStateFilter && selectedClosureState ? closureLabels[selectedClosureState] : '',
      hasWeekdayFilter
        ? normalizeWeekdays(selectedWeekdays)
            .map(
              (weekday) =>
                weekdayOptions.find((option) => option.value === weekday)?.shortLabel ??
                `#${weekday}`,
            )
            .join(', ')
        : '',
    ]
      .filter(Boolean)
      .join(' · ');

  return {
    currentYear,
    currentMonth,
    from,
    setFrom,
    to,
    setTo,
    projectId,
    setProjectId,
    selectedType,
    setSelectedType,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    filterMode,
    setFilterMode,
    customFilterOpen,
    setCustomFilterOpen,
    customFilterTriggerRef,
    typePickerOpen,
    setTypePickerOpen,
    projectPickerOpen,
    setProjectPickerOpen,
    tempFrom,
    setTempFrom,
    tempTo,
    setTempTo,
    desktopProjectFilterExpanded,
    setDesktopProjectFilterExpanded,
    mobileFiltersExpanded,
    setMobileFiltersExpanded,
    mobileTypeFilterExpanded,
    setMobileTypeFilterExpanded,
    mobileProjectFilterExpanded,
    setMobileProjectFilterExpanded,
    selectedWeekdays,
    setSelectedWeekdays,
    tempSelectedWeekdays,
    setTempSelectedWeekdays,
    selectedExecutionStatuses,
    setSelectedExecutionStatuses,
    tempSelectedExecutionStatuses,
    setTempSelectedExecutionStatuses,
    selectedClosureState,
    setSelectedClosureState,
    tempSelectedClosureState,
    setTempSelectedClosureState,
    activitiesPage,
    setActivitiesPage,
    updateDateRange,
    selectYear,
    selectMonth,
    switchToYearView,
    switchToMonthView,
    navigateMonth,
    applyCustomRange,
    resetAdvancedFilters,
    isCustomRange,
    hasWeekdayFilter,
    hasExecutionStatusFilter,
    hasClosureStateFilter,
    hasAdvancedFilter,
    formatRangeDisplay,
    formatAdvancedFilterDisplay,
  };
}
