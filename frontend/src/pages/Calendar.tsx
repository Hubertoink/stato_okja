import { useEffect, useMemo, useState, useRef, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useIsMobile } from '@/lib/useIsMobile';
import type { Project } from '@/lib/projects';
import ActivityQuickAdd from './CalendarQuickAddModal.tsx';
import ProjectPickerModal from './ProjectPickerModal';
import { useActivities, Activity } from '@/lib/activities';
// colorForActivityType no longer needed after switching to class-based palette
import { getHolidaysInRange, readHolidayPrefs, type Holiday } from '@/lib/holidays';
import { getSchoolHolidaysInRange, type SchoolHolidayRange } from '@/lib/schoolHolidays';
import {
  deleteClosureDay,
  getClosureDays,
  getOpeningHours,
  type OpeningHours,
  type OrganizationClosureDay,
  upsertClosureDay,
} from '@/lib/orgs';
import { useAuth } from '@/lib/auth';
import { useOrgScope, useOrgScopeKey } from '@/lib/orgScope';
import { addDevMetricEvent, finishDevFlow, markDevFlow, startDevFlow } from '@/lib/devMetrics';
import type React from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Building2, Pencil, Plus } from 'lucide-react';
import ProtectedImage from '@/components/ProtectedImage';
import CalendarClosureModal from '@/components/CalendarClosureModal';
import ActivityExecutionStatusBadge from '@/components/ActivityExecutionStatusBadge';
import { ACTIVITY_EXECUTION_STATUS_SHORT_LABELS, isCancelledActivity } from '@/lib/activityExecutionStatus';
import DemoHoverHint from '@/demo/DemoHoverHint';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function filterClosureDaysForRange(
  closureDays: OrganizationClosureDay[],
  from?: string,
  to?: string,
) {
  return closureDays.filter((entry) => {
    if (from && entry.date < from) return false;
    if (to && entry.date > to) return false;
    return true;
  });
}

function syncClosureDayQueries(
  queryClient: QueryClient,
  orgId: string,
  closureDays: OrganizationClosureDay[],
) {
  const queries = queryClient.getQueriesData<OrganizationClosureDay[]>({
    queryKey: ['org-closure-days', orgId],
  });

  queries.forEach(([queryKey]) => {
    const from = typeof queryKey[2] === 'string' ? queryKey[2] : undefined;
    const to = typeof queryKey[3] === 'string' ? queryKey[3] : undefined;
    queryClient.setQueryData(queryKey, filterClosureDaysForRange(closureDays, from, to));
  });
}

async function invalidateClosureDerivedQueries(
  queryClient: QueryClient,
  scopeKey: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['activities', scopeKey], refetchType: 'active' }),
    queryClient.invalidateQueries({
      predicate: (query) => {
        const [key, queryScopeKey] = Array.isArray(query.queryKey) ? query.queryKey : [];
        return typeof key === 'string' && key.startsWith('stats:') && queryScopeKey === scopeKey;
      },
      refetchType: 'active',
    }),
  ]);
}

type TooltipLayout = {
  left: number;
  top: number;
  transform: string;
  arrowCenterPx: number;
  arrowClass: string;
  maxHeight: number;
};

function useClampedTooltipLayout(
  position: { x: number; y: number } | null,
  visible: boolean,
  options?: { preferBelow?: boolean; preferBelowOnOverflow?: boolean },
) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<TooltipLayout | null>(null);

  useLayoutEffect(() => {
    if (!visible || !position || !ref.current) {
      setLayout(null);
      return;
    }

    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 12;
    const gap = 8;
    const availableAbove = Math.max(position.y - padding - gap, 0);
    const availableBelow = Math.max(vh - position.y - padding - gap, 0);

    const fitsAbove = rect.height <= availableAbove;
    const fitsBelow = rect.height <= availableBelow;
    const placeTop = options?.preferBelow
      ? fitsBelow
        ? false
        : fitsAbove
          ? true
          : options?.preferBelowOnOverflow
            ? false
            : availableAbove >= availableBelow
      : fitsAbove
        ? true
        : fitsBelow
          ? false
          : options?.preferBelowOnOverflow
            ? false
            : availableAbove >= availableBelow;

    // Center-align, but clamp to viewport using measured width.
    const clampedCenterX = clamp(position.x, padding + rect.width / 2, vw - padding - rect.width / 2);
    const transform = placeTop
      ? 'translate(-50%, -100%) translateY(-8px)'
      : 'translate(-50%, 0%) translateY(8px)';

    // Arrow: point to original x, but clamp within tooltip body.
    const leftEdge = clampedCenterX - rect.width / 2;
    const arrowCenterPx = clamp(position.x - leftEdge, 18, rect.width - 18);

    // If bottom placement would overflow viewport, nudge up slightly (rare).
    const top = clamp(position.y, padding, vh - padding);

    const maxHeight = Math.max(placeTop ? availableAbove : availableBelow, 0);

    setLayout({
      left: clampedCenterX,
      top,
      transform,
      arrowCenterPx,
      arrowClass: placeTop ? '-bottom-1 rotate-45' : '-top-1 rotate-45',
      maxHeight,
    });
  }, [options?.preferBelowOnOverflow, position?.x, position?.y, visible]);

  return { ref, layout };
}

// Custom tooltip component for calendar activities
interface ActivityTooltipProps {
  activity: Activity | null;
  position: { x: number; y: number } | null;
  typeLabel: Record<string, string>;
  fmtTimeRange: (s?: string | null, e?: string | null) => string;
}

