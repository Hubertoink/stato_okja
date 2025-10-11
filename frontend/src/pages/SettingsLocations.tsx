import { useState } from 'react';
import { useLocations, Location } from '@/lib/locations';
import { api } from '@/lib/api';
import { Pencil, Save as SaveIcon, X as XIcon, Trash2 } from 'lucide-react';

function LocationForm({ initial, onClose, onSaved }: { initial?: Partial<Location>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Location>>({ active: true, ...initial });
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof Location>(k: K, v: Location[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      if (initial?.id) {
        await api.patch(`/locations/${initial.id}`, form);
      } else {
        await api.post('/locations', form);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto bottom-sheet-animate">
        <h3 className="text-xl font-semibold text-viridian mb-4">{initial?.id ? 'Einrichtung bearbeiten' : 'Neue Einrichtung'}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input className="w-full border rounded px-3 py-2" value={form.name || ''} onChange={(e)=> update('name', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Adresse</label>
            <input className="w-full border rounded px-3 py-2" value={form.address || ''} onChange={(e)=> update('address', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Raumtyp</label>
            <input className="w-full border rounded px-3 py-2" value={form.roomType || ''} onChange={(e)=> update('roomType', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active ?? true} onChange={(e)=> update('active', Boolean(e.target.checked))} />
            Aktiv
          </label>
        </div>
        <div className="mt-6 flex items-center justify-between gap-3 sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 px-4 md:px-6">
          <button type="button" className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700" onClick={onClose} aria-label="Abbrechen"><XIcon className="w-5 h-5"/></button>
          <button type="button" disabled={saving} className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white disabled:opacity-50" onClick={save} aria-label="Speichern"><SaveIcon className="w-5 h-5"/></button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsLocations() {
  const { data, refetch } = useLocations({ active: true });
  const [modal, setModal] = useState<{ mode: 'create'|'edit'; loc?: Location }|null>(null);
  const locations = data || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-xl font-semibold text-viridian">Einrichtungen</h3>
          <p className="text-gray-600">Standorte/Räume zur Auswahl bei Aktivitäten</p>
        </div>
        <button className="bg-viridian text-white px-4 py-2 rounded-lg hover:bg-cambridge-blue" onClick={()=> setModal({ mode: 'create' })}>+ Neue Einrichtung</button>
      </div>
      <div className="divide-y">
        {locations.map((l) => (
          <div key={l.id} className="py-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-medium text-viridian">{l.name}</div>
              {(l.address || l.roomType) && <div className="text-sm text-gray-600">{[l.address, l.roomType].filter(Boolean).join(' · ')}</div>}
            </div>
            <div className="flex gap-2">
              <button className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-viridian/10 hover:bg-viridian/20 p-1.5" onClick={()=> setModal({ mode: 'edit', loc: l })} aria-label="Bearbeiten"><Pencil className="w-4 h-4 text-viridian"/></button>
              <button className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 p-1.5" onClick={async ()=> { if (!confirm('Einrichtung löschen?')) return; await api.delete(`/locations/${l.id}`); await refetch(); }} aria-label="Löschen"><Trash2 className="w-4 h-4 text-red-600"/></button>
            </div>
          </div>
        ))}
        {locations.length === 0 && <div className="text-gray-500 py-6">Noch keine Einrichtungen.</div>}
      </div>
      {modal && (
        <LocationForm initial={modal.mode==='edit'? modal.loc : undefined} onClose={()=> setModal(null)} onSaved={async ()=> { setModal(null); await refetch(); }} />
      )}
    </div>
  );
}
