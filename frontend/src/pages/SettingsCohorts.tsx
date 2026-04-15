import { useState } from 'react';
import Toggle from '@/components/Toggle';
import { Cohort, useCohorts, useCreateCohort, useDeleteCohort, useTaxonomyAccess, useUpdateCohort } from '@/lib/taxonomy';
import { Pencil, Save as SaveIcon, X as XIcon, Archive as ArchiveIcon, Trash2 } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { api } from '@/lib/api';
import { useEditorShortcuts } from '@/lib/useEditorShortcuts';

function CohortForm({ initial, onSubmit, onCancel, onArchive }: { initial?: Partial<Cohort>; onSubmit: (d: Partial<Cohort>) => void; onCancel: () => void; onArchive?: () => void }) {
  const [form, setForm] = useState<Partial<Cohort>>({ active: true, sortOrder: 0, ...initial });
  const update = <K extends keyof Cohort>(k: K, v: Cohort[K]) => setForm((f) => ({ ...f, [k]: v }));
  const handleSave = () => {
    const cleaned = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== '' && v !== null && v !== undefined),
    ) as Partial<Cohort>;
    onSubmit(cleaned);
  };

  useEditorShortcuts({
    onClose: onCancel,
    onSave: handleSave,
  });

  return (
  <div className="fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6">
  <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto bottom-sheet-animate">
        <h3 className="text-xl font-semibold text-viridian mb-4">{initial?.id ? 'Kohorte bearbeiten' : 'Neue Kohorte'}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input value={form.name || ''} onChange={(e) => update('name', e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Min Alter</label>
              <input type="number" value={form.minAge ?? 0} onChange={(e) => update('minAge', Number(e.target.value))} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Alter</label>
              <input type="number" value={form.maxAge ?? 0} onChange={(e) => update('maxAge', Number(e.target.value))} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sortierung</label>
              <input type="number" value={form.sortOrder ?? 0} onChange={(e) => update('sortOrder', Number(e.target.value))} className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          {/* Kohorten werden immer aktiv angelegt; kein Toggle im UI */}
        </div>
  <div className="modal-sticky-actions md:-mx-6 md:px-6">
          <span className="tooltip-wrapper"><button type="button" className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700" onClick={onCancel} title="Abbrechen" aria-label="Abbrechen">
            <XIcon className="w-5 h-5" />
          </button><span className="tooltip-bubble">Abbrechen</span></span>
          <span className="tooltip-wrapper"><button
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
            onClick={handleSave}
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

export default function SettingsCohorts() {
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useCohorts(showArchived ? undefined : { active: true });
  const { data: archivedOnly } = useCohorts({ active: false });
  const { data: access } = useTaxonomyAccess();
  const archivedCount = (archivedOnly || []).length;
  const create = useCreateCohort();
  const update = useUpdateCohort();
  const remove = useDeleteCohort();
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; cohort?: Cohort } | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; cohort?: Cohort; countActivities?: number; countParticipants?: number; loading?: boolean }>({ open: false });

  const cohorts = data || [];
  const canCreateOwn = access?.cohorts.canCreateOwn ?? true;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-xl font-semibold text-viridian">Alterskohorten</h3>
          <p className="text-gray-600">Definieren Sie Altersgruppen für die Auswertung</p>
          {!canCreateOwn && (
            <p className="text-xs text-amber-700 mt-1">
              Lokale Kohorten sind in diesem Org-Kontext gesperrt. Sichtbar bleiben geerbte und bestehende Kohorten.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {archivedCount > 0 && (
            <Toggle checked={showArchived} onChange={setShowArchived} label={<span>Archiv <span className="text-xs text-gray-500">({archivedCount})</span></span>} />
          )}
          <span className="tooltip-wrapper"><button
            className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-viridian text-white hover:bg-cambridge-blue shadow disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => canCreateOwn && setModal({ mode: 'create' })}
            aria-label="Neue Kohorte"
            title="Neue Kohorte"
            disabled={!canCreateOwn}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M12 4.5a.75.75 0 01.75.75v6h6a.75.75 0 010 1.5h-6v6a.75.75 0 01-1.5 0v-6h-6a.75.75 0 010-1.5h6v-6A.75.75 0 0112 4.5z" clipRule="evenodd" /></svg>
          </button><span className="tooltip-bubble">Neue Kohorte</span></span>
        </div>
      </div>
      <div className="divide-y">
        {cohorts.map((c) => {
          const isInherited = !!c.isInherited;
          const canManage = c.canManage !== false;
          return (
          <div key={c.id} className={`py-3 flex items-center justify-between ${isInherited ? 'bg-gray-50' : ''}`}>
            <div className="min-w-0">
              <div className="font-medium text-viridian flex items-center gap-2">
                {c.name}
                {isInherited && (
                  <span className="text-xs bg-cambridge-blue/20 text-cambridge-blue px-1.5 py-0.5 rounded">
                    geerbt{c.sourceOrgName ? ` aus ${c.sourceOrgName}` : ''}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600">{c.minAge}–{c.maxAge} Jahre</div>
            </div>
            <div className="flex gap-2">
              {showArchived && c.active === false && canManage && (
                <button
                  className="text-viridian hover:underline"
                  onClick={() => update.mutate({ id: c.id, data: { active: true } })}
                >Wiederherstellen</button>
              )}
              {canManage && (
                <>
                  <button
                    className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-viridian/10 hover:bg-viridian/20 p-1.5"
                    title="Bearbeiten"
                    aria-label={`Kohorte ${c.name} bearbeiten`}
                    onClick={() => setModal({ mode: 'edit', cohort: c })}
                  >
                    <Pencil className="w-4 h-4 text-viridian" />
                  </button>
                  <button
                    className="danger-icon-button p-1.5"
                    aria-label="Löschen"
                    title="Löschen"
                    onClick={async () => {
                    setConfirm({ open: true, cohort: c, loading: true });
                    try {
                      const resStats = await api.get('/stats/by-cohort');
                      const statsList = Array.isArray(resStats.data) ? (resStats.data as Array<{ cohortId: string; total: number; activities?: number }>) : [];
                      const statEntry = statsList.find((s) => s.cohortId === c.id);
                      const participants = statEntry?.total || 0;
                      const acts = typeof statEntry?.activities === 'number' ? statEntry!.activities : 0;
                      setConfirm({ open: true, cohort: c, countActivities: acts, countParticipants: participants, loading: false });
                    } catch {
                      setConfirm((prv) => ({ ...prv, loading: false }));
                    }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          );
        })}
        {cohorts.length === 0 && <div className="text-gray-500 py-6">Keine sichtbaren Kohorten in diesem Org-Kontext.</div>}
      </div>

      {modal && (
        <CohortForm
          initial={modal.mode === 'edit' ? modal.cohort : undefined}
          onSubmit={(values) => {
            if (modal.mode === 'create') {
              create.mutate({ ...values, active: true }, { onSuccess: () => setModal(null) });
            } else if (modal.cohort?.id) {
              const { id: _r, ...rest } = (values || {}) as Partial<Cohort>;
              void _r;
              update.mutate({ id: modal.cohort.id, data: rest }, { onSuccess: () => setModal(null) });
            }
          }}
          onArchive={modal.mode === 'edit' && modal.cohort && modal.cohort.id ? () => update.mutate({ id: modal.cohort!.id, data: { active: false } }, { onSuccess: () => setModal(null) }) : undefined}
          onCancel={() => setModal(null)}
        />
      )}

      <ConfirmModal
        open={confirm.open}
        title="Kohorte löschen?"
        message={
          <div className="space-y-2">
            <p>Wenn Sie eine Alterskohorte löschen, werden historische Auswertungen beeinflusst. Aktivitäten, die dieser Kohorte zugeordnet wurden, verlieren diese Zuordnung. Statistiken nach Alterskohorten ändern sich rückwirkend.</p>
            {confirm.loading ? (
              <p className="text-sm text-gray-500">Ermittle betroffene Einträge…</p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-gray-700">Betroffene Aktivitäten: <strong>{typeof confirm.countActivities === 'number' ? confirm.countActivities : 0}</strong></p>
                <p className="text-sm text-gray-700">Betroffene Personen (m/w/d gesamt): <strong>{typeof confirm.countParticipants === 'number' ? confirm.countParticipants : 0}</strong></p>
              </div>
            )}
            <p className="text-sm text-gray-600">Tipp: Statt zu löschen können Sie die Kohorte archivieren. Archivierte Kohorten erscheinen nicht mehr in Auswahlfeldern, bleiben aber für bestehende Daten erhalten.</p>
          </div>
        }
        cancelLabel="Abbrechen"
        secondaryLabel="Archivieren (empfohlen)"
        onSecondaryConfirm={() => {
          if (confirm.cohort?.id) update.mutate({ id: confirm.cohort.id, data: { active: false } });
          setConfirm({ open: false });
        }}
        confirmLabel="Endgültig löschen"
        onConfirm={() => {
          if (confirm.cohort?.id) remove.mutate(confirm.cohort.id);
          setConfirm({ open: false });
        }}
        onCancel={() => setConfirm({ open: false })}
      />
    </div>
  );
}
