import { useEffect, useMemo, useState, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useIsMobile } from '@/lib/useIsMobile';
import type { Project } from '@/lib/projects';
import ActivityQuickAdd from './CalendarQuickAddModal.tsx';
import ProjectPickerModal from './ProjectPickerModal';
import { useActivities, Activity } from '@/lib/activities';
// colorForActivityType no longer needed after switching to class-based palette
import ActivityDetailModal from './ActivityDetailModal';
import { getHolidaysInRange, readHolidayPrefs, type Holiday } from '@/lib/holidays';
import { getSchoolHolidaysInRange, type SchoolHolidayRange } from '@/lib/schoolHolidays';
import { getOpeningHours, OpeningHours } from '@/lib/orgs';
import { useAuth } from '@/lib/auth';
import { useOrgScope, useOrgScopeKey } from '@/lib/orgScope';
import { addDevMetricEvent, finishDevFlow, markDevFlow, startDevFlow } from '@/lib/devMetrics';
import type React from 'react';
import { createPortal } from 'react-dom';
import ProtectedImage from '@/components/ProtectedImage';

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
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
  const time = fmtTimeRange(activity.startTime, activity.endTime);
  const total = activity.countTotal ?? 0;
  const m = activity.countMale ?? 0;
  const w = activity.countFemale ?? 0;
  const d = activity.countDiverse ?? 0;
  const loc = activity.location?.name;
  
  const { ref, layout } = useClampedTooltipLayout(position, true);
  if (!layout) {
    // First paint: render off-screen to measure without flashing.
    return createPortal(
      <div className="fixed left-[-9999px] top-[-9999px] z-[9999] pointer-events-none" aria-hidden>
        <div
          ref={ref}
          className="text-xs rounded-lg px-3 py-2 shadow-xl w-[280px] max-w-[calc(100vw-24px)] border"
          style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="font-semibold mb-1 text-viridian">{label}</div>
          {time && <div className="text-gray-300"><span className="text-gray-400">Zeit:</span> {time}</div>}
          <div className="text-gray-300">
            <span className="text-gray-400">Teilnehmende:</span> {total}
            <span className="text-[10px] text-gray-400 ml-1">(m:{m}, w:{w}, d:{d})</span>
          </div>
          {loc && <div className="text-gray-300"><span className="text-gray-400">Ort:</span> {loc}</div>}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none animate-tooltip-fade-in"
      style={{ left: layout.left, top: layout.top, transform: layout.transform }}
    >
      <div
        ref={ref}
        className="relative text-xs rounded-lg px-3 py-2 shadow-xl w-[280px] max-w-[calc(100vw-24px)] border"
        style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="font-semibold mb-1 text-viridian">{label}</div>
        {time && <div className="text-gray-300"><span className="text-gray-400">Zeit:</span> {time}</div>}
        <div className="text-gray-300">
          <span className="text-gray-400">Teilnehmende:</span> {total}
          <span className="text-[10px] text-gray-400 ml-1">(m:{m}, w:{w}, d:{d})</span>
        </div>
        {loc && <div className="text-gray-300"><span className="text-gray-400">Ort:</span> {loc}</div>}
        {/* Tooltip arrow */}
        <div
          className={`absolute w-2 h-2 -translate-x-1/2 ${layout.arrowClass}`}
          style={{ left: layout.arrowCenterPx, backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border-subtle)', borderRightWidth: '1px', borderBottomWidth: '1px' }}
        />
      </div>
    </div>,
    document.body,
  );
}
// duplicate import removed

type View = 'month' | 'week';

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

export default function Calendar() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { scope } = useOrgScope();
  const scopeKey = useOrgScopeKey();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [showAdjacentMonthActivities, setShowAdjacentMonthActivities] = useState<boolean>(() => {
    try {
      return localStorage.getItem('calendar:show-adjacent-activities') === '1';
    } catch {
      return false;
    }
  });
  const [modal, setModal] = useState<{ date: string; project?: Project } | null>(null);
  const [picker, setPicker] = useState<{ date: string } | null>(null);
  const [detail, setDetail] = useState<Activity | null>(null);
  const [edit, setEdit] = useState<Activity | null>(null);
  
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
      localStorage.setItem('calendar:show-adjacent-activities', showAdjacentMonthActivities ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [showAdjacentMonthActivities]);

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
    const base = cursor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    if (view === 'week') {
      const kw = getISOWeek(cursor);
      return `${base} (KW ${kw})`;
    }
    return base;
  }, [cursor, view]);
  const fmtLocalISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmtTime = (t?: string | null) => (t ? String(t).slice(0, 5) : '');
  const fmtTimeRange = (s?: string | null, e?: string | null) => {
    const S = fmtTime(s);
    const E = fmtTime(e);
    return S && E ? `${S} – ${E}` : S || E || '';
  };
  const openActivitiesForDate = (iso: string) => {
    const qp = new URLSearchParams({ date: iso });
    navigate(`/activities?${qp.toString()}`);
  };
  const handleDayAddKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, iso: string) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (isMobile) navigate(`/activities/new/select-project?date=${iso}`);
    else setPicker({ date: iso });
  };

  // Build month grid (6 weeks)
  const monthWeeks = useMemo(() => {
    if (view !== 'month') return [] as Date[][];
    const first = startOfMonth(cursor);
    const gridStart = startOfWeek(first);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));
    const weeks: Date[][] = [];
    for (let w = 0; w < 6; w++) weeks.push(days.slice(w * 7, w * 7 + 7));
    return weeks;
  }, [cursor, view]);

  const todayISO = fmtLocalISO(new Date());
  const gotoToday = () => setCursor(new Date());
  const weekDays = useMemo(() => {
    if (view !== 'week') return [] as Date[];
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor, view]);

  // Compute visible range and fetch activities
  const range = useMemo(() => {
    if (view === 'month') {
      const first = startOfMonth(cursor);
      const gridStart = startOfWeek(first);
      const gridEnd = addDays(gridStart, 41);
      return { from: fmtLocalISO(gridStart), to: fmtLocalISO(gridEnd) };
    }
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    return { from: fmtLocalISO(start), to: fmtLocalISO(end) };
  }, [cursor, view]);
  const activitiesQ = useActivities({ from: range.from, to: range.to });
  const activities = activitiesQ.data;
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
  const pickBgClass = (title?: string, type?: string) => {
    if (type && typeBgClass[type]) return typeBgClass[type];
    if (!title) return 'bg-slate-300/40';
    let h = 0;
    for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
    return paletteClasses[h % paletteClasses.length];
  };
  
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
          const bgClass = pickBgClass(
            a.project?.title || a.title || typeLabel[a.type] || '',
            a.type,
          );
          const hasImg = Boolean(a.project?.imageUrl);
          return (
            <button
              key={i}
              type="button"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                setDetail(a);
              }}
              onMouseEnter={(e) => handleActivityMouseEnter(e, a)}
              className={`relative w-full h-4 md:h-5 rounded text-[9px] md:text-[10px] leading-4 md:leading-5 px-1 truncate text-left overflow-hidden border border-black/10 ${bgClass}`}
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
                {label}
              </span>
            </button>
          );
        })}
        {hidden > 0 && (
          <div 
            className="h-4 rounded bg-cambridge-blue/35 text-[9px] md:text-[10px] leading-4 px-1 text-gray-900 font-medium border border-black/10 cursor-pointer hover:bg-cambridge-blue/50 transition-colors"
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
          const bgClass = pickBgClass(
            a.project?.title || a.title || typeLabel[a.type] || '',
            a.type,
          );
          const time = fmtTimeRange(a.startTime, a.endTime);
          const counts = a.countTotal ?? 0;
          const m = a.countMale ?? 0;
          const w = a.countFemale ?? 0;
          const d = a.countDiverse ?? 0;
          const hasImg = Boolean(a.project?.imageUrl);
          return (
            <button
              key={i}
              type="button"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                setDetail(a);
              }}
              onMouseEnter={(e) => handleActivityMouseEnter(e, a)}
              className={`relative w-full rounded px-2 py-1.5 text-left shadow-sm hover:shadow transition-shadow overflow-hidden border border-black/10 ${bgClass}`}
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
              <div
                className={`relative z-10 text-[10px] ${hasImg ? 'text-white drop-shadow-sm' : 'text-gray-700'}`}
              >
                {counts} (m:{m}, w:{w}, d:{d})
              </div>
            </button>
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
          <div>
            <h2 className="text-xl md:text-3xl font-bold text-viridian">Kalender</h2>
            <div className="text-gray-600 text-sm md:text-lg">{label}</div>
          </div>
          {/* Navigation controls on mobile - inline with title */}
          <div className="flex gap-1.5 md:hidden">
            <button className="bg-viridian text-white px-2.5 py-1.5 rounded text-sm" onClick={gotoToday}>
              Heute
            </button>
            <button
              className="calendar-control px-2 py-1.5 rounded text-sm"
              onClick={() =>
                setCursor((c) => (view === 'week' ? addDays(startOfWeek(c), -7) : addMonths(c, -1)))
              }
            >
              «
            </button>
            <button
              className="calendar-control px-2 py-1.5 rounded text-sm"
              onClick={() =>
                setCursor((c) => (view === 'week' ? addDays(startOfWeek(c), 7) : addMonths(c, 1)))
              }
            >
              »
            </button>
          </div>
        </div>
        {/* Desktop controls */}
        <div className="hidden md:flex gap-2">
          <button className="bg-viridian text-white px-3 py-2 rounded" onClick={gotoToday}>
            Heute
          </button>
          <button
            className="calendar-control px-3 py-2 rounded"
            onClick={() =>
              setCursor((c) => (view === 'week' ? addDays(startOfWeek(c), -7) : addMonths(c, -1)))
            }
          >
            «
          </button>
          <button
            className="calendar-control px-3 py-2 rounded"
            onClick={() =>
              setCursor((c) => (view === 'week' ? addDays(startOfWeek(c), 7) : addMonths(c, 1)))
            }
          >
            »
          </button>
          <select
            value={view}
            title="Ansicht wählen"
            onChange={(e) => setView(e.target.value as View)}
            className="calendar-control rounded px-2 py-2"
          >
            <option value="month">Monat</option>
            <option value="week">Woche</option>
          </select>
          {view === 'month' && (
            <label className="calendar-control-toggle flex items-center gap-2 px-3 py-2 rounded select-none" title="Aktivitäten aus dem Vor- und Folgemonat in der Monatsansicht anzeigen">
              <input
                type="checkbox"
                className="accent-viridian"
                checked={showAdjacentMonthActivities}
                onChange={(e) => setShowAdjacentMonthActivities(e.target.checked)}
              />
              <span className="text-sm whitespace-nowrap">Vormonat/Folgemonat</span>
            </label>
          )}
        </div>
      </div>

      {/* Month grid */}
      {view === 'month' && (
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
          <div className="grid grid-cols-7 grid-rows-6">
            {monthWeeks.flat().map((day, idx) => {
              const iso = fmtLocalISO(day);
              const isToday = iso === todayISO;
              const isOtherMonth = day.getMonth() !== cursor.getMonth();
              const showEntriesForDay = !isOtherMonth || showAdjacentMonthActivities;
              const hasHoliday = !!holidaysByDate.get(iso)?.length;
              const hasSchoolHoliday = showSchool && schoolLabelFor(iso);
              return (
                <div
                  key={idx}
                  className={`calendar-day-cell relative h-24 md:h-32 border p-1 text-left focus:outline-none focus:ring-2 focus:ring-viridian transition-colors ${
                    isOtherMonth
                      ? 'calendar-day-cell-other'
                      : isToday
                        ? 'calendar-day-cell-today bg-mint-green/40 ring-2 ring-mint-green'
                        : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (isMobile) navigate(`/activities/new/select-project?date=${iso}`);
                    else setPicker({ date: iso });
                  }}
                  onKeyDown={(e) => handleDayAddKeyDown(e, iso)}
                  title={`Aktivität am ${day.toLocaleDateString('de-DE')} hinzufügen`}
                >
                  {/* Top row: Day number + Holiday badge inline */}
                  <div className="flex items-start gap-1 mb-0.5">
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
                    {hasHoliday && (
                      <div
                        className="calendar-holiday-badge px-1 py-[1px] rounded text-[9px] md:text-[10px] font-semibold border truncate max-w-[calc(100%-1.5rem)]"
                        title={holidaysByDate
                          .get(iso)!
                          .map((h) => h.name)
                          .join(', ')}
                      >
                        {holidaysByDate.get(iso)![0].name}
                      </div>
                    )}
                  </div>
                  {/* School holiday band */}
                  {hasSchoolHoliday && (
                    <div
                      className="calendar-school-badge w-full h-3.5 rounded-sm border text-[9px] md:text-[10px] overflow-hidden px-1 mb-0.5"
                      title={schoolLabelFor(iso) || undefined}
                    >
                      <span className="truncate inline-block align-top leading-[14px]">{schoolLabelFor(iso)}</span>
                    </div>
                  )}
                  {showEntriesForDay ? renderEntries(iso, hasSchoolHoliday ? 2 : 3) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week view */}
      {view === 'week' && (
        <div className="calendar-surface rounded-lg shadow overflow-hidden">
          <div className="calendar-header-row grid grid-cols-7 text-xs md:text-sm font-medium">
            {weekDays.map((d, idx) => (
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
                    {getOpeningHoursForDay(idx)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {weekDays.map((d) => {
              const iso = fmtLocalISO(d);
              const isToday = iso === todayISO;
              return (
                <div
                  key={iso}
                  className={`calendar-day-cell min-h-[68vh] md:min-h-[72vh] lg:min-h-[32rem] border p-2 text-left focus:outline-none transition-colors ${isToday ? 'calendar-day-cell-today bg-mint-green/40 ring-1 ring-mint-green/60' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (isMobile) navigate(`/activities/new/select-project?date=${iso}`);
                    else setPicker({ date: iso });
                  }}
                  onKeyDown={(e) => handleDayAddKeyDown(e, iso)}
                  title={`Aktivität am ${d.toLocaleDateString('de-DE')} hinzufügen`}
                >
                  <div className="mb-1">
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
                  {renderEntriesWeek(iso)}
                </div>
              );
            })}
          </div>
        </div>
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
      {detail && (
        <ActivityDetailModal
          activity={detail}
          onClose={() => setDetail(null)}
          onEdit={(a) => {
            setDetail(null);
            setEdit(a);
          }}
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
                  className="text-xs rounded-lg px-3 py-2 shadow-xl w-[320px] max-w-[calc(100vw-24px)] border"
                  style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                >
                  <div className="font-semibold mb-1.5 text-viridian border-b pb-1" style={{ borderColor: 'var(--border-subtle)' }}>
                    +{moreTooltip.activities.length} weitere Aktivitäten
                  </div>
                  <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(50vh - 60px)' }}>
                    {moreTooltip.activities.map((a, i) => {
                      const label = `${a.project?.title || typeLabel[a.type] || a.type}${a.title ? ` (${a.title})` : ''}`;
                      const time = fmtTimeRange(a.startTime, a.endTime);
                      return (
                        <div key={i} className="text-gray-200">
                          <span className="font-medium">{label}</span>
                          {time && <span className="text-gray-400 ml-1 text-[10px]">{time}</span>}
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
                className="relative flex flex-col overflow-hidden text-xs rounded-lg px-3 py-2 shadow-xl w-[320px] max-w-[calc(100vw-24px)] border"
                style={{ maxHeight: layout.maxHeight, backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="font-semibold mb-1.5 text-viridian border-b pb-1 shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  +{moreTooltip.activities.length} weitere Aktivitäten
                </div>
                <div className="space-y-1 overflow-y-auto min-h-0 flex-1 pr-1">
                  {moreTooltip.activities.map((a, i) => {
                    const label = `${a.project?.title || typeLabel[a.type] || a.type}${a.title ? ` (${a.title})` : ''}`;
                    const time = fmtTimeRange(a.startTime, a.endTime);
                    return (
                      <div key={i} className="text-gray-200">
                        <span className="font-medium">{label}</span>
                        {time && <span className="text-gray-400 ml-1 text-[10px]">{time}</span>}
                      </div>
                    );
                  })}
                </div>
                {/* Tooltip arrow */}
                <div
                  className={`absolute w-2 h-2 -translate-x-1/2 ${layout.arrowClass}`}
                  style={{ left: layout.arrowCenterPx, backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border-subtle)', borderRightWidth: '1px', borderBottomWidth: '1px' }}
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
