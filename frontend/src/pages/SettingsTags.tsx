import { useState } from 'react';
import Toggle from '@/components/Toggle';
import { Tag, useCreateTag, useDeleteTag, useTags, useTaxonomyAccess, useUpdateTag } from '@/lib/taxonomy';
import { Pencil, Trash2 } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { api } from '@/lib/api';
import { TagFormModal } from '@/components/settings/EntityFormModals';

export default function SettingsTags() {
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useTags(showArchived ? undefined : { active: true });
  const { data: archivedOnly } = useTags({ active: false });
  const { data: access } = useTaxonomyAccess();
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
  const canCreateOwn = access?.tags.canCreateOwn ?? true;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-xl font-semibold text-viridian">Tags verwalten</h3>
          <p className="text-gray-600">Freitext-Tags mit Farben für flexible Zuordnung</p>
          {!canCreateOwn && (
            <p className="taxonomy-lock-hint">
              Lokale Tags sind in diesem Org-Kontext gesperrt. Sichtbar bleiben geerbte und bestehende Tags, lokale Tags sind hier nur lesbar.
            </p>
          )}
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
              aria-label="Neues Tag"
              title="Neues Tag"
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
            <span className="tooltip-bubble">Neues Tag</span>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tags.map((t) => {
          const isInherited = !!t.isInherited;
          const canManage = t.canManage !== false;
          return (
            <div key={t.id} className={`p-3 rounded border flex items-center justify-between ${isInherited ? 'bg-gray-50 border-gray-200' : ''}`}>
              <div className="min-w-0 flex items-center gap-3">
                <span
                  className="inline-block h-4 w-4 rounded bg-slate-400"
                  style={{ backgroundColor: t.color || undefined }}
                />
                <div>
                  <div className="font-medium text-viridian flex items-center gap-2 flex-wrap">
                    <span>{t.name}</span>
                    {isInherited && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-cambridge-blue/15 text-cambridge-blue">
                        geerbt{t.sourceOrgName ? ` aus ${t.sourceOrgName}` : ''}
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <div className="text-sm text-gray-600 line-clamp-2">{t.description}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {showArchived && t.active === false && canManage && (
                  <button
                    className="text-viridian hover:underline"
                    onClick={() => update.mutate({ id: t.id, data: { active: true } })}
                  >
                    Wiederherstellen
                  </button>
                )}
                {canManage && <button
                  className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-viridian/10 hover:bg-viridian/20 p-1.5"
                  title="Bearbeiten"
                  aria-label={`Tag ${t.name} bearbeiten`}
                  onClick={() => setModal({ mode: 'edit', tag: t })}
                >
                  <Pencil className="w-4 h-4 text-viridian" />
                </button>}
                {canManage && <button
                  className="danger-icon-button p-1.5"
                  aria-label="Löschen"
                  title="Löschen"
                  onClick={async () => {
                    setConfirm({ open: true, tag: t, loading: true });
                    try {
                      const res = await api.get('/activities', { params: { tagIds: t.id, page: 1, limit: 1 } });
                      setConfirm({
                        open: true,
                        tag: t,
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
        {tags.length === 0 && <div className="text-gray-500 py-6">Keine sichtbaren Tags in diesem Org-Kontext.</div>}
      </div>
      {modal && (
        <TagFormModal
          initial={modal.mode === 'edit' ? modal.tag : undefined}
          onSubmit={(values) => {
            if (modal.mode === 'create') {
              // Tags sind per Default aktiv.
              const color = values.color || '#7aa39a';
              create.mutate(
                { ...values, color, active: true },
                { onSuccess: () => setModal(null) },
              );
            } else if (modal.tag?.id) {
              const { id: _r, ...rest } = (values || {}) as Partial<Tag>;
              void _r;
              const color = rest.color || modal.tag?.color || '#7aa39a';
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
