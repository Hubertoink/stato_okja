import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { createOrgApi, inviteUserApi, listOrgs, acceptInviteApi, type OrgDto, listUsersByOrg, moveOrgApi } from '@/lib/orgs';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchUsers } from '@/lib/users';
// no auto-login on invite accept; keep superadmin session
import { Link as LinkIcon, Shield, User as UserIcon, Trash2 } from 'lucide-react';
import DeleteOrgModal from '@/components/DeleteOrgModal';

export default function AdminOrgSetup() {
  const { user } = useAuth();
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const { showToast } = useToast();
  const [orgName, setOrgName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [orgs, setOrgs] = useState<OrgDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [parentId, setParentId] = useState<string | 'root' | ''>('root');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Invite accept modal
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  async function reloadOrgs() {
    setLoading(true);
    try {
      if (user?.role === 'superadmin') {
        setOrgs(await listOrgs());
      } else if (user?.orgId) {
        const res = await api.get<OrgDto[]>('/orgs/subtree');
        setOrgs(res.data);
      } else {
        setOrgs([]);
      }
    } finally { setLoading(false); }
  }
  useEffect(() => { reloadOrgs(); }, [user?.id, user?.role, user?.orgId]);
  useEffect(() => {
    if (user?.role !== 'superadmin') {
      setParentId((user?.orgId as string | undefined) ?? 'root');
    }
  }, [user?.id, user?.role, user?.orgId]);

  // Build a simple org tree and helpers for indentation
  type OrgNode = { org: OrgDto; children: OrgNode[] };
  const tree = useMemo<OrgNode[]>(() => {
    const byId = new Map(orgs.map(o => [o.id, { org: o, children: [] as OrgNode[] }]));
    const roots: OrgNode[] = [];
    for (const n of byId.values()) {
      const p = n.org.parentId ? byId.get(n.org.parentId) : undefined;
      if (p) p.children.push(n); else roots.push(n);
    }
    // Sort children by name for consistent display
    const sortRec = (nodes: OrgNode[]) => { nodes.sort((a,b)=>a.org.name.localeCompare(b.org.name,'de')); nodes.forEach(n=>sortRec(n.children)); };
    sortRec(roots);
    return roots;
  }, [orgs]);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-2xl font-bold text-viridian">Organisationen</h2>
        <button
          className="bg-viridian text-white px-3 py-1.5 rounded text-sm"
          onClick={()=> { if (user?.role !== 'superadmin') setParentId((user?.orgId as string | undefined) ?? 'root'); setCreateModalOpen(true); }}
        >Organisation anlegen</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="block text-sm font-medium">Name der Organisation</label>
          <input ref={nameInputRef} value={orgName} onChange={(e)=>setOrgName(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="z. B. Jugendzentrum Nord"/>
          <label className="block text-sm font-medium">Übergeordnete Organisation</label>
          <select value={parentId} onChange={(e)=> setParentId((e.target.value || 'root') as 'root' | string)} className="border rounded px-3 py-2 w-full">
            <option value="root">(Keine, oberste Ebene)</option>
            {orgs.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
          </select>

          <label className="block text-sm font-medium">Admin Name</label>
          <input value={adminName} onChange={(e)=>setAdminName(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Max Mustermann"/>
          <label className="block text-sm font-medium">Admin E-Mail</label>
          <input value={adminEmail} onChange={(e)=>setAdminEmail(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="admin@org.de"/>
          <button
            className="bg-viridian text-white px-4 py-2 rounded"
            onClick={async () => {
              if (!orgName || !adminEmail) return;
              // 1) Org anlegen
              const org = await createOrgApi(orgName, parentId === 'root' ? null : parentId);
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
        <div className="min-w-0">
          <h3 className="font-semibold mb-1">Bestehende Organisationen</h3>
          <p className="text-xs text-gray-600 mb-2">Die Einrückung zeigt die Hierarchie. Mit „Verschieben unter…“ ordnest du eine Organisation als Unterorganisation neu ein.</p>
          {loading && <div className="text-gray-500">Lade Organisationen…</div>}
          <ul className="text-sm space-y-2">
            {tree.map((n) => (
              <OrgTree key={n.org.id} node={n} depth={0} allOrgs={orgs} onMoved={reloadOrgs} />
            ))}
            {!loading && orgs.length===0 && <li className="text-gray-500">Noch keine Organisationen</li>}
          </ul>
        </div>
      </div>

      {/* Einladung annehmen Modal */}
      <Modal open={!!inviteToken} onClose={()=>{ setInviteToken(null); setInvitePassword(''); }} title="Admin-Einladung aktivieren" maxWidth="sm">
        <p className="text-sm text-gray-700 mb-3">Setze ein Passwort für den eingeladenen Admin.</p>
        {inviteToken && (
          <div className="mb-3 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 flex items-center justify-between">
            <span className="truncate">{`${window.location.origin}/accept-invite?token=${inviteToken}`}</span>
            <button className="ml-2 px-2 py-0.5 rounded bg-gray-200" onClick={async()=>{ try { await navigator.clipboard.writeText(`${window.location.origin}/accept-invite?token=${inviteToken}`);} catch { /* ignore */ } }}>Kopieren</button>
          </div>
        )}
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
                await acceptInviteApi(inviteToken, invitePassword);
                // nicht automatisch einloggen – Superadmin bleibt eingeloggt
                setInviteToken(null); setInvitePassword('');
                showToast('Passwort gesetzt und Einladung aktiviert.', { type: 'success' });
              } catch (e: unknown) {
                const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Aktivierung fehlgeschlagen';
                showToast(String(msg), { type: 'error', durationMs: 3500 });
              } finally { setInviteBusy(false); }
            }}
          >Speichern</button>
        </div>
      </Modal>
      {/* Organisation anlegen Modal (ohne Admin anlegen) */}
      <Modal open={createModalOpen} onClose={()=> setCreateModalOpen(false)} title="Organisation anlegen" maxWidth="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name der Organisation</label>
            <input value={orgName} onChange={(e)=>setOrgName(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="z. B. Jugendzentrum Nord"/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Übergeordnete Organisation</label>
            <select value={parentId} onChange={(e)=> setParentId((e.target.value || 'root') as 'root' | string)} className="border rounded px-3 py-2 w-full">
              <option value="root">(Keine, oberste Ebene)</option>
              {orgs.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
            </select>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button className="px-3 py-1.5 rounded bg-gray-200 text-gray-700" onClick={()=> setCreateModalOpen(false)}>Abbrechen</button>
            <button
              className="px-3 py-1.5 rounded bg-viridian text-white disabled:opacity-60"
              disabled={!orgName.trim()}
              onClick={async () => {
                try {
                  await createOrgApi(orgName.trim(), parentId === 'root' ? null : parentId);
                  setOrgName('');
                  setCreateModalOpen(false);
                  await reloadOrgs();
                } catch {
                  // optional: toast error
                }
              }}
            >Organisation anlegen</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

type OrgTreeNode = { org: OrgDto; children: OrgTreeNode[] };
function OrgTree({ node, depth, allOrgs, onMoved }: { node: OrgTreeNode; depth: number; allOrgs: OrgDto[]; onMoved: () => void }) {
  return (
    <>
      <OrgRow org={node.org} depth={depth} allOrgs={allOrgs} onMoved={onMoved} />
      {node.children.map((c) => (
        <OrgTree key={c.org.id} node={c} depth={depth + 1} allOrgs={allOrgs} onMoved={onMoved} />
      ))}
    </>
  );
}

function OrgRow({ org, depth, allOrgs, onMoved }: { org: OrgDto; depth: number; allOrgs: OrgDto[]; onMoved: () => void }) {
  const { showToast } = useToast();
  const [counts, setCounts] = useState<{ admins: number; users: number } | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Array<{ id: string; email: string; name: string; role: string }> | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const byId = useMemo(() => Object.fromEntries(allOrgs.map(o => [o.id, o] as const)), [allOrgs]);

  // Compute valid parents (exclude self and descendants)
  const validParents = useMemo(() => {
    const currentPath = org.path || '';
    const isDescendant = (candidate: OrgDto) => {
      if (!currentPath || !candidate.path) return candidate.id !== org.id; // conservative when paths missing
      return candidate.id !== org.id && !candidate.path.startsWith(currentPath + '/');
    };
    const withDepth = allOrgs
      .filter(isDescendant)
      .map(o => ({ o, depth: o.path ? Math.max(0, o.path.split('/').length - 1) : getDepthByChain(o, byId) }));
    // Sort by name within same depth to keep consistent
    withDepth.sort((a,b)=> a.depth - b.depth || a.o.name.localeCompare(b.o.name,'de'));
    return withDepth;
  }, [allOrgs, byId, org.id, org.path]);

  function getDepthByChain(o: OrgDto, map: Record<string, OrgDto>): number {
    let d = 0; let cur: OrgDto | undefined = o;
    const safe = new Set<string>();
    while (cur?.parentId && !safe.has(cur.parentId)) { d++; safe.add(cur.parentId); cur = map[cur.parentId]; }
    return d;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchUsers();
        const admins = list.filter(u => u.orgId === org.id && u.role === 'org_admin').length;
        const users = list.filter(u => u.orgId === org.id && u.role === 'user').length;
        if (mounted) setCounts({ admins, users });
  } catch { /* ignore */ }
    })();
    return () => { mounted = false; };
  }, [org.id]);

  // Try to prefill invite email from clipboard when modal opens
  useEffect(() => {
    const isEmail = (t: string) => /[^\s@]+@[^\s@]+\.[^\s@]+/.test(t);
    if (!open) return;
    (async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && isEmail(text.trim()) && !inviteEmail) setInviteEmail(text.trim());
      } catch { /* ignore */ }
    })();
  }, [open, inviteEmail]);

  return (
    <li className="border rounded px-2 py-2 bg-white flex items-stretch sm:items-center justify-between gap-2 flex-col sm:flex-row w-full" style={{ marginLeft: depth * 16 }}>
      <button className="truncate text-left w-full sm:flex-1" onClick={async()=>{ setOpen(true); try { setMembers(await listUsersByOrg(org.id, true)); } catch { /* ignore */ } }} title="Anklicken, um Benutzer anzuzeigen">
        {org.name}
      </button>
      <div className="flex items-stretch sm:items-center gap-3 text-xs text-gray-600 w-full sm:w-auto">
        <span className="inline-flex items-center gap-1 bg-gray-100 rounded px-2 py-0.5"><Shield className="w-3.5 h-3.5" /> {counts?.admins ?? '–'}</span>
        <span className="inline-flex items-center gap-1 bg-gray-100 rounded px-2 py-0.5"><UserIcon className="w-3.5 h-3.5" /> {counts?.users ?? '–'}</span>
        {/* Move org under a different parent (superadmin route is available) */}
        <select
          className="border rounded px-1 py-1 w-full sm:w-auto"
          title="Verschieben unter … (wählt die neue übergeordnete Organisation)"
          onChange={async (e)=>{
            try {
              const newParent = e.target.value || 'root';
              await moveOrgApi(org.id, newParent === 'root' ? null : newParent);
              showToast('Organisation verschoben.', { type: 'success' });
              onMoved();
            } catch {
              showToast('Verschieben fehlgeschlagen.', { type: 'error' });
            }
          }}
        >
          <option value="">Verschieben unter…</option>
          <option value="root">(Obere Ebene)</option>
          {validParents.map(({ o, depth: d }) => (
            <option key={o.id} value={o.id}>{`${'  '.repeat(d)}${o.name}`}</option>
          ))}
        </select>
        {/* Delete button (superadmin only) */}
        <button
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
          title="Organisation löschen"
          onClick={()=> setDeleteModalOpen(true)}
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Löschen</span>
        </button>
        {/* Link icon moved into the modal header; keep row compact */}
      </div>

      <Modal open={open} onClose={()=>setOpen(false)} title={`Benutzer in „${org.name}“`} maxWidth="md">
        {!members && <div className="text-gray-500">Lade Benutzer…</div>}
        {members && members.length === 0 && <div className="text-gray-500">Keine Benutzer</div>}
        {members && members.length > 0 && (
          <ul className="divide-y">
            {members.map(m => (
              <li key={m.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium">{m.name} <span className="text-gray-500 font-normal">({m.email})</span></div>
                  <div className="text-xs text-gray-600">Rolle: {m.role === 'org_admin' ? 'Admin' : (m.role==='superadmin'?'Superadmin':'Benutzer')}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 pt-2 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1" htmlFor={`invite-${org.id}`}>Neue Benutzer per Einladungslink hinzufügen</label>
            <input
              id={`invite-${org.id}`}
              type="email"
              inputMode="email"
              placeholder="E-Mail der Einladung"
              className="border rounded px-2 py-1 text-sm"
              value={inviteEmail}
              onChange={(e)=> setInviteEmail(e.target.value)}
            />
          </div>
          <button
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-viridian text-white disabled:opacity-60 justify-center"
            title="Einladungslink (mit Token) kopieren"
            disabled={inviteBusy || !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(inviteEmail)}
            onClick={async()=>{
              try {
                setInviteBusy(true);
                const { token } = await inviteUserApi({ email: inviteEmail.trim(), role: 'user', orgId: org.id });
                const link = `${window.location.origin}/accept-invite?token=${token}`;
                await navigator.clipboard.writeText(link);
                setCopyMsg('Einladungslink kopiert');
                setTimeout(()=>setCopyMsg(null), 1500);
                showToast('Einladungslink (mit Token) kopiert.', { type: 'success' });
              } catch (e) {
                showToast('Einladung fehlgeschlagen.', { type: 'error' });
              } finally {
                setInviteBusy(false);
              }
            }}
          >
            <LinkIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Link kopieren</span>
          </button>
        </div>
        {copyMsg && <div className="text-[11px] text-viridian mt-1">{copyMsg}</div>}
      </Modal>
      <DeleteOrgModal
        orgId={org.id}
        orgName={org.name}
        open={deleteModalOpen}
        onClose={()=> setDeleteModalOpen(false)}
        onDeleted={()=> { setDeleteModalOpen(false); onMoved(); }}
      />
    </li>
  );
}
