import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { createUserApi, fetchUsers, removeUserApi, updateUserApi, type UserDto } from '@/lib/users';

export default function OrgUserManagement() {
  const { user } = useAuth();
  const orgId = (user?.role === 'superadmin') ? undefined : (user?.orgId as string | undefined);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'org_admin' | 'user'>('user');
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchUsers();
      setUsers(list);
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Fehler beim Laden der Benutzer';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
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
              await createUserApi({ email, name: name || email, role, orgId: orgId ?? null });
              setEmail(''); setName(''); setRole('user');
              await reload();
            } catch (e: any) {
              const msg = e?.response?.data?.message || 'Benutzer anlegen fehlgeschlagen';
              alert(Array.isArray(msg) ? msg.join(', ') : String(msg));
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
                    await updateUserApi(u.id, { role: e.target.value as any });
                    await reload();
                  } catch (err: any) {
                    const msg = err?.response?.data?.message || 'Rolle ändern fehlgeschlagen';
                    alert(Array.isArray(msg)?msg.join(', '):String(msg));
                  }
                }}
              >
                <option value="user">Benutzer</option>
                <option value="org_admin">Admin</option>
                {u.role === 'superadmin' && <option value="superadmin">Superadmin</option>}
              </select>
              <button
                className="text-red-600 hover:underline text-sm"
                onClick={async()=>{
                  if (u.id === user?.id) { alert('Du kannst dich nicht selbst entfernen.'); return; }
                  if (!confirm(`Benutzer ${u.email} entfernen?`)) return;
                  try {
                    await removeUserApi(u.id);
                    await reload();
                  } catch (err: any) {
                    const msg = err?.response?.data?.message || 'Entfernen fehlgeschlagen';
                    alert(Array.isArray(msg)?msg.join(', '):String(msg));
                  }
                }}
              >Entfernen</button>
            </div>
          </li>
        ))}
        {(!loading && users.length===0) && <li className="text-gray-500">Noch keine Benutzer</li>}
      </ul>
    </div>
  );
}
