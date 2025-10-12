import { useState } from 'react';
import Toggle from '@/components/Toggle';
import { Category, useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/lib/taxonomy';
import ConfirmModal from '@/components/ConfirmModal';
import { api } from '@/lib/api';
import { Pencil, Save as SaveIcon, X as XIcon, Archive as ArchiveIcon, Trash2 } from 'lucide-react';

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
          {/* Kategorien werden immer aktiv angelegt; kein Toggle im UI */}
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
  const { data: archivedOnly } = useCategories({ active: false });
  const archivedCount = (archivedOnly || []).length;
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; category?: Category } | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; category?: Category; count?: number; loading?: boolean }>({ open: false });

  const categories = data || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-xl font-semibold text-viridian">Kategorien verwalten</h3>
        </div>
        <div className="flex items-center gap-3">
          {archivedCount > 0 && (
            <Toggle checked={showArchived} onChange={setShowArchived} label={<span>Archiv <span className="text-xs text-gray-500">({archivedCount})</span></span>} />
          )}
          <span className="tooltip-wrapper"><button
            className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-viridian text-white hover:bg-cambridge-blue shadow"
            onClick={() => setModal({ mode: 'create' })}
            aria-label="Neue Kategorie"
            title="Neue Kategorie"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M12 4.5a.75.75 0 01.75.75v6h6a.75.75 0 010 1.5h-6v6a.75.75 0 01-1.5 0v-6h-6a.75.75 0 010-1.5h6v-6A.75.75 0 0112 4.5z" clipRule="evenodd" /></svg>
          </button><span className="tooltip-bubble">Neue Kategorie</span></span>
        </div>
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
              {showArchived && (c as Category).active === false && (
                <button className="text-viridian hover:underline" onClick={() => update.mutate({ id: c.id, data: { active: true } })}>Wiederherstellen</button>
              )}
              <button
                className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-viridian/10 hover:bg-viridian/20 p-1.5"
                title="Bearbeiten"
                aria-label={`Kategorie ${c.name} bearbeiten`}
                onClick={() => setModal({ mode: 'edit', category: c })}
              >
                <Pencil className="w-4 h-4 text-viridian" />
              </button>
              <button
                className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 p-1.5"
                aria-label="Löschen"
                title="Löschen"
                onClick={async () => {
                setConfirm({ open: true, category: c, loading: true });
                try {
                  const res = await api.get('/activities', { params: { categoryIds: c.id } });
                  const list = res.data as unknown[];
                  setConfirm({ open: true, category: c, count: Array.isArray(list) ? list.length : 0, loading: false });
                } catch {
                  setConfirm((prv) => ({ ...prv, loading: false }));
                }
              }}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
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
              create.mutate({ ...values, active: true }, { onSuccess: () => setModal(null) });
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
      <ConfirmModal
        open={confirm.open}
        title="Kategorie löschen?"
        message={
          <div className="space-y-2">
            <p>Wenn Sie eine Kategorie löschen, verlieren alle Aktivitäten mit dieser Kategorie die Zuordnung. Historische Auswertungen nach Kategorien ändern sich rückwirkend.</p>
            {confirm.loading ? (
              <p className="text-sm text-gray-500">Ermittle betroffene Einträge…</p>
            ) : (
              <p className="text-sm text-gray-700">Betroffene Aktivitäten: <strong>{typeof confirm.count === 'number' ? confirm.count : 0}</strong></p>
            )}
            <p className="text-sm text-gray-600">Tipp: Statt zu löschen können Sie die Kategorie archivieren. Archivierte Kategorien erscheinen nicht mehr in Auswahlfeldern, bleiben aber für bestehende Daten erhalten.</p>
          </div>
        }
        cancelLabel="Abbrechen"
        secondaryLabel="Archivieren (empfohlen)"
        onSecondaryConfirm={() => {
          if (confirm.category?.id) update.mutate({ id: confirm.category.id, data: { active: false } });
          setConfirm({ open: false });
        }}
        confirmLabel="Endgültig löschen"
        onConfirm={() => {
          if (confirm.category?.id) remove.mutate(confirm.category.id);
          setConfirm({ open: false });
        }}
        onCancel={() => setConfirm({ open: false })}
      />
    </div>
  );
}
