import { useState } from 'react';
import { useLocations, Location } from '@/lib/locations';
import { api } from '@/lib/api';
import { Pencil, Save as SaveIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { canManageSettingsDestructiveActions, useAuth } from '@/lib/auth';
import { useModalHistory } from '@/components/Modal';
import { CloseButton, DeleteIconButton } from '@/components/ui/Button';
import ConfirmModal from '@/components/ConfirmModal';

function LocationForm({ initial, onClose, onSaved }: { initial?: Partial<Location>; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(['settings', 'common']);
  const [form, setForm] = useState<Partial<Location>>({ ...initial });
  const [saving, setSaving] = useState(false);
  useBodyScrollLock(true);
  const { dismiss } = useModalHistory(onClose);
  const update = <K extends keyof Location>(k: K, v: Location[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      if (initial?.id) {
  // On edit, do not change active state via UI (always active); omit 'active' if present
  const { /* active: _omit, */ ...rest } = form as Record<string, unknown>;
        await api.patch(`/locations/${initial.id}`, rest);
      } else {
        // New locations are always active
        await api.post('/locations', { ...form, active: true });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center overflow-x-hidden p-0 md:p-6"
      onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}
    >
      <div className="bg-white w-full max-w-full min-w-0 md:max-w-lg rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto overflow-x-hidden bottom-sheet-animate">
        <h3 className="text-xl font-semibold text-viridian mb-4">{initial?.id ? t('locations.edit') : t('locations.create')}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('locations.name')}</label>
            <input className="w-full border rounded px-3 py-2" value={form.name || ''} onChange={(e)=> update('name', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('locations.address')}</label>
            <input className="w-full border rounded px-3 py-2" value={form.address || ''} onChange={(e)=> update('address', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('locations.roomType')}</label>
            <input className="w-full border rounded px-3 py-2" value={form.roomType || ''} onChange={(e)=> update('roomType', e.target.value)} />
          </div>
          {/* Locations are always active; no UI toggle */}
        </div>
        <div className="settings-modal-actions roomy-settings-modal-actions -mx-4 md:-mx-6 px-4 md:px-6">
          <CloseButton onClick={dismiss} aria-label={t('common:actions.cancel')} />
          <button type="button" disabled={saving} className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white disabled:opacity-50" onClick={save} aria-label={t('common:actions.save')}><SaveIcon className="w-5 h-5"/></button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsLocations() {
  const { t } = useTranslation(['settings', 'common']);
  const { user } = useAuth();
  const { data, refetch } = useLocations({ active: true });
  const [modal, setModal] = useState<{ mode: 'create'|'edit'; loc?: Location }|null>(null);
  const [deleteLocation, setDeleteLocation] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const locations = data || [];
  const canManageLocations = canManageSettingsDestructiveActions(user?.role);

  const confirmDelete = async () => {
    if (!deleteLocation || deleting || !canManageLocations) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/locations/${deleteLocation.id}`);
      setDeleteLocation(null);
      await refetch();
    } catch {
      setDeleteError(t('locations.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden bg-white rounded-lg shadow p-6">
      <div className="flex min-w-0 items-center justify-between mb-4 gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-semibold text-viridian">{t('locations.title')}</h3>
          <p className="text-gray-600">{t('locations.subtitle')}</p>
        </div>
        <span className="tooltip-wrapper shrink-0"><button
          className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-viridian text-white hover:bg-cambridge-blue shadow disabled:cursor-not-allowed disabled:opacity-50"
          onClick={()=> canManageLocations && setModal({ mode: 'create' })}
          aria-label={t('locations.create')}
          title={canManageLocations ? t('locations.create') : 'Nur Editor oder Organisationsadmin dürfen Einrichtungen verwalten'}
          disabled={!canManageLocations}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M12 4.5a.75.75 0 01.75.75v6h6a.75.75 0 010 1.5h-6v6a.75.75 0 01-1.5 0v-6h-6a.75.75 0 010-1.5h6v-6A.75.75 0 0112 4.5z" clipRule="evenodd" /></svg>
        </button><span className="tooltip-bubble">{t('locations.create')}</span></span>
      </div>
      <div className="min-w-0 divide-y">
        {locations.map((l) => (
          <div key={l.id} className="min-w-0 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-viridian">{l.name}</div>
              {(l.address || l.roomType) && <div className="text-sm text-gray-600">{[l.address, l.roomType].filter(Boolean).join(' · ')}</div>}
            </div>
            <div className="flex shrink-0 gap-2">
              {canManageLocations && <button className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-viridian/10 hover:bg-viridian/20 p-1.5" onClick={()=> setModal({ mode: 'edit', loc: l })} aria-label={t('common:actions.edit')}><Pencil className="w-4 h-4 text-viridian"/></button>}
              {canManageLocations && <DeleteIconButton size="icon-compact" onClick={() => { setDeleteError(''); setDeleteLocation(l); }} aria-label={t('common:actions.delete')} />}
            </div>
          </div>
        ))}
        {locations.length === 0 && <div className="text-gray-500 py-6">{t('locations.empty')}</div>}
      </div>
      {modal && (
        <LocationForm initial={modal.mode==='edit'? modal.loc : undefined} onClose={()=> setModal(null)} onSaved={async ()=> { setModal(null); await refetch(); }} />
      )}
      <ConfirmModal
        open={Boolean(deleteLocation)}
        title={t('locations.deleteConfirm')}
        message={<div className="space-y-2"><p>{t('locations.deleteMessage', { name: deleteLocation?.name })}</p>{deleteError && <p role="alert" className="text-[var(--status-danger-text)]">{deleteError}</p>}</div>}
        confirmLabel={t('common:actions.delete')}
        confirmDisabled={deleting}
        onCancel={() => { if (!deleting) setDeleteLocation(null); }}
        onConfirm={() => { void confirmDelete(); }}
      />
    </div>
  );
}
