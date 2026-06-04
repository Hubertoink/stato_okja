import { useState } from 'react';
import { Archive as ArchiveIcon, Save as SaveIcon, X as XIcon } from 'lucide-react';
import { FIXED_PALETTE, TAG_PALETTE, getBgClass, isInFixedPalette, isInTagPalette } from '@/lib/colorPalette';
import { type Category, type Tag } from '@/lib/taxonomy';
import { type StaffMember, type StaffRole } from '@/lib/staff';
import { useEditorShortcuts } from '@/lib/useEditorShortcuts';

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
    <div className="modal-overlay fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-0 pb-safe md:items-center md:p-6">
      <div className="mb-safe bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-3 sm:px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto overflow-x-hidden bottom-sheet-animate">
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
              onChange={(event) => update('name', event.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Farbe</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {TAG_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => update('color', color as Tag['color'])}
                  className={`w-8 h-8 rounded-full border ${getBgClass(color)} ${form.color === color ? 'ring-2 ring-offset-2 ring-viridian' : ''}`}
                  aria-label={`Farbe ${color}`}
                />
              ))}
            </div>
            {!isInTagPalette(form.color as string) && (
              <p className="text-xs text-gray-500">Hinweis: Farben sind auf die feste Palette begrenzt.</p>
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
              onChange={(event) => update('description', event.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <div className="settings-modal-actions -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 py-2 pb-safe flex items-center justify-between gap-3">
          <div className="flex-1 flex items-center">
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
          </div>
          <div className="flex-1 flex items-center justify-center">
            {initial?.id && onArchive ? (
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
            ) : null}
          </div>
          <div className="flex-1 flex items-center justify-end">
            <span className="tooltip-wrapper">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
                onClick={handleSave}
                title="Speichern"
                aria-label="Speichern"
              >
                <SaveIcon className="w-5 h-5" />
              </button>
              <span className="tooltip-bubble">Speichern</span>
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
    <div className="modal-overlay fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-0 pb-safe md:items-center md:p-6">
      <div className="mb-safe bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-3 sm:px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto overflow-x-hidden bottom-sheet-animate">
        <h3 className="text-xl font-semibold text-viridian mb-4">
          {initial?.id ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="category-name">
              Name *
            </label>
            <input
              id="category-name"
              placeholder="z. B. Beratung"
              value={form.name || ''}
              onChange={(event) => update('name', event.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="category-desc">
              Beschreibung
            </label>
            <textarea
              id="category-desc"
              placeholder="Optional: kurze Beschreibung…"
              value={form.description || ''}
              onChange={(event) => update('description', event.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Standard-Referenz</label>
              <input
                id="category-standard-ref"
                placeholder="z. B. §11 Nr. 3 SGB VIII"
                value={form.standardRef || ''}
                onChange={(event) => update('standardRef', event.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Farbe</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {FIXED_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => update('color', color as Category['color'])}
                    className={`w-8 h-8 rounded-full border ${getBgClass(color)} ${form.color === color ? 'ring-2 ring-offset-2 ring-viridian' : ''}`}
                    aria-label={`Farbe ${color}`}
                  />
                ))}
              </div>
              {!isInFixedPalette(form.color as string) && (
                <p className="text-xs text-gray-500">Hinweis: Farben sind auf die feste Palette begrenzt.</p>
              )}
            </div>
          </div>
        </div>
        <div className="settings-modal-actions -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 py-2 pb-safe flex items-center justify-between gap-3">
          <div className="flex-1 flex items-center">
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
          </div>
          <div className="flex-1 flex items-center justify-center">
            {initial?.id && onArchive ? (
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
            ) : null}
          </div>
          <div className="flex-1 flex items-center justify-end">
            <span className="tooltip-wrapper">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
                onClick={handleSave}
                title="Speichern"
                aria-label="Speichern"
              >
                <SaveIcon className="w-5 h-5" />
              </button>
              <span className="tooltip-bubble">Speichern</span>
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
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto bottom-sheet-animate">
        <h3 className="text-xl font-semibold text-viridian mb-4">
          {initial?.id ? 'Teammitglied bearbeiten' : 'Neues Teammitglied'}
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="staff-name" className="block text-sm font-medium mb-1">
              Name *
            </label>
            <input
              id="staff-name"
              placeholder="Vollständiger Name"
              value={form.name || ''}
              onChange={(event) => update('name', event.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="staff-email" className="block text-sm font-medium mb-1">
                E-Mail
              </label>
              <input
                id="staff-email"
                type="email"
                placeholder="name@example.org"
                value={form.email || ''}
                onChange={(event) => update('email', event.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="staff-phone" className="block text-sm font-medium mb-1">
                Telefon
              </label>
              <input
                id="staff-phone"
                type="tel"
                placeholder="z. B. 01234 567890"
                value={form.phone || ''}
                onChange={(event) => update('phone', event.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label htmlFor="staff-role" className="block text-sm font-medium mb-1">
              Rolle
            </label>
            <select
              id="staff-role"
              value={
                Array.isArray(form.roles)
                  ? form.roles[0]
                  : form.role && STAFF_ROLE_LABEL[form.role]
                    ? form.role
                    : 'employee'
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
            <label htmlFor="staff-notes" className="block text-sm font-medium mb-1">
              Notizen
            </label>
            <textarea
              id="staff-notes"
              placeholder="Interne Hinweise, Verfügbarkeit…"
              value={form.notes || ''}
              onChange={(event) => update('notes', event.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <div className="modal-sticky-actions md:-mx-6 md:px-6">
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
              onClick={handleSave}
              title="Speichern"
              aria-label="Speichern"
            >
              <SaveIcon className="w-5 h-5" />
            </button>
            <span className="tooltip-bubble">Speichern</span>
          </span>
        </div>
      </div>
    </div>
  );
}