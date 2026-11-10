import { useCallback, useState } from 'react';
import SettingsEntityHeader from '@/components/settings/SettingsEntityHeader';
import EntityRemovalDialog from '@/components/settings/EntityRemovalDialog';
import {
  StaffMember,
  StaffRole,
  useArchiveStaff,
  useCreateStaff,
  useDeleteStaff,
  useStaff,
  useUpdateStaff,
} from '@/lib/staff';
import { Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { STAFF_ROLE_LABEL, StaffFormModal } from '@/components/settings/EntityFormModals';
import { autoT } from '@/i18n/auto';
import { canManageSettingsDestructiveActions, useAuth } from '@/lib/auth';
import { ArchiveIconButton, DeleteIconButton, IconButton } from '@/components/ui/Button';

export default function SettingsTeam() {
  const { user } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const { data, refetch } = useStaff(showArchived ? undefined : { active: true });
  const { data: archivedOnly } = useStaff({ active: false });
  const archivedCount = (archivedOnly || []).length;
  const create = useCreateStaff();
  const update = useUpdateStaff();
  const archive = useArchiveStaff();
  const remove = useDeleteStaff();
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; member?: StaffMember } | null>(
    null,
  );
  const [removing, setRemoving] = useState<StaffMember | null>(null);
  const loadUsage = useCallback(async () => {
    const res = await api.get('/activities', { params: { staffIds: removing?.id, page: 1, limit: 1 } });
    return Number(res.data?.total || 0);
  }, [removing?.id]);

  const members = data || [];
  const canManageTeam = canManageSettingsDestructiveActions(user?.role);

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
    <div className="modern-card p-6">
      <SettingsEntityHeader
        title={autoT('ui_9261e2edbfdf')} description={autoT('ui_cb2d31be2f67')}
        archivedCount={archivedCount} showArchived={showArchived} onShowArchived={setShowArchived}
        canCreate={canManageTeam} createLabel={autoT('ui_bb42e5a2eb95')}
        onCreate={() => setModal({ mode: 'create' })}
      />
      <div className="divide-y">
        {members.map((m) => (
          <div key={m.id} className="py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 pr-2">
              <div className="font-medium text-viridian break-words flex flex-wrap items-center gap-2">
                {m.name}
                {m.active === false && (
                  <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">Archiviert</span>
                )}
              </div>
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
              {showArchived && m.active === false && canManageTeam && (
                <ArchiveIconButton
                  restore
                  size="icon-compact"
                  title={autoT('ui_98f492b5e015')}
                  aria-label={autoT('ui_98f492b5e015')}
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
                />
              )}
              {canManageTeam && <IconButton
                size="icon-compact" variant="ghost"
                className="!rounded-full bg-viridian/10 hover:bg-viridian/20 text-viridian"
                title={autoT('ui_104f3bfdc340')}
                aria-label={autoT('ui_3829918a22c4', { value0: m.name })}
                onClick={() => setModal({ mode: 'edit', member: m })}
              >
                <Pencil className="w-4 h-4 text-viridian" />
              </IconButton>}
              {canManageTeam && <DeleteIconButton
                size="icon-compact"
                title={autoT('ui_ffa5a8a7e21d')}
                aria-label={autoT('ui_b607bbd2d882', { value0: m.name })}
                onClick={() => setRemoving(m)}
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
          onSubmit={async (values) => {
            if (modal.mode === 'create') {
              // Neue Teammitglieder sind immer aktiv
              await create.mutateAsync({ ...values, active: true });
            } else if (modal.member?.id) {
              const { id: _removed, ...rest } = values as Partial<StaffMember>;
              void _removed;
              // Beim Update das Feld 'active' nicht überschreiben
              const { active: _omit, ...withoutActive } = rest as Partial<StaffMember> & {
                active?: boolean;
              };
              void _omit;
              await update.mutateAsync(
                { id: modal.member.id, data: withoutActive },
              );
            }
            setModal(null);
          }}
          onCancel={() => setModal(null)}
        />
      )}
      {removing && <EntityRemovalDialog
        key={removing.id} title={autoT('ui_e521836a88a3')} name={removing.name}
        archived={removing.active === false} warning={autoT('ui_bdba6855be5c')}
        loadUsage={loadUsage}
        onArchive={() => archive.mutateAsync({ id: removing.id })}
        onDelete={() => remove.mutateAsync(removing.id)}
        onClose={() => setRemoving(null)}
      />}

    </div>
  );
}
