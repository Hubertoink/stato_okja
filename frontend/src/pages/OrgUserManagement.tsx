import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchUsers, removeUserApi, updateUserApi, type UserDto } from '@/lib/users';
import { inviteUserApi, listOrgs, type OrgDto } from '@/lib/orgs';
import { api } from '@/lib/api';
import { useOrgScope } from '@/lib/orgScope';
import { Trash2, KeyRound } from 'lucide-react';
import { adminResetPassword } from '@/lib/password';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import AssignOrgModal from '@/components/AssignOrgModal';
import { Building2 } from 'lucide-react';

export default function OrgUserManagement() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { scope } = useOrgScope();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'org_admin' | 'user'>('user');
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<UserDto | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [assignUser, setAssignUser] = useState<UserDto | null>(null);
  const [orgs, setOrgs] = useState<OrgDto[]>([]);
  const [targetOrgId, setTargetOrgId] = useState<string | 'root' | ''>('');

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchUsers();
      setUsers(list);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Fehler beim Laden der Benutzer';
      setError(Array.isArray(msg as unknown as unknown[]) ? (msg as unknown[]).join(', ') : String(msg));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);
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
    if (!user) return;
    if (user.role !== 'superadmin') setTargetOrgId((user.orgId as string | undefined) ?? '');
  }, [user]);

  if (!user) return null;
  const activeOrgName = (() => {
    if (typeof scope === 'undefined') return 'Alle Organisationen';
    if (scope === null) return 'Ohne Organisation';
    const found = orgs.find(o => o.id === scope);
    if (found?.name) return found.name;
    if (user?.orgId === scope && (user as { orgName?: string }).orgName) return (user as { orgName?: string }).orgName as string;
    return `Org ${scope.substring(0,6)}…`;
  })();

  return (
    <div>
      <h2 className="text-2xl font-bold text-viridian mb-4">Benutzer verwalten</h2>
      <div className="space-y-2 max-w-md">
        <label className="block text-sm font-medium">Name</label>
        <input value={name} onChange={(e)=>setName(e.target.value)} className="border rounded px-3 py-2" placeholder="Vorname Nachname"/>
        <label className="block text-sm font-medium">E-Mail</label>
        <input value={email} onChange={(e)=>setEmail(e.target.value)} className="border rounded px-3 py-2" placeholder="user@org.de"/>
        <label className="block text-sm font-medium">Organisation</label>
        <select
          className="border rounded px-3 py-2"
          value={targetOrgId}
          onChange={(e)=> setTargetOrgId((e.target.value || '') as string | 'root' | '')}
        >
          {user?.role === 'superadmin' && (<option value="">Bitte Organisation auswählen</option>)}
          {orgs
            .filter(o => {
              if (user?.role === 'superadmin') return true;
              const my = orgs.find(x => x.id === user?.orgId);
              if (!my) return o.id === user?.orgId;
              const myPath = my.path || my.id;
              const oPath = o.path || o.id;
              return oPath.startsWith(myPath);
            })
            .map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
        </select>
        <label className="block text-sm font-medium">Rolle</label>
        <select value={role} onChange={(e)=> setRole(e.target.value as 'org_admin'|'user')} className="border rounded px-3 py-2">
          <option value="user">Benutzer (Daten eingeben)</option>
          <option value="org_admin">Admin (Benutzer verwalten)</option>
        </select>
        <p className="text-xs text-gray-500 -mt-1">
          <span className="font-medium">Admin</span>: kann Benutzer und Unterorganisationen anlegen ·
          <span className="ml-1 font-medium">Benutzer</span>: kann Daten eingeben
        </p>
        <div className="flex items-center gap-2">
          <button
            className="bg-viridian text-white px-4 py-2 rounded disabled:opacity-60"
            disabled={!email || !targetOrgId}
            onClick={async()=>{
              if (!email || !targetOrgId) return;
              try {
                const selectedOrgId = (user?.role === 'superadmin') ? (targetOrgId || null) : ((targetOrgId as string) || (user?.orgId ?? null));
                const res = await inviteUserApi({ email, name: name || email, role, orgId: selectedOrgId });
                setEmail(''); setName(''); setRole('user');
                setTargetOrgId('');
                setInviteToken(res.token);
                await reload();
                showToast('Einladung verschickt.', { type: 'success' });
              } catch (e: unknown) {
                const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Einladung senden fehlgeschlagen';
                showToast(Array.isArray(msg as unknown as unknown[]) ? (msg as unknown[]).join(', ') : String(msg), { type: 'error', durationMs: 3500 });
              }
            }}
          >Benutzer anlegen</button>
        </div>
      </div>

      <h3 className="mt-6 font-semibold">Benutzerliste</h3>
      {loading && <div className="text-gray-500 mt-2">Lade Benutzer…</div>}
      {error && <div className="text-red-600 mt-2 text-sm">{error}</div>}

      <ul className="mt-2 space-y-1">
        {users.map((u: UserDto) => (
          <li key={u.id} className="bg-white border rounded px-3 py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium">
                {u.name} <a className="text-gray-500 font-normal hover:underline" href={`mailto:${u.email}`}>({u.email})</a>
              </div>
              <div className="text-xs text-gray-600">Rolle: {u.role === 'org_admin' ? 'Admin' : (u.role==='superadmin'?'Superadmin':'Benutzer')} {u.org?.name ? `· Organisation: ${u.org.name}` : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              {/* Org zuweisen */}
              {(user.role === 'superadmin' || user.role === 'org_admin') && u.id !== user.id && (
                <button
                  className="p-2 rounded hover:bg-azure-web"
                  title="Organisation zuweisen"
                  aria-label="Organisation zuweisen"
                  onClick={()=> setAssignUser(u)}
                >
                  <Building2 className="w-4 h-4 text-gray-700" />
                </button>
              )}
              {/* Superadmin: trigger password reset email */}
              {user.role === 'superadmin' && (
                <button
                  className="p-2 rounded hover:bg-azure-web"
                  title="Passwort-Zurücksetzen Link senden"
                  onClick={async()=>{
                    try { await adminResetPassword(u.id); showToast('Reset-Link gesendet (falls E-Mail existiert).', { type: 'success' }); }
                    catch { showToast('Senden fehlgeschlagen.', { type: 'error' }); }
                  }}
                >
                  <KeyRound className="w-4 h-4 text-gray-700" />
                </button>
              )}
              <select
                className="border rounded px-2 py-1 text-sm"
                value={u.role === 'superadmin' ? 'superadmin' : u.role}
                disabled={u.role === 'superadmin' || u.id === user.id}
                onChange={async (e)=>{
                  if (u.id === user.id) return; // prevent self role change
                  try {
                    const newRole = e.target.value as 'org_admin'|'user';
                    await updateUserApi(u.id, { role: newRole });
                    await reload();
                  } catch (err: unknown) {
                    const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Rolle ändern fehlgeschlagen';
                    alert(Array.isArray(msg as unknown as unknown[])?(msg as unknown[]).join(', '):String(msg));
                  }
                }}
              >
                <option value="user">Benutzer</option>
                <option value="org_admin">Admin</option>
                {u.role === 'superadmin' && <option value="superadmin">Superadmin</option>}
              </select>
              <button
                className="p-2 rounded hover:bg-red-50"
                title="Entfernen"
                onClick={()=>{
                  if (u.id === user?.id) { showToast('Du kannst dich nicht selbst entfernen.', { type: 'info' }); return; }
                  setConfirmUser(u);
                }}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          </li>
        ))}
  {(!loading && users.length===0) && <li className="text-gray-500">Noch keine Benutzer{typeof scope === 'string' ? ` (${activeOrgName})` : ''}</li>}
      </ul>
      {/* Delete confirmation modal */}
      <RemoveUserModal
        user={confirmUser}
        onClose={()=> setConfirmUser(null)}
        onRemoved={()=> { setConfirmUser(null); reload(); }}
      />
      {/* Assign org modal */}
      <AssignOrgModal
        open={!!assignUser}
        onClose={()=> setAssignUser(null)}
        userName={assignUser?.name || assignUser?.email || ''}
        currentOrgId={(assignUser?.orgId ?? assignUser?.org?.id) || null}
        onAssign={async (orgId)=> {
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
      {/* Einladung-Link Modal */}
      <Modal open={!!inviteToken} onClose={()=> setInviteToken(null)} title="Einladung verschickt" maxWidth="sm">
        <div className="text-sm text-gray-700">Sende diesen Link an den Benutzer, damit er sein Passwort setzen kann:</div>
        <div className="mt-3 flex items-center bg-azure-web rounded px-2 py-2">
          <span className="truncate">{inviteToken ? `${window.location.origin}/accept-invite?token=${inviteToken}` : ''}</span>
          <button
            className="ml-2 px-2 py-0.5 rounded bg-gray-200"
            onClick={async()=>{
              try {
                if (inviteToken) await navigator.clipboard.writeText(`${window.location.origin}/accept-invite?token=${inviteToken}`);
              } catch (_e) {
                /* ignore clipboard errors */
              }
            }}
          >Kopieren</button>
        </div>
      </Modal>
    </div>
  );
}

// Confirm delete modal
function RemoveUserModal({ user, onClose, onRemoved }: { user: UserDto | null; onClose: ()=>void; onRemoved: ()=>void }) {
  if (!user) return null;
  return (
    <Modal open={true} onClose={onClose} title="Benutzer entfernen" maxWidth="sm">
      <p className="text-sm text-gray-700">Möchtest du den Benutzer <span className="font-medium">{user.email}</span> wirklich entfernen?</p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button className="px-3 py-1.5 rounded bg-gray-200 text-gray-700" onClick={onClose}>Abbrechen</button>
        <button
          className="px-3 py-1.5 rounded bg-red-600 text-white"
          onClick={async()=>{
            try { await removeUserApi(user.id); onClose(); onRemoved(); }
            catch (err: unknown) {
              const e = err as { response?: { data?: { message?: unknown } } };
              alert(String(e?.response?.data?.message || 'Entfernen fehlgeschlagen'));
            }
          }}
        >Entfernen</button>
      </div>
    </Modal>
  );
}
