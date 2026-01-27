import { useEffect, useMemo, useState, useRef } from 'react';
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
import { useOrgScope } from '@/lib/orgScope';
import type React from 'react';

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
  
  return (
    <div 
      className="fixed z-[9999] pointer-events-none animate-tooltip-fade-in"
      style={{ 
        left: position.x, 
        top: position.y,
        transform: 'translate(-50%, -100%) translateY(-8px)'
      }}
    >
      <div className="bg-gray-900/95 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-xs backdrop-blur-sm">
        <div className="font-semibold mb-1 text-mint-green">{label}</div>
        {time && <div className="text-gray-300"><span className="text-gray-400">Zeit:</span> {time}</div>}
        <div className="text-gray-300">
          <span className="text-gray-400">Teilnehmende:</span> {total} 
          <span className="text-[10px] text-gray-400 ml-1">(m:{m}, w:{w}, d:{d})</span>
        </div>
        {loc && <div className="text-gray-300"><span className="text-gray-400">Ort:</span> {loc}</div>}
        {/* Tooltip arrow */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900/95 rotate-45" />
      </div>
    </div>
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
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [modal, setModal] = useState<{ date: string; project?: Project } | null>(null);
  const [picker, setPicker] = useState<{ date: string } | null>(null);
  const [detail, setDetail] = useState<Activity | null>(null);
  const [edit, setEdit] = useState<Activity | null>(null);
  
  // Tooltip state for activity hover
  const [tooltipActivity, setTooltipActivity] = useState<Activity | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const tooltipTimeoutRef = useRef<number | null>(null);

  // Determine effective orgId for opening hours
  const effectiveOrgId = user?.role === 'superadmin'
    ? (typeof scope === 'string' ? scope : null)
    : (user?.orgId ?? null);

  // Fetch opening hours for the current organization
  const { data: openingHours } = useQuery({
    queryKey: ['opening-hours', effectiveOrgId],
    queryFn: () => getOpeningHours(effectiveOrgId!),
    enabled: !!effectiveOrgId,
  });

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
  const { data: activities } = useActivities({ from: range.from, to: range.to });
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
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!showSchool || !holidayState) {
        if (alive) setSchoolRanges(null);
        return;
      }
      try {
        const ranges = await getSchoolHolidaysInRange(holidayState, range.from, range.to);
        if (alive) setSchoolRanges(ranges);
      } catch {
        if (alive) setSchoolRanges(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [showSchool, holidayState, range.from, range.to]);
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
  const handleActivityMouseEnter = (e: React.MouseEvent, activity: Activity) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setTooltipActivity(activity);
  };
  
  const handleActivityMouseLeave = () => {
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setTooltipActivity(null);
      setTooltipPosition(null);
    }, 100);
  };
  
  // State for "+x more" tooltip
  const [moreTooltip, setMoreTooltip] = useState<{ activities: Activity[]; position: { x: number; y: number } } | null>(null);
  const moreTooltipTimeoutRef = useRef<number | null>(null);
  
  const handleMoreMouseEnter = (e: React.MouseEvent, hiddenActivities: Activity[]) => {
    if (moreTooltipTimeoutRef.current) {
      clearTimeout(moreTooltipTimeoutRef.current);
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMoreTooltip({
      activities: hiddenActivities,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top
      }
    });
  };
  
  const handleMoreMouseLeave = () => {
    moreTooltipTimeoutRef.current = window.setTimeout(() => {
      setMoreTooltip(null);
    }, 150);
  };
  
  const renderEntries = (iso: string, maxRows = 3) => {
    const items = activitiesByDate.get(iso) || [];
    if (!items.length) return null;
    const visible = items.slice(0, maxRows);
    const hiddenItems = items.slice(maxRows);
    const hidden = hiddenItems.length;
    return (
      <div className="space-y-0.5">
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
              onMouseLeave={handleActivityMouseLeave}
              className={`relative w-full h-4 md:h-5 rounded text-[9px] md:text-[10px] leading-4 md:leading-5 px-1 truncate text-left overflow-hidden border border-black/10 ${bgClass}`}
              aria-label={label}
            >
              {hasImg && a.project && (
                <img
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
      <div className="mt-2 space-y-2">
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
              onMouseLeave={handleActivityMouseLeave}
              className={`relative w-full rounded px-2 py-1.5 text-left shadow-sm hover:shadow transition-shadow overflow-hidden border border-black/10 ${bgClass}`}
            >
              {hasImg && a.project && (
                <img
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl md:text-3xl font-bold text-viridian">Kalender</h2>
          <div className="text-gray-600 text-base md:text-lg">{label}</div>
        </div>
        <div className="flex gap-2">
          <button className="bg-viridian text-white px-3 py-2 rounded" onClick={gotoToday}>
            Heute
          </button>
          <button
            className="bg-white border text-gray-700 px-3 py-2 rounded"
            onClick={() =>
              setCursor((c) => (view === 'week' ? addDays(startOfWeek(c), -7) : addMonths(c, -1)))
            }
          >
            «
          </button>
          <button
            className="bg-white border text-gray-700 px-3 py-2 rounded"
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
            className="border rounded px-2 py-2"
          >
            <option value="month">Monat</option>
            <option value="week">Woche</option>
          </select>
        </div>
      </div>

      {/* Month grid */}
      {view === 'month' && (
        <div className="bg-white rounded-lg shadow">
          <div className="grid grid-cols-7 text-xs md:text-sm font-medium text-gray-600 border-b">
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
              const hasHoliday = !!holidaysByDate.get(iso)?.length;
              const hasSchoolHoliday = showSchool && schoolLabelFor(iso);
              return (
                <button
                  key={idx}
                  className={`relative h-24 md:h-32 border p-1 text-left focus:outline-none focus:ring-2 focus:ring-viridian transition-colors ${
                    isOtherMonth
                      ? 'bg-gray-100/80 text-gray-400 border-gray-200'
                      : isToday
                        ? 'bg-mint-green/40 ring-2 ring-mint-green border-mint-green'
                        : 'bg-white hover:bg-gray-50/50'
                  }`}
                  onClick={() => {
                    if (isMobile) navigate(`/activities/new/select-project?date=${iso}`);
                    else setPicker({ date: iso });
                  }}
                  title={`Aktivität am ${day.toLocaleDateString('de-DE')} hinzufügen`}
                >
                  {/* Top row: Day number + Holiday badge inline */}
                  <div className="flex items-start gap-1 mb-0.5">
                    <span className={`text-xs md:text-sm font-medium shrink-0 ${isOtherMonth ? 'text-gray-400' : ''}`}>
                      {day.getDate()}
                    </span>
                    {hasHoliday && (
                      <div
                        className="px-1 py-[1px] rounded text-[9px] md:text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 truncate max-w-[calc(100%-1.5rem)]"
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
                      className="w-full h-3.5 rounded-sm bg-amber-100 border border-amber-200 text-[9px] md:text-[10px] text-amber-800 overflow-hidden px-1 mb-0.5"
                      title={schoolLabelFor(iso) || undefined}
                    >
                      <span className="truncate inline-block align-top leading-[14px]">{schoolLabelFor(iso)}</span>
                    </div>
                  )}
                  {renderEntries(iso, hasSchoolHoliday ? 2 : 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Week view */}
      {view === 'week' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-7 bg-azure-web text-xs md:text-sm font-medium text-gray-600 border-b">
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
                <button
                  key={iso}
                  className={`min-h-[68vh] md:min-h-[72vh] lg:min-h-[32rem] border p-2 text-left focus:outline-none transition-colors ${isToday ? 'bg-mint-green/40 ring-1 ring-mint-green/60 border-mint-green/60' : ''}`}
                  onClick={() => {
                    if (isMobile) navigate(`/activities/new/select-project?date=${iso}`);
                    else setPicker({ date: iso });
                  }}
                  title={`Aktivität am ${d.toLocaleDateString('de-DE')} hinzufügen`}
                >
                  {!!holidaysByDate.get(iso)?.length && (
                    <div
                      className="inline-block mb-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 truncate max-w-full"
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
                      className="mb-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-800 bg-amber-100 border border-amber-200 truncate max-w-full"
                      title={schoolLabelFor(iso) || undefined}
                    >
                      {schoolLabelFor(iso)}
                    </div>
                  )}
                  {renderEntriesWeek(iso)}
                </button>
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
      {moreTooltip && (
        <div 
          className="fixed z-[9999] pointer-events-none animate-tooltip-fade-in"
          style={{ 
            left: moreTooltip.position.x, 
            top: moreTooltip.position.y,
            transform: 'translate(-50%, -100%) translateY(-8px)'
          }}
        >
          <div className="bg-gray-900/95 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-xs backdrop-blur-sm">
            <div className="font-semibold mb-1.5 text-mint-green border-b border-gray-700 pb-1">
              +{moreTooltip.activities.length} weitere Aktivitäten
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
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
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900/95 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}
