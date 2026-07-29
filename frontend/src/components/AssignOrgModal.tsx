import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import { listOrgs, createOrgApi, type OrgDto } from '@/lib/orgs';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { autoT } from '@/i18n/auto';

export default function AssignOrgModal({
  open,
  onClose,
  userName,
  currentOrgId,
  onAssign,
}: {
  open: boolean;
  onClose: () => void;
  userName: string;
  currentOrgId?: string | null;
  onAssign: (orgId: string | null) => Promise<void> | void;
}) {
  const [orgs, setOrgs] = useState<OrgDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(currentOrgId ?? null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newParentId, setNewParentId] = useState<string | ''>('');
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('recent_org_ids') || '[]'); } catch { return []; }
  });

  const { user } = useAuth();
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        if (user?.role === 'superadmin') {
          const all = await listOrgs();
          setOrgs(all);
        } else if (user?.orgId) {
          const res = await api.get<OrgDto[]>('/orgs/subtree');
          setOrgs(res.data);
        } else {
          setOrgs([]);
        }
      } finally { setLoading(false); }
    })();
  }, [open, user?.id, user?.role, user?.orgId]);

  useEffect(() => { setSelected(currentOrgId ?? null); }, [currentOrgId, open]);

  const idToOrg = useMemo(() => new Map(orgs.map(o => [o.id, o] as const)), [orgs]);
  const breadcrumbFor = (o: OrgDto) => {
    if (o.path) {
      const parts = o.path.split('/').filter(Boolean);
      const labels = parts.map(id => idToOrg.get(id)?.name || id);
      return labels.join(' / ');
    }
    // fallback: build via parent links if available
    const labels: string[] = [];
    const seen = new Set<string>();
    let cur: OrgDto | undefined = o;
    while (cur && cur.parentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      const p = idToOrg.get(cur.parentId as string);
      if (!p) break;
      labels.unshift(p.name);
      cur = p;
    }
    labels.push(o.name);
    return labels.join(' / ');
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return orgs;
    return orgs.filter(o => {
      const breadcrumb = breadcrumbFor(o);
      return (
        (o.name || '').toLowerCase().includes(term) ||
        breadcrumb.toLowerCase().includes(term)
      );
    });
  }, [orgs, q, breadcrumbFor]);

  const recentOrgs = useMemo(() => recent.map(id => orgs.find(o => o.id === id)).filter(Boolean) as OrgDto[], [recent, orgs]);

  async function handleAssign() {
    await onAssign(selected ?? null);
    // persist recent
    if (selected) {
      const next = [selected, ...recent.filter(x => x !== selected)].slice(0, 5);
      setRecent(next);
  try { localStorage.setItem('recent_org_ids', JSON.stringify(next)); } catch (_e) { /* ignore */ }
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const parentId = (user?.role === 'superadmin')
      ? (newParentId || null)
      : ((newParentId as string) || (user?.orgId as string | undefined) || null);
    const org = await createOrgApi(newName.trim(), parentId);
    // refresh list based on role
    if (user?.role === 'superadmin') {
      const all = await listOrgs();
      setOrgs(all);
    } else if (user?.orgId) {
      const res = await api.get<OrgDto[]>('/orgs/subtree');
      setOrgs(res.data);
    }
    setSelected(org.id);
    setCreating(false);
    setNewName('');
    setNewParentId('');
  }

  return (
    <Modal open={open} onClose={onClose} title={autoT('ui_3c189622881d', { value0: userName })} maxWidth="md">
      <div className="space-y-3">
        <input
          value={q}
          onChange={(e)=> setQ(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder={autoT('ui_94116b877ab6')}
          autoFocus
        />
        {/* Quick create toggle */}
        <div>
          <button
            type="button"
            className="text-sm text-viridian underline"
            onClick={()=> setCreating(v=>!v)}
          >{creating ? autoT('ui_50a05604e20c') : autoT('ui_7080a85ff9d5')}</button>
        </div>
        {creating && (
          <div className="rounded border p-3 bg-white">
            <label className="block text-sm font-medium mb-1">{autoT('ui_709a23220f2c')}</label>
            <input
              value={newName}
              onChange={(e)=> setNewName(e.target.value)}
              onKeyDown={(e)=> { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
              className="w-full border rounded px-3 py-2 mb-2"
              placeholder={autoT('ui_62c2a0bd008d')}
            />
            <label className="block text-sm font-medium mb-1">{autoT('ui_734823106a0b')}</label>
            <select
              value={(user?.role !== 'superadmin' && !newParentId) ? ((user?.orgId as string | undefined) ?? '') : newParentId}
              onChange={(e)=> setNewParentId(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              {user?.role === 'superadmin' && <option value="">{autoT('ui_b2e9a7616515')}</option>}
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-3 py-1.5 rounded bg-viridian text-white disabled:opacity-60"
              >{autoT('ui_dbc9fb8c7424')}</button>
              <button
                type="button"
                onClick={()=> setCreating(false)}
                className="px-3 py-1.5 rounded bg-gray-200 text-gray-700"
              >{autoT('ui_07af7cb30fca')}</button>
            </div>
          </div>
        )}
        
        {/* Recently used */}
        {recentOrgs.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">{autoT('ui_72885290a91b')}</div>
            <div className="flex flex-wrap gap-2">
              {recentOrgs.map(o => (
                <button key={o.id} className={`px-2 py-1 rounded-full text-xs border ${selected===o.id?"bg-cambridge-blue text-white":"bg-white text-gray-700"}`} onClick={()=> setSelected(o.id)}>{o.name}</button>
              ))}
            </div>
          </div>
        )}

        {/* List */}
        <div className="max-h-[40vh] overflow-y-auto scrollbar-hide rounded border divide-y">
          {loading && <div className="p-3 text-gray-500">{autoT('ui_240c23fcdd31')}</div>}
          {!loading && filtered.length === 0 && <div className="p-3 text-gray-500">{autoT('ui_921d42241b62')}</div>}
          {!loading && filtered.map(o => (
            <label key={o.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer active:bg-azure-web">
              <input type="radio" className="accent-viridian" checked={selected===o.id} onChange={()=> setSelected(o.id)} />
              <div className="truncate">
                <div className="font-medium text-sm">{o.name}</div>
                <div className="text-xs text-gray-500 truncate">{breadcrumbFor(o)}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-3 sticky bottom-0 bg-gray-50 py-2 pb-safe -mx-4 md:-mx-6 px-4 md:px-6 flex items-center justify-end gap-2 border-t">
          <button className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors" onClick={onClose}>{autoT('ui_07af7cb30fca')}</button>
          <button className="px-3 py-1.5 rounded-lg bg-viridian text-white hover:bg-cambridge-blue disabled:opacity-60 transition-colors" disabled={selected === (currentOrgId ?? null)} onClick={handleAssign}>{autoT('ui_a4ed9add9edd')}</button>
        </div>
      </div>
    </Modal>
  );
}
