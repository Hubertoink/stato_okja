import { useState } from 'react';
import { Archive as ArchiveIcon, Save as SaveIcon, X as XIcon } from 'lucide-react';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { type Category, type Tag } from '@/lib/taxonomy';
import { type StaffMember, type StaffRole } from '@/lib/staff';
import { useEditorShortcuts } from '@/lib/useEditorShortcuts';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { autoT } from '@/i18n/auto';
import { useModalHistory } from '@/components/Modal';

export const STAFF_ROLE_LABEL: Partial<Record<StaffRole, string>> = {
  employee: 'Mitarbeitende',
  volunteer: 'Ehrenamtliche',
  helper: 'Helfer',
};

export function TagFormModal({
  initial,
  onSubmit,
  onCancel,
  onArchive,
}: {
  initial?: Partial<Tag>;
  onSubmit: (data: Partial<Tag>) => void;
  onCancel: () => void;
  onArchive?: () => void;
}) {
  const [form, setForm] = useState<Partial<Tag>>({ active: true, ...initial });
  useBodyScrollLock(true);
  const { dismiss } = useModalHistory(onCancel);
  const update = <K extends keyof Tag>(key: K, value: Tag[K]) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = () => {
    const cleaned = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== '' && value !== null && value !== undefined),
    ) as Partial<Tag>;
    onSubmit(cleaned);
  };

  useEditorShortcuts({
    onClose: onCancel,
    onSave: handleSave,
  });

  return (
    <div className="modal-overlay visual-viewport-fixed z-[60] flex items-end justify-center overflow-x-hidden bg-black/30 p-0 md:items-center md:p-6" onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
      <div className="bg-white w-full max-w-full md:max-w-lg rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-3 sm:px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto overflow-x-hidden bottom-sheet-animate">
        <h3 className="text-xl font-semibold text-viridian mb-4">
          {initial?.id ? autoT('ui_c7f5b6bae389') : autoT('ui_dacb43d1a177')}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="tag-name">{autoT('ui_d145bb830936')}</label>
            <input
              id="tag-name"
              placeholder={autoT('ui_9a833db2ca8f')}
              value={form.name || ''}
              onChange={(event) => update('name', event.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="tag-color">{autoT('ui_89b7957dae43')}</label>
            <ColorPicker id="tag-color" value={form.color} onChange={(color) => update('color', color as Tag['color'])} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="tag-desc">{autoT('ui_b3c8defcacc0')}</label>
            <textarea
              id="tag-desc"
              placeholder={autoT('ui_b93e372c4a97')}
              value={form.description || ''}
              onChange={(event) => update('description', event.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <div className="settings-modal-actions -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
          <div className="flex-1 flex items-center">
            <span className="tooltip-wrapper">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
                onClick={dismiss}
                title={autoT('ui_07af7cb30fca')}
                aria-label={autoT('ui_07af7cb30fca')}
              >
                <XIcon className="w-5 h-5" />
              </button>
              <span className="tooltip-bubble">{autoT('ui_07af7cb30fca')}</span>
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            {initial?.id && onArchive ? (
              <span className="tooltip-wrapper">
                <button
                  type="button"
                  className="inline-flex items-center justify-center p-2 rounded-full border border-gray-300 text-gray-700 bg-white"
                  onClick={onArchive}
                  title={autoT('ui_b81f3298d960')}
                  aria-label={autoT('ui_b81f3298d960')}
                >
                  <ArchiveIcon className="w-5 h-5" />
                </button>
                <span className="tooltip-bubble">{autoT('ui_b81f3298d960')}</span>
              </span>
            ) : null}
          </div>
          <div className="flex-1 flex items-center justify-end">
            <span className="tooltip-wrapper">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
                onClick={handleSave}
                title={autoT('ui_70b73bbc118d')}
                aria-label={autoT('ui_70b73bbc118d')}
              >
                <SaveIcon className="w-5 h-5" />
              </button>
              <span className="tooltip-bubble">{autoT('ui_70b73bbc118d')}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CategoryFormModal({
  initial,
  onSubmit,
  onCancel,
  onArchive,
}: {
  initial?: Partial<Category>;
  onSubmit: (data: Partial<Category>) => void;
  onCancel: () => void;
  onArchive?: () => void;
}) {
  const [form, setForm] = useState<Partial<Category>>({ active: true, ...initial });
  useBodyScrollLock(true);
  const { dismiss } = useModalHistory(onCancel);
  const update = <K extends keyof Category>(key: K, value: Category[K]) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = () => {
    const cleaned = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== '' && value !== null && value !== undefined),
    ) as Partial<Category>;
    onSubmit(cleaned);
  };

  useEditorShortcuts({
    onClose: onCancel,
    onSave: handleSave,
  });

  return (
    <div className="modal-overlay visual-viewport-fixed z-[60] flex items-end justify-center overflow-x-hidden bg-black/30 p-0 md:items-center md:p-6" onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
      <div className="bg-white w-full max-w-full md:max-w-lg rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-3 sm:px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto overflow-x-hidden bottom-sheet-animate">
        <h3 className="text-xl font-semibold text-viridian mb-4">
          {initial?.id ? autoT('ui_a396ad29224c') : autoT('ui_f65f5413c438')}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="category-name">{autoT('ui_d145bb830936')}</label>
            <input
              id="category-name"
              placeholder={autoT('ui_98ec9686a395')}
              value={form.name || ''}
              onChange={(event) => update('name', event.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="category-desc">{autoT('ui_b3c8defcacc0')}</label>
            <textarea
              id="category-desc"
              placeholder={autoT('ui_b93e372c4a97')}
              value={form.description || ''}
              onChange={(event) => update('description', event.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{autoT('ui_7611b749500a')}</label>
              <input
                id="category-standard-ref"
                placeholder={autoT('ui_3d87605003c7')}
                value={form.standardRef || ''}
                onChange={(event) => update('standardRef', event.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="category-color">{autoT('ui_89b7957dae43')}</label>
              <ColorPicker id="category-color" value={form.color} onChange={(color) => update('color', color as Category['color'])} />
            </div>
          </div>
        </div>
        <div className="settings-modal-actions roomy-settings-modal-actions -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
          <div className="flex-1 flex items-center">
            <span className="tooltip-wrapper">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
                onClick={dismiss}
                title={autoT('ui_07af7cb30fca')}
                aria-label={autoT('ui_07af7cb30fca')}
              >
                <XIcon className="w-5 h-5" />
              </button>
              <span className="tooltip-bubble">{autoT('ui_07af7cb30fca')}</span>
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            {initial?.id && onArchive ? (
              <span className="tooltip-wrapper">
                <button
                  type="button"
                  className="inline-flex items-center justify-center p-2 rounded-full border border-gray-300 text-gray-700 bg-white"
                  onClick={onArchive}
                  title={autoT('ui_b81f3298d960')}
                  aria-label={autoT('ui_b81f3298d960')}
                >
                  <ArchiveIcon className="w-5 h-5" />
                </button>
                <span className="tooltip-bubble">{autoT('ui_b81f3298d960')}</span>
              </span>
            ) : null}
          </div>
          <div className="flex-1 flex items-center justify-end">
            <span className="tooltip-wrapper">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
                onClick={handleSave}
                title={autoT('ui_70b73bbc118d')}
                aria-label={autoT('ui_70b73bbc118d')}
              >
                <SaveIcon className="w-5 h-5" />
              </button>
              <span className="tooltip-bubble">{autoT('ui_70b73bbc118d')}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StaffFormModal({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: Partial<StaffMember>;
  onCancel: () => void;
  onSubmit: (data: Partial<StaffMember>) => void;
}) {
  const [form, setForm] = useState<Partial<StaffMember>>({
    name: '',
    roles: initial?.role ? [initial.role] : initial?.roles || ['employee'],
    ...initial,
  });
  useBodyScrollLock(true);
  const { dismiss } = useModalHistory(onCancel);
  const update = <K extends keyof StaffMember>(key: K, value: StaffMember[K]) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = () => {
    const cleaned = Object.fromEntries(
      Object.entries(form).filter(([key, value]) => key !== 'active' && value !== '' && value !== null && value !== undefined),
    ) as Partial<StaffMember>;
    onSubmit(cleaned);
  };

  useEditorShortcuts({
    onClose: onCancel,
    onSave: handleSave,
  });

  return (
    <div className="modal-overlay visual-viewport-fixed z-[60] bg-black/30 flex items-end md:items-center justify-center overflow-x-hidden p-0 md:p-6" onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
      <div className="bg-white w-full max-w-full md:max-w-lg rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto overflow-x-hidden bottom-sheet-animate">
        <h3 className="text-xl font-semibold text-viridian mb-4">
          {initial?.id ? autoT('ui_362bc3480705') : autoT('ui_561b3cbf4717')}
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="staff-name" className="block text-sm font-medium mb-1">{autoT('ui_d145bb830936')}</label>
            <input
              id="staff-name"
              placeholder={autoT('ui_c3c4779024d4')}
              value={form.name || ''}
              onChange={(event) => update('name', event.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="staff-email" className="block text-sm font-medium mb-1">{autoT('ui_9eeffe4b7b6e')}</label>
              <input
                id="staff-email"
                type="email"
                placeholder={autoT('ui_24fe902c0a81')}
                value={form.email || ''}
                onChange={(event) => update('email', event.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="staff-phone" className="block text-sm font-medium mb-1">{autoT('ui_40314f882822')}</label>
              <input
                id="staff-phone"
                type="tel"
                placeholder={autoT('ui_bf47e88b120b')}
                value={form.phone || ''}
                onChange={(event) => update('phone', event.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label htmlFor="staff-role" className="block text-sm font-medium mb-1">{autoT('ui_6237f0afe77f')}</label>
            <select
              id="staff-role"
              value={
                Array.isArray(form.roles)
                  ? form.roles[0]
                  : form.role && STAFF_ROLE_LABEL[form.role]
                    ? form.role
                    : "employee"
              }
              onChange={(event) => update('roles', [event.target.value as StaffRole])}
              className="w-full border rounded px-3 py-2"
            >
              {(['employee', 'volunteer', 'helper'] as StaffRole[]).map((role) => (
                <option key={role} value={role}>
                  {STAFF_ROLE_LABEL[role]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="staff-notes" className="block text-sm font-medium mb-1">{autoT('ui_7e458d013900')}</label>
            <textarea
              id="staff-notes"
              placeholder={autoT('ui_a6853cdd477f')}
              value={form.notes || ''}
              onChange={(event) => update('notes', event.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <div className="settings-modal-actions -mx-4 md:-mx-6 px-4 md:px-6">
          <span className="tooltip-wrapper">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
              onClick={dismiss}
              title={autoT('ui_07af7cb30fca')}
              aria-label={autoT('ui_07af7cb30fca')}
            >
              <XIcon className="w-5 h-5" />
            </button>
            <span className="tooltip-bubble">{autoT('ui_07af7cb30fca')}</span>
          </span>
          <span className="tooltip-wrapper">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
              onClick={handleSave}
              title={autoT('ui_70b73bbc118d')}
              aria-label={autoT('ui_70b73bbc118d')}
            >
              <SaveIcon className="w-5 h-5" />
            </button>
            <span className="tooltip-bubble">{autoT('ui_70b73bbc118d')}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
