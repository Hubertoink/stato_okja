import { useState } from 'react';
import { StaffMember, StaffRole, useArchiveStaff, useCreateStaff, useStaff, useUpdateStaff } from '@/lib/staff';
import { Pencil, Save as SaveIcon, X as XIcon, Archive as ArchiveIcon } from 'lucide-react';

const ROLE_LABEL: Record<StaffRole, string> = {
  admin: 'Admin',
  lead: 'Leitung',
  employee: 'Mitarbeitende',
  volunteer: 'Ehrenamtliche',
  helper: 'Helfer',
  analyst: 'Analyst',
};

function StaffForm({ initial, onCancel, onSubmit }: { initial?: Partial<StaffMember>; onCancel: () => void; onSubmit: (data: Partial<StaffMember>) => void }) {
  const [form, setForm] = useState<Partial<StaffMember>>({
    name: '',
    active: true,
    roles: initial?.role ? [initial.role] : initial?.roles || ['employee'],
    ...initial,
  });
  const [archiving, setArchiving] = useState(false);
  const archive = useArchiveStaff();

  const update = <K extends keyof StaffMember>(k: K, v: StaffMember[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
  <div className="fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6">
  <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto bottom-sheet-animate">
        <h3 className="text-xl font-semibold text-viridian mb-4">{initial?.id ? 'Teammitglied bearbeiten' : 'Neues Teammitglied'}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input value={form.name || ''} onChange={(e) => update('name', e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">E-Mail</label>
              <input value={form.email || ''} onChange={(e) => update('email', e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefon</label>
              <input value={form.phone || ''} onChange={(e) => update('phone', e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rolle</label>
            <select
              value={Array.isArray(form.roles) ? form.roles[0] : form.role || 'employee'}
              onChange={(e) => update('roles', [e.target.value as StaffRole])}
              className="w-full border rounded px-3 py-2"
            >
              {Object.entries(ROLE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notizen</label>
            <textarea value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} rows={3} className="w-full border rounded px-3 py-2" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active ?? true} onChange={(e) => update('active', Boolean(e.target.checked))} />
            Aktiv
          </label>
        </div>
  <div className="mt-6 flex items-center justify-between gap-3 sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 px-4 md:px-6">
          <span className="tooltip-wrapper"><button
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
            onClick={onCancel}
            title="Abbrechen"
            aria-label="Abbrechen"
          >
            <XIcon className="w-5 h-5" />
          </button><span className="tooltip-bubble">Abbrechen</span></span>
          <span className="tooltip-wrapper"><button
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
            onClick={() => {
              const cleaned = Object.fromEntries(
                Object.entries(form).filter(([, v]) => v !== '' && v !== null && v !== undefined),
              ) as Partial<StaffMember>;
              onSubmit(cleaned);
            }}
            title="Speichern"
            aria-label="Speichern"
          >
            <SaveIcon className="w-5 h-5" />
          </button><span className="tooltip-bubble">Speichern</span></span>
          {initial?.id && (
            <span className="tooltip-wrapper"><button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-full border border-gray-300 text-gray-700 disabled:opacity-50 bg-white"
              disabled={archiving || archive.isPending}
              onClick={() => {
                setArchiving(true);
                archive.mutate(
                  { id: initial.id as string },
                  { onSettled: () => setArchiving(false) },
                );
              }}
              title="Archivieren"
              aria-label="Archivieren"
            >
              <ArchiveIcon className="w-5 h-5" />
            </button><span className="tooltip-bubble">Archivieren</span></span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsTeam() {
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useStaff(showArchived ? undefined : { active: true });
  const create = useCreateStaff();
  const update = useUpdateStaff();
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; member?: StaffMember } | null>(null);

  const members = data || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-xl font-semibold text-viridian">Team-Mitglieder</h3>
          <p className="text-gray-600">Mitarbeitende, Ehrenamtliche, Helfer</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Archivierte anzeigen
          </label>
          <button className="bg-viridian text-white px-3 py-1.5 text-sm rounded-md hover:bg-cambridge-blue" onClick={() => setModal({ mode: 'create' })}>
            + Neues Mitglied
          </button>
        </div>
      </div>
      <div className="divide-y">
        {members.map((m) => (
          <div key={m.id} className="py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 pr-2">
              <div className="font-medium text-viridian">{m.name}</div>
              <div className="text-sm text-gray-600 flex flex-wrap gap-3">
                {m.email && <span className="break-all">{m.email}</span>}
                {m.phone && <span>{m.phone}</span>}
              </div>
              <div className="mt-2">
                <span className="inline-block px-2 py-0.5 rounded-full bg-azure-web text-viridian text-xs">
                  {ROLE_LABEL[(m.role || (Array.isArray(m.roles) ? m.roles[0] : 'employee')) as StaffRole]}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0 self-start md:self-center">
              <button
                className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-viridian/10 hover:bg-viridian/20 p-1.5"
                title="Bearbeiten"
                aria-label={`Teammitglied ${m.name} bearbeiten`}
                onClick={() => setModal({ mode: 'edit', member: m })}
              >
                <Pencil className="w-4 h-4 text-viridian" />
              </button>
            </div>
          </div>
        ))}
        {members.length === 0 && <div className="text-gray-500 py-6">Noch keine Team-Mitglieder.</div>}
      </div>

      {modal && (
        <StaffForm
          initial={modal.mode === 'edit' ? modal.member : undefined}
          onSubmit={(values) => {
            if (modal.mode === 'create') {
              create.mutate(values, { onSuccess: () => setModal(null) });
            } else if (modal.member?.id) {
              const { id: _removed, ...rest } = values as Partial<StaffMember>;
              void _removed;
              update.mutate({ id: modal.member.id, data: rest }, { onSuccess: () => setModal(null) });
            }
          }}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
