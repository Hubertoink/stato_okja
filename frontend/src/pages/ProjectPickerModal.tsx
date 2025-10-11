import { useProjects, Project } from '@/lib/projects';
import { useMemo, useState } from 'react';
import { X as XIcon } from 'lucide-react';

function pickBg(title?: string) {
  const palette = ['#2563eb','#ef4444','#f59e0b','#10b981','#8b5cf6','#ec4899','#f97316','#14b8a6','#22c55e','#0ea5e9','#a855f7'];
  if (!title) return palette[0];
  let h = 0; for (let i=0;i<title.length;i++) h = (h*31 + title.charCodeAt(i))>>>0;
  return palette[h % palette.length];
}

export default function ProjectPickerModal({ onPick, onClose }: { onPick: (p: Project) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const { data } = useProjects({ archived: false, search });
  const projects = useMemo(() => data || [], [data]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[85vh] overflow-y-auto bottom-sheet-animate">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-viridian">Projekt wählen</h3>
          <button className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700" onClick={onClose} aria-label="Schließen"><XIcon className="w-5 h-5" /></button>
        </div>
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Suchen…" className="w-full border rounded px-3 py-2 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {projects.map((p) => (
            <button key={p.id} onClick={() => onPick(p)} className="rounded-xl overflow-hidden shadow focus:outline-none focus:ring-2 focus:ring-viridian text-left">
              <div className="relative h-24">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.title} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0" style={{ backgroundColor: pickBg(p.title) }} />
                )}
              </div>
              <div className="p-2">
                <div className="font-medium text-viridian truncate">{p.title}</div>
                <div className="text-xs text-gray-600 truncate">{p.targetGroup || '—'}</div>
              </div>
            </button>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full text-gray-500 text-center py-6">Keine Projekte gefunden.</div>
          )}
        </div>
        <div className="mt-4 sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 -mb-4 md:-mb-6 px-4 md:px-6">
          <div className="text-xs text-gray-600">Tipp: Tippe zum Auswählen. Suche nach Titel oder Zielgruppe.</div>
        </div>
      </div>
    </div>
  );
}
