import { useProjects, Project } from '@/lib/projects';
import { colorFromStringHash } from '@/lib/colors';
import { useMemo, useState } from 'react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { Link } from 'react-router-dom';
import { X as XIcon } from 'lucide-react';
import { Star } from 'lucide-react';
import { getStarredProjectIds } from '@/lib/starred';

// Map project to one of a stable set of Tailwind classes (avoid inline styles)
function bgClassForProject(p: Project) {
  const colors = [
    'bg-rose-200',
    'bg-pink-200',
    'bg-fuchsia-200',
    'bg-purple-200',
    'bg-violet-200',
    'bg-indigo-200',
    'bg-blue-200',
    'bg-sky-200',
    'bg-cyan-200',
    'bg-teal-200',
    'bg-emerald-200',
    'bg-green-200',
    'bg-lime-200',
    'bg-yellow-200',
    'bg-amber-200',
    'bg-orange-200',
    'bg-red-200',
    'bg-stone-200',
  ];
  const key = p.color || colorFromStringHash(p.title);
  // Simple stable hash to bucket index
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

export default function ProjectPickerModal({
  onPick,
  onClose,
}: {
  onPick: (p: Project) => void;
  onClose: () => void;
}) {
  // This component mounts only when open – lock body scroll while mounted
  useBodyScrollLock(true);
  const [search, setSearch] = useState('');
  const { data } = useProjects({ archived: false, search });
  const projects = useMemo(() => {
    const list = data || [];
    const starred = new Set(getStarredProjectIds());
    return list.slice().sort((a, b) => {
      const sa = starred.has(a.id) ? 1 : 0;
      const sb = starred.has(b.id) ? 1 : 0;
      if (sa !== sb) return sb - sa; // starred first
      return a.title.localeCompare(b.title, 'de');
    });
  }, [data]);
  // Lade Kompakt-Einstellung aus localStorage, damit sie beim Wiederkommen erhalten bleibt
  const [compact, setCompact] = useState<boolean>(() => {
    try {
      return localStorage.getItem('projectPickerCompact') === 'true';
    } catch {
      return false;
    }
  });
  const toggleCompact = (val: boolean) => {
    setCompact(val);
    try {
      localStorage.setItem('projectPickerCompact', String(val));
    } catch {
      /* ignore */
    }
  };
  const typeLabel: Record<string, string> = {
    open_door: 'Offene Tür',
    project_open: 'Projekt (offen)',
    project_closed: 'Projekt (geschlossen)',
    event: 'Veranstaltung',
    outreach: 'Aufsuchend',
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6 modal-overlay"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[85vh] overflow-y-auto bottom-sheet-animate">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-viridian">Projekt wählen</h3>
          <button
            className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
            onClick={onClose}
            aria-label="Schließen"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="flex-1 border rounded px-3 py-2"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={compact}
              onChange={(e) => toggleCompact(e.target.checked)}
            />
            Kompakt
          </label>
        </div>

        {!compact && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p)}
                className="rounded-xl overflow-hidden shadow focus:outline-none focus:ring-2 focus:ring-viridian text-left"
              >
                <div className="relative h-24">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className={`absolute inset-0 ${bgClassForProject(p)}`} />
                  )}
                  {/* Type badge overlay */}
                  <div className="absolute top-1 left-1 z-10">
                    <span
                      className={`inline-block text-[11px] leading-4 px-2 py-0.5 rounded ${
                        p.imageUrl
                          ? 'bg-black/45 text-white'
                          : 'bg-white/80 text-gray-800 border border-white/60'
                      }`}
                    >
                      {typeLabel[p.type] || p.type}
                    </span>
                  </div>
                  {/* Star badge if highlighted */}
                  {getStarredProjectIds().includes(p.id) && (
                    <div className="absolute top-1 right-1 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400 shadow">
                      <Star className="w-3.5 h-3.5 text-gray-900" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <div className="font-medium text-viridian truncate">{p.title}</div>
                </div>
              </button>
            ))}
            {projects.length === 0 && (
              <div className="col-span-full text-center py-6">
                <div className="text-gray-500">Keine Projekte gefunden.</div>
                <div className="mt-2 text-xs text-gray-600">
                  Erstelle dein erstes Projekt –
                  <Link
                    to="/projects"
                    className="text-viridian hover:underline ml-1"
                    onClick={onClose}
                  >
                    zur Projekte-Seite
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {compact && (
          <ul className="divide-y border rounded">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onPick(p)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-viridian"
                >
                  <div className="w-10 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className={`${bgClassForProject(p)} w-full h-full`} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-viridian truncate">{p.title}</div>
                    <div className="text-[11px] text-gray-600">{typeLabel[p.type] || p.type}</div>
                  </div>
                  {getStarredProjectIds().includes(p.id) && (
                    <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  )}
                </button>
              </li>
            ))}
            {projects.length === 0 && (
              <li className="px-3 py-6 text-center text-gray-500">Keine Projekte gefunden.</li>
            )}
          </ul>
        )}
        <div className="mt-4 sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 -mb-4 md:-mb-6 px-4 md:px-6">
          <div className="text-xs text-gray-600">
            Tipp: Tippe zum Auswählen. Suche nach Titel oder Zielgruppe.
          </div>
        </div>
      </div>
    </div>
  );
}
