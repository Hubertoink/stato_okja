import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { createOrgApi, inviteUserApi, listOrgs, acceptInviteApi, type OrgDto } from '@/lib/orgs';
import { setAuthToken } from '@/lib/api';

export default function AdminOrgSetup() {
  const [orgName, setOrgName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [orgs, setOrgs] = useState<OrgDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite accept modal
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  async function reloadOrgs() {
    setLoading(true);
    try { setOrgs(await listOrgs()); } finally { setLoading(false); }
  }
  useEffect(() => { reloadOrgs(); }, []);

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
            onClick={async () => {
              if (!orgName || !adminEmail) return;
              // 1) Org anlegen
              const org = await createOrgApi(orgName);
              // 2) Admin einladen (bekommt Invite-Token zurück)
              const { token } = await inviteUserApi({ email: adminEmail, name: adminName || adminEmail.split('@')[0], role: 'org_admin', orgId: org.id });
              setOrgName(''); setAdminEmail(''); setAdminName('');
              await reloadOrgs();
              // 3) Modales Passwort-Setzen (anstelle von E-Mail-Link)
              setInviteToken(token);
            }}
          >
            Organisation + Admin einladen
          </button>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Bestehende Organisationen</h3>
          {loading && <div className="text-gray-500">Lade Organisationen…</div>}
          <ul className="text-sm space-y-1">
            {orgs.map(o => (
              <li key={o.id} className="border rounded px-2 py-1 bg-white flex justify-between">
                <span>{o.name}</span>
              </li>
            ))}
            {!loading && orgs.length===0 && <li className="text-gray-500">Noch keine Organisationen</li>}
          </ul>
        </div>
      </div>

      {/* Einladung annehmen Modal */}
      <Modal open={!!inviteToken} onClose={()=>{ setInviteToken(null); setInvitePassword(''); }} title="Admin-Einladung aktivieren" maxWidth="sm">
        <p className="text-sm text-gray-700 mb-3">Setze ein Passwort für den eingeladenen Admin.</p>
        <input type="password" value={invitePassword} onChange={(e)=>setInvitePassword(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Neues Passwort"/>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button className="px-3 py-1.5 rounded bg-gray-200 text-gray-700" onClick={()=>{ setInviteToken(null); setInvitePassword(''); }}>Abbrechen</button>
          <button
            className="px-3 py-1.5 rounded bg-viridian text-white disabled:opacity-60"
            disabled={!invitePassword || inviteBusy}
            onClick={async()=>{
              if (!inviteToken) return;
              try {
                setInviteBusy(true);
                const res = await acceptInviteApi(inviteToken, invitePassword);
                // optional: gleich einloggen mit erhaltenem Token
                if (res?.access_token) {
                  localStorage.setItem('auth_token', res.access_token);
                  setAuthToken(res.access_token);
                }
                setInviteToken(null); setInvitePassword('');
                alert('Passwort gesetzt und Einladung aktiviert.');
              } catch (e: any) {
                alert(String(e?.response?.data?.message || 'Aktivierung fehlgeschlagen'));
              } finally { setInviteBusy(false); }
            }}
          >Speichern</button>
        </div>
      </Modal>
    </div>
  );
}
