import { useState } from 'react';
import Toggle from '@/components/Toggle';
import {
  StaffMember,
  StaffRole,
  useArchiveStaff,
  useCreateStaff,
  useStaff,
  useUpdateStaff,
} from '@/lib/staff';
import { Pencil, Save as SaveIcon, X as XIcon, Trash2 } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { api } from '@/lib/api';

// Statistikrelevante Rollen (UI-Auswahl auf diese beschränkt)
const ROLE_LABEL: Partial<Record<StaffRole, string>> = {
  employee: 'Mitarbeitende',
  volunteer: 'Ehrenamtliche',
  helper: 'Helfer',
};

function StaffForm({
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

  const update = <K extends keyof StaffMember>(k: K, v: StaffMember[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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
              onChange={(e) => update('name', e.target.value)}
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
                onChange={(e) => update('email', e.target.value)}
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
                onChange={(e) => update('phone', e.target.value)}
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
                  : form.role && ROLE_LABEL[form.role]
                    ? form.role
                    : 'employee'
              }
              onChange={(e) => update('roles', [e.target.value as StaffRole])}
              className="w-full border rounded px-3 py-2"
            >
              {(['employee', 'volunteer', 'helper'] as StaffRole[]).map((key) => (
                <option key={key} value={key}>
                  {ROLE_LABEL[key]}
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
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          {/* "Aktiv" wird nicht mehr umgeschaltet; Teammitglieder sind immer aktiv. */}
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
                  Object.entries(form).filter(
                    ([k, v]) => k !== 'active' && v !== '' && v !== null && v !== undefined,
                  ),
                ) as Partial<StaffMember>;
                onSubmit(cleaned);
              }}
              title="Speichern"
              aria-label="Speichern"
            >
              <SaveIcon className="w-5 h-5" />
            </button>
            <span className="tooltip-bubble">Speichern</span>
          </span>
          {/* Archivieren erfolgt in der Liste über den roten Mülleimer-Button */}
        </div>
      </div>
    </div>
  );
}

export default function SettingsTeam() {
  const [showArchived, setShowArchived] = useState(false);
  const { data, refetch } = useStaff(showArchived ? undefined : { active: true });
  const { data: archivedOnly } = useStaff({ active: false });
  const archivedCount = (archivedOnly || []).length;
  const create = useCreateStaff();
  const update = useUpdateStaff();
  const archive = useArchiveStaff();
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; member?: StaffMember } | null>(
    null,
  );
  const [confirm, setConfirm] = useState<{
    open: boolean;
    member?: StaffMember;
    count?: number;
    loading?: boolean;
  }>({ open: false });

  const members = data || [];

  const roleBadgeClass = (role?: StaffRole | null) => {
    const r = (role || 'employee') as StaffRole;
    switch (r) {
      case 'employee':
        return 'bg-viridian text-white';
      case 'volunteer':
        return 'bg-cambridge-blue text-white';
      case 'helper':
        return 'bg-amber-200 text-gray-900';
      default:
        return 'bg-azure-web text-viridian';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-xl font-semibold text-viridian">Team-Mitglieder</h3>
          <p className="text-gray-600">Mitarbeitende, Ehrenamtliche, Helfer</p>
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
              aria-label="Neues Mitglied"
              title="Neues Mitglied"
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
            <span className="tooltip-bubble">Neues Mitglied</span>
          </span>
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
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs ${roleBadgeClass(
                    (m.role || (Array.isArray(m.roles) ? m.roles[0] : 'employee')) as StaffRole,
                  )}`}
                >
                  {ROLE_LABEL[
                    (m.role || (Array.isArray(m.roles) ? m.roles[0] : 'employee')) as StaffRole
                  ] || '–'}
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
              {showArchived && m.active === false && (
                <button
                  className="text-viridian hover:underline text-sm"
                  onClick={() =>
                    update.mutate(
                      { id: m.id, data: { active: true } },
                      {
                        onSuccess: () => {
                          void refetch();
                        },
                      },
                    )
                  }
                >
                  Wiederherstellen
                </button>
              )}
              <button
                className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 p-1.5"
                title="Löschen"
                aria-label={`Teammitglied ${m.name} löschen`}
                onClick={async () => {
                  setConfirm({ open: true, member: m, loading: true });
                  try {
                    const res = await api.get('/activities', { params: { staffIds: m.id } });
                    const list = res.data as unknown[];
                    setConfirm({
                      open: true,
                      member: m,
                      count: Array.isArray(list) ? list.length : 0,
                      loading: false,
                    });
                  } catch {
                    setConfirm({ open: true, member: m, count: 0, loading: false });
                  }
                }}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          </div>
        ))}
        {members.length === 0 && (
          <div className="text-gray-500 py-6">Noch keine Team-Mitglieder.</div>
        )}
      </div>

      {modal && (
        <StaffForm
          initial={modal.mode === 'edit' ? modal.member : undefined}
          onSubmit={(values) => {
            if (modal.mode === 'create') {
              // Neue Teammitglieder sind immer aktiv
              create.mutate({ ...values, active: true }, { onSuccess: () => setModal(null) });
            } else if (modal.member?.id) {
              const { id: _removed, ...rest } = values as Partial<StaffMember>;
              void _removed;
              // Beim Update das Feld 'active' nicht überschreiben
              const { active: _omit, ...withoutActive } = rest as Partial<StaffMember> & {
                active?: boolean;
              };
              void _omit;
              update.mutate(
                { id: modal.member.id, data: withoutActive },
                { onSuccess: () => setModal(null) },
              );
            }
          }}
          onCancel={() => setModal(null)}
        />
      )}
      <ConfirmModal
        open={confirm.open}
        title="Teammitglied löschen?"
        message={
          <div className="space-y-2">
            <p>
              Wenn Sie ein Teammitglied löschen, verlieren Aktivitäten mit diesem Bezug die
              Zuordnung. Historische Auswertungen ändern sich rückwirkend.
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
              Tipp: Statt zu löschen können Sie das Mitglied archivieren. Archivierte Einträge
              erscheinen nicht mehr in Auswahlfeldern, bleiben aber für bestehende Daten erhalten.
            </p>
          </div>
        }
        cancelLabel="Abbrechen"
        secondaryLabel="Archivieren (empfohlen)"
        onSecondaryConfirm={async () => {
          if (confirm.member?.id) await archive.mutateAsync({ id: confirm.member.id });
          setConfirm({ open: false });
          await refetch();
        }}
        confirmLabel="Endgültig löschen"
        onConfirm={async () => {
          if (confirm.member?.id) await api.delete(`/staff/${confirm.member.id}`);
          setConfirm({ open: false });
          await refetch();
        }}
        onCancel={() => setConfirm({ open: false })}
      />
    </div>
  );
}
