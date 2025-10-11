import { useMemo, useState } from 'react';
import { listUsersByOrg, createUser, removeUser } from '@/lib/mockdb';
import { useAuth } from '@/lib/auth';

export default function OrgUserManagement() {
  const { user } = useAuth();
  const orgId = user?.orgId as string | undefined;
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const users = useMemo(() => (orgId ? listUsersByOrg(orgId) : []), [orgId]);

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
        <button className="bg-viridian text-white px-4 py-2 rounded" onClick={()=>{
          if (!email) return;
          const u = createUser({ email, name: name || email, role: 'user', orgId });
          alert(`Einladung (Mock) für ${u.email} erstellt. Passwort: user`);
          // For mock ease of testing
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          setTimeout(()=>window.location.reload(), 100);
        }}>Einladen (Mock)</button>
      </div>
      <h3 className="mt-6 font-semibold">Benutzerliste</h3>
      <ul className="mt-2 space-y-1">
        {users.map(u => (
          <li key={u.id} className="bg-white border rounded px-3 py-2 flex items-center justify-between">
            <span>{u.name} <span className="text-gray-500">({u.email})</span></span>
            <button className="text-red-600 hover:underline" onClick={()=>{removeUser(u.id); window.location.reload();}}>Entfernen</button>
          </li>
        ))}
        {users.length===0 && <li className="text-gray-500">Noch keine Benutzer</li>}
      </ul>
    </div>
  );
}
