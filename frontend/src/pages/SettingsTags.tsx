import { useState } from 'react';
import { TAG_PALETTE, isInTagPalette, getBgClass } from '@/lib/colorPalette';
import Toggle from '@/components/Toggle';
import { Tag, useCreateTag, useDeleteTag, useTags, useUpdateTag } from '@/lib/taxonomy';
import { Pencil, Save as SaveIcon, X as XIcon, Archive as ArchiveIcon, Trash2 } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { api } from '@/lib/api';

function TagForm({
  initial,
  onSubmit,
  onCancel,
  onArchive,
}: {
  initial?: Partial<Tag>;
  onSubmit: (d: Partial<Tag>) => void;
  onCancel: () => void;
  onArchive?: () => void;
}) {
  const [form, setForm] = useState<Partial<Tag>>({ active: true, ...initial });
  const update = <K extends keyof Tag>(k: K, v: Tag[K]) => setForm((f) => ({ ...f, [k]: v }));
  const swatches = TAG_PALETTE;
  return (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto bottom-sheet-animate">
        <h3 className="text-xl font-semibold text-viridian mb-4">
          {initial?.id ? 'Tag bearbeiten' : 'Neues Tag'}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="tag-name">
              Name *
            </label>
            <input
              id="tag-name"
              placeholder="z. B. Ferienprogramm"
              value={form.name || ''}
              onChange={(e) => update('name', e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Farbe</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {swatches.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update('color', c as unknown as string)}
                  className={`w-8 h-8 rounded-full border ${getBgClass(c)} ${form.color === c ? 'ring-2 ring-offset-2 ring-viridian' : ''}`}
                  aria-label={`Farbe ${c}`}
                />
              ))}
            </div>
            {!isInTagPalette(form.color as string) && (
              <p className="text-xs text-gray-500">
                Hinweis: Farben sind auf die feste Palette begrenzt.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="tag-desc">
              Beschreibung
            </label>
            <textarea
              id="tag-desc"
              placeholder="Optional: kurze Beschreibung…"
              value={form.description || ''}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between gap-3 sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 px-4 md:px-6">
          <span className="tooltip-wrapper">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
              onClick={onCancel}
              title="Abbrechen"
              aria-label="Abbrechen"
            >
              <XIcon className="w-5 h-5" />
            </button>
            <span className="tooltip-bubble">Abbrechen</span>
          </span>
          <span className="tooltip-wrapper">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
              onClick={() => {
                const cleaned = Object.fromEntries(
                  Object.entries(form).filter(([, v]) => v !== '' && v !== null && v !== undefined),
                ) as Partial<Tag>;
                onSubmit(cleaned);
              }}
              title="Speichern"
              aria-label="Speichern"
            >
              <SaveIcon className="w-5 h-5" />
            </button>
            <span className="tooltip-bubble">Speichern</span>
          </span>
          {initial?.id && onArchive && (
            <span className="tooltip-wrapper">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-full border border-gray-300 text-gray-700 bg-white"
                onClick={onArchive}
                title="Archivieren"
                aria-label="Archivieren"
              >
                <ArchiveIcon className="w-5 h-5" />
              </button>
              <span className="tooltip-bubble">Archivieren</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsTags() {
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useTags(showArchived ? undefined : { active: true });
  const { data: archivedOnly } = useTags({ active: false });
  const archivedCount = (archivedOnly || []).length;
  const create = useCreateTag();
  const update = useUpdateTag();
  const remove = useDeleteTag();
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; tag?: Tag } | null>(null);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    tag?: Tag;
    count?: number;
    loading?: boolean;
  }>({ open: false });

  const tags = data || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-xl font-semibold text-viridian">Tags verwalten</h3>
          <p className="text-gray-600">Freitext-Tags mit Farben für flexible Zuordnung</p>
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
              className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-viridian text-white hover:bg-cambridge-blue shadow"
              onClick={() => setModal({ mode: 'create' })}
              aria-label="Neues Tag"
              title="Neues Tag"
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
            <span className="tooltip-bubble">Neues Tag</span>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tags.map((t) => (
          <div key={t.id} className="p-3 rounded border flex items-center justify-between">
            <div className="min-w-0 flex items-center gap-3">
              <span
                className={`inline-block w-4 h-4 rounded ${getBgClass(t.color as string, 'bg-slate-400')}`}
              />
              <div>
                <div className="font-medium text-viridian">{t.name}</div>
                {t.description && (
                  <div className="text-sm text-gray-600 line-clamp-2">{t.description}</div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {showArchived && t.active === false && (
                <button
                  className="text-viridian hover:underline"
                  onClick={() => update.mutate({ id: t.id, data: { active: true } })}
                >
                  Wiederherstellen
                </button>
              )}
              <button
                className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-viridian/10 hover:bg-viridian/20 p-1.5"
                title="Bearbeiten"
                aria-label={`Tag ${t.name} bearbeiten`}
                onClick={() => setModal({ mode: 'edit', tag: t })}
              >
                <Pencil className="w-4 h-4 text-viridian" />
              </button>
              <button
                className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 p-1.5"
                aria-label="Löschen"
                title="Löschen"
                onClick={async () => {
                  setConfirm({ open: true, tag: t, loading: true });
                  try {
                    const res = await api.get('/activities', { params: { tagIds: t.id } });
                    const list = res.data as unknown[];
                    setConfirm({
                      open: true,
                      tag: t,
                      count: Array.isArray(list) ? list.length : 0,
                      loading: false,
                    });
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
        {tags.length === 0 && <div className="text-gray-500 py-6">Noch keine Tags.</div>}
      </div>
      {modal && (
        <TagForm
          initial={modal.mode === 'edit' ? modal.tag : undefined}
          onSubmit={(values) => {
            if (modal.mode === 'create') {
              // Tags sind per Default aktiv
              // Enforce palette on create: fallback to first palette color if invalid
              const color = isInTagPalette(values.color as string) ? values.color : TAG_PALETTE[0];
              create.mutate(
                { ...values, color, active: true },
                { onSuccess: () => setModal(null) },
              );
            } else if (modal.tag?.id) {
              const { id: _r, ...rest } = (values || {}) as Partial<Tag>;
              void _r;
              // Enforce palette on update
              const color = isInTagPalette(rest.color as string)
                ? rest.color
                : isInTagPalette(modal.tag?.color as string)
                  ? modal.tag?.color
                  : TAG_PALETTE[0];
              update.mutate(
                { id: modal.tag.id, data: { ...rest, color } },
                { onSuccess: () => setModal(null) },
              );
            }
          }}
          onArchive={
            modal.mode === 'edit' && modal.tag && modal.tag.id
              ? () =>
                  update.mutate(
                    { id: modal.tag!.id, data: { active: false } },
                    { onSuccess: () => setModal(null) },
                  )
              : undefined
          }
          onCancel={() => setModal(null)}
        />
      )}
      <ConfirmModal
        open={confirm.open}
        title="Tag löschen?"
        message={
          <div className="space-y-2">
            <p>
              Wenn Sie ein Tag löschen, verlieren alle Aktivitäten mit diesem Tag die Zuordnung.
              Historische Auswertungen nach Tags ändern sich rückwirkend.
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
              Tipp: Statt zu löschen können Sie das Tag archivieren. Archivierte Tags erscheinen
              nicht mehr in Auswahlfeldern, bleiben aber für bestehende Daten erhalten.
            </p>
          </div>
        }
        cancelLabel="Abbrechen"
        secondaryLabel="Archivieren (empfohlen)"
        onSecondaryConfirm={() => {
          if (confirm.tag?.id) update.mutate({ id: confirm.tag.id, data: { active: false } });
          setConfirm({ open: false });
        }}
        confirmLabel="Endgültig löschen"
        onConfirm={() => {
          if (confirm.tag?.id) remove.mutate(confirm.tag.id);
          setConfirm({ open: false });
        }}
        onCancel={() => setConfirm({ open: false })}
      />
    </div>
  );
}
