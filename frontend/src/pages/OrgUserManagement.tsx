import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useAuth, type Role } from '@/lib/auth';
import { fetchUsers, removeUserApi, updateUserApi, type UserDto } from '@/lib/users';
import { createLocalUserApi, inviteUserApi, listOrgs, type OrgDto } from '@/lib/orgs';
import { api } from '@/lib/api';
import { useOrgScope } from '@/lib/orgScope';
import { Trash2, KeyRound, Users, Plus, Shield, User as UserIcon, Building2, Mail, Search, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { adminResetPassword } from '@/lib/password';
import { DEFAULT_PUBLIC_CONFIG, fetchPublicConfig, type AdminResetActionMode, type PublicConfig } from '@/lib/publicConfig';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import AssignOrgModal from '@/components/AssignOrgModal';
import { useIsMobile } from '@/lib/useIsMobile';
import PasswordRequirementsHint from '@/components/PasswordRequirementsHint';
import { getPasswordValidationMessage } from '@/lib/passwordPolicy';
import { getEmailValidationMessage } from '@/lib/emailValidation';
import { autoT } from '@/i18n/auto';
import { useTranslation } from 'react-i18next';

export default function OrgUserManagement() {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const { showToast } = useToast();
  const { scope } = useOrgScope();
  const isMobile = useIsMobile(768);
  const isScopedOrgView = typeof scope === 'string';

  // Create user modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Exclude<Role, 'superadmin'>>('user');
  const [targetOrgId, setTargetOrgId] = useState<string | ''>('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [creating, setCreating] = useState(false);

  // User list state
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const reloadRequestRef = useRef(0);

  // Modals
  const [confirmUser, setConfirmUser] = useState<UserDto | null>(null);
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
      const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || autoT('ui_211e58a9e2c6');
      setError(Array.isArray(msg as unknown as unknown[]) ? (msg as unknown[]).join(', ') : String(msg));
    } finally {
      if (reloadRequestRef.current === requestId) setLoading(false);
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
  const emailValidationMessage = getEmailValidationMessage(email);

  // Reset create form
  const resetCreateForm = () => {
    setEmail('');
    setName('');
    setRole('user');
    setTargetOrgId(user?.role !== 'superadmin' ? (user?.orgId ?? '') : '');
    setTemporaryPassword('');
  };

  // Handle create user
  const handleCreate = async () => {
    if (!email.trim() || !targetOrgId) return;
    if (emailValidationMessage) return;
    const localProvisioning = publicConfig.userProvisioningMode === 'local';
    if (localProvisioning && (!temporaryPassword || getPasswordValidationMessage(temporaryPassword))) return;
    
    setCreating(true);
    try {
      const selectedOrgId = (user?.role === 'superadmin') ? (targetOrgId || null) : ((targetOrgId as string) || (user?.orgId ?? null));
      if (localProvisioning) {
        await createLocalUserApi({
          email: email.trim(),
          name: name.trim() || email.split('@')[0],
          role,
          orgId: selectedOrgId as string,
          temporaryPassword,
        });
      } else {
        await inviteUserApi({ email: email.trim(), name: name.trim() || email.split('@')[0], role, orgId: selectedOrgId });
      }
      
      resetCreateForm();
      setCreateModalOpen(false);
      await reload();
      showToast(
        localProvisioning
          ? autoT('ui_3e9d9ed6bfed')
          : autoT('ui_a6b3076de73d'),
        { type: 'success' },
      );
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || autoT('ui_afe7111f97a8');
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
            <Users className="w-6 h-6" />{autoT('ui_1ea1e1f1bc9e')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {isScopedOrgView
              ? t('userManagement.organizationUsers', { name: activeOrgName })
              : t('userManagement.unassignedUsers')}
          </p>
        </div>
        <button
          className="inline-flex shrink-0 items-center justify-center gap-2 bg-viridian text-white px-4 py-2 rounded-lg shadow hover:bg-cambridge-blue transition-colors"
          onClick={() => { resetCreateForm(); setCreateModalOpen(true); }}
          aria-label={publicConfig.userProvisioningMode === 'local' ? autoT('ui_464d554f6c6d') : autoT('ui_744a87e36886')}
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">{publicConfig.userProvisioningMode === 'local' ? autoT('ui_1614f4af1460') : autoT('ui_744a87e36886')}</span>
        </button>
      </div>

      {/* Search & User List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
            <div>
              <h3 className="font-semibold text-gray-800">{autoT('ui_f73f37bacbdd')}</h3>
              <span className="text-xs text-gray-500">{users.length}{' '}{autoT('ui_bd26f3d230af')}{users.length !== 1 ? '' : ''}</span>
            </div>
            {/* Search */}
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={autoT('ui_d26ce4a1305c')}
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
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-viridian mr-2"></div>{autoT('ui_fdfb01fa6df9')}</div>
          )}
          
          {error && (
            <div className="text-red-600 py-4 px-3 text-sm bg-red-50 rounded-lg">{error}</div>
          )}

          {!loading && !error && filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">
                {searchQuery
                  ? autoT('ui_dddda7684ac4')
                  : autoT('ui_15ef9a8b600f', { value0: isScopedOrgView ? ` in ${activeOrgName}` : '' })}
              </p>
              {!searchQuery && (
                <button
                  className="inline-flex items-center gap-2 bg-viridian text-white px-4 py-2 rounded-lg"
                  onClick={() => { resetCreateForm(); setCreateModalOpen(true); }}
                >
                  <Plus className="w-4 h-4" />{autoT('ui_ef5bcd6a81e1')}</button>
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
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title={publicConfig.userProvisioningMode === 'local' ? autoT('ui_d18b3ef3514d') : autoT('ui_be454fe3dbfd')} maxWidth="md">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{autoT('ui_709a23220f2c')}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
                placeholder={autoT('ui_57d950a48336')}
              />
              <p className="text-xs text-gray-500 mt-1">{autoT('ui_14c8987e027b')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{autoT('ui_9811c39359c5')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian ${emailValidationMessage ? "border-red-500" : ''}`}
                placeholder={autoT('ui_15c8c90e4b60')}
                autoFocus
                aria-invalid={Boolean(emailValidationMessage)}
              />
              {emailValidationMessage && <p className="text-xs text-red-600 mt-1">{emailValidationMessage}</p>}
            </div>
          </div>

          {publicConfig.userProvisioningMode === 'local' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">{autoT('ui_c07dc032f12a')}</label>
              <input
                type="password"
                value={temporaryPassword}
                onChange={(event) => setTemporaryPassword(event.target.value)}
                className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
                autoComplete="new-password"
              />
              <PasswordRequirementsHint password={temporaryPassword} className="mt-2" />
              <p className="text-xs text-gray-600 mt-2">{autoT('ui_3402fb901043')}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{autoT('ui_695feaaed412')}</label>
              <select
                className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
                value={targetOrgId}
                onChange={(e) => setTargetOrgId(e.target.value)}
              >
                <option value="">{autoT('ui_4b0896060a4d')}</option>
                {availableOrgs.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{autoT('ui_6237f0afe77f')}</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Exclude<Role, 'superadmin'>)}
                className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
              >
                <option value="user">{autoT('ui_bd26f3d230af')}</option>
                <option value="editor">Editor</option>
                <option value="org_admin">{autoT('ui_1eda23758be9')}</option>
              </select>
            </div>
          </div>

          {/* Role explanation */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <div className="flex items-start gap-2 mb-2">
              <UserIcon className="w-4 h-4 mt-0.5 text-gray-500" />
              <div><strong>{autoT('ui_e8321efba4c2')}</strong>{' '}{autoT('ui_c9319abe9cdf')}</div>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5 text-viridian" />
              <div><strong>{autoT('ui_9e2aeb7aa5cc')}</strong>{' '}{autoT('ui_32a6e772e5c4')}</div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <button
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={() => setCreateModalOpen(false)}
            >{autoT('ui_07af7cb30fca')}</button>
            <button
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              disabled={!email.trim() || Boolean(emailValidationMessage) || !targetOrgId || creating || (publicConfig.userProvisioningMode === 'local' && (!temporaryPassword || Boolean(getPasswordValidationMessage(temporaryPassword))))}
              onClick={handleCreate}
            >
              {creating && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
              {publicConfig.userProvisioningMode === 'local' ? <KeyRound className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
              {publicConfig.userProvisioningMode === 'local' ? autoT('ui_464d554f6c6d') : autoT('ui_39e31ae7a854')}
            </button>
          </div>
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
            showToast(autoT('ui_fd4267b6a968'), { type: 'success' });
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
  const { t } = useTranslation('common');
  const isCurrentUser = userData.id === currentUser.id;
  const isSuperadmin = userData.role === 'superadmin';
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleHelpOpen, setRoleHelpOpen] = useState(false);
  const currentSelectableRole: Exclude<Role, 'superadmin'> = userData.role === 'org_admin'
    ? 'org_admin'
    : userData.role === 'editor'
      ? 'editor'
      : 'user';
  const [pendingRole, setPendingRole] = useState<Exclude<Role, 'superadmin'>>(currentSelectableRole);
  const roleLabel = isSuperadmin ? 'Superadmin' : userData.role === 'org_admin' ? 'Admin' : userData.role === 'editor' ? 'Editor' : autoT('ui_bd26f3d230af');
  const roleBadgeClass = isSuperadmin
    ? 'bg-viridian text-white'
    : userData.role === 'org_admin'
      ? 'bg-cambridge-blue/20 text-cambridge-blue'
      : userData.role === 'editor'
        ? 'bg-viridian/15 text-viridian'
      : 'bg-gray-100 text-gray-600';
  const avatarClass = isSuperadmin
    ? 'bg-viridian text-white'
    : userData.role === 'org_admin'
      ? 'bg-cambridge-blue text-white'
      : userData.role === 'editor'
        ? 'bg-viridian text-white'
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
              {isCurrentUser && <span className="text-xs font-medium text-viridian">{autoT('ui_848149853921')}</span>}
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
                setPendingRole(currentSelectableRole);
                setRoleModalOpen(true);
              }}
            >
              <Shield className="w-4 h-4" />{autoT('ui_6237f0afe77f')}</button>
          )}

          {(currentUser.role === 'superadmin' || currentUser.role === 'org_admin') && !isCurrentUser && (
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              onClick={onAssign}
            >
              <Building2 className="w-4 h-4" />{autoT('ui_6e99c1d3b150')}</button>
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
              <Trash2 className="w-4 h-4" />{autoT('ui_f78b6376e028')}</button>
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
              {isCurrentUser && <span className="ml-2 text-xs text-viridian">{autoT('ui_12e5369c8fb1')}</span>}
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
              title={autoT('ui_3cde967bbfd0')}
              onClick={() => {
                setPendingRole(currentSelectableRole);
                setRoleModalOpen(true);
              }}
            >
              <Shield className="w-3.5 h-3.5 text-gray-600" />{autoT('ui_3cde967bbfd0')}</button>
          )}

          {/* Org assign button */}
          {(currentUser.role === 'superadmin' || currentUser.role === 'org_admin') && !isCurrentUser && (
            <button
              className="p-2 rounded hover:bg-gray-200 transition-colors"
              title={autoT('ui_f132125032ab')}
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
              title={autoT('ui_2a1dd54ba9b6')}
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
        title={autoT('ui_3cde967bbfd0')}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            {autoT('ui_c82711ef6dd2')}{' '}
            <span className="font-medium">{userData.name || userData.email}</span>{' '}
            {autoT('ui_42347fb498a0')}
          </p>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-700">{autoT('ui_1fca361cd80f')}</label>
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-viridian"
                onClick={() => setRoleHelpOpen((open) => !open)}
                aria-label={t('roles.descriptions.toggle')}
                aria-expanded={roleHelpOpen}
                title={t('roles.descriptions.toggle')}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
            <select
              className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
              value={pendingRole}
              onChange={(e) => setPendingRole(e.target.value as Exclude<Role, 'superadmin'>)}
            >
              <option value="user">{autoT('ui_bd26f3d230af')}</option>
              <option value="editor">Editor</option>
              <option value="org_admin">{autoT('ui_1eda23758be9')}</option>
            </select>
            {roleHelpOpen && (
              <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-600">
                <p className="font-semibold text-gray-800">{t('roles.descriptions.title')}</p>
                <p><span className="font-medium text-gray-800">{t('roles.user')}:</span> {t('roles.descriptions.user')}</p>
                <p><span className="font-medium text-gray-800">{t('roles.editor')}:</span> {t('roles.descriptions.editor')}</p>
                <p><span className="font-medium text-gray-800">{t('roles.org_admin')}:</span> {t('roles.descriptions.org_admin')}</p>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">{autoT('ui_bba2b9362a66')}</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              onClick={() => setRoleModalOpen(false)}
            >{autoT('ui_07af7cb30fca')}</button>
            <button
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={pendingRole === currentSelectableRole}
              onClick={async () => {
                try {
                  await updateUserApi(userData.id, { role: pendingRole });
                  setRoleModalOpen(false);
                  await onReload();
                  showToast(autoT('ui_d524dd5d7012'), { type: 'success' });
                } catch (err: unknown) {
                  const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message || autoT('ui_bcdd0620f5b9');
                  showToast(Array.isArray(msg as unknown as unknown[]) ? (msg as unknown[]).join(', ') : String(msg), { type: 'error' });
                }
              }}
            >{autoT('ui_3cde967bbfd0')}</button>
          </div>
        </div>
      </Modal>
    </li>
  );
}

function buildTemporaryPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%*?';
  const all = `${upper}${lower}${digits}${symbols}`;
  const pick = (source: string) => source[Math.floor(Math.random() * source.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
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
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [showConfirmTemporaryPassword, setShowConfirmTemporaryPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const temporaryPasswordValidationMessage = getPasswordValidationMessage(temporaryPassword);

  useEffect(() => {
    setResetMode(resetConfig.passwordResetMode === 'email' ? 'email' : 'temporary_password');
  }, [resetConfig.passwordResetMode]);

  const resetButtonLabel =
    resetConfig.passwordResetMode === 'admin_temp_password'
      ? autoT('ui_20641e4ae914')
      : resetConfig.passwordResetMode === 'hybrid'
        ? autoT('ui_ac8579f409c2')
        : 'Reset';
  const resetButtonTitle =
    resetConfig.passwordResetMode === 'admin_temp_password'
      ? autoT('ui_7a28e7c4548f')
      : resetConfig.passwordResetMode === 'hybrid'
        ? autoT('ui_ac8579f409c2')
        : autoT('ui_c7bd5292502e');

  const resetFields = () => {
    setTemporaryPassword('');
    setConfirmTemporaryPassword('');
    setShowTemporaryPassword(false);
    setShowConfirmTemporaryPassword(false);
    setBusy(false);
    setResetMode(resetConfig.passwordResetMode === 'email' ? 'email' : 'temporary_password');
  };

  const sendResetEmail = async () => {
    setBusy(true);
    try {
      await adminResetPassword({ userId, mode: 'email' });
      showToast(autoT('ui_4d9d929e45c9'), { type: 'success' });
      setOpen(false);
      resetFields();
    } catch {
      showToast(autoT('ui_e06f0adb7deb'), { type: 'error' });
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
      showToast(autoT('ui_ac48d3d8da29'), { type: 'error' });
      return;
    }
    if (temporaryPassword !== confirmTemporaryPassword) {
      showToast(autoT('ui_8e0c2f68198c'), { type: 'error' });
      return;
    }
    if (temporaryPasswordValidationMessage) {
      showToast(temporaryPasswordValidationMessage, { type: 'error' });
      return;
    }
    setBusy(true);
    try {
      await adminResetPassword({
        userId,
        mode: 'temporary_password',
        temporaryPassword,
      });
      showToast(autoT('ui_3719f800953a'), { type: 'success' });
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
        title={autoT('ui_ac8579f409c2')}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            {autoT('ui_181ea833463f')}{' '}<span className="font-medium">{userName}</span>{' '}{autoT('ui_8d140d8bf587')}
          </p>

          {resetConfig.passwordResetMode === 'hybrid' && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">{autoT('ui_5dcc6d55e88c')}</div>
              <label className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-3">
                <input
                  type="radio"
                  name={`reset-mode-${userId}`}
                  checked={resetMode === 'temporary_password'}
                  onChange={() => setResetMode('temporary_password')}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-gray-800">{autoT('ui_7a28e7c4548f')}</span>
                  <span className="block text-xs text-gray-500">{autoT('ui_b40566514b14')}</span>
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
                  <span className="block font-medium text-gray-800">{autoT('ui_0cbccb90f14d')}</span>
                  <span className="block text-xs text-gray-500">{autoT('ui_f78cd0b8b81d')}</span>
                </span>
              </label>
            </div>
          )}

          {resetMode === 'temporary_password' && (
            <div className="space-y-3">
              <div className="rounded-lg bg-amber-50 px-3 py-3 text-xs text-amber-900">{autoT('ui_ddb790431110')}</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{autoT('ui_20641e4ae914')}</label>
                <PasswordInput
                  value={temporaryPassword}
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                  visible={showTemporaryPassword}
                  onToggleVisibility={() => setShowTemporaryPassword((visible) => !visible)}
                  placeholder={autoT('ui_20641e4ae914')}
                />
                <PasswordRequirementsHint password={temporaryPassword} className="mt-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{autoT('ui_35229a5f4490')}</label>
                <PasswordInput
                  value={confirmTemporaryPassword}
                  onChange={(event) => setConfirmTemporaryPassword(event.target.value)}
                  visible={showConfirmTemporaryPassword}
                  onToggleVisibility={() => setShowConfirmTemporaryPassword((visible) => !visible)}
                  placeholder={autoT('ui_3794271cb105')}
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
              >{autoT('ui_6669229e0285')}</button>
            </div>
          )}

          {resetMode === 'email' && (
            <div className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-600">{autoT('ui_ca1c655804a0')}</div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              onClick={() => {
                setOpen(false);
                resetFields();
              }}
            >{autoT('ui_07af7cb30fca')}</button>
            <button
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={busy || (resetMode === 'temporary_password' && Boolean(temporaryPasswordValidationMessage))}
              onClick={() => {
                void submit();
              }}
            >
              {resetMode === 'temporary_password' ? autoT('ui_7a28e7c4548f') : autoT('ui_691ad4def207')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function PasswordInput({
  value,
  visible,
  placeholder,
  onChange,
  onToggleVisibility,
}: {
  value: string;
  visible: boolean;
  placeholder: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggleVisibility: () => void;
}) {
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="new-password"
        className="w-full border rounded-lg px-3 py-2 pr-11 focus:ring-2 focus:ring-viridian focus:border-viridian"
      />
      <button
        type="button"
        onClick={onToggleVisibility}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-viridian"
        aria-label={visible ? autoT('ui_79de9effdeda') : autoT('ui_07039cae9ab7')}
        title={visible ? autoT('ui_79de9effdeda') : autoT('ui_07039cae9ab7')}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// Confirm delete modal
function RemoveUserModal({ user, onClose, onRemoved }: { user: UserDto | null; onClose: () => void; onRemoved: () => void }) {
  if (!user) return null;
  return (
    <Modal open={true} onClose={onClose} title={autoT('ui_2a1dd54ba9b6')} maxWidth="sm">
      <p className="text-sm text-gray-700">{autoT('ui_278bb06ac706')}<span className="font-medium">{user.name || user.email}</span>{autoT('ui_9c7ba5c37be5')}</p>
      <p className="text-xs text-gray-500 mt-2">{autoT('ui_c7cd00d4551a')}</p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={onClose}>{autoT('ui_07af7cb30fca')}</button>
        <button
          className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
          onClick={async () => {
            try {
              await removeUserApi(user.id);
              onClose();
              onRemoved();
            } catch (err: unknown) {
              const e = err as { response?: { data?: { message?: unknown } } };
              alert(String(e?.response?.data?.message || autoT('ui_bbe17e081ceb')));
            }
          }}
        >{autoT('ui_f78b6376e028')}</button>
      </div>
    </Modal>
  );
}
