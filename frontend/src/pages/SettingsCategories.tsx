import { useState } from 'react';
import { Category, useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/lib/taxonomy';
import { Pencil, Save as SaveIcon, X as XIcon, Archive as ArchiveIcon } from 'lucide-react';

function CategoryForm({ initial, onSubmit, onCancel, onArchive }: { initial?: Partial<Category>; onSubmit: (d: Partial<Category>) => void; onCancel: () => void; onArchive?: () => void }) {
  const [form, setForm] = useState<Partial<Category>>({ active: true, ...initial });
  const update = <K extends keyof Category>(k: K, v: Category[K]) => setForm((f) => ({ ...f, [k]: v }));
  const swatches = ['#2563eb','#ef4444','#f59e0b','#10b981','#8b5cf6','#ec4899','#f97316','#14b8a6','#22c55e','#0ea5e9'];
  return (
  <div className="fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6">
  <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto bottom-sheet-animate">
        <h3 className="text-xl font-semibold text-viridian mb-4">{initial?.id ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input value={form.name || ''} onChange={(e) => update('name', e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung</label>
            <textarea value={form.description || ''} onChange={(e) => update('description', e.target.value)} rows={3} className="w-full border rounded px-3 py-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Standard-Referenz</label>
              <input value={form.standardRef || ''} onChange={(e) => update('standardRef', e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Farbe</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {swatches.map((c) => (
                  <button key={c} type="button" onClick={() => update('color', c as unknown as string)} className="w-8 h-8 rounded-full border" style={{ backgroundColor: c }} aria-label={`Farbe ${c}`} />
                ))}
              </div>
              <input type="color" value={(form.color as string) || '#7aa39a'} onChange={(e) => update('color', e.target.value)} className="w-full h-10 border rounded" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active ?? true} onChange={(e) => update('active', Boolean(e.target.checked))} />
            Aktiv
          </label>
        </div>
  <div className="mt-6 flex items-center justify-between gap-3 sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 px-4 md:px-6">
          <span className="tooltip-wrapper"><button type="button" className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700" onClick={onCancel} title="Abbrechen" aria-label="Abbrechen">
            <XIcon className="w-5 h-5" />
          </button><span className="tooltip-bubble">Abbrechen</span></span>
          <span className="tooltip-wrapper"><button
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
            onClick={() => {
              const cleaned = Object.fromEntries(
                Object.entries(form).filter(([, v]) => v !== '' && v !== null && v !== undefined),
              ) as Partial<Category>;
              onSubmit(cleaned);
            }}
            title="Speichern"
            aria-label="Speichern"
          >
            <SaveIcon className="w-5 h-5" />
          </button><span className="tooltip-bubble">Speichern</span></span>
          {initial?.id && onArchive && (
            <span className="tooltip-wrapper"><button type="button" className="inline-flex items-center justify-center p-2 rounded-full border border-gray-300 text-gray-700 bg-white" onClick={onArchive} title="Archivieren" aria-label="Archivieren">
              <ArchiveIcon className="w-5 h-5" />
            </button><span className="tooltip-bubble">Archivieren</span></span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsCategories() {
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useCategories(showArchived ? undefined : { active: true });
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; category?: Category } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const categories = data || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-xl font-semibold text-viridian">Kategorien verwalten</h3>
          <p className="text-gray-600">Kategorien nach Landesjugendamt-Standard</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Archivierte anzeigen
          </label>
          <button className="bg-viridian text-white px-4 py-2 rounded-lg hover:bg-cambridge-blue" onClick={() => setModal({ mode: 'create' })}>+ Neue Kategorie</button>
        </div>
      </div>
      <div className="mb-3">
        <button
          className="text-sm text-viridian underline disabled:opacity-50"
          disabled={seeding}
          onClick={async () => {
            setSeeding(true);
            const defaults: Array<{ name: string; description: string }> = [
              { name: 'Medienpädagogik', description: 'Förderung von Medienkompetenz, kreative Medienarbeit, kritischer Umgang mit digitalen Tools' },
              { name: 'Freizeitpädagogik', description: 'Offene Angebote zur Freizeitgestaltung, z. B. Spiel, Sport, Ausflüge, kreative Werkstätten' },
              { name: 'Kulturelle Bildung', description: 'Theater, Musik, Tanz, bildende Kunst – oft mit partizipativem Ansatz' },
              { name: 'Politische Bildung', description: 'Demokratieförderung, Beteiligung, Wertevermittlung, z. B. Jugendforen oder Workshops' },
              { name: 'Interkulturelle Arbeit', description: 'Begegnung, Integration, Empowerment von Jugendlichen mit Migrationsgeschichte' },
              { name: 'Genderpädagogik', description: 'Geschlechtersensible Angebote, z. B. Mädchenarbeit, Jungenarbeit, Queer-Jugendarbeit' },
              { name: 'Soziale Gruppenarbeit', description: 'Stärkung sozialer Kompetenzen, Konfliktlösung, Peer-Projekte' },
              { name: 'Berufsorientierung & Lebensplanung', description: 'Unterstützung beim Übergang Schule–Beruf, Bewerbungstrainings, Zukunftswerkstätten' },
              { name: 'Inklusive Pädagogik', description: 'Barrierefreie Angebote, Teilhabe für Jugendliche mit Behinderung oder Benachteiligung' },
            ];
            try {
              for (const d of defaults) {
                await new Promise<void>((resolve) => {
                  create.mutate(
                    { name: d.name, description: d.description, active: true },
                    { onSettled: () => resolve() },
                  );
                });
              }
            } finally {
              setSeeding(false);
            }
          }}
        >
          Standardkategorien hinzufügen
        </button>
      </div>
      <div className="divide-y">
        {categories.map((c) => (
          <div key={c.id} className="py-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-medium text-viridian flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: c.color || '#7aa39a' }} />
                {c.name}
              </div>
              {c.description && <div className="text-sm text-gray-600 line-clamp-2">{c.description}</div>}
            </div>
            <div className="flex gap-2">
              <button
                className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-viridian/10 hover:bg-viridian/20 p-1.5"
                title="Bearbeiten"
                aria-label={`Kategorie ${c.name} bearbeiten`}
                onClick={() => setModal({ mode: 'edit', category: c })}
              >
                <Pencil className="w-4 h-4 text-viridian" />
              </button>
              <button className="text-gray-500 hover:underline" onClick={() => { if (confirm('Kategorie löschen?')) remove.mutate(c.id); }}>Löschen</button>
            </div>
          </div>
        ))}
        {categories.length === 0 && <div className="text-gray-500 py-6">Noch keine Kategorien.</div>}
      </div>

      {modal && (
        <CategoryForm
          initial={modal.mode === 'edit' ? modal.category : undefined}
          onSubmit={(values) => {
            if (modal.mode === 'create') {
              create.mutate(values, { onSuccess: () => setModal(null) });
            } else if (modal.category?.id) {
              const { id: _r, ...rest } = (values || {}) as Partial<Category>;
              void _r;
              update.mutate({ id: modal.category.id, data: rest }, { onSuccess: () => setModal(null) });
            }
          }}
          onArchive={modal.mode === 'edit' && modal.category && modal.category.id ? () => update.mutate({ id: modal.category!.id, data: { active: false } }, { onSuccess: () => setModal(null) }) : undefined}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
