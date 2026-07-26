import { useEffect, useMemo, useState } from 'react';
import { getBgClass } from '@/lib/colorPalette';
import { DEFAULT_CATEGORIES } from '@/lib/defaultCategories';
import Toggle from '@/components/Toggle';
import {
  Category,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useTaxonomyAccess,
  useUpdateCategory,
} from '@/lib/taxonomy';
import ConfirmModal from '@/components/ConfirmModal';
import { api } from '@/lib/api';
import { Pencil, Trash2 } from 'lucide-react';
import { CategoryFormModal } from '@/components/settings/EntityFormModals';

export default function SettingsCategories() {
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useCategories(showArchived ? undefined : { active: true });
  const { data: archivedOnly } = useCategories({ active: false });
  const { data: access } = useTaxonomyAccess();
  const archivedCount = (archivedOnly || []).length;
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; category?: Category } | null>(null);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    category?: Category;
    count?: number;
    loading?: boolean;
  }>({ open: false });
  const [seedConfirm, setSeedConfirm] = useState<{
    open: boolean;
    busy?: boolean;
    created?: number;
  }>({ open: false });
  const [selectedDefaultNames, setSelectedDefaultNames] = useState<string[]>([]);

  const categories = data || [];
  const canCreateOwn = access?.categories.canCreateOwn ?? true;
  const allExisting = useMemo(
    () => [...(data || []), ...(archivedOnly || [])] as Category[],
    [data, archivedOnly],
  );

  const existingNames = useMemo(
    () => new Set(allExisting.map((c) => (c.name || '').trim().toLowerCase())),
    [allExisting],
  );
  const defaultsMissing = useMemo(
    () => DEFAULT_CATEGORIES.filter((c) => !existingNames.has(c.name.trim().toLowerCase())),
    [existingNames],
  );
  const selectedDefaultsMissing = useMemo(
    () => defaultsMissing.filter((c) => selectedDefaultNames.includes(c.name)),
    [defaultsMissing, selectedDefaultNames],
  );

  useEffect(() => {
    if (!seedConfirm.open) return;
    setSelectedDefaultNames((current) => {
      const availableNames = new Set(defaultsMissing.map((c) => c.name));
      const filtered = current.filter((name) => availableNames.has(name));
      return filtered.length > 0 ? filtered : defaultsMissing.map((c) => c.name);
    });
  }, [seedConfirm.open, defaultsMissing]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-xl font-semibold text-viridian">Kategorien verwalten</h3>
          {!canCreateOwn && (
            <p className="taxonomy-lock-hint">
              Lokale Kategorien sind in diesem Org-Kontext gesperrt. Sichtbar bleiben geerbte und bestehende Kategorien, neue lokale Kategorien sowie Bearbeiten, Archivieren und Löschen lokaler Kategorien sind hier nicht erlaubt.
            </p>
          )}
          <div className="text-xs text-gray-600 mt-1">
            <button
              type="button"
              className="text-viridian hover:underline disabled:text-gray-400"
              onClick={() => {
                if (!canCreateOwn) return;
                setSelectedDefaultNames(defaultsMissing.map((c) => c.name));
                setSeedConfirm({ open: true });
              }}
              disabled={!canCreateOwn || defaultsMissing.length === 0}
              title={
                !canCreateOwn
                  ? 'Standard-Kategorien sind gesperrt, solange lokale Kategorien in diesem Org-Kontext nicht erlaubt sind'
                  : defaultsMissing.length === 0
                  ? 'Alle Standard-Kategorien sind bereits vorhanden'
                  : undefined
              }
            >
              Standard‑Kategorien erstellen
              {defaultsMissing.length > 0 ? ` (${defaultsMissing.length})` : ''}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {archivedCount > 0 && (
            <Toggle
              checked={showArchived}
              onChange={setShowArchived}
              label={
                <span>
                  Archiv <span className="text-xs text-gray-500">({archivedCount})</span>
                </span>
              }
            />
          )}
          <span className="tooltip-wrapper">
            <button
              className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-viridian text-white hover:bg-cambridge-blue shadow disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => canCreateOwn && setModal({ mode: 'create' })}
              aria-label="Neue Kategorie"
              title="Neue Kategorie"
              disabled={!canCreateOwn}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6"
              >
                <path
                  fillRule="evenodd"
                  d="M12 4.5a.75.75 0 01.75.75v6h6a.75.75 0 010 1.5h-6v6a.75.75 0 01-1.5 0v-6h-6a.75.75 0 010-1.5h6v-6A.75.75 0 0112 4.5z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <span className="tooltip-bubble">Neue Kategorie</span>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {categories.map((c) => {
          const isInherited = !!c.isInherited;
          const canManage = c.canManage !== false;
          return (
            <div key={c.id} className={`p-3 rounded border flex items-center justify-between ${isInherited ? 'bg-gray-50 border-gray-200' : ''}`}>
              <div className="min-w-0 flex items-center gap-3">
                <span
                  className={`inline-block w-4 h-4 rounded ${getBgClass(c.color as string, 'bg-slate-400')}`}
                />
                <div>
                  <div className="font-medium text-viridian flex items-center gap-2 flex-wrap">
                    <span>{c.name}</span>
                    {isInherited && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-cambridge-blue/15 text-cambridge-blue">
                        geerbt{c.sourceOrgName ? ` aus ${c.sourceOrgName}` : ''}
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <div className="text-sm text-gray-600 line-clamp-2">{c.description}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {showArchived && (c as Category).active === false && canManage && (
                  <button
                    className="text-viridian hover:underline"
                    onClick={() => update.mutate({ id: c.id, data: { active: true } })}
                  >
                    Wiederherstellen
                  </button>
                )}
                {canManage && <button
                  className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-viridian/10 hover:bg-viridian/20 p-1.5"
                  title="Bearbeiten"
                  aria-label={`Kategorie ${c.name} bearbeiten`}
                  onClick={() => setModal({ mode: 'edit', category: c })}
                >
                  <Pencil className="w-4 h-4 text-viridian" />
                </button>}
                {canManage && <button
                  className="danger-icon-button p-1.5"
                  aria-label="Löschen"
                  title="Löschen"
                  onClick={async () => {
                    setConfirm({ open: true, category: c, loading: true });
                    try {
                      const res = await api.get('/activities', { params: { categoryIds: c.id, page: 1, limit: 1 } });
                      setConfirm({
                        open: true,
                        category: c,
                        count: Number(res.data?.total || 0),
                        loading: false,
                      });
                    } catch {
                      setConfirm((prv) => ({ ...prv, loading: false }));
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>}
              </div>
            </div>
          );
        })}
        {categories.length === 0 && (
          <div className="text-gray-500 py-6">Keine sichtbaren Kategorien in diesem Org-Kontext.</div>
        )}
      </div>

      {modal && (
        <CategoryFormModal
          initial={modal.mode === 'edit' ? modal.category : undefined}
          onSubmit={(values) => {
            if (modal.mode === 'create') {
              const color = values.color || '#7aa39a';
              create.mutate(
                { ...values, color, active: true },
                { onSuccess: () => setModal(null) },
              );
            } else if (modal.category?.id) {
              const { id: _r, ...rest } = (values || {}) as Partial<Category>;
              void _r;
              const color = rest.color || modal.category?.color || '#7aa39a';
              update.mutate(
                { id: modal.category.id, data: { ...rest, color } },
                { onSuccess: () => setModal(null) },
              );
            }
          }}
          onArchive={
            modal.mode === 'edit' && modal.category && modal.category.id
              ? () =>
                  update.mutate(
                    { id: modal.category!.id, data: { active: false } },
                    { onSuccess: () => setModal(null) },
                  )
              : undefined
          }
          onCancel={() => setModal(null)}
        />
      )}
      <ConfirmModal
        open={confirm.open}
        title="Kategorie löschen?"
        message={
          <div className="space-y-2">
            <p>
              Wenn Sie eine Kategorie löschen, verlieren alle Aktivitäten mit dieser Kategorie die
              Zuordnung. Historische Auswertungen nach Kategorien ändern sich rückwirkend.
            </p>
            {confirm.loading ? (
              <p className="text-sm text-gray-500">Ermittle betroffene Einträge…</p>
            ) : (
              <p className="text-sm text-gray-700">
                Betroffene Aktivitäten:{' '}
                <strong>{typeof confirm.count === 'number' ? confirm.count : 0}</strong>
              </p>
            )}
            <p className="text-sm text-gray-600">
              Tipp: Statt zu löschen können Sie die Kategorie archivieren. Archivierte Kategorien
              erscheinen nicht mehr in Auswahlfeldern, bleiben aber für bestehende Daten erhalten.
            </p>
          </div>
        }
        cancelLabel="Abbrechen"
        secondaryLabel="Archivieren (empfohlen)"
        onSecondaryConfirm={() => {
          if (confirm.category?.id)
            update.mutate({ id: confirm.category.id, data: { active: false } });
          setConfirm({ open: false });
        }}
        confirmLabel="Endgültig löschen"
        onConfirm={() => {
          if (confirm.category?.id) remove.mutate(confirm.category.id);
          setConfirm({ open: false });
        }}
        onCancel={() => setConfirm({ open: false })}
      />

      {/* Seed standard categories */}
      <ConfirmModal
        open={seedConfirm.open}
        title="Standard‑Kategorien erstellen"
        message={
          <div className="space-y-2 text-sm">
            {defaultsMissing.length > 0 ? (
              <>
                <p>
                  Wähle aus, welche Standard-Kategorien angelegt werden sollen. Bereits
                  vorhandene Kategorien werden weiterhin übersprungen.
                </p>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-gray-500">
                    {selectedDefaultsMissing.length} von {defaultsMissing.length} ausgewählt
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-viridian hover:underline disabled:text-gray-400"
                      onClick={() => setSelectedDefaultNames(defaultsMissing.map((c) => c.name))}
                      disabled={selectedDefaultsMissing.length === defaultsMissing.length}
                    >
                      Alle
                    </button>
                    <button
                      type="button"
                      className="text-gray-600 hover:underline disabled:text-gray-400"
                      onClick={() => setSelectedDefaultNames([])}
                      disabled={selectedDefaultsMissing.length === 0}
                    >
                      Keine
                    </button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {defaultsMissing.map((c) => {
                    const checked = selectedDefaultNames.includes(c.name);
                    return (
                      <label
                        key={c.name}
                        className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-viridian focus:ring-viridian"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedDefaultNames((current) =>
                              e.target.checked
                                ? [...current, c.name]
                                : current.filter((name) => name !== c.name),
                            );
                          }}
                        />
                        <span
                          className={`mt-1 inline-block h-3.5 w-3.5 rounded ${getBgClass(c.color, 'bg-slate-400')}`}
                        />
                        <span className="min-w-0 flex-1 text-gray-800">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedDefaultsMissing.length === 0 && (
                  <p className="text-xs text-red-600">Bitte mindestens eine Kategorie auswählen.</p>
                )}
              </>
            ) : (
              <p>Alle Standard‑Kategorien sind bereits vorhanden.</p>
            )}
          </div>
        }
        confirmLabel={seedConfirm.busy ? 'Erstelle…' : `Erstellen${selectedDefaultsMissing.length > 0 ? ` (${selectedDefaultsMissing.length})` : ''}`}
        onConfirm={async () => {
          if (seedConfirm.busy) {
            return;
          }
          if (defaultsMissing.length === 0) {
            setSeedConfirm({ open: false });
            return;
          }
          if (selectedDefaultsMissing.length === 0) return;
          setSeedConfirm({ open: true, busy: true });
          try {
            for (const def of selectedDefaultsMissing) {
              await create.mutateAsync({ name: def.name, color: def.color, active: true });
            }
            setSeedConfirm({ open: false, busy: false, created: selectedDefaultsMissing.length });
          } catch {
            setSeedConfirm({ open: false, busy: false });
          }
        }}
        onCancel={() => setSeedConfirm({ open: false })}
        showCancel={true}
        cancelLabel="Abbrechen"
      />
    </div>
  );
}
