import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import { listOrgs, createOrgApi, type OrgDto } from '@/lib/orgs';
import { useAuth, type Role } from '@/lib/auth';
import { fetchUserMemberships, type UserOrganizationMembership } from '@/lib/users';
import { autoT } from '@/i18n/auto';
import { Button, CloseButton } from '@/components/ui/Button';
import { FieldLabel, Input, Select } from '@/components/ui/Field';

export default function AssignOrgModal({
  open,
  onClose,
  userName,
  userId,
  onAssign,
  onRemoveMembership,
}: {
  open: boolean;
  onClose: () => void;
  userName: string;
  userId: string;
  onAssign: (orgIds: string[], role: Exclude<Role, 'superadmin'>) => Promise<void> | void;
  onRemoveMembership?: (orgId: string) => Promise<void> | void;
}) {
  const [orgs, setOrgs] = useState<OrgDto[]>([]);
  const [memberships, setMemberships] = useState<UserOrganizationMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<Exclude<Role, 'superadmin'>>('user');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newParentId, setNewParentId] = useState<string | ''>('');
  const [removingOrgId, setRemovingOrgId] = useState<string | null>(null);
  const [membershipPendingRemoval, setMembershipPendingRemoval] = useState<UserOrganizationMembership | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('recent_org_ids') || '[]');
    } catch {
      return [];
    }
  });

  const { user } = useAuth();
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const [availableOrgs, existingMemberships] = await Promise.all([
          user?.role === 'superadmin'
            ? listOrgs()
            : Promise.resolve((user?.memberships || []).map((membership) => ({
              id: membership.orgId,
              name: membership.orgName,
            }))),
          fetchUserMemberships(userId),
        ]);
        setOrgs(availableOrgs);
        setMemberships(existingMemberships);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, user?.id, user?.role, user?.memberships, userId]);

  useEffect(() => {
    if (!open) return;
    setSelectedOrgIds([]);
    setSelectedRole('user');
    setQ('');
  }, [open]);

  const idToOrg = useMemo(() => new Map(orgs.map((o) => [o.id, o] as const)), [orgs]);
  const breadcrumbFor = (o: OrgDto) => {
    if (o.path) {
      const parts = o.path.split('/').filter(Boolean);
      const labels = parts.map((id) => idToOrg.get(id)?.name || id);
      return labels.join(' / ');
    }
    // fallback: build via parent links if available
    const labels: string[] = [];
    const seen = new Set<string>();
    let cur: OrgDto | undefined = o;
    while (cur && cur.parentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      const p = idToOrg.get(cur.parentId as string);
      if (!p) break;
      labels.unshift(p.name);
      cur = p;
    }
    labels.push(o.name);
    return labels.join(' / ');
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orgs.filter((o) => {
      if (!term) return true;
      const breadcrumb = breadcrumbFor(o);
      return (o.name || '').toLowerCase().includes(term) || breadcrumb.toLowerCase().includes(term);
    });
  }, [orgs, memberships, q, breadcrumbFor]);

  const recentOrgs = useMemo(
    () => recent
      .map((id) => orgs.find((o) => o.id === id))
      .filter((org): org is OrgDto => Boolean(org) && !memberships.some((membership) => membership.orgId === org?.id && membership.status === 'active')),
    [recent, orgs, memberships],
  );

  async function handleAssign() {
    if (!selectedOrgIds.length) return;
    await onAssign(selectedOrgIds, selectedRole);
    // persist recent
    if (selectedOrgIds.length) {
      const next = [...selectedOrgIds, ...recent.filter((x) => !selectedOrgIds.includes(x))].slice(0, 5);
      setRecent(next);
      try {
        localStorage.setItem('recent_org_ids', JSON.stringify(next));
      } catch (_e) {
        /* ignore */
      }
    }
  }

  function requestRemoveMembership(membership: UserOrganizationMembership) {
    if (!onRemoveMembership || removingOrgId) return;
    setMembershipError(null);
    setMembershipPendingRemoval(membership);
  }

  async function confirmRemoveMembership() {
    const membership = membershipPendingRemoval;
    if (!membership || !onRemoveMembership || removingOrgId) return;
    setRemovingOrgId(membership.orgId);
    try {
      await onRemoveMembership(membership.orgId);
      setMemberships((current) => current.filter((item) => item.orgId !== membership.orgId));
      setMembershipPendingRemoval(null);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      setMembershipError(Array.isArray(message) ? message.join(', ') : String(message || 'Zugang konnte nicht entfernt werden.'));
    } finally {
      setRemovingOrgId(null);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const parentId =
      user?.role === 'superadmin'
        ? newParentId || null
        : (newParentId as string) || (user?.orgId as string | undefined) || null;
    const org = await createOrgApi(newName.trim(), parentId);
    // refresh list based on role
    if (user?.role === 'superadmin') {
      const all = await listOrgs();
      setOrgs(all);
    } else {
      setOrgs((user?.memberships || []).map((membership) => ({
        id: membership.orgId,
        name: membership.orgName,
      })));
    }
    setSelectedOrgIds((current) => [...current, org.id]);
    setCreating(false);
    setNewName('');
    setNewParentId('');
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`Organisationszugänge verwalten – ${userName}`}
        maxWidth="md"
      >
      <div className="space-y-3">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-sm text-[var(--text-secondary)]">
          Wähle eine oder mehrere Organisationen aus, um Zugänge hinzuzufügen. Das rote X entzieht nur den jeweiligen Organisationszugang – Konto und weitere Zugänge bleiben erhalten.
        </div>
        <FieldLabel>Organisationen verwalten</FieldLabel>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={autoT('ui_94116b877ab6')}
          autoFocus
        />
        {/* Quick create toggle */}
        <div>
          <button
            type="button"
            className="text-sm text-viridian underline"
            onClick={() => setCreating((v) => !v)}
          >
            {creating ? autoT('ui_50a05604e20c') : autoT('ui_7080a85ff9d5')}
          </button>
        </div>
        {creating && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
            <FieldLabel className="mb-1">{autoT('ui_709a23220f2c')}</FieldLabel>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              className="mb-2"
              placeholder={autoT('ui_62c2a0bd008d')}
            />
            <FieldLabel className="mb-1">{autoT('ui_734823106a0b')}</FieldLabel>
            <Select
              value={
                user?.role !== 'superadmin' && !newParentId
                  ? ((user?.orgId as string | undefined) ?? '')
                  : newParentId
              }
              onChange={(e) => setNewParentId(e.target.value)}
            >
              {user?.role === 'superadmin' && <option value="">{autoT('ui_b2e9a7616515')}</option>}
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
            <div className="mt-3 flex items-center gap-2">
              <Button onClick={handleCreate} disabled={!newName.trim()} size="sm">
                {autoT('ui_dbc9fb8c7424')}
              </Button>
              <Button onClick={() => setCreating(false)} size="sm" variant="secondary">
                {autoT('ui_07af7cb30fca')}
              </Button>
            </div>
          </div>
        )}

        {/* Recently used */}
        {recentOrgs.length > 0 && (
          <div>
            <div className="mb-1 text-xs text-[var(--text-muted)]">{autoT('ui_72885290a91b')}</div>
            <div className="flex flex-wrap gap-2">
              {recentOrgs.map((o) => (
                <button
                  key={o.id}
                  className={`rounded-full border px-2 py-1 text-xs transition-colors ${selectedOrgIds.includes(o.id) ? 'border-viridian bg-viridian text-white' : 'border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:bg-[var(--interactive-soft)]'}`}
                  onClick={() => setSelectedOrgIds((current) => current.includes(o.id) ? current.filter((id) => id !== o.id) : [...current, o.id])}
                >
                  {o.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* List */}
        <div className="max-h-[40vh] divide-y divide-[var(--border-subtle)] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] scrollbar-hide">
          {loading && (
            <div className="p-3 text-[var(--text-muted)]">{autoT('ui_240c23fcdd31')}</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="p-3 text-[var(--text-muted)]">{autoT('ui_921d42241b62')}</div>
          )}
          {!loading &&
            filtered.map((o) => {
              const membership = memberships.find((item) => item.orgId === o.id && item.status === 'active');
              const isAssigned = Boolean(membership);
              return (
                <div
                  key={o.id}
                  className={`flex items-center gap-2 px-3 py-2 transition-colors ${isAssigned ? 'bg-[var(--surface-2)] opacity-75' : 'hover:bg-[var(--interactive-soft)] active:bg-[var(--interactive-soft-strong)]'}`}
                >
                  <label className={`flex min-w-0 flex-1 items-center gap-2 ${isAssigned ? 'cursor-default' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      className="accent-viridian"
                      checked={isAssigned || selectedOrgIds.includes(o.id)}
                      disabled={isAssigned}
                      onChange={() => setSelectedOrgIds((current) => current.includes(o.id) ? current.filter((id) => id !== o.id) : [...current, o.id])}
                    />
                    <div className="min-w-0 truncate">
                      <div className="text-sm font-medium text-[var(--text-primary)]">
                        {o.name}
                        {membership && (
                          <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                            bereits zugewiesen · {membership.role === 'org_admin' ? 'Organisationsadmin' : membership.role === 'editor' ? 'Editor' : 'Benutzer'}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-[var(--text-muted)]">
                        {breadcrumbFor(o)}
                      </div>
                    </div>
                  </label>
                  {membership && onRemoveMembership && (
                    <CloseButton
                      aria-label={`Zugang zu ${membership.orgName} entfernen`}
                      title={`Zugang zu ${membership.orgName} entfernen`}
                      size="icon-compact"
                      disabled={removingOrgId === membership.orgId}
                      onClick={() => requestRemoveMembership(membership)}
                    />
                  )}
                </div>
              );
            })}
        </div>

        <div>
          <FieldLabel className="mb-1">Rolle in den zusätzlichen Organisationen</FieldLabel>
          <Select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as Exclude<Role, 'superadmin'>)}>
            <option value="user">Benutzer</option>
            <option value="editor">Editor</option>
            <option value="org_admin">Organisationsadmin</option>
          </Select>
        </div>

        <div className="-mx-4 mt-3 sticky bottom-0 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-2 pb-safe md:-mx-6 md:px-6">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {autoT('ui_07af7cb30fca')}
          </Button>
          <Button size="sm" disabled={!selectedOrgIds.length} onClick={handleAssign}>
            {selectedOrgIds.length === 1 ? 'Zusätzlichen Zugang hinzufügen' : `${selectedOrgIds.length} zusätzliche Zugänge hinzufügen`}
          </Button>
        </div>
      </div>
      </Modal>
      <Modal
        open={Boolean(membershipPendingRemoval)}
        onClose={() => {
          if (!removingOrgId) setMembershipPendingRemoval(null);
        }}
        title="Organisationszugang entziehen"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Möchtest du <strong className="text-[var(--text-primary)]">{userName}</strong> den Zugang zu
            {' '}<strong className="text-[var(--text-primary)]">{membershipPendingRemoval?.orgName}</strong> entziehen?
          </p>
          <div className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-sm text-[var(--status-danger-text)]">
            Das Benutzerkonto und Zugänge zu anderen Organisationen bleiben erhalten.
          </div>
          {membershipError && <p className="text-sm text-[var(--status-danger-text)]">{membershipError}</p>}
          <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
            <Button
              size="sm"
              variant="secondary"
              disabled={Boolean(removingOrgId)}
              onClick={() => setMembershipPendingRemoval(null)}
            >
              Abbrechen
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={Boolean(removingOrgId)}
              onClick={() => void confirmRemoveMembership()}
            >
              {removingOrgId ? 'Wird entzogen …' : 'Zugang entziehen'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