function ActivityTooltip({ activity, position, typeLabel, fmtTimeRange }: ActivityTooltipProps) {
  if (!activity || !position) return null;
  
  const label = `${activity.project?.title || typeLabel[activity.type] || activity.type}${activity.title ? ` (${activity.title})` : ''}`;
  const statusLabel = isCancelledActivity(activity.executionStatus) ? 'Ausgefallen' : null;
  const time = fmtTimeRange(activity.startTime, activity.endTime);
  const total = activity.countTotal ?? 0;
  const m = activity.countMale ?? 0;
  const w = activity.countFemale ?? 0;
  const d = activity.countDiverse ?? 0;
  const loc = activity.location?.name;
  const panelClass = 'calendar-tooltip-panel text-xs rounded-xl px-3.5 py-2.5 shadow-xl w-[300px] max-w-[calc(100vw-24px)] border';
  
  const { ref, layout } = useClampedTooltipLayout(position, true);
  if (!layout) {
    // First paint: render off-screen to measure without flashing.
    return createPortal(
      <div className="fixed left-[-9999px] top-[-9999px] z-[55] pointer-events-none" aria-hidden>
        <div
          ref={ref}
          className={panelClass}
        >
          {statusLabel && <div className="mb-1 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">{statusLabel}</div>}
          <div className="font-semibold mb-1 text-viridian">{label}</div>
          {time && <div className="calendar-tooltip-body"><span className="calendar-tooltip-meta">Zeit:</span> {time}</div>}
          {!statusLabel && (
            <div className="calendar-tooltip-body">
              <span className="calendar-tooltip-meta">Teilnehmende:</span> {total}
              <span className="calendar-tooltip-meta ml-1 text-[10px]">(m:{m}, w:{w}, d:{d})</span>
            </div>
          )}
          {loc && <div className="calendar-tooltip-body"><span className="calendar-tooltip-meta">Ort:</span> {loc}</div>}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="fixed z-[55] pointer-events-none animate-tooltip-fade-in"
      style={{ left: layout.left, top: layout.top, transform: layout.transform }}
    >
      <div
        ref={ref}
        className={`relative ${panelClass}`}
      >
        {statusLabel && <div className="mb-1 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">{statusLabel}</div>}
        <div className="font-semibold mb-1 text-viridian">{label}</div>
        {time && <div className="calendar-tooltip-body"><span className="calendar-tooltip-meta">Zeit:</span> {time}</div>}
        {!statusLabel && (
          <div className="calendar-tooltip-body">
            <span className="calendar-tooltip-meta">Teilnehmende:</span> {total}
            <span className="calendar-tooltip-meta ml-1 text-[10px]">(m:{m}, w:{w}, d:{d})</span>
          </div>
        )}
        {loc && <div className="calendar-tooltip-body"><span className="calendar-tooltip-meta">Ort:</span> {loc}</div>}
        {/* Tooltip arrow */}
        <div
          className={`absolute w-2 h-2 -translate-x-1/2 ${layout.arrowClass}`}
          style={{ left: layout.arrowCenterPx, backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border-strong)', borderRightWidth: '1px', borderBottomWidth: '1px' }}
        />
      </div>
    </div>,
    document.body,
  );
}
// duplicate import removed

type View = 'month' | 'week' | 'three-day';

const CALENDAR_VIEW_STORAGE_KEY = 'calendar:view';

function readStoredCalendarView(): View {
  try {
    const stored = localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
    return stored === 'week' || stored === 'three-day' ? stored : 'month';
  } catch {
    return 'month';
  }
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d: Date, n: number) {
  // Jump to first of target month for stable month navigation
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // make Monday=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function getISOWeek(d: Date) {
  // ISO week: Thursday determines the week number
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // set to nearest Thursday (current date + 4 - current day number)
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  // Jan 4th is always in week 1
  const jan4 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (date.getTime() - jan4.getTime()) / 86400000; // days
  return 1 + Math.floor((diff + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

function formatLongDate(iso: string) {
  const [year, month, day] = iso.split('-').map((value) => Number(value));
  const date = new Date(year, (month || 1) - 1, day || 1);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function Calendar() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { scope } = useOrgScope();
  const scopeKey = useOrgScopeKey();
  const [view, setView] = useState<View>(() => readStoredCalendarView());
  const [cursor, setCursor] = useState<Date>(new Date());
  const [modal, setModal] = useState<{ date: string; project?: Project } | null>(null);
  const [picker, setPicker] = useState<{ date: string } | null>(null);
  const [edit, setEdit] = useState<Activity | null>(null);
  const [selectedDateISO, setSelectedDateISO] = useState<string | null>(null);
  const [closureDate, setClosureDate] = useState<string | null>(null);
  const calendarView: View = isMobile
    ? view === 'week'
      ? 'three-day'
      : view
    : view === 'three-day'
      ? 'week'
      : view;
  const showCalendarDayActions = !isMobile || calendarView === 'three-day';
  
  // Tooltip state for activity hover
  const [tooltipActivity, setTooltipActivity] = useState<Activity | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const activityTooltipOpenTimeoutRef = useRef<number | null>(null);
  const activityTooltipCloseTimeoutRef = useRef<number | null>(null);
  const calendarFlowIdRef = useRef<string | null>(null);
  const calendarFlowCompletedRef = useRef(false);
  const calendarFlowMarksRef = useRef<Record<string, boolean>>({});
  const calendarPendingRunKeyRef = useRef<string | null>(null);
  const calendarFetchSeenRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    try {
      localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  // Determine effective orgId for opening hours
  const effectiveOrgId = user?.role === 'superadmin'
    ? (typeof scope === 'string' ? scope : null)
    : (user?.orgId ?? null);

  // Fetch opening hours for the current organization
  const openingHoursQ = useQuery({
    queryKey: ['opening-hours', effectiveOrgId],
    queryFn: () => getOpeningHours(effectiveOrgId!),
    enabled: !!effectiveOrgId,
  });
  const openingHours = openingHoursQ.data;

  // Helper to get opening hours for a weekday (0=Monday, 6=Sunday)
  const getOpeningHoursForDay = (dayIdx: number): string | null => {
    if (!openingHours) return null;
    const dayKeys: (keyof OpeningHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayData = openingHours[dayKeys[dayIdx]];
    if (!dayData?.open) return 'Geschl.';
    return `${dayData.from || '–'} – ${dayData.to || '–'}`;
  };

  const label = useMemo(() => {
    if (calendarView === 'three-day') {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      const end = addDays(start, 2);
      return `${start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} – ${end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    }

    const base = cursor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    if (calendarView === 'week') {
      const kw = getISOWeek(cursor);
      return `${base} (KW ${kw})`;
    }
    return base;
  }, [calendarView, cursor]);
  const fmtLocalISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmtTime = (t?: string | null) => (t ? String(t).slice(0, 5) : '');
  const fmtTimeRange = (s?: string | null, e?: string | null) => {
    const S = fmtTime(s);
    const E = fmtTime(e);
    return S && E ? `${S} – ${E}` : S || E || '';
  };
  const fmtDuration = (activity: Activity) => {
    if (typeof activity.durationMinutes === 'number' && activity.durationMinutes >= 0) {
      return `${activity.durationMinutes} min`;
    }
    const toMinutes = (time?: string | null) => {
      if (!time) return undefined;
      const [hours, minutes] = time.split(':').map((value) => parseInt(value, 10));
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;
      return hours * 60 + minutes;
    };
    const start = toMinutes(activity.startTime);
    const end = toMinutes(activity.endTime);
    return start !== undefined && end !== undefined && end >= start ? `${end - start} min` : '-';
  };
  const openActivitiesForDate = (iso: string) => {
    if (!isMobile) {
      setSelectedDateISO(iso);
      return;
    }
    const qp = new URLSearchParams({ date: iso });
    navigate(`/activities?${qp.toString()}`);
  };
  const openFilteredActivitiesForDate = (iso: string) => {
    const qp = new URLSearchParams({ date: iso });
    navigate(`/activities?${qp.toString()}`);
  };
  const openActivity = (activity: Activity) => {
    if (isMobile && activity.id) {
      navigate(`/activities/${activity.id}`, {
        state: { from: `${location.pathname}${location.search}` },
      });
      return;
    }
    setEdit(activity);
  };
  const openAddActivityForDate = (iso: string) => {
    if (isMobile) navigate(`/activities/new/select-project?date=${iso}`);
    else setPicker({ date: iso });
  };
  const goToPrevious = () => {
    setCursor((c) => {
      if (calendarView === 'month') return addMonths(c, -1);
      if (calendarView === 'three-day') return addDays(new Date(c.getFullYear(), c.getMonth(), c.getDate()), -3);
      return addDays(startOfWeek(c), -7);
    });
  };
  const goToNext = () => {
    setCursor((c) => {
      if (calendarView === 'month') return addMonths(c, 1);
      if (calendarView === 'three-day') return addDays(new Date(c.getFullYear(), c.getMonth(), c.getDate()), 3);
      return addDays(startOfWeek(c), 7);
    });
  };

  // Build month grid (6 weeks)
  const monthWeeks = useMemo(() => {
    if (calendarView !== 'month') return [] as Date[][];
    const first = startOfMonth(cursor);
    const gridStart = startOfWeek(first);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));
    const weeks: Date[][] = [];
    for (let w = 0; w < 6; w++) weeks.push(days.slice(w * 7, w * 7 + 7));
    return weeks;
  }, [calendarView, cursor]);

  const todayDate = new Date();
  const todayISO = fmtLocalISO(todayDate);
  const gotoToday = () => setCursor(new Date());
  const visibleDays = useMemo(() => {
    if (calendarView === 'month') return [] as Date[];
    const start = calendarView === 'three-day'
      ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
      : startOfWeek(cursor);
    const length = calendarView === 'three-day' ? 3 : 7;
    return Array.from({ length }, (_, i) => addDays(start, i));
  }, [calendarView, cursor]);
  const isTodayInCurrentView = calendarView === 'month'
    ? cursor.getFullYear() === todayDate.getFullYear() && cursor.getMonth() === todayDate.getMonth()
    : visibleDays.some((d) => fmtLocalISO(d) === todayISO);
  const showTodayButton = !isTodayInCurrentView;

  // Compute visible range and fetch activities
  const range = useMemo(() => {
    if (calendarView === 'month') {
      const first = startOfMonth(cursor);
      const gridStart = startOfWeek(first);
      const gridEnd = addDays(gridStart, 41);
      return { from: fmtLocalISO(gridStart), to: fmtLocalISO(gridEnd) };
    }
    const start = calendarView === 'three-day'
      ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
      : startOfWeek(cursor);
    const end = addDays(start, calendarView === 'three-day' ? 2 : 6);
    return { from: fmtLocalISO(start), to: fmtLocalISO(end) };
  }, [calendarView, cursor]);
  const closureDaysQ = useQuery({
    queryKey: ['org-closure-days', effectiveOrgId, range.from, range.to],
    queryFn: () => getClosureDays(effectiveOrgId!, { from: range.from, to: range.to }),
    enabled: !!effectiveOrgId,
  });
  const activitiesQ = useActivities({ from: range.from, to: range.to });
  const activities = activitiesQ.data;
  const closureDays = closureDaysQ.data ?? [];
  const closureDaysByDate = useMemo(() => {
    const map = new Map<string, OrganizationClosureDay>();
    closureDays.forEach((entry) => {
      map.set(entry.date, entry);
    });
    return map;
  }, [closureDays]);
  const selectedClosureDay = closureDate ? closureDaysByDate.get(closureDate) ?? null : null;
  const saveClosureMutation = useMutation({
    mutationFn: async ({ date, payload }: { date: string; payload: Pick<OrganizationClosureDay, 'from' | 'to'> }) => {
      if (!effectiveOrgId) throw new Error('Keine Organisation ausgewählt');
      return upsertClosureDay(effectiveOrgId, date, payload);
    },
    onSuccess: async (nextClosureDays) => {
      if (!effectiveOrgId) return;
      syncClosureDayQueries(queryClient, effectiveOrgId, nextClosureDays);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['org-closure-days', effectiveOrgId], refetchType: 'active' }),
        invalidateClosureDerivedQueries(queryClient, scopeKey),
      ]);
      setClosureDate(null);
    },
  });
  const deleteClosureMutation = useMutation({
    mutationFn: async (date: string) => {
      if (!effectiveOrgId) throw new Error('Keine Organisation ausgewählt');
      return deleteClosureDay(effectiveOrgId, date);
    },
    onSuccess: async (nextClosureDays) => {
      if (!effectiveOrgId) return;
      syncClosureDayQueries(queryClient, effectiveOrgId, nextClosureDays);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['org-closure-days', effectiveOrgId], refetchType: 'active' }),
        invalidateClosureDerivedQueries(queryClient, scopeKey),
      ]);
      setClosureDate(null);
    },
  });
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, Activity[]>();
    const list: Activity[] = (activities ?? []) as Activity[];
    list.forEach((a: Activity) => {
      const iso = (a.date || '').slice(0, 10);
      const arr = map.get(iso) || [];
      arr.push(a);
      map.set(iso, arr);
    });
    return map;
  }, [activities]);

  useEffect(() => {
    if (!selectedDateISO) return;
    if (selectedDateISO < range.from || selectedDateISO > range.to) setSelectedDateISO(null);
  }, [range.from, range.to, selectedDateISO]);

  const formatClosureLabel = (closureDay?: OrganizationClosureDay | null, compact = false) => {
    if (!closureDay) return null;
    const from = closureDay.from ? String(closureDay.from).slice(0, 5) : '';
    const to = closureDay.to ? String(closureDay.to).slice(0, 5) : '';
    if (from && to) return compact ? `Geschl. ${from}-${to}` : `Einrichtung geschlossen ${from} - ${to}`;
    return compact ? 'Geschlossen' : 'Einrichtung ganztägig geschlossen';
  };

  const renderClosureBadge = (iso: string, compact = false) => {
    const closureDay = closureDaysByDate.get(iso);
    const label = formatClosureLabel(closureDay, compact);
    if (!closureDay || !label) return null;

    return (
      <div
        className={`calendar-closure-badge rounded border font-semibold truncate max-w-full ${compact ? 'mb-0.5 px-1 py-[1px] text-[9px] md:text-[10px]' : 'mb-1 px-1.5 py-0.5 text-[10px]'}`}
        title={label}
      >
        {label}
      </div>
    );
  };

  // Holidays overlay
  const { state: holidayState, school: showSchool } = readHolidayPrefs();
  const holidays = useMemo(
    () => getHolidaysInRange(range.from, range.to, holidayState),
    [range.from, range.to, holidayState],
  );
  const holidaysByDate = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    holidays.forEach((h: Holiday) => {
      const arr = map.get(h.date) || [];
      arr.push(h);
      map.set(h.date, arr);
    });
    return map;
  }, [holidays]);

  // School holidays (optional)
  const [schoolRanges, setSchoolRanges] = useState<SchoolHolidayRange[] | null>(null);
  const [schoolRangesStatus, setSchoolRangesStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!showSchool || !holidayState) {
        if (alive) setSchoolRangesStatus('idle');
        if (alive) setSchoolRanges(null);
        return;
      }
      try {
        if (alive) setSchoolRangesStatus('loading');
        const ranges = await getSchoolHolidaysInRange(holidayState, range.from, range.to);
        if (alive) {
          setSchoolRanges(ranges);
          setSchoolRangesStatus('success');
        }
      } catch {
        if (alive) {
          setSchoolRanges(null);
          setSchoolRangesStatus('error');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [showSchool, holidayState, range.from, range.to]);
  const calendarRunKey = `${scopeKey}|${view}|${range.from}|${range.to}|${showSchool ? 'school' : 'no-school'}|${holidayState ?? 'none'}|${effectiveOrgId ?? 'none'}`;

  useEffect(() => {
    if (calendarFlowIdRef.current && !calendarFlowCompletedRef.current) {
      finishDevFlow(calendarFlowIdRef.current, 'cancelled', { reason: 'superseded' });
    }
    calendarFlowIdRef.current = null;
    calendarFlowCompletedRef.current = false;
    calendarFlowMarksRef.current = {};
    calendarPendingRunKeyRef.current = calendarRunKey;
    calendarFetchSeenRef.current = {};
  }, [calendarRunKey]);

  useEffect(() => {
    const queryStates = [
      {
        key: 'activities',
        label: 'activities-ready',
        status: activitiesQ.status,
        isError: activitiesQ.isError,
        isFetching: activitiesQ.isFetching,
        size: Array.isArray(activities) ? activities.length : 0,
      },
      {
        key: 'openingHours',
        label: 'opening-hours-ready',
        status: openingHoursQ.status,
        isError: openingHoursQ.isError,
        isFetching: openingHoursQ.isFetching,
        size: openingHours ? 1 : 0,
      },
      ...(showSchool && holidayState
        ? [
            {
              key: 'schoolHolidays',
              label: 'school-holidays-ready',
              status: schoolRangesStatus === 'success' ? 'success' : schoolRangesStatus === 'error' ? 'error' : 'pending',
              isError: schoolRangesStatus === 'error',
              isFetching: schoolRangesStatus === 'loading',
              size: Array.isArray(schoolRanges) ? schoolRanges.length : 0,
            },
          ]
        : []),
    ];

    const anyFetching = queryStates.some((queryState) => queryState.isFetching);
    const anyPending = queryStates.some((queryState) => queryState.status !== 'success' && !queryState.isError);
    const allSettledSuccessfully = queryStates.every(
      (queryState) => queryState.status === 'success' && !queryState.isFetching,
    );
    const shouldStartFlow =
      !calendarFlowIdRef.current &&
      !calendarFlowCompletedRef.current &&
      calendarPendingRunKeyRef.current === calendarRunKey &&
      (anyFetching || anyPending);

    if (shouldStartFlow) {
      calendarFlowIdRef.current = startDevFlow('calendar:view-load', {
        scopeKey,
        view,
        from: range.from,
        to: range.to,
        showSchool,
        holidayState: holidayState ?? null,
      });
      markDevFlow(calendarFlowIdRef.current, 'view-applied', {
        view,
        from: range.from,
        to: range.to,
      });
    }

    if (
      !calendarFlowIdRef.current &&
      !calendarFlowCompletedRef.current &&
      calendarPendingRunKeyRef.current === calendarRunKey &&
      allSettledSuccessfully
    ) {
      calendarFlowCompletedRef.current = true;
      calendarPendingRunKeyRef.current = null;
      addDevMetricEvent({
        kind: 'flow',
        status: 'info',
        name: 'calendar:view-load',
        message: 'Calendar view was served from cache without a new fetch cycle.',
        meta: {
          scopeKey,
          view,
          from: range.from,
          to: range.to,
          cacheHit: true,
          showSchool,
          holidayState: holidayState ?? null,
        },
      });
      return;
    }

    const flowId = calendarFlowIdRef.current;
    if (!flowId || calendarFlowCompletedRef.current) return;

    for (const queryState of queryStates) {
      if (queryState.isFetching) {
        calendarFetchSeenRef.current[queryState.key] = true;
      }
      if (queryState.status === 'success' && !calendarFlowMarksRef.current[queryState.key]) {
        calendarFlowMarksRef.current[queryState.key] = true;
        markDevFlow(flowId, queryState.label, {
          rows: queryState.size,
          fetched: Boolean(calendarFetchSeenRef.current[queryState.key]),
        });
      }
    }

    const failedQueries = queryStates.filter((queryState) => queryState.isError).map((queryState) => queryState.key);
    if (failedQueries.length > 0) {
      calendarFlowCompletedRef.current = true;
      calendarPendingRunKeyRef.current = null;
      finishDevFlow(flowId, 'error', { failedQueries, view, from: range.from, to: range.to });
      return;
    }

    if (allSettledSuccessfully) {
      calendarFlowCompletedRef.current = true;
      calendarPendingRunKeyRef.current = null;
      finishDevFlow(flowId, 'success', {
        scopeKey,
        view,
        from: range.from,
        to: range.to,
        showSchool,
        visibleActivities: Array.isArray(activities) ? activities.length : 0,
      });
    }
  }, [
    activities,
    activitiesQ.isError,
    activitiesQ.isFetching,
    activitiesQ.status,
    calendarRunKey,
    holidayState,
    openingHours,
    openingHoursQ.isError,
    openingHoursQ.isFetching,
    openingHoursQ.status,
    range.from,
    range.to,
    schoolRanges,
    schoolRangesStatus,
    scopeKey,
    showSchool,
    view,
  ]);

  const schoolLabelFor = (iso: string): string | null => {
    if (!schoolRanges || !schoolRanges.length) return null;
    const hit = schoolRanges.find((r: SchoolHolidayRange) => !(r.end < iso || r.start > iso));
    return hit?.name ?? null;
  };
  const typeLabel: Record<string, string> = {
    open_door: 'Offene Tür',
    project_open: 'Projekt (offen)',
    project_closed: 'Projekt (geschlossen)',
    event: 'Veranstaltung',
    outreach: 'Aufsuchend',
  };
  // Tailwind class palette (translucent backgrounds) to avoid inline styles
  const paletteClasses = [
    'bg-blue-500/35',
    'bg-red-500/35',
    'bg-amber-500/35',
    'bg-emerald-500/35',
    'bg-violet-500/35',
    'bg-pink-500/35',
    'bg-orange-500/35',
    'bg-teal-500/35',
    'bg-green-500/35',
    'bg-yellow-500/35',
    'bg-sky-500/35',
    'bg-purple-500/35',
  ];
  const typeBgClass: Record<string, string> = {
    open_door: 'bg-emerald-600/35',
    project_open: 'bg-viridian/35',
    project_closed: 'bg-gray-500/35',
    event: 'bg-amber-600/35',
    outreach: 'bg-slate-600/35',
  };
  const activityListTypePillClass: Record<string, string> = {
    open_door: 'bg-emerald-700 text-white',
    project_open: 'bg-viridian text-white',
    project_closed: 'bg-slate-700 text-white',
    event: 'bg-amber-700 text-white',
    outreach: 'bg-red-700 text-white',
  };
  const pickBgClass = (title?: string, type?: string) => {
    if (type && typeBgClass[type]) return typeBgClass[type];
    if (!title) return 'bg-slate-300/40';
    let h = 0;
    for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
    return paletteClasses[h % paletteClasses.length];
  };
  const selectedDayActivities = useMemo(() => {
    if (!selectedDateISO) return [] as Activity[];
    return [...(activitiesByDate.get(selectedDateISO) || [])].sort((a, b) => {
      const timeA = a.startTime || '';
      const timeB = b.startTime || '';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      const titleA = a.project?.title || a.title || a.type;
      const titleB = b.project?.title || b.title || b.type;
      return titleA.localeCompare(titleB, 'de');
    });
  }, [activitiesByDate, selectedDateISO]);
  const selectedDateLabel = selectedDateISO ? formatLongDate(selectedDateISO) : '';
  
  // Tooltip handlers
  const clearActivityTooltipOpen = () => {
    if (activityTooltipOpenTimeoutRef.current) {
      clearTimeout(activityTooltipOpenTimeoutRef.current);
      activityTooltipOpenTimeoutRef.current = null;
    }
  };

  const clearActivityTooltipClose = () => {
    if (activityTooltipCloseTimeoutRef.current) {
      clearTimeout(activityTooltipCloseTimeoutRef.current);
      activityTooltipCloseTimeoutRef.current = null;
    }
  };

  const hideActivityTooltip = () => {
    setTooltipActivity(null);
    setTooltipPosition(null);
  };

  const scheduleActivityTooltipOpen = (activity: Activity, position: { x: number; y: number }) => {
    clearActivityTooltipOpen();
    activityTooltipOpenTimeoutRef.current = window.setTimeout(() => {
      setTooltipPosition(position);
      setTooltipActivity(activity);
      activityTooltipOpenTimeoutRef.current = null;
    }, 600);
  };

  const scheduleActivityTooltipClose = () => {
    clearActivityTooltipClose();
    activityTooltipCloseTimeoutRef.current = window.setTimeout(() => {
      hideActivityTooltip();
      activityTooltipCloseTimeoutRef.current = null;
    }, 120);
  };

  const handleActivityMouseEnter = (e: React.MouseEvent, activity: Activity) => {
    clearActivityTooltipClose();
    clearActivityTooltipOpen();
    const rect = e.currentTarget.getBoundingClientRect();
    hideActivityTooltip();
    scheduleActivityTooltipOpen(activity, {
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  };
  
  const handleActivityStackMouseLeave = () => {
    clearActivityTooltipOpen();
    scheduleActivityTooltipClose();
  };
  
  // State for "+x more" tooltip
  const [moreTooltip, setMoreTooltip] = useState<{ activities: Activity[]; position: { x: number; y: number } } | null>(null);
  const moreTooltipOpenTimeoutRef = useRef<number | null>(null);
  const moreTooltipCloseTimeoutRef = useRef<number | null>(null);

  const clearMoreTooltipOpen = () => {
    if (moreTooltipOpenTimeoutRef.current) {
      clearTimeout(moreTooltipOpenTimeoutRef.current);
      moreTooltipOpenTimeoutRef.current = null;
    }
  };
  const clearMoreTooltipClose = () => {
    if (moreTooltipCloseTimeoutRef.current) {
      clearTimeout(moreTooltipCloseTimeoutRef.current);
      moreTooltipCloseTimeoutRef.current = null;
    }
  };
  const scheduleMoreTooltipClose = () => {
    clearMoreTooltipClose();
    clearMoreTooltipOpen();
    moreTooltipCloseTimeoutRef.current = window.setTimeout(() => {
      setMoreTooltip(null);
      moreTooltipCloseTimeoutRef.current = null;
    }, 180);
  };

  const handleMoreMouseEnter = (e: React.MouseEvent, hiddenActivities: Activity[]) => {
    clearMoreTooltipClose();
    clearMoreTooltipOpen();
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = { x: rect.left + rect.width / 2, y: rect.bottom };
    moreTooltipOpenTimeoutRef.current = window.setTimeout(() => {
      setMoreTooltip({ activities: hiddenActivities, position: pos });
      moreTooltipOpenTimeoutRef.current = null;
    }, 600);
  };

  const handleMoreMouseLeave = () => {
    scheduleMoreTooltipClose();
  };

  useEffect(() => {
    return () => {
      clearActivityTooltipOpen();
      clearActivityTooltipClose();
      clearMoreTooltipOpen();
      clearMoreTooltipClose();
    };
  }, []);
  
  const renderEntries = (iso: string, maxRows = 3) => {
    const items = activitiesByDate.get(iso) || [];
    if (!items.length) return null;
    const visible = items.slice(0, maxRows);
    const hiddenItems = items.slice(maxRows);
    const hidden = hiddenItems.length;
    return (
      <div className="space-y-0.5" onMouseLeave={handleActivityStackMouseLeave}>
        {visible.map((a: Activity, i: number) => {
          const label = `${a.project?.title || typeLabel[a.type] || a.type}${a.title ? ` (${a.title})` : ''}`;
          const bgClass = isCancelledActivity(a.executionStatus)
            ? 'bg-rose-600/35'
            : pickBgClass(a.project?.title || a.title || typeLabel[a.type] || '', a.type);
          const hasImg = Boolean(a.project?.imageUrl);
          const compactStatusPrefix = isCancelledActivity(a.executionStatus)
            ? `${ACTIVITY_EXECUTION_STATUS_SHORT_LABELS.cancelled} `
            : '';
          return (
            <div key={i} className="group/activity relative">
              <button
                type="button"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  openActivity(a);
                }}
                onMouseEnter={(e) => handleActivityMouseEnter(e, a)}
                className={`relative w-full h-4 rounded overflow-hidden border border-black/10 px-1 text-left text-[9px] leading-4 truncate md:h-5 md:pl-6 md:pr-1 md:text-[10px] md:leading-5 ${bgClass}`}
                aria-label={label}
              >
                {hasImg && a.project && (
                  <ProtectedImage
                    src={a.project.imageUrl || undefined}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 w-full h-full object-cover blur-[2px] opacity-40"
                  />
                )}
                {hasImg && <div className="absolute inset-0 calendar-img-overlay" aria-hidden />}
                <span
                  className={`relative z-10 font-medium ${
                    hasImg ? 'text-white drop-shadow-sm' : 'text-gray-900'
                  }`}
                >
                  {compactStatusPrefix}{label}
                </span>
              </button>
              <button
                type="button"
                className="pointer-events-none absolute left-0.5 top-1/2 z-20 hidden h-4 w-4 -translate-y-1/2 items-center justify-center rounded bg-white/92 text-viridian shadow-sm opacity-0 ring-1 ring-black/10 transition-opacity md:flex md:group-hover/activity:pointer-events-auto md:group-hover/activity:opacity-100 md:group-focus-within/activity:pointer-events-auto md:group-focus-within/activity:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setEdit(a);
                }}
                aria-label={`${label} bearbeiten`}
                title="Bearbeiten"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
        {hidden > 0 && (
          <div 
            className="calendar-more-badge h-4 rounded border px-1 text-[9px] font-semibold leading-4 cursor-pointer transition-colors md:h-5 md:text-[10px] md:leading-5"
            onMouseEnter={(e) => handleMoreMouseEnter(e, hiddenItems)}
            onMouseLeave={handleMoreMouseLeave}
          >
            +{hidden}
          </div>
        )}
      </div>
    );
  };

  // Week view: show richer tiles (time + participant stats)
  const renderEntriesWeek = (iso: string) => {
    const items = activitiesByDate.get(iso) || [];
    if (!items.length) return null;
    return (
      <div className="mt-2 space-y-2" onMouseLeave={handleActivityStackMouseLeave}>
        {items.map((a: Activity, i: number) => {
          const title = a.project?.title || typeLabel[a.type] || a.type;
          const subtitle = a.title ? a.title : undefined;
          const bgClass = isCancelledActivity(a.executionStatus)
            ? 'bg-rose-600/30'
            : pickBgClass(a.project?.title || a.title || typeLabel[a.type] || '', a.type);
          const time = fmtTimeRange(a.startTime, a.endTime);
          const counts = a.countTotal ?? 0;
          const m = a.countMale ?? 0;
          const w = a.countFemale ?? 0;
          const d = a.countDiverse ?? 0;
          const hasImg = Boolean(a.project?.imageUrl);
          return (
            <div key={i} className="group/activity relative">
              <button
                type="button"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  openActivity(a);
                }}
                onMouseEnter={(e) => handleActivityMouseEnter(e, a)}
                className={`relative w-full overflow-hidden rounded border border-black/10 px-2 py-1.5 text-left shadow-sm transition-shadow hover:shadow md:pl-8 ${bgClass}`}
              >
                {hasImg && a.project && (
                  <ProtectedImage
                    src={a.project.imageUrl || undefined}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 w-full h-full object-cover blur-[3px] opacity-35"
                  />
                )}
                {hasImg && <div className="absolute inset-0 calendar-img-overlay" aria-hidden />}
                {isCancelledActivity(a.executionStatus) && (
                  <div className="relative z-10 mb-1 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                    Ausgefallen
                  </div>
                )}
                <div
                  className={`relative z-10 text-[11px] font-medium truncate ${hasImg ? 'text-white drop-shadow-sm' : 'text-gray-800'}`}
                >
                  {title}
                  {subtitle ? ` (${subtitle})` : ''}
                </div>
                {time && (
                  <div
                    className={`relative z-10 text-[10px] ${hasImg ? 'text-white drop-shadow-sm' : 'text-gray-700'}`}
                  >
                    {time} Uhr
                  </div>
                )}
                {!isCancelledActivity(a.executionStatus) && (
                  <div
                    className={`relative z-10 text-[10px] ${hasImg ? 'text-white drop-shadow-sm' : 'text-gray-700'}`}
                  >
                    {counts} (m:{m}, w:{w}, d:{d})
                  </div>
                )}
              </button>
              <button
                type="button"
                className="pointer-events-none absolute left-1 top-2 z-20 hidden h-5 w-5 items-center justify-center rounded bg-white/92 text-viridian shadow-sm opacity-0 ring-1 ring-black/10 transition-opacity md:flex md:group-hover/activity:pointer-events-auto md:group-hover/activity:opacity-100 md:group-focus-within/activity:pointer-events-auto md:group-focus-within/activity:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setEdit(a);
                }}
                aria-label={`${title}${subtitle ? ` (${subtitle})` : ''} bearbeiten`}
                title="Bearbeiten"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="pb-20 md:pb-0">
      {/* Mobile: stacked layout; Desktop: row layout */}
      <div className="flex flex-col gap-2 mb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between md:block">
          <PageHeader className="mb-0" description={label} title="Kalender" />
          {/* Navigation controls on mobile - inline with title */}
          <div className="flex gap-1.5 md:hidden">
            {showTodayButton && (
              <Button className="rounded-lg px-2.5 py-1.5" size="sm" onClick={gotoToday}>
                Heute
              </Button>
            )}
            <button
              className="calendar-control px-2 py-1.5 rounded text-sm"
              onClick={goToPrevious}
            >
              «
            </button>
            <button
              className="calendar-control px-2 py-1.5 rounded text-sm"
              onClick={goToNext}
            >
              »
            </button>
          </div>
        </div>
        {/* Desktop controls */}
        <DemoHoverHint
          title="Kalendersteuerung"
          description="Wechselt zwischen Monaten und Wochen. Der Heute-Knopf erscheint nur, wenn der aktuelle Zeitraum nicht bereits sichtbar ist."
          placement="bottom"
          align="end"
        >
          <div className="hidden md:flex gap-2">
            {showTodayButton && (
              <Button onClick={gotoToday}>
                Heute
              </Button>
            )}
            <button
              className="calendar-control px-3 py-2 rounded"
              onClick={goToPrevious}
            >
              «
            </button>
            <button
              className="calendar-control px-3 py-2 rounded"
              onClick={goToNext}
            >
              »
            </button>
            <div className="stats-kpi-toggle inline-flex items-center gap-1 rounded-lg p-1" role="tablist" aria-label="Kalenderansicht">
              <button
                type="button"
                className={`stats-kpi-toggle-button rounded-md px-3 py-2 text-sm transition-colors ${
                  calendarView === 'month' ? 'stats-kpi-toggle-button-active font-medium' : ''
                }`}
                onClick={() => setView('month')}
                aria-pressed={calendarView === 'month'}
              >
                Monat
              </button>
              <button
                type="button"
                className={`stats-kpi-toggle-button rounded-md px-3 py-2 text-sm transition-colors ${
                  calendarView === 'week' ? 'stats-kpi-toggle-button-active font-medium' : ''
                }`}
                onClick={() => setView('week')}
                aria-pressed={calendarView === 'week'}
              >
                Woche
              </button>
            </div>
          </div>
        </DemoHoverHint>

        <div className="flex flex-wrap items-center gap-2 md:hidden">
          <div className="stats-kpi-toggle inline-flex items-center gap-1 rounded-lg p-1" role="tablist" aria-label="Kalenderansicht mobil">
            <button
              type="button"
              className={`stats-kpi-toggle-button rounded-md px-3 py-2 text-sm transition-colors ${
                calendarView === 'month' ? 'stats-kpi-toggle-button-active font-medium' : ''
              }`}
              onClick={() => setView('month')}
              aria-pressed={calendarView === 'month'}
            >
              Monat
            </button>
            <button
              type="button"
              className={`stats-kpi-toggle-button rounded-md px-3 py-2 text-sm transition-colors ${
                calendarView === 'three-day' ? 'stats-kpi-toggle-button-active font-medium' : ''
              }`}
              onClick={() => setView('three-day')}
              aria-pressed={calendarView === 'three-day'}
            >
              3 Tage
            </button>
          </div>
        </div>
      </div>

      {/* Month grid */}
      {calendarView === 'month' && (
        <DemoHoverHint
          title="Kalenderflaeche"
          description="Ein Klick auf ein Tagesfeld zeigt im Desktop die Aktivitaeten direkt unter dem Kalender. Plus- und Schliesszeit-Buttons erscheinen im Desktop beim Hover; mobil bleiben sie in der Monatsuebersicht ausgeblendet."
          placement="bottom"
          className="demo-hover-hint-anchor-top"
        >
          <div className="calendar-surface rounded-lg shadow overflow-hidden">
          <div className="calendar-header-row grid grid-cols-7 text-xs md:text-sm font-medium">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, idx) => (
              <div key={d} className="px-2 py-2 text-center">
                <div>{d}</div>
                {openingHours && (
                  <div className="text-[10px] text-viridian font-normal">
                    {getOpeningHoursForDay(idx)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-auto">
            {monthWeeks.flat().map((day, idx) => {
              const iso = fmtLocalISO(day);
              const isToday = iso === todayISO;
              const isOtherMonth = day.getMonth() !== cursor.getMonth();
              const hasHoliday = !!holidaysByDate.get(iso)?.length;
              const hasSchoolHoliday = showSchool && schoolLabelFor(iso);
              return (
                <div
                  key={idx}
                  onClick={isMobile ? undefined : () => openActivitiesForDate(iso)}
                  className={`calendar-day-cell group relative min-h-[6.25rem] md:min-h-[8rem] border p-1 text-left transition-colors ${!isMobile ? 'cursor-pointer' : ''} ${
                    isOtherMonth
                      ? 'calendar-day-cell-other'
                      : isToday
                        ? 'calendar-day-cell-today'
                        : ''
                  } ${!isMobile && selectedDateISO === iso ? 'calendar-day-cell-selected' : ''}`}
                >
                  {/* Top row: Day number + desktop actions overlay */}
                  <div className="mb-0.5 flex items-start gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openActivitiesForDate(iso);
                      }}
                      className={`calendar-day-number text-xs md:text-sm font-medium shrink-0 rounded px-1 -mx-1 hover:bg-black/5 underline-offset-2 hover:underline ${isOtherMonth ? 'calendar-day-number-other' : ''}`}
                      title={`Aktivitäten am ${day.toLocaleDateString('de-DE')} anzeigen`}
                      aria-label={`Aktivitäten am ${day.toLocaleDateString('de-DE')} anzeigen`}
                    >
                      {day.getDate()}
                    </button>
                    {showCalendarDayActions && (
                      <div className="calendar-day-actions absolute right-1 top-1 z-10 flex items-center gap-1">
                        {effectiveOrgId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClosureDate(iso);
                            }}
                            className={`calendar-closure-button inline-flex h-5 w-5 items-center justify-center rounded-md border shadow-sm opacity-100 transition-all md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${closureDaysByDate.has(iso) ? 'calendar-closure-button-active' : ''}`}
                            aria-label={`Schließzeit für ${day.toLocaleDateString('de-DE')} bearbeiten`}
                            title={closureDaysByDate.has(iso) ? 'Schließung bearbeiten' : 'Tag als geschlossen markieren'}
                          >
                            <Building2 className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddActivityForDate(iso);
                          }}
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white/92 text-viridian shadow-sm opacity-100 transition-all md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 hover:bg-white"
                          aria-label={`Aktivität zu ${day.toLocaleDateString('de-DE')} hinzufügen`}
                          title="Aktivität zu diesem Tag hinzufügen"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  {hasHoliday && (
                    <div
                      className="calendar-holiday-badge mb-0.5 block w-full rounded px-1 py-[1px] text-[9px] md:text-[10px] font-semibold border truncate"
                      title={holidaysByDate
                        .get(iso)!
                        .map((h) => h.name)
                        .join(', ')}
                    >
                      {holidaysByDate.get(iso)![0].name}
                    </div>
                  )}
                  {/* School holiday band */}
                  {hasSchoolHoliday && (
                    <div
                      className="calendar-school-badge w-full h-3.5 rounded-sm border text-[9px] md:text-[10px] overflow-hidden px-1 mb-0.5"
                      title={schoolLabelFor(iso) || undefined}
                    >
                      <span className="truncate inline-block align-top leading-[14px]">{schoolLabelFor(iso)}</span>
                    </div>
                  )}
                  {renderClosureBadge(iso, true)}
                  {renderEntries(
                    iso,
                    isMobile ? (hasSchoolHoliday ? 2 : 3) : hasSchoolHoliday ? 5 : 6,
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </DemoHoverHint>
      )}

      {/* Day-range view */}
      {calendarView !== 'month' && (
        <DemoHoverHint
          title="Kalenderflaeche"
          description="Die mobile 3-Tage-Ansicht zeigt Schliesszeit- und Plus-Buttons direkt pro Tag. So kannst du Tage als geschlossen markieren oder neue Aktivitaeten hinzufuegen, ohne in die Monatsuebersicht zu wechseln."
          placement="bottom"
          className="demo-hover-hint-anchor-top"
        >
          <div className="calendar-surface rounded-lg shadow overflow-hidden">
          <div
            className="calendar-header-row grid text-xs md:text-sm font-medium"
            style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))` }}
          >
            {visibleDays.map((d) => (
              <div key={d.toISOString()} className="px-2 py-2 text-center">
                <div>
                  {d.toLocaleDateString('de-DE', {
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </div>
                {openingHours && (
                  <div className="text-[10px] text-viridian font-normal">
                    {getOpeningHoursForDay((d.getDay() + 6) % 7)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))` }}
          >
            {visibleDays.map((d) => {
              const iso = fmtLocalISO(d);
              const isToday = iso === todayISO;
              return (
                <div
                  key={iso}
                  onClick={isMobile ? undefined : () => openActivitiesForDate(iso)}
                  className={`calendar-day-cell group min-h-[68vh] md:min-h-[72vh] lg:min-h-[32rem] border p-2 text-left transition-colors ${!isMobile ? 'cursor-pointer' : ''} ${isToday ? 'calendar-day-cell-today' : ''} ${!isMobile && selectedDateISO === iso ? 'calendar-day-cell-selected' : ''}`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openActivitiesForDate(iso);
                      }}
                      className="rounded px-1 -mx-1 text-xs font-medium text-gray-700 hover:bg-black/5 hover:text-viridian hover:underline underline-offset-2"
                      title={`Aktivitäten am ${d.toLocaleDateString('de-DE')} anzeigen`}
                      aria-label={`Aktivitäten am ${d.toLocaleDateString('de-DE')} anzeigen`}
                    >
                      {d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    </button>
                    {showCalendarDayActions && (
                      <div className="calendar-day-actions flex shrink-0 items-center gap-1">
                        {effectiveOrgId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClosureDate(iso);
                            }}
                            className={`calendar-closure-button inline-flex h-6 w-6 items-center justify-center rounded-md border shadow-sm opacity-100 transition-all md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${closureDaysByDate.has(iso) ? 'calendar-closure-button-active' : ''}`}
                            aria-label={`Schließzeit für ${d.toLocaleDateString('de-DE')} bearbeiten`}
                            title={closureDaysByDate.has(iso) ? 'Schließung bearbeiten' : 'Tag als geschlossen markieren'}
                          >
                            <Building2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddActivityForDate(iso);
                          }}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white/92 text-viridian shadow-sm opacity-100 transition-all md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 hover:bg-white"
                          aria-label={`Aktivität zu ${d.toLocaleDateString('de-DE')} hinzufügen`}
                          title="Aktivität zu diesem Tag hinzufügen"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {!!holidaysByDate.get(iso)?.length && (
                    <div
                      className="calendar-holiday-badge inline-block mb-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border truncate max-w-full"
                      title={holidaysByDate
                        .get(iso)!
                        .map((h) => h.name)
                        .join(', ')}
                    >
                      {holidaysByDate.get(iso)![0].name}
                    </div>
                  )}
                  {showSchool && schoolLabelFor(iso) && (
                    <div
                      className="calendar-school-badge mb-1 px-1.5 py-0.5 rounded text-[10px] font-medium border truncate max-w-full"
                      title={schoolLabelFor(iso) || undefined}
                    >
                      {schoolLabelFor(iso)}
                    </div>
                  )}
                  {renderClosureBadge(iso)}
                  {renderEntriesWeek(iso)}
                </div>
              );
            })}
          </div>
        </div>
        </DemoHoverHint>
      )}

      {selectedDateISO && !isMobile && (
        <DemoHoverHint
          title="Tagesliste"
          description="Nach dem Klick auf einen Tag erscheinen hier die Aktivitaeten dieses Tages. Ueber Pfeil, Plus und Stift wechselst du zur Liste, legst neu an oder bearbeitest direkt."
          placement="bottom"
          className="demo-hover-hint-anchor-top"
        >
          <section className="calendar-day-list activities-desktop-table-shell mt-4 hidden overflow-hidden rounded-lg border shadow md:block" aria-live="polite">
          <div className="calendar-day-list-header flex flex-col gap-3 border-b bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Tagesauswahl
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Aktivitäten am {selectedDateLabel}
                </h3>
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-2 py-1 text-xs text-gray-700">
                  {selectedDayActivities.length} {selectedDayActivities.length === 1 ? 'Eintrag' : 'Einträge'}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="calendar-control inline-flex h-10 w-10 items-center justify-center rounded-lg"
                onClick={() => openFilteredActivitiesForDate(selectedDateISO)}
                aria-label={`Aktivitäten am ${selectedDateLabel} in der Aktivitätenliste öffnen`}
                title="In Aktivitäten öffnen"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-viridian px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cambridge-blue"
                onClick={() => openAddActivityForDate(selectedDateISO)}
              >
                <Plus className="h-4 w-4" />
                Hinzufügen
              </button>
            </div>
          </div>

          {selectedDayActivities.length > 0 ? (
            <div className="overflow-hidden">
              <table className="calendar-day-list-table activities-desktop-table w-full min-w-0 table-fixed">
                <thead className="bg-azure-web">
                  <tr>
                    <th className="activities-col-date px-2 py-3 text-left text-sm font-semibold text-gray-700 lg:px-4">
                      Zeit
                    </th>
                    <th className="activities-col-type px-2 py-3 text-left text-sm font-semibold text-gray-700 lg:px-4">
                      Typ
                    </th>
                    <th className="activities-col-title px-2 py-3 text-left text-sm font-semibold text-gray-700 lg:px-4">
                      Titel / Projekt
                    </th>
                    <th className="activities-col-participants px-2 py-3 text-left text-sm font-semibold text-gray-700 lg:px-4">
                      <span className="hidden xl:inline">Teilnehmende</span>
                      <span className="xl:hidden" title="Teilnehmende">TN</span>
                    </th>
                    <th className="activities-col-duration hidden px-2 py-3 text-left text-sm font-semibold text-gray-700 xl:table-cell xl:px-4">
                      Dauer
                    </th>
                    <th className="activities-col-action px-2 py-3 text-center text-sm font-semibold text-gray-700 lg:px-4">
                      Aktion
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedDayActivities.map((activity) => {
                    const type = typeLabel[activity.type] || activity.type;
                    const title = activity.title || '-';
                    const projectTitle = activity.project?.title || '-';
                    const time = fmtTimeRange(activity.startTime, activity.endTime);
                    const total = activity.countTotal ?? 0;
                    const male = activity.countMale ?? 0;
                    const female = activity.countFemale ?? 0;
                    const diverse = activity.countDiverse ?? 0;

                    return (
                      <tr key={activity.id} className="bg-white hover:bg-azure-web">
                        <td className="activities-col-date whitespace-normal px-2 py-4 text-sm leading-snug text-gray-700 lg:px-4">
                          {time ? `${time} Uhr` : '-'}
                        </td>
                        <td className="activities-col-type px-2 py-4 text-sm lg:px-4">
                          <span className={`inline-flex items-center rounded-full border border-black/10 px-2 py-1 text-xs font-medium tracking-tight ${activityListTypePillClass[activity.type] || 'bg-gray-700 text-white'}`}>
                            <span className="hidden lg:inline">{type}</span>
                            <span className="lg:hidden" title={type}>{type.split(' ')[0]}</span>
                          </span>
                        </td>
                        <td className="activities-col-title min-w-0 px-2 py-4 text-sm lg:px-4">
                          <div className="truncate font-medium text-gray-900">{title}</div>
                          <div className="truncate text-xs text-gray-600">{projectTitle}</div>
                          {activity.location?.name && (
                            <div className="truncate text-xs text-gray-500">{activity.location.name}</div>
                          )}
                        </td>
                        <td className="activities-col-participants whitespace-nowrap px-2 py-4 text-sm lg:px-4">
                          {isCancelledActivity(activity.executionStatus) ? (
                            <ActivityExecutionStatusBadge status={activity.executionStatus} />
                          ) : (
                            <>
                              <span className="font-medium">{total}</span>
                              <span className="ml-1 hidden text-xs text-gray-500 xl:inline">
                                (m:{male}, w:{female}, d:{diverse})
                              </span>
                            </>
                          )}
                        </td>
                        <td className="activities-col-duration hidden px-2 py-4 text-sm xl:table-cell xl:px-4">
                          {fmtDuration(activity)}
                        </td>
                        <td className="activities-col-action relative overflow-hidden px-2 py-4 text-center text-sm lg:px-4">
                          {activity.project?.imageUrl ? (
                            <>
                              <ProtectedImage
                                src={activity.project.imageUrl || undefined}
                                alt=""
                                aria-hidden
                                className="absolute inset-0 h-full w-full object-cover object-right opacity-70"
                              />
                              <div className="activity-image-fade absolute inset-0" aria-hidden />
                            </>
                          ) : activity.project?.color ? (
                            <>
                              <div
                                className="absolute inset-0 opacity-30"
                                style={{ backgroundColor: activity.project.color || undefined }}
                                aria-hidden
                              />
                              <div className="activity-image-fade absolute inset-0" aria-hidden />
                            </>
                          ) : null}
                          <button
                            type="button"
                            className="activity-edit-button relative z-10 p-2"
                            onClick={() => setEdit(activity)}
                            aria-label={`${title !== '-' ? title : projectTitle} bearbeiten`}
                            title="Bearbeiten"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              className="rounded-none border-x-0 border-b-0"
              description="Wähle einen anderen Tag oder lege eine neue Aktivität an."
              title="Keine Aktivitäten an diesem Tag"
            />
          )}
        </section>
        </DemoHoverHint>
      )}

      {picker && (
        <ProjectPickerModal
          onPick={(p) => {
            setPicker(null);
            setModal({ date: picker.date, project: p });
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {modal && (
        <ActivityQuickAdd
          dateISO={modal.date}
          onClose={() => setModal(null)}
          project={modal.project}
        />
      )}
      {edit && (
        <ActivityQuickAdd
          dateISO={edit.date}
          onClose={() => setEdit(null)}
          project={edit.project ?? undefined}
          activity={edit}
        />
      )}
      {closureDate && effectiveOrgId && (
        <CalendarClosureModal
          date={closureDate}
          closureDay={selectedClosureDay}
          onClose={() => setClosureDate(null)}
          onSave={(payload) => saveClosureMutation.mutate({ date: closureDate, payload })}
          onDelete={() => deleteClosureMutation.mutate(closureDate)}
          saving={saveClosureMutation.isPending}
          deleting={deleteClosureMutation.isPending}
        />
      )}
      
      {/* Custom tooltip for activity hover */}
      <ActivityTooltip
        activity={tooltipActivity}
        position={tooltipPosition}
        typeLabel={typeLabel}
        fmtTimeRange={fmtTimeRange}
      />
      
      {/* Tooltip for "+x more" badge */}
      {moreTooltip && (() => {
        const MoreTooltipContent = () => {
          const { ref, layout } = useClampedTooltipLayout(moreTooltip.position, true, {
            preferBelow: true,
            preferBelowOnOverflow: true,
          });

          if (!layout) {
            return (
              <div className="fixed left-[-9999px] top-[-9999px] z-[9999] pointer-events-none" aria-hidden>
                <div
                  ref={ref}
                  className="calendar-tooltip-panel text-xs rounded-xl px-3.5 py-2.5 shadow-xl w-[320px] max-w-[calc(100vw-24px)] border"
                >
                  <div className="font-semibold mb-1.5 border-b pb-1 text-viridian" style={{ borderColor: 'var(--border-strong)' }}>
                    +{moreTooltip.activities.length} weitere Aktivitäten
                  </div>
                  <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(50vh - 60px)' }}>
                    {moreTooltip.activities.map((a, i) => {
                      const label = `${a.project?.title || typeLabel[a.type] || a.type}${a.title ? ` (${a.title})` : ''}`;
                      const time = fmtTimeRange(a.startTime, a.endTime);
                      return (
                        <div key={i} className="calendar-tooltip-body leading-snug">
                          <span className="font-medium text-[color:var(--text-primary)]">{label}</span>
                          {time && <span className="calendar-tooltip-meta ml-1 text-[10px]">{time}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              className="fixed z-[9999] pointer-events-none animate-tooltip-fade-in"
              style={{ left: layout.left, top: layout.top, transform: layout.transform }}
            >
              <div
                ref={ref}
                className="calendar-tooltip-panel relative flex flex-col overflow-hidden text-xs rounded-xl px-3.5 py-2.5 shadow-xl w-[320px] max-w-[calc(100vw-24px)] border"
                style={{ maxHeight: layout.maxHeight }}
              >
                <div className="font-semibold mb-1.5 shrink-0 border-b pb-1 text-viridian" style={{ borderColor: 'var(--border-strong)' }}>
                  +{moreTooltip.activities.length} weitere Aktivitäten
                </div>
                <div className="space-y-1 overflow-y-auto min-h-0 flex-1 pr-1">
                  {moreTooltip.activities.map((a, i) => {
                    const label = `${a.project?.title || typeLabel[a.type] || a.type}${a.title ? ` (${a.title})` : ''}`;
                    const time = fmtTimeRange(a.startTime, a.endTime);
                    return (
                      <div key={i} className="calendar-tooltip-body leading-snug">
                        <span className="font-medium text-[color:var(--text-primary)]">{label}</span>
                        {time && <span className="calendar-tooltip-meta ml-1 text-[10px]">{time}</span>}
                      </div>
                    );
                  })}
                </div>
                {/* Tooltip arrow */}
                <div
                  className={`absolute w-2 h-2 -translate-x-1/2 ${layout.arrowClass}`}
                  style={{ left: layout.arrowCenterPx, backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border-strong)', borderRightWidth: '1px', borderBottomWidth: '1px' }}
                />
              </div>
            </div>
          );
        };

        return createPortal(<MoreTooltipContent />, document.body);
      })()}
    </div>
  );
}
