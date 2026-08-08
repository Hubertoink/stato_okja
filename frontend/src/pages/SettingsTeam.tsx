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
import { Pencil } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { api } from '@/lib/api';
import { STAFF_ROLE_LABEL, StaffFormModal } from '@/components/settings/EntityFormModals';
import { autoT } from '@/i18n/auto';
import { canManageSettingsDestructiveActions, useAuth } from '@/lib/auth';
import { DeleteIconButton } from '@/components/ui/Button';

export default function SettingsTeam() {
  const { user } = useAuth();
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
  const canManageDestructiveActions = canManageSettingsDestructiveActions(user?.role);

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
          <h3 className="text-xl font-semibold text-viridian">{autoT('ui_9261e2edbfdf')}</h3>
          <p className="text-gray-600">{autoT('ui_cb2d31be2f67')}</p>
        </div>
        <div className="flex items-center gap-3">
          {archivedCount > 0 && (
            <Toggle
              checked={showArchived}
              onChange={setShowArchived}
              label={
                <span>{autoT('ui_d9431e38c8b6')}<span className="text-xs text-gray-500">({archivedCount})</span>
                </span>
              }
            />
          )}
          <span className="tooltip-wrapper">
            <button
              className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-viridian text-white hover:bg-cambridge-blue shadow"
              onClick={() => setModal({ mode: 'create' })}
              aria-label={autoT('ui_bb42e5a2eb95')}
              title={autoT('ui_bb42e5a2eb95')}
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
            <span className="tooltip-bubble">{autoT('ui_bb42e5a2eb95')}</span>
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
                    (m.role || (Array.isArray(m.roles) ? m.roles[0] : "employee")) as StaffRole,
                  )}`}
                >
                  {STAFF_ROLE_LABEL[
                    (m.role || (Array.isArray(m.roles) ? m.roles[0] : "employee")) as StaffRole
                  ] || '–'}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0 self-start md:self-center">
              <button
                className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-viridian/10 hover:bg-viridian/20 p-1.5"
                title={autoT('ui_104f3bfdc340')}
                aria-label={autoT('ui_3829918a22c4', { value0: m.name })}
                onClick={() => setModal({ mode: 'edit', member: m })}
              >
                <Pencil className="w-4 h-4 text-viridian" />
              </button>
              {showArchived && m.active === false && canManageDestructiveActions && (
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
                >{autoT('ui_98f492b5e015')}</button>
              )}
              {canManageDestructiveActions && <DeleteIconButton
                size="icon-compact"
                title={autoT('ui_ffa5a8a7e21d')}
                aria-label={autoT('ui_b607bbd2d882', { value0: m.name })}
                onClick={async () => {
                  setConfirm({ open: true, member: m, loading: true });
                  try {
                    const res = await api.get('/activities', { params: { staffIds: m.id, page: 1, limit: 1 } });
                    setConfirm({
                      open: true,
                      member: m,
                      count: Number(res.data?.total || 0),
                      loading: false,
                    });
                  } catch {
                    setConfirm({ open: true, member: m, count: 0, loading: false });
                  }
                }}
              />}
            </div>
          </div>
        ))}
        {members.length === 0 && (
          <div className="text-gray-500 py-6">{autoT('ui_2f421a476157')}</div>
        )}
      </div>

      {modal && (
        <StaffFormModal
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
        title={autoT('ui_e521836a88a3')}
        message={
          <div className="space-y-2">
            <p>{autoT('ui_bdba6855be5c')}</p>
            {confirm.loading ? (
              <p className="text-sm text-gray-500">{autoT('ui_7a67a2dd16a7')}</p>
            ) : (
              <p className="text-sm text-gray-700">{autoT('ui_8ae03f3803dd')}{' '}
                <strong>{typeof confirm.count === 'number' ? confirm.count : 0}</strong>
              </p>
            )}
            <p className="text-sm text-gray-600">{autoT('ui_ec837b4d76ed')}</p>
          </div>
        }
        cancelLabel={autoT('ui_07af7cb30fca')}
        secondaryLabel={autoT('ui_49471caa9c1f')}
        onSecondaryConfirm={async () => {
          if (confirm.member?.id) await archive.mutateAsync({ id: confirm.member.id });
          setConfirm({ open: false });
          await refetch();
        }}
        confirmLabel={autoT('ui_9df6718de96c')}
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
