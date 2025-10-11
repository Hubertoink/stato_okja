import { useState, useMemo } from 'react';
import { createOrg, createUser, loadOrgs, loadUsers, updateUser } from '@/lib/mockdb';

export default function AdminOrgSetup() {
  const [orgName, setOrgName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const orgs = useMemo(() => loadOrgs(), []);
  const users = useMemo(() => loadUsers(), []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-viridian mb-4">Organisation anlegen</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="block text-sm font-medium">Name der Organisation</label>
          <input value={orgName} onChange={(e)=>setOrgName(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="z. B. Jugendzentrum Nord"/>
          <label className="block text-sm font-medium">Admin Name</label>
          <input value={adminName} onChange={(e)=>setAdminName(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Max Mustermann"/>
          <label className="block text-sm font-medium">Admin E-Mail</label>
          <input value={adminEmail} onChange={(e)=>setAdminEmail(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="admin@org.de"/>
          <button
            className="bg-viridian text-white px-4 py-2 rounded"
            onClick={() => {
              if (!orgName || !adminEmail) return;
              const org = createOrg(orgName);
              const u = createUser({ email: adminEmail, name: adminName || adminEmail.split('@')[0], role: 'org_admin', orgId: org.id, invited: true });
              // For the mock, set a default password to allow login immediately
              updateUser(u.id, { invited: false, password: 'admin' });
              alert(`Organisation erstellt: ${org.name}. Admin: ${u.email} (Passwort: admin)`);
              setOrgName(''); setAdminEmail(''); setAdminName('');
            }}
          >
            Organisation + Admin anlegen (Mock)
          </button>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Bestehende Organisationen</h3>
          <ul className="text-sm space-y-1">
            {orgs.map(o => (
              <li key={o.id} className="border rounded px-2 py-1 bg-white flex justify-between">
                <span>{o.name}</span>
                <span className="text-gray-500">{users.filter(u=>u.orgId===o.id && u.role==='org_admin').length} Admin(s)</span>
              </li>
            ))}
            {orgs.length===0 && <li className="text-gray-500">Noch keine Organisationen</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
