import { useMemo, useState } from 'react';
import { useActivities } from '@/lib/activities';
import { useLocations } from '@/lib/locations';
import ProjectPickerModal from './ProjectPickerModal';
import ActivityQuickAdd from './CalendarQuickAddModal';
import type { Project } from '@/lib/projects';
import { Pencil, XCircle, Tag as TagIcon, StickyNote } from 'lucide-react';
import { useActivity } from '@/lib/activities';

export default function Activities() {
  const [showFilters, setShowFilters] = useState(false);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [picker, setPicker] = useState<boolean>(false);
  const [quickAdd, setQuickAdd] = useState<{ project: Project } | null>(null);
  const { data } = useActivities({ from: from || undefined, to: to || undefined, type: type || undefined, locationId: locationId || undefined });
  const { data: locs } = useLocations({ active: true });
  const activities = useMemo(() => data || [], [data]);
  const [editId, setEditId] = useState<string | null>(null);
  const { data: editing } = useActivity(editId || undefined);
  const firstWords = (s?: string | null, n: number = 20) => {
    if (!s) return '';
    const words = s.trim().split(/\s+/).filter(Boolean);
    const part = words.slice(0, n).join(' ');
    return words.length > n ? part + '…' : part;
  };
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-viridian">Aktivitäten</h2>
        <button className="bg-viridian text-white px-6 py-2 rounded-lg hover:bg-cambridge-blue transition-colors" onClick={() => setPicker(true)}>
          + Neue Aktivität
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between md:block">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Filter</h3>
            {([from, to, type, locationId].some(Boolean)) && (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-azure-web text-viridian hover:bg-cambridge-blue/20 transition-colors p-1.5"
                title="Filter zurücksetzen"
                aria-label="Filter zurücksetzen"
                onClick={() => { setFrom(''); setTo(''); setType(''); setLocationId(''); }}
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
            type="button"
            className="md:hidden text-viridian underline"
            onClick={() => setShowFilters((s) => !s)}
          >
            {showFilters ? 'Filter verbergen' : 'Filter anzeigen'}
          </button>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 ${showFilters ? '' : 'hidden md:grid'}`}>
          <input type="date" className="border border-gray-300 rounded px-3 py-2" value={from} onChange={(e)=> setFrom(e.target.value)} />
          <input type="date" className="border border-gray-300 rounded px-3 py-2" value={to} onChange={(e)=> setTo(e.target.value)} />
          <select className="border border-gray-300 rounded px-3 py-2" value={type} onChange={(e)=> setType(e.target.value)}>
            <option value="">Alle Tätigkeitstypen</option>
            <option value="open_door">Offene Tür</option>
            <option value="project_open">Projekt (offen)</option>
            <option value="project_closed">Projekt (geschlossen)</option>
            <option value="event">Veranstaltung</option>
            <option value="outreach">Aufsuchende Arbeit</option>
          </select>
          <select className="border border-gray-300 rounded px-3 py-2" value={locationId} onChange={(e)=> setLocationId(e.target.value)}>
            <option value="">Alle Einrichtungen</option>
            {(locs || []).map((l)=> (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Activity List */}
      {/* Desktop Table */}
      <div className="bg-white rounded-lg shadow hidden md:block">
        <table className="w-full">
          <thead className="bg-azure-web">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Datum</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Typ</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Titel / Projekt</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Teilnehmende</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Dauer</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tags & Notizen</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {activities.map((a) => (
              <tr key={a.id} className="hover:bg-azure-web">
                <td className="px-6 py-4 text-sm">{(() => { const s=(a.date||'').slice(0,10); const [y,m,d]=s.split('-'); return `${d}.${m}.${y}`; })()}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 bg-viridian text-white rounded text-xs">
                    {({open_door:'Offene Tür', project_open:'Projekt (offen)', project_closed:'Projekt (geschlossen)', event:'Veranstaltung', outreach:'Aufsuchend'} as Record<string,string>)[a.type] || a.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="font-medium text-gray-900">{a.title || '-'}</div>
                  <div className="text-xs text-gray-600">{a.project?.title || '-'}</div>
                </td>
                <td className="px-6 py-4 text-sm">{(a.countTotal ?? 0)} (m:{a.countMale ?? 0}, w:{a.countFemale ?? 0}, d:{a.countDiverse ?? 0})</td>
                <td className="px-6 py-4 text-sm">{(() => {
                  if (a.durationMinutes) return `${a.durationMinutes} min`;
                  const parse = (t?: string | null) => {
                    if (!t) return undefined;
                    const [h, m] = t.split(':').map((v)=> parseInt(v,10));
                    if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
                    return h*60+m;
                  };
                  const s = parse(a.startTime); const e = parse(a.endTime);
                  if (s!==undefined && e!==undefined && e>=s) return `${e-s} min`;
                  return '-';
                })()}</td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(a.tags || []).map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border"
                        style={{ backgroundColor: t.color ? `${t.color}26` : undefined, borderColor: t.color || undefined }}
                        title={t.name}
                      >
                        <TagIcon className="w-3 h-3" /> {t.name}
                      </span>
                    ))}
                    {(a.tags || []).length === 0 && <span className="text-xs text-gray-400">–</span>}
                  </div>
                  {a.notes && (
                    <div className="text-xs text-gray-600 flex items-start gap-1" title={a.notes || undefined}>
                      <StickyNote className="w-3.5 h-3.5 mt-[2px] text-gray-500" />
                      <span>{firstWords(a.notes, 20)}</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <button onClick={() => setEditId(a.id)} className="inline-flex items-center justify-center rounded-full bg-white border p-2 text-viridian hover:bg-azure-web" title="Bearbeiten" aria-label="Bearbeiten">
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {activities.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-6 text-center text-gray-500 text-sm">Keine Aktivitäten im Zeitraum.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {activities.map((a) => (
          <div
            key={a.id}
            className="bg-white rounded-lg shadow p-4 cursor-pointer hover:bg-azure-web/50 focus:outline-none focus:ring-2 focus:ring-viridian/40"
            role="button"
            tabIndex={0}
            aria-label="Aktivität bearbeiten"
            onClick={() => setEditId(a.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditId(a.id); }
            }}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-sm text-gray-500">{(() => { const s=(a.date||'').slice(0,10); const [y,m,d]=s.split('-'); return `${d}.${m}.${y}`; })()}</div>
                <div className="font-semibold text-viridian">{({open_door:'Offene Tür', project_open:'Projekt (offen)', project_closed:'Projekt (geschlossen)', event:'Veranstaltung', outreach:'Aufsuchend'} as Record<string,string>)[a.type] || a.type}</div>
              </div>
              {(() => {
                const duration = a.durationMinutes ?? (()=>{
                  const parse = (t?: string | null) => {
                    if (!t) return undefined; const [h,m] = t.split(':').map((v)=>parseInt(v,10));
                    if (Number.isNaN(h)||Number.isNaN(m)) return undefined; return h*60+m;
                  };
                  const s=parse(a.startTime); const e=parse(a.endTime); return (s!==undefined&&e!==undefined&&e>=s)?(e-s):undefined;
                })();
                return duration ? (<span className="text-xs px-2 py-1 bg-viridian text-white rounded">{duration} min</span>) : null;
              })()}
            </div>
            <div className="text-sm text-gray-600 mb-1">{a.title || '-'}</div>
            <div className="text-xs text-gray-500 mb-3">{a.project?.title || '-'}</div>
            {(a.tags && a.tags.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {a.tags.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border"
                    style={{ backgroundColor: t.color ? `${t.color}26` : undefined, borderColor: t.color || undefined }}
                    title={t.name}
                  >
                    <TagIcon className="w-3 h-3" /> {t.name}
                  </span>
                ))}
              </div>
            )}
            {a.notes && (
              <div className="text-[12px] text-gray-600 flex items-start gap-1 mb-2">
                <StickyNote className="w-3.5 h-3.5 mt-[2px] text-gray-500" />
                <span>{firstWords(a.notes, 20)}</span>
              </div>
            )}
            {/* Mobile actions intentionally hidden; tap card to edit */}
          </div>
        ))}
        {activities.length === 0 && (
          <div className="text-gray-500 py-6 text-center">Keine Aktivitäten im Zeitraum.</div>
        )}
      </div>
      {picker && (
        <ProjectPickerModal onPick={(p)=> { setPicker(false); setQuickAdd({ project: p }); }} onClose={()=> setPicker(false)} />
      )}
      {quickAdd && (
        <ActivityQuickAdd dateISO={`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`} onClose={()=> setQuickAdd(null)} project={quickAdd.project} />
      )}
      {editId && editing && (
        <ActivityQuickAdd dateISO={editing.date} onClose={() => setEditId(null)} project={editing.project ?? undefined} activity={editing} />
      )}
    </div>
  );
}
