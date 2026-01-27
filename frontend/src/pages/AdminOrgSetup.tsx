import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { createOrgApi, inviteUserApi, listOrgs, acceptInviteApi, type OrgDto, listUsersByOrg, moveOrgApi } from '@/lib/orgs';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchUsers } from '@/lib/users';
import { Link as LinkIcon, Shield, User as UserIcon, Trash2, Plus, Building2, ChevronDown, ChevronRight, Users } from 'lucide-react';
import DeleteOrgModal from '@/components/DeleteOrgModal';

/** Instant hover tooltip with optional user list */
function Tooltip({ label, names, children }: { label: string; names?: string[]; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1.5 rounded bg-gray-800 text-white text-xs shadow-lg z-50 pointer-events-none min-w-max">
          <div className="font-medium mb-0.5">{label}</div>
          {names && names.length > 0 ? (
            <ul className="text-gray-300 text-[11px] space-y-0.5">
              {names.slice(0, 5).map((n, i) => <li key={i}>• {n}</li>)}
              {names.length > 5 && <li className="text-gray-400">… +{names.length - 5} weitere</li>}
            </ul>
          ) : (
            <div className="text-gray-400 text-[11px]">Keine</div>
          )}
        </span>
      )}
    </span>
  );
}

export default function AdminOrgSetup() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<OrgDto[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create org modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [parentId, setParentId] = useState<string | 'root' | ''>('root');
  const [withAdmin, setWithAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [creating, setCreating] = useState(false);

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

  const resetCreateForm = () => {
    setOrgName('');
    setParentId(user?.role !== 'superadmin' ? (user?.orgId ?? 'root') : 'root');
    setWithAdmin(false);
    setAdminEmail('');
    setAdminName('');
  };

  const handleCreate = async () => {
    if (!orgName.trim()) return;
    if (withAdmin && !adminEmail.trim()) return;
    
    setCreating(true);
    try {
      const org = await createOrgApi(orgName.trim(), parentId === 'root' ? null : parentId);
      
      if (withAdmin && adminEmail.trim()) {
        const { token } = await inviteUserApi({ 
          email: adminEmail.trim(), 
          name: adminName.trim() || adminEmail.split('@')[0], 
          role: 'org_admin', 
          orgId: org.id 
        });
        setInviteToken(token);
      }
      
      resetCreateForm();
      setCreateModalOpen(false);
      await reloadOrgs();
      showToast(`Organisation „${org.name}" erfolgreich angelegt.`, { type: 'success' });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Fehler beim Anlegen';
      showToast(String(msg), { type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-viridian flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Organisationen
          </h2>
          <p className="text-sm text-gray-600 mt-1">Verwalte Organisationen und ihre Hierarchie</p>
        </div>
        <button
          className="inline-flex items-center gap-2 bg-viridian text-white px-4 py-2 rounded-lg shadow hover:bg-cambridge-blue transition-colors"
          onClick={()=> { 
            resetCreateForm(); 
            setCreateModalOpen(true); 
          }}
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Neue Organisation</span>
        </button>
      </div>

      {/* Organisations-Liste */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Bestehende Organisationen</h3>
            <span className="text-xs text-gray-500">{orgs.length} Organisation{orgs.length !== 1 ? 'en' : ''}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Klicke auf eine Organisation, um Benutzer zu sehen</p>
        </div>
        
        <div className="p-2">
          {loading && (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-viridian mr-2"></div>
              Lade Organisationen…
            </div>
          )}
          
          {!loading && orgs.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">Noch keine Organisationen vorhanden</p>
              <button
                className="inline-flex items-center gap-2 bg-viridian text-white px-4 py-2 rounded-lg"
                onClick={()=> { resetCreateForm(); setCreateModalOpen(true); }}
              >
                <Plus className="w-4 h-4" />
                Erste Organisation anlegen
              </button>
            </div>
          )}
          
          {!loading && orgs.length > 0 && (
            <ul className="space-y-1">
              {tree.map((n) => (
                <OrgTree key={n.org.id} node={n} depth={0} allOrgs={orgs} onMoved={reloadOrgs} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Neues einheitliches Create Modal */}
      <Modal open={createModalOpen} onClose={()=> setCreateModalOpen(false)} title="Neue Organisation anlegen" maxWidth="md">
        <div className="space-y-4">
          {/* Organisation Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name der Organisation *</label>
            <input 
              value={orgName} 
              onChange={(e)=>setOrgName(e.target.value)} 
              className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian" 
              placeholder="z. B. Jugendzentrum Nord"
              autoFocus
            />
          </div>
          
          {/* Übergeordnete Organisation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Übergeordnete Organisation</label>
            <select 
              value={parentId} 
              onChange={(e)=> setParentId((e.target.value || 'root') as 'root' | string)} 
              className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
            >
              <option value="root">(Keine – oberste Ebene)</option>
              {orgs.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Leer lassen, um eine eigenständige Organisation zu erstellen</p>
          </div>

          {/* Admin gleich mit anlegen? */}
          <div className="border-t pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={withAdmin} 
                onChange={(e) => setWithAdmin(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-viridian focus:ring-viridian"
              />
              <div>
                <span className="font-medium text-gray-700">Administrator einladen</span>
                <p className="text-xs text-gray-500">Erstellt einen Einladungslink für den Organisations-Admin</p>
              </div>
            </label>
          </div>

          {/* Admin-Felder (nur wenn Checkbox aktiv) */}
          {withAdmin && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin E-Mail *</label>
                <input 
                  type="email"
                  value={adminEmail} 
                  onChange={(e)=>setAdminEmail(e.target.value)} 
                  className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian" 
                  placeholder="admin@organisation.de"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name</label>
                <input 
                  value={adminName} 
                  onChange={(e)=>setAdminName(e.target.value)} 
                  className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian" 
                  placeholder="Max Mustermann"
                />
                <p className="text-xs text-gray-500 mt-1">Optional – wird sonst aus der E-Mail abgeleitet</p>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <button 
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors" 
              onClick={()=> setCreateModalOpen(false)}
            >
              Abbrechen
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              disabled={!orgName.trim() || (withAdmin && !adminEmail.trim()) || creating}
              onClick={handleCreate}
            >
              {creating && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
              {withAdmin ? 'Organisation + Admin anlegen' : 'Organisation anlegen'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Einladung annehmen Modal */}
      <Modal open={!!inviteToken} onClose={()=>{ setInviteToken(null); setInvitePassword(''); }} title="Admin-Passwort setzen" maxWidth="sm">
        <p className="text-sm text-gray-700 mb-3">Setze ein Passwort für den eingeladenen Admin oder teile den Einladungslink.</p>
        {inviteToken && (
          <div className="mb-3 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <span className="truncate flex-1 font-mono">{`${window.location.origin}/accept-invite?token=${inviteToken.substring(0, 20)}...`}</span>
            <button 
              className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 transition-colors text-xs whitespace-nowrap" 
              onClick={async()=>{ 
                try { 
                  await navigator.clipboard.writeText(`${window.location.origin}/accept-invite?token=${inviteToken}`);
                  showToast('Link kopiert!', { type: 'success' });
                } catch { /* ignore */ } 
              }}
            >
              Link kopieren
            </button>
          </div>
        )}
        <div className="border-t pt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Oder Passwort jetzt setzen:</label>
          <input 
            type="password" 
            value={invitePassword} 
            onChange={(e)=>setInvitePassword(e.target.value)} 
            className="border rounded-lg px-3 py-2 w-full" 
            placeholder="Neues Passwort"
          />
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button 
            className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300" 
            onClick={()=>{ setInviteToken(null); setInvitePassword(''); }}
          >
            Später
          </button>
          <button
            className="px-3 py-1.5 rounded-lg bg-viridian text-white disabled:opacity-60"
            disabled={!invitePassword || inviteBusy}
            onClick={async()=>{
              if (!inviteToken) return;
              try {
                setInviteBusy(true);
                await acceptInviteApi(inviteToken, invitePassword);
                setInviteToken(null); setInvitePassword('');
                showToast('Passwort gesetzt – Admin kann sich jetzt einloggen.', { type: 'success' });
              } catch (e: unknown) {
                const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Aktivierung fehlgeschlagen';
                showToast(String(msg), { type: 'error', durationMs: 3500 });
              } finally { setInviteBusy(false); }
            }}
          >Passwort speichern</button>
        </div>
      </Modal>
    </div>
  );
}

type OrgTreeNode = { org: OrgDto; children: OrgTreeNode[] };
function OrgTree({ node, depth, allOrgs, onMoved }: { node: OrgTreeNode; depth: number; allOrgs: OrgDto[]; onMoved: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  
  return (
    <>
      <OrgRow 
        org={node.org} 
        depth={depth} 
        allOrgs={allOrgs} 
        onMoved={onMoved} 
        hasChildren={hasChildren}
        expanded={expanded}
        onToggleExpand={() => setExpanded(!expanded)}
      />
      {expanded && node.children.map((c) => (
        <OrgTree key={c.org.id} node={c} depth={depth + 1} allOrgs={allOrgs} onMoved={onMoved} />
      ))}
    </>
  );
}

function OrgRow({ org, depth, allOrgs, onMoved, hasChildren, expanded, onToggleExpand }: { 
  org: OrgDto; 
  depth: number; 
  allOrgs: OrgDto[]; 
  onMoved: () => void;
  hasChildren: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [orgUsers, setOrgUsers] = useState<{ admins: { name: string }[]; users: { name: string }[] } | null>(null);
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
      if (!currentPath || !candidate.path) return candidate.id !== org.id;
      return candidate.id !== org.id && !candidate.path.startsWith(currentPath + '/');
    };
    const withDepth = allOrgs
      .filter(isDescendant)
      .map(o => ({ o, depth: o.path ? Math.max(0, o.path.split('/').length - 1) : getDepthByChain(o, byId) }));
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
        const admins = list.filter(u => u.orgId === org.id && u.role === 'org_admin').map(u => ({ name: u.name || u.email }));
        const users = list.filter(u => u.orgId === org.id && u.role === 'user').map(u => ({ name: u.name || u.email }));
        if (mounted) setOrgUsers({ admins, users });
      } catch { /* ignore */ }
    })();
    return () => { mounted = false; };
  }, [org.id]);

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
    <li 
      className="border rounded-lg bg-white hover:bg-gray-50 transition-colors" 
      style={{ marginLeft: depth * 20 }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Expand/Collapse Toggle */}
        <button 
          className={`w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 transition-colors ${!hasChildren ? 'invisible' : ''}`}
          onClick={onToggleExpand}
        >
          {hasChildren && (expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />)}
        </button>
        
        {/* Org Name */}
        <button 
          className="flex-1 text-left font-medium text-gray-800 hover:text-viridian transition-colors truncate"
          onClick={async()=>{ setOpen(true); try { setMembers(await listUsersByOrg(org.id, true)); } catch { /* ignore */ } }}
          title="Benutzer anzeigen"
        >
          {org.name}
        </button>
        
        {/* User Counts */}
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Tooltip label="Administratoren" names={orgUsers?.admins.map(a => a.name)}>
            <span className="inline-flex items-center gap-1 bg-gray-100 rounded px-2 py-1 cursor-default">
              <Shield className="w-3.5 h-3.5" /> {orgUsers?.admins.length ?? '–'}
            </span>
          </Tooltip>
          <Tooltip label="Benutzer" names={orgUsers?.users.map(u => u.name)}>
            <span className="inline-flex items-center gap-1 bg-gray-100 rounded px-2 py-1 cursor-default">
              <UserIcon className="w-3.5 h-3.5" /> {orgUsers?.users.length ?? '–'}
            </span>
          </Tooltip>
        </div>
        
        {/* Move Dropdown */}
        <select
          className="border rounded px-2 py-1 text-xs bg-white hover:bg-gray-50 cursor-pointer"
          title="Verschieben unter…"
          value=""
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
          <option value="">Verschieben…</option>
          <option value="root">(Obere Ebene)</option>
          {validParents.map(({ o, depth: d }) => (
            <option key={o.id} value={o.id}>{`${'  '.repeat(d)}${o.name}`}</option>
          ))}
        </select>
        
        {/* Delete Button (nur für Superadmin) */}
        {user?.role === 'superadmin' && (
          <button
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-xs"
            title="Organisation löschen"
            onClick={()=> setDeleteModalOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Benutzer Modal */}
      <Modal open={open} onClose={()=>setOpen(false)} title={`Benutzer in „${org.name}"`} maxWidth="md">
        {!members && <div className="text-gray-500">Lade Benutzer…</div>}
        {members && members.length === 0 && (
          <div className="text-center py-6">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">Noch keine Benutzer in dieser Organisation</p>
          </div>
        )}
        {members && members.length > 0 && (
          <ul className="divide-y">
            {members.map(m => (
              <li key={m.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{m.name} <span className="text-gray-500 font-normal">({m.email})</span></div>
                  <div className="text-xs text-gray-600">
                    {m.role === 'org_admin' ? (
                      <span className="inline-flex items-center gap-1"><Shield className="w-3 h-3" /> Admin</span>
                    ) : m.role === 'superadmin' ? (
                      <span className="text-viridian font-medium">Superadmin</span>
                    ) : (
                      <span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3" /> Benutzer</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Neuen Benutzer einladen</label>
          <div className="flex gap-2">
            <input
              type="email"
              inputMode="email"
              placeholder="E-Mail-Adresse"
              className="border rounded-lg px-3 py-2 text-sm flex-1"
              value={inviteEmail}
              onChange={(e)=> setInviteEmail(e.target.value)}
            />
            <button
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-viridian text-white disabled:opacity-60 text-sm"
              title="Einladungslink kopieren"
              disabled={inviteBusy || !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(inviteEmail)}
              onClick={async()=>{
                try {
                  setInviteBusy(true);
                  const { token } = await inviteUserApi({ email: inviteEmail.trim(), role: 'user', orgId: org.id });
                  const link = `${window.location.origin}/accept-invite?token=${token}`;
                  await navigator.clipboard.writeText(link);
                  setCopyMsg('Einladungslink kopiert');
                  setTimeout(()=>setCopyMsg(null), 1500);
                  showToast('Einladungslink kopiert.', { type: 'success' });
                } catch {
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
          {copyMsg && <div className="text-xs text-viridian mt-1">{copyMsg}</div>}
        </div>
      </Modal>
      
      {user?.role === 'superadmin' && (
        <DeleteOrgModal
          orgId={org.id}
          orgName={org.name}
          open={deleteModalOpen}
          onClose={()=> setDeleteModalOpen(false)}
          onDeleted={()=> { setDeleteModalOpen(false); onMoved(); }}
        />
      )}
    </li>
  );
}
