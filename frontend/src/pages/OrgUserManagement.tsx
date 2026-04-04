import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchUsers, removeUserApi, updateUserApi, type UserDto } from '@/lib/users';
import { inviteUserApi, listOrgs, type OrgDto } from '@/lib/orgs';
import { api } from '@/lib/api';
import { useOrgScope } from '@/lib/orgScope';
import { Trash2, KeyRound, Users, Plus, Shield, User as UserIcon, Building2, Mail, Search } from 'lucide-react';
import { adminResetPassword } from '@/lib/password';
import { DEFAULT_PUBLIC_CONFIG, fetchPublicConfig, type AdminResetActionMode, type PublicConfig } from '@/lib/publicConfig';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import AssignOrgModal from '@/components/AssignOrgModal';
import { useIsMobile } from '@/lib/useIsMobile';

export default function OrgUserManagement() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { scope } = useOrgScope();
  const isMobile = useIsMobile(768);
  const isScopedOrgView = typeof scope === 'string';

  // Create user modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'org_admin' | 'user'>('user');
  const [targetOrgId, setTargetOrgId] = useState<string | ''>('');
  const [creating, setCreating] = useState(false);

  // User list state
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const reloadRequestRef = useRef(0);

  // Modals
  const [confirmUser, setConfirmUser] = useState<UserDto | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [assignUser, setAssignUser] = useState<UserDto | null>(null);
  
  // Orgs for dropdown
  const [orgs, setOrgs] = useState<OrgDto[]>([]);
  const [publicConfig, setPublicConfig] = useState<PublicConfig>(DEFAULT_PUBLIC_CONFIG);

  async function reload() {
    const requestId = ++reloadRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchUsers();
      if (reloadRequestRef.current !== requestId) return;
      setUsers(list);
    } catch (e: unknown) {
      if (reloadRequestRef.current !== requestId) return;
      const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Fehler beim Laden der Benutzer';
      setError(Array.isArray(msg as unknown as unknown[]) ? (msg as unknown[]).join(', ') : String(msg));
    } finally {
      if (reloadRequestRef.current !== requestId) return;
      setLoading(false);
    }
  }

  // When switching org scope, this screen stays mounted.
  // Ensure we refetch immediately so users update without needing a manual refresh.
  useEffect(() => {
    setUsers([]);
    setError(null);
    void reload();
  }, [scope]);
  
  useEffect(() => {
    (async ()=>{
      try {
        if (user?.role === 'superadmin') {
          setOrgs(await listOrgs());
        } else if (user?.orgId) {
          const res = await api.get<OrgDto[]>('/orgs/subtree');
          setOrgs(res.data);
        } else {
          setOrgs([]);
        }
      } catch { /* ignore */ }
    })();
  }, [user?.id, user?.role, user?.orgId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const config = await fetchPublicConfig();
        if (!cancelled) setPublicConfig(config);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Get current org name for display
  const activeOrgName = (() => {
    if (typeof scope === 'undefined') return 'Superadmin Bereich';
    if (scope === null) return 'Superadmin Bereich';
    const found = orgs.find(o => o.id === scope);
    if (found?.name) return found.name;
    if (user?.orgId === scope && (user as { orgName?: string }).orgName) return (user as { orgName?: string }).orgName as string;
    return `Org ${scope.substring(0,6)}…`;
  })();

  // Filter users by search
  const filteredUsers = users.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.org?.name?.toLowerCase().includes(q);
  });

  // Reset create form
  const resetCreateForm = () => {
    setEmail('');
    setName('');
    setRole('user');
    setTargetOrgId(user?.role !== 'superadmin' ? (user?.orgId ?? '') : '');
  };

  // Handle create user
  const handleCreate = async () => {
    if (!email.trim() || !targetOrgId) return;
    
    setCreating(true);
    try {
      const selectedOrgId = (user?.role === 'superadmin') ? (targetOrgId || null) : ((targetOrgId as string) || (user?.orgId ?? null));
      const res = await inviteUserApi({ email: email.trim(), name: name.trim() || email.split('@')[0], role, orgId: selectedOrgId });
      
      resetCreateForm();
      setCreateModalOpen(false);
      setInviteToken(res.token);
      await reload();
      showToast('Einladung erstellt.', { type: 'success' });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Einladung fehlgeschlagen';
      showToast(Array.isArray(msg as unknown as unknown[]) ? (msg as unknown[]).join(', ') : String(msg), { type: 'error', durationMs: 3500 });
    } finally {
      setCreating(false);
    }
  };

  if (!user) return null;

  // Get available orgs for selection (filtered for non-superadmins)
  const availableOrgs = orgs.filter(o => {
    if (user?.role === 'superadmin') return true;
    const my = orgs.find(x => x.id === user?.orgId);
    if (!my) return o.id === user?.orgId;
    const myPath = my.path || my.id;
    const oPath = o.path || o.id;
    return oPath.startsWith(myPath);
  });

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-viridian flex items-center gap-2">
            <Users className="w-6 h-6" />
            Benutzer verwalten
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {isScopedOrgView ? activeOrgName : 'Alle Benutzer im System'}
          </p>
        </div>
        <button
          className="inline-flex shrink-0 items-center justify-center gap-2 bg-viridian text-white px-4 py-2 rounded-lg shadow hover:bg-cambridge-blue transition-colors"
          onClick={() => { resetCreateForm(); setCreateModalOpen(true); }}
          aria-label="Benutzer einladen"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Benutzer einladen</span>
        </button>
      </div>

      {/* Search & User List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
            <div>
              <h3 className="font-semibold text-gray-800">Benutzerliste</h3>
              <span className="text-xs text-gray-500">{users.length} Benutzer{users.length !== 1 ? '' : ''}</span>
            </div>
            {/* Search */}
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Suchen…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border rounded-lg pl-9 pr-3 py-2 text-sm w-full sm:w-48 focus:ring-2 focus:ring-viridian focus:border-viridian"
              />
            </div>
          </div>
        </div>

        <div className="p-2">
          {loading && (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-viridian mr-2"></div>
              Lade Benutzer…
            </div>
          )}
          
          {error && (
            <div className="text-red-600 py-4 px-3 text-sm bg-red-50 rounded-lg">{error}</div>
          )}

          {!loading && !error && filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">
                {searchQuery
                  ? 'Keine Benutzer gefunden'
                  : `Noch keine Benutzer${isScopedOrgView ? ` in ${activeOrgName}` : ''}`}
              </p>
              {!searchQuery && (
                <button
                  className="inline-flex items-center gap-2 bg-viridian text-white px-4 py-2 rounded-lg"
                  onClick={() => { resetCreateForm(); setCreateModalOpen(true); }}
                >
                  <Plus className="w-4 h-4" />
                  Ersten Benutzer einladen
                </button>
              )}
            </div>
          )}

          {!loading && !error && filteredUsers.length > 0 && (
            <ul className="space-y-3 sm:space-y-0 sm:divide-y sm:divide-gray-100">
              {filteredUsers.map((u) => (
                <UserRow 
                  key={u.id} 
                  userData={u} 
                  currentUser={user}
                  isMobile={isMobile}
                  onReload={reload}
                  onAssign={() => setAssignUser(u)}
                  onDelete={() => setConfirmUser(u)}
                  resetConfig={publicConfig}
                  showToast={showToast}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Neuen Benutzer einladen" maxWidth="md">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
                placeholder="Max Mustermann"
              />
              <p className="text-xs text-gray-500 mt-1">Optional – wird sonst aus der E-Mail abgeleitet</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
                placeholder="user@organisation.de"
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organisation *</label>
              <select
                className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
                value={targetOrgId}
                onChange={(e) => setTargetOrgId(e.target.value)}
              >
                <option value="">Bitte auswählen…</option>
                {availableOrgs.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'org_admin' | 'user')}
                className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
              >
                <option value="user">Benutzer</option>
                <option value="org_admin">Administrator</option>
              </select>
            </div>
          </div>

          {/* Role explanation */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <div className="flex items-start gap-2 mb-2">
              <UserIcon className="w-4 h-4 mt-0.5 text-gray-500" />
              <div><strong>Benutzer:</strong> Kann Aktivitäten und Daten erfassen</div>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5 text-viridian" />
              <div><strong>Administrator:</strong> Kann zusätzlich Benutzer verwalten und Unterorganisationen anlegen</div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <button
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={() => setCreateModalOpen(false)}
            >
              Abbrechen
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              disabled={!email.trim() || !targetOrgId || creating}
              onClick={handleCreate}
            >
              {creating && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
              <Mail className="w-4 h-4" />
              Einladung erstellen
            </button>
          </div>
        </div>
      </Modal>

      {/* Invite Token Modal */}
      <Modal open={!!inviteToken} onClose={() => setInviteToken(null)} title="Einladung erstellt" maxWidth="sm">
        <p className="text-sm text-gray-700 mb-3">Teile diesen Link mit dem Benutzer, damit er sein Passwort setzen kann:</p>
        <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <span className="truncate flex-1 font-mono text-xs">
            {inviteToken ? `${window.location.origin}/accept-invite?token=${inviteToken.substring(0, 20)}...` : ''}
          </span>
          <button
            className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 transition-colors text-xs whitespace-nowrap"
            onClick={async () => {
              try {
                if (inviteToken) await navigator.clipboard.writeText(`${window.location.origin}/accept-invite?token=${inviteToken}`);
                showToast('Link kopiert!', { type: 'success' });
              } catch { /* ignore */ }
            }}
          >
            Link kopieren
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className="px-4 py-2 rounded-lg bg-viridian text-white"
            onClick={() => setInviteToken(null)}
          >
            Fertig
          </button>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <RemoveUserModal
        user={confirmUser}
        onClose={() => setConfirmUser(null)}
        onRemoved={() => { setConfirmUser(null); reload(); }}
      />

      {/* Assign org modal */}
      <AssignOrgModal
        open={!!assignUser}
        onClose={() => setAssignUser(null)}
        userName={assignUser?.name || assignUser?.email || ''}
        currentOrgId={(assignUser?.orgId ?? assignUser?.org?.id) || null}
        onAssign={async (orgId) => {
          if (!assignUser) return;
          try {
            await updateUserApi(assignUser.id, { orgId });
            setAssignUser(null);
            await reload();
            showToast('Organisation zugewiesen', { type: 'success' });
          } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Zuweisung fehlgeschlagen';
            showToast(Array.isArray(msg as unknown as unknown[]) ? (msg as unknown[]).join(', ') : String(msg), { type: 'error' });
          }
        }}
      />
    </div>
  );
}

// Individual user row component
function UserRow({ 
  userData, 
  currentUser, 
  isMobile,
  onReload, 
  onAssign, 
  onDelete,
  resetConfig,
  showToast 
}: { 
  userData: UserDto;
  currentUser: { id: string; role: string };
  isMobile: boolean;
  onReload: () => void;
  onAssign: () => void;
  onDelete: () => void;
  resetConfig: PublicConfig;
  showToast: (msg: string, opts?: { type?: 'success' | 'error' | 'info' }) => void;
}) {
  const isCurrentUser = userData.id === currentUser.id;
  const isSuperadmin = userData.role === 'superadmin';
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<'org_admin' | 'user'>(userData.role === 'org_admin' ? 'org_admin' : 'user');
  const roleLabel = isSuperadmin ? 'Superadmin' : userData.role === 'org_admin' ? 'Admin' : 'Benutzer';
  const roleBadgeClass = isSuperadmin
    ? 'bg-viridian text-white'
    : userData.role === 'org_admin'
      ? 'bg-cambridge-blue/20 text-cambridge-blue'
      : 'bg-gray-100 text-gray-600';
  const avatarClass = isSuperadmin
    ? 'bg-viridian text-white'
    : userData.role === 'org_admin'
      ? 'bg-cambridge-blue text-white'
      : 'bg-gray-200 text-gray-600';

  if (isMobile) {
    return (
      <li className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${avatarClass}`}>
            {isSuperadmin ? <Shield className="w-5 h-5" /> :
             userData.role === 'org_admin' ? <Shield className="w-5 h-5" /> :
             <UserIcon className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 text-base font-semibold text-gray-900 break-words">
                {userData.name || userData.email.split('@')[0]}
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full ${roleBadgeClass}`}>
                {roleLabel}
              </span>
              {isCurrentUser && <span className="text-xs font-medium text-viridian">Du</span>}
            </div>
            <div className="mt-1 break-all text-sm text-gray-600">{userData.email}</div>
            {userData.org?.name && (
              <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-500">
                <Building2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{userData.org.name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {!isSuperadmin && !isCurrentUser && (
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              onClick={() => {
                setPendingRole(userData.role === 'org_admin' ? 'org_admin' : 'user');
                setRoleModalOpen(true);
              }}
            >
              <Shield className="w-4 h-4" />
              Rolle
            </button>
          )}

          {(currentUser.role === 'superadmin' || currentUser.role === 'org_admin') && !isCurrentUser && (
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              onClick={onAssign}
            >
              <Building2 className="w-4 h-4" />
              Organisation
            </button>
          )}

          {currentUser.role === 'superadmin' && (
            <PasswordResetButton
              userId={userData.id}
              userName={userData.name || userData.email}
              resetConfig={resetConfig}
              buttonClassName="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              iconClassName="w-4 h-4"
              showToast={showToast}
            />
          )}

          {!isCurrentUser && (
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
              Entfernen
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <li className="px-3 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between gap-3">
        {/* User Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${avatarClass}`}>
            {isSuperadmin ? <Shield className="w-5 h-5" /> : 
             userData.role === 'org_admin' ? <Shield className="w-5 h-5" /> : 
             <UserIcon className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">
              {userData.name || userData.email.split('@')[0]}
              {isCurrentUser && <span className="ml-2 text-xs text-viridian">(Du)</span>}
            </div>
            <div className="text-sm text-gray-500 truncate">{userData.email}</div>
            {userData.org?.name && (
              <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3" />
                {userData.org.name}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Role badge */}
          <span className={`text-xs px-2 py-1 rounded-full ${roleBadgeClass}`}>{roleLabel}</span>

          {/* Role change (requires explicit confirmation; not for superadmin or self) */}
          {!isSuperadmin && !isCurrentUser && (
            <button
              className="inline-flex items-center gap-1.5 border rounded px-2 py-1 text-xs bg-white hover:bg-gray-50 transition-colors"
              title="Rolle ändern"
              onClick={() => {
                setPendingRole(userData.role === 'org_admin' ? 'org_admin' : 'user');
                setRoleModalOpen(true);
              }}
            >
              <Shield className="w-3.5 h-3.5 text-gray-600" />
              Rolle ändern
            </button>
          )}

          {/* Org assign button */}
          {(currentUser.role === 'superadmin' || currentUser.role === 'org_admin') && !isCurrentUser && (
            <button
              className="p-2 rounded hover:bg-gray-200 transition-colors"
              title="Organisation zuweisen"
              onClick={onAssign}
            >
              <Building2 className="w-4 h-4 text-gray-600" />
            </button>
          )}

          {/* Password reset (superadmin only) */}
          {currentUser.role === 'superadmin' && (
            <PasswordResetButton
              userId={userData.id}
              userName={userData.name || userData.email}
              resetConfig={resetConfig}
              buttonClassName="p-2 rounded hover:bg-gray-200 transition-colors"
              iconClassName="w-4 h-4 text-gray-600"
              iconOnly
              showToast={showToast}
            />
          )}

          {/* Delete button (not for self) */}
          {!isCurrentUser && (
            <button
              className="p-2 rounded hover:bg-red-100 transition-colors"
              title="Benutzer entfernen"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          )}
        </div>
      </div>

      {/* Change role modal */}
      <Modal
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title="Rolle ändern"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Rolle von <span className="font-medium">{userData.name || userData.email}</span> ändern.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Neue Rolle</label>
            <select
              className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
              value={pendingRole}
              onChange={(e) => setPendingRole(e.target.value as 'org_admin' | 'user')}
            >
              <option value="user">Benutzer</option>
              <option value="org_admin">Administrator</option>
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Änderungen an Rollen können Berechtigungen stark beeinflussen.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              onClick={() => setRoleModalOpen(false)}
            >
              Abbrechen
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={pendingRole === (userData.role === 'org_admin' ? 'org_admin' : 'user')}
              onClick={async () => {
                try {
                  await updateUserApi(userData.id, { role: pendingRole });
                  setRoleModalOpen(false);
                  await onReload();
                  showToast('Rolle geändert', { type: 'success' });
                } catch (err: unknown) {
                  const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Rolle ändern fehlgeschlagen';
                  showToast(Array.isArray(msg as unknown as unknown[]) ? (msg as unknown[]).join(', ') : String(msg), { type: 'error' });
                }
              }}
            >
              Rolle ändern
            </button>
          </div>
        </div>
      </Modal>
    </li>
  );
}

function buildTemporaryPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%*?';
  const all = `${letters}${digits}${symbols}`;
  const pick = (source: string) => source[Math.floor(Math.random() * source.length)];
  const chars = [pick(letters), pick(letters), pick(digits), pick(symbols)];
  while (chars.length < 12) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

function PasswordResetButton({
  userId,
  userName,
  resetConfig,
  buttonClassName,
  iconClassName,
  iconOnly,
  showToast,
}: {
  userId: string;
  userName: string;
  resetConfig: PublicConfig;
  buttonClassName: string;
  iconClassName: string;
  iconOnly?: boolean;
  showToast: (msg: string, opts?: { type?: 'success' | 'error' | 'info' }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [resetMode, setResetMode] = useState<AdminResetActionMode>(
    resetConfig.passwordResetMode === 'email' ? 'email' : 'temporary_password',
  );
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [confirmTemporaryPassword, setConfirmTemporaryPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setResetMode(resetConfig.passwordResetMode === 'email' ? 'email' : 'temporary_password');
  }, [resetConfig.passwordResetMode]);

  const resetButtonLabel =
    resetConfig.passwordResetMode === 'admin_temp_password'
      ? 'Temporäres Passwort'
      : resetConfig.passwordResetMode === 'hybrid'
        ? 'Passwort zurücksetzen'
        : 'Reset';
  const resetButtonTitle =
    resetConfig.passwordResetMode === 'admin_temp_password'
      ? 'Temporäres Passwort setzen'
      : resetConfig.passwordResetMode === 'hybrid'
        ? 'Passwort zurücksetzen'
        : 'Passwort-Reset senden';

  const resetFields = () => {
    setTemporaryPassword('');
    setConfirmTemporaryPassword('');
    setBusy(false);
    setResetMode(resetConfig.passwordResetMode === 'email' ? 'email' : 'temporary_password');
  };

  const sendResetEmail = async () => {
    setBusy(true);
    try {
      await adminResetPassword({ userId, mode: 'email' });
      showToast('Reset-Link gesendet', { type: 'success' });
      setOpen(false);
      resetFields();
    } catch {
      showToast('Senden fehlgeschlagen', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleClick = async () => {
    if (resetConfig.passwordResetMode === 'email') {
      await sendResetEmail();
      return;
    }
    setOpen(true);
  };

  const submitTemporaryPassword = async () => {
    if (!temporaryPassword) {
      showToast('Temporäres Passwort erforderlich', { type: 'error' });
      return;
    }
    if (temporaryPassword !== confirmTemporaryPassword) {
      showToast('Passwörter stimmen nicht überein', { type: 'error' });
      return;
    }
    setBusy(true);
    try {
      await adminResetPassword({
        userId,
        mode: 'temporary_password',
        temporaryPassword,
      });
      showToast('Temporäres Passwort gesetzt. Bitte sicher weitergeben.', { type: 'success' });
      setOpen(false);
      resetFields();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      showToast(Array.isArray(msg as unknown[]) ? (msg as unknown[]).join(', ') : String(msg || 'Setzen fehlgeschlagen'), { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (resetMode === 'email') {
      await sendResetEmail();
      return;
    }
    await submitTemporaryPassword();
  };

  return (
    <>
      <button
        className={buttonClassName}
        title={resetButtonTitle}
        onClick={() => {
          void handleClick();
        }}
      >
        <KeyRound className={iconClassName} />
        {!iconOnly && resetButtonLabel}
      </button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetFields();
        }}
        title="Passwort zurücksetzen"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Passwort für <span className="font-medium">{userName}</span> zurücksetzen.
          </p>

          {resetConfig.passwordResetMode === 'hybrid' && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Methode</div>
              <label className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-3">
                <input
                  type="radio"
                  name={`reset-mode-${userId}`}
                  checked={resetMode === 'temporary_password'}
                  onChange={() => setResetMode('temporary_password')}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-gray-800">Temporäres Passwort setzen</span>
                  <span className="block text-xs text-gray-500">Der Benutzer meldet sich damit an und muss es danach sofort ändern.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-3">
                <input
                  type="radio"
                  name={`reset-mode-${userId}`}
                  checked={resetMode === 'email'}
                  onChange={() => setResetMode('email')}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-gray-800">Reset-Link per E-Mail senden</span>
                  <span className="block text-xs text-gray-500">Nutzt den bestehenden E-Mail-Reset-Flow.</span>
                </span>
              </label>
            </div>
          )}

          {resetMode === 'temporary_password' && (
            <div className="space-y-3">
              <div className="rounded-lg bg-amber-50 px-3 py-3 text-xs text-amber-900">
                Das Passwort muss stark sein und der Benutzer wird nach dem Login auf die Passwortänderung umgeleitet.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporäres Passwort</label>
                <input
                  type="text"
                  value={temporaryPassword}
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-viridian focus:border-viridian"
                  placeholder="Temporäres Passwort"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bestätigung</label>
                <input
                  type="text"
                  value={confirmTemporaryPassword}
                  onChange={(event) => setConfirmTemporaryPassword(event.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-viridian focus:border-viridian"
                  placeholder="Passwort wiederholen"
                />
              </div>
              <button
                type="button"
                className="text-sm font-medium text-viridian hover:text-cambridge-blue"
                onClick={() => {
                  const generated = buildTemporaryPassword();
                  setTemporaryPassword(generated);
                  setConfirmTemporaryPassword(generated);
                }}
              >
                Starkes temporäres Passwort generieren
              </button>
            </div>
          )}

          {resetMode === 'email' && (
            <div className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-600">
              Es wird ein normaler Reset-Link per E-Mail ausgelöst.
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              onClick={() => {
                setOpen(false);
                resetFields();
              }}
            >
              Abbrechen
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={busy}
              onClick={() => {
                void submit();
              }}
            >
              {resetMode === 'temporary_password' ? 'Temporäres Passwort setzen' : 'Reset-Link senden'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// Confirm delete modal
function RemoveUserModal({ user, onClose, onRemoved }: { user: UserDto | null; onClose: () => void; onRemoved: () => void }) {
  if (!user) return null;
  return (
    <Modal open={true} onClose={onClose} title="Benutzer entfernen" maxWidth="sm">
      <p className="text-sm text-gray-700">
        Möchtest du <span className="font-medium">{user.name || user.email}</span> wirklich entfernen?
      </p>
      <p className="text-xs text-gray-500 mt-2">Diese Aktion kann nicht rückgängig gemacht werden.</p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={onClose}>
          Abbrechen
        </button>
        <button
          className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
          onClick={async () => {
            try {
              await removeUserApi(user.id);
              onClose();
              onRemoved();
            } catch (err: unknown) {
              const e = err as { response?: { data?: { message?: unknown } } };
              alert(String(e?.response?.data?.message || 'Entfernen fehlgeschlagen'));
            }
          }}
        >
          Entfernen
        </button>
      </div>
    </Modal>
  );
}
