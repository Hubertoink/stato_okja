import { useEffect, useMemo, useState } from 'react';
import { listUsersByOrg, createUser, removeUser, updateUser } from '@/lib/mockdb';
import { useAuth } from '@/lib/auth';

export default function OrgUserManagement() {
  const { user } = useAuth();
  const orgId = user?.orgId as string | undefined;
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'org_admin' | 'user'>('user');
  const [version, setVersion] = useState(0);
  const users = useMemo(() => (orgId ? listUsersByOrg(orgId) : []), [orgId, version]);
  useEffect(() => { /* force initial read */ setVersion(v=>v); }, []);

  if (!orgId) {
    return <div className="text-gray-600">Keine Organisation zugeordnet.</div>;
  }

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
          onClick={()=>{
            if (!email) return;
            const u = createUser({ email, name: name || email, role, orgId });
            // Für den Mock: Passwort entsprechend Rolle setzen
            updateUser(u.id, { password: role === 'org_admin' ? 'admin' : 'user' });
            alert(`Einladung (Mock) für ${u.email} erstellt. Passwort: ${role === 'org_admin' ? 'admin' : 'user'}`);
            setEmail(''); setName(''); setRole('user');
            setVersion(v=>v+1);
          }}
        >Benutzer anlegen (Mock)</button>
      </div>
      <h3 className="mt-6 font-semibold">Benutzerliste</h3>
      <ul className="mt-2 space-y-1">
        {users.map(u => (
          <li key={u.id} className="bg-white border rounded px-3 py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{u.name} <span className="text-gray-500 font-normal">({u.email})</span></div>
              <div className="text-xs text-gray-600">Rolle: {u.role === 'org_admin' ? 'Admin' : 'Benutzer'}</div>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="border rounded px-2 py-1 text-sm"
                value={u.role === 'superadmin' ? 'superadmin' : u.role}
                disabled={u.role === 'superadmin'}
                onChange={(e)=>{ updateUser(u.id, { role: e.target.value as any }); setVersion(v=>v+1); }}
              >
                <option value="user">Benutzer</option>
                <option value="org_admin">Admin</option>
                {u.role === 'superadmin' && <option value="superadmin">Superadmin</option>}
              </select>
              <button
                className="text-red-600 hover:underline text-sm"
                onClick={()=>{
                  if (u.id === user?.id) { alert('Du kannst dich nicht selbst entfernen.'); return; }
                  const adminCount = users.filter(x=>x.role==='org_admin').length;
                  if (u.role==='org_admin' && adminCount<=1) { alert('Letzten Admin der Organisation kannst du nicht entfernen.'); return; }
                  if (!confirm(`Benutzer ${u.email} entfernen?`)) return;
                  removeUser(u.id);
                  setVersion(v=>v+1);
                }}
              >Entfernen</button>
            </div>
          </li>
        ))}
        {users.length===0 && <li className="text-gray-500">Noch keine Benutzer</li>}
      </ul>
    </div>
  );
}
