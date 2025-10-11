import { useMemo, useState } from 'react';
import type { Project } from '@/lib/projects';
import ActivityQuickAdd from './CalendarQuickAddModal.tsx';
import ProjectPickerModal from './ProjectPickerModal';
import { useActivities, Activity } from '@/lib/activities';
import ActivityDetailModal from './ActivityDetailModal';
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
function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // make Monday=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function Calendar() {
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [modal, setModal] = useState<{ date: string; project?: Project } | null>(null);
  const [picker, setPicker] = useState<{ date: string } | null>(null);
  const [detail, setDetail] = useState<Activity | null>(null);
  const [edit, setEdit] = useState<Activity | null>(null);

  const label = useMemo(() => cursor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }), [cursor]);
  const fmtLocalISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
    (activities || []).forEach((a) => {
      const iso = (a.date || '').slice(0, 10);
      const arr = map.get(iso) || [];
      arr.push(a);
      map.set(iso, arr);
    });
    return map;
  }, [activities]);
  const typeLabel: Record<string, string> = {
    open_door: 'Offene Tür',
    project_open: 'Projekt (offen)',
    project_closed: 'Projekt (geschlossen)',
    event: 'Veranstaltung',
    outreach: 'Aufsuchend',
  };
  const palette = [
    '#2563eb', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#22c55e', '#eab308', '#0ea5e9', '#a855f7',
  ];
  const pickBg = (title?: string) => {
    if (!title) return '#bfd8d3';
    let h = 0; for (let i=0;i<title.length;i++) h = (h*31 + title.charCodeAt(i)) >>> 0;
    return palette[h % palette.length] + '33'; // translucent
  };
  const renderEntries = (iso: string, maxRows = 3) => {
    const items = activitiesByDate.get(iso) || [];
    if (!items.length) return null;
    const visible = items.slice(0, maxRows);
    const hidden = items.length - visible.length;
    return (
      <div className="mt-1 space-y-1">
        {visible.map((a, i) => {
          const label = `${a.project?.title || typeLabel[a.type] || a.type}${a.title ? ` (${a.title})` : ''}`;
          const bg = (a.project?.color ? `${a.project.color}33` : pickBg(a.project?.title || a.title || typeLabel[a.type] || ''));
          const time = fmtTimeRange(a.startTime, a.endTime);
          const total = a.countTotal ?? 0;
          const m = a.countMale ?? 0; const w = a.countFemale ?? 0; const d = a.countDiverse ?? 0;
          const loc = a.location?.name;
          const tooltip = [
            label,
            time ? `Zeit: ${time}` : null,
            `Teilnehmende: ${total} (m:${m}, w:${w}, d:${d})`,
            loc ? `Ort: ${loc}` : null,
          ].filter(Boolean).join('\n');
          return (
            <button
              key={i}
              type="button"
              onClick={(e)=> { e.stopPropagation(); setDetail(a); }}
              className="w-full h-5 rounded text-[10px] leading-5 px-1 truncate text-left"
              style={{ backgroundColor: bg }}
              title={tooltip}
              aria-label={label}
            >
              {label}
            </button>
          );
        })}
        {hidden > 0 && (
          <div className="h-5 rounded bg-cambridge-blue/20 text-[10px] leading-5 px-1">+{hidden}</div>
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
        {items.map((a, i) => {
          const title = a.project?.title || typeLabel[a.type] || a.type;
          const subtitle = a.title ? a.title : undefined;
          const bg = (a.project?.color ? `${a.project.color}33` : pickBg(a.project?.title || a.title || typeLabel[a.type] || ''));
          const time = fmtTimeRange(a.startTime, a.endTime);
          const counts = (a.countTotal ?? 0);
          const m = a.countMale ?? 0; const w = a.countFemale ?? 0; const d = a.countDiverse ?? 0;
          return (
            <button
              key={i}
              type="button"
              onClick={(e)=> { e.stopPropagation(); setDetail(a); }}
              className="w-full rounded px-2 py-1.5 text-left shadow-sm hover:shadow transition-shadow"
              style={{ backgroundColor: bg }}
              title="Details anzeigen"
            >
              <div className="text-[11px] font-medium text-gray-800 truncate">{title}{subtitle ? ` (${subtitle})` : ''}</div>
              {time && <div className="text-[10px] text-gray-700">{time}</div>}
              <div className="text-[10px] text-gray-700">{counts} (m:{m}, w:{w}, d:{d})</div>
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
          <button className="bg-viridian text-white px-3 py-2 rounded" onClick={gotoToday}>Heute</button>
          <button className="bg-white border text-gray-700 px-3 py-2 rounded" onClick={() => setCursor(addDays(cursor, -30))}>«</button>
          <button className="bg-white border text-gray-700 px-3 py-2 rounded" onClick={() => setCursor(addDays(cursor, 30))}>»</button>
          <select value={view} onChange={(e) => setView(e.target.value as View)} className="border rounded px-2 py-2">
            <option value="month">Monat</option>
            <option value="week">Woche</option>
          </select>
        </div>
      </div>

      {/* Month grid */}
      {view === 'month' && (
        <div className="bg-white rounded-lg shadow">
          <div className="grid grid-cols-7 text-xs md:text-sm font-medium text-gray-600 border-b">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
              <div key={d} className="px-2 py-2 text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 grid-rows-6">
            {monthWeeks.flat().map((day, idx) => {
              const iso = fmtLocalISO(day);
              const isToday = iso === todayISO;
              const isOtherMonth = day.getMonth() !== cursor.getMonth();
              return (
                <button
                  key={idx}
                  className={`relative h-24 md:h-32 border p-1 text-left focus:outline-none focus:ring-2 focus:ring-viridian ${isOtherMonth ? 'bg-azure-web/60 text-gray-500' : 'bg-white'} ${isToday ? 'ring-1 ring-viridian' : ''}`}
                  onClick={() => setPicker({ date: iso })}
                  title={`Aktivität am ${day.toLocaleDateString('de-DE')} hinzufügen`}
                >
                  <div className="absolute top-1 left-1 text-xs md:text-sm font-medium">{day.getDate()}</div>
                  {renderEntries(iso, 3)}
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
            {weekDays.map((d) => (
              <div key={d.toISOString()} className="px-2 py-2 text-center">
                {d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
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
                  className={`min-h-[68vh] md:min-h-[72vh] lg:min-h-[32rem] border p-2 text-left focus:outline-none ${isToday ? 'ring-1 ring-viridian' : ''}`}
                  onClick={() => setPicker({ date: iso })}
                  title={`Aktivität am ${d.toLocaleDateString('de-DE')} hinzufügen`}
                >
                  {renderEntriesWeek(iso)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {picker && (
        <ProjectPickerModal
          onPick={(p) => { setPicker(null); setModal({ date: picker.date, project: p }); }}
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
        <ActivityDetailModal activity={detail} onClose={() => setDetail(null)} onEdit={(a)=> { setDetail(null); setEdit(a); }} />
      )}
      {edit && (
        <ActivityQuickAdd dateISO={edit.date} onClose={() => setEdit(null)} project={edit.project ?? undefined} activity={edit} />
      )}
    </div>
  );
}
