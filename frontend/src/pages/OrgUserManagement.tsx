import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchUsers, removeUserApi, updateUserApi, type UserDto } from '@/lib/users';
import { inviteUserApi } from '@/lib/orgs';
import Modal from '@/components/Modal';

export default function OrgUserManagement() {
  const { user } = useAuth();
  const orgId = (user?.role === 'superadmin') ? undefined : (user?.orgId as string | undefined);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'org_admin' | 'user'>('user');
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<UserDto | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchUsers();
      setUsers(list);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Fehler beim Laden der Benutzer';
      setError(Array.isArray(msg as any) ? (msg as any[]).join(', ') : String(msg));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  if (!user) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-viridian mb-4">Benutzer verwalten</h2>
      <div className="space-y-2 max-w-md">
        <label className="block text-sm font-medium">Name</label>
        <input value={name} onChange={(e)=>setName(e.target.value)} className="border rounded px-3 py-2" placeholder="Vorname Nachname"/>
        <label className="block text-sm font-medium">E-Mail</label>
        <input value={email} onChange={(e)=>setEmail(e.target.value)} className="border rounded px-3 py-2" placeholder="user@org.de"/>
        <label className="block text-sm font-medium">Rolle</label>
        <select value={role} onChange={(e)=> setRole(e.target.value as 'org_admin'|'user')} className="border rounded px-3 py-2">
          <option value="user">Benutzer (Daten eingeben)</option>
          <option value="org_admin">Admin (Benutzer verwalten)</option>
        </select>
        <button
          className="bg-viridian text-white px-4 py-2 rounded"
          onClick={async()=>{
            if (!email) return;
            try {
              const res = await inviteUserApi({ email, name: name || email, role, orgId: orgId ?? null });
              setEmail(''); setName(''); setRole('user');
              setInviteToken(res.token);
              await reload();
            } catch (e: unknown) {
              const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Einladung senden fehlgeschlagen';
              alert(Array.isArray(msg as any) ? (msg as any[]).join(', ') : String(msg));
            }
          }}
        >Benutzer anlegen</button>
      </div>

      <h3 className="mt-6 font-semibold">Benutzerliste</h3>
      {loading && <div className="text-gray-500 mt-2">Lade Benutzer…</div>}
      {error && <div className="text-red-600 mt-2 text-sm">{error}</div>}

      <ul className="mt-2 space-y-1">
        {users.map((u: UserDto) => (
          <li key={u.id} className="bg-white border rounded px-3 py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{u.name} <span className="text-gray-500 font-normal">({u.email})</span></div>
              <div className="text-xs text-gray-600">Rolle: {u.role === 'org_admin' ? 'Admin' : (u.role==='superadmin'?'Superadmin':'Benutzer')}</div>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="border rounded px-2 py-1 text-sm"
                value={u.role === 'superadmin' ? 'superadmin' : u.role}
                disabled={u.role === 'superadmin'}
                onChange={async (e)=>{
                  try {
                    const newRole = e.target.value as 'org_admin'|'user';
                    await updateUserApi(u.id, { role: newRole });
                    await reload();
                  } catch (err: unknown) {
                    const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Rolle ändern fehlgeschlagen';
                    alert(Array.isArray(msg as any)?(msg as any[]).join(', '):String(msg));
                  }
                }}
              >
                <option value="user">Benutzer</option>
                <option value="org_admin">Admin</option>
                {u.role === 'superadmin' && <option value="superadmin">Superadmin</option>}
              </select>
              <button
                className="text-red-600 hover:underline text-sm"
                onClick={()=>{
                  if (u.id === user?.id) { alert('Du kannst dich nicht selbst entfernen.'); return; }
                  setConfirmUser(u);
                }}
              >Entfernen</button>
            </div>
          </li>
        ))}
        {(!loading && users.length===0) && <li className="text-gray-500">Noch keine Benutzer</li>}
      </ul>
      {/* Delete confirmation modal */}
      <RemoveUserModal
        user={confirmUser}
        onClose={()=> setConfirmUser(null)}
        onRemoved={()=> { setConfirmUser(null); reload(); }}
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
