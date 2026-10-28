import { useState } from 'react';
import { useLocations, Location } from '@/lib/locations';
import { api } from '@/lib/api';
import { Pencil, Save as SaveIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { canManageSettingsDestructiveActions, useAuth } from '@/lib/auth';
import Modal from '@/components/Modal';
import { CloseButton, DeleteIconButton, IconButton } from '@/components/ui/Button';
import ConfirmModal from '@/components/ConfirmModal';
import { Input } from '@/components/ui/Field';
import { Tooltip } from '@/components/ui/Tooltip';
import { autoT } from '@/i18n/auto';

function LocationForm({ initial, onClose, onSaved }: { initial?: Partial<Location>; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(['settings', 'common']);
  const [form, setForm] = useState<Partial<Location>>({ ...initial });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const update = <K extends keyof Location>(k: K, v: Location[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const { name, address, roomType } = form;
      const payload = { name, address, roomType };
      if (initial?.id) {
        await api.patch(`/locations/${initial.id}`, payload);
      } else {
        // New locations are always active
        await api.post('/locations', { ...payload, active: true });
      }
      onSaved();
    } catch {
      setSaveError(autoT('ui_892c38bb9803'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="lg"
      showCloseButton={false}
      title={initial?.id ? t('locations.edit') : t('locations.create')}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t('locations.name')}</label>
          <Input value={form.name || ''} onChange={(e)=> update('name', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('locations.address')}</label>
          <Input value={form.address || ''} onChange={(e)=> update('address', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('locations.roomType')}</label>
          <Input value={form.roomType || ''} onChange={(e)=> update('roomType', e.target.value)} />
        </div>
        {/* Locations are always active; no UI toggle */}
      </div>
      {saveError && <p role="alert" className="text-[var(--status-danger-text)]">{saveError}</p>}
      <div data-scroll-footer className="settings-modal-actions entity-form-actions -mx-4 md:-mx-6 px-4 md:px-6">
        <Tooltip text={t('common:actions.cancel')}>
          <CloseButton onClick={onClose} aria-label={t('common:actions.cancel')} />
        </Tooltip>
        <Tooltip text={t('common:actions.save')} disabled={saving}>
          <IconButton disabled={saving} onClick={save} aria-label={t('common:actions.save')}>
            <SaveIcon className="w-5 h-5" />
          </IconButton>
        </Tooltip>
      </div>
    </Modal>
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
        <span className="shrink-0">
          <Tooltip
            text={canManageLocations ? t('locations.create') : 'Nur Editor oder Organisationsadmin dürfen Einrichtungen verwalten'}
            disabled={!canManageLocations}
          >
            <button
              className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-viridian text-white hover:bg-cambridge-blue shadow disabled:cursor-not-allowed disabled:opacity-50"
              onClick={()=> canManageLocations && setModal({ mode: 'create' })}
              aria-label={t('locations.create')}
              disabled={!canManageLocations}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M12 4.5a.75.75 0 01.75.75v6h6a.75.75 0 010 1.5h-6v6a.75.75 0 01-1.5 0v-6h-6a.75.75 0 010-1.5h6v-6A.75.75 0 0112 4.5z" clipRule="evenodd" /></svg>
            </button>
          </Tooltip>
        </span>
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
