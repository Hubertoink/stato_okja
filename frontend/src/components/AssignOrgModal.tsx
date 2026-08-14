import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import { listOrgs, createOrgApi, type OrgDto } from '@/lib/orgs';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { autoT } from '@/i18n/auto';
import { Button } from '@/components/ui/Button';
import { FieldLabel, Input, Select } from '@/components/ui/Field';

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
    try {
      return JSON.parse(localStorage.getItem('recent_org_ids') || '[]');
    } catch {
      return [];
    }
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
      } finally {
        setLoading(false);
      }
    })();
  }, [open, user?.id, user?.role, user?.orgId]);

  useEffect(() => {
    setSelected(currentOrgId ?? null);
  }, [currentOrgId, open]);

  const idToOrg = useMemo(() => new Map(orgs.map((o) => [o.id, o] as const)), [orgs]);
  const breadcrumbFor = (o: OrgDto) => {
    if (o.path) {
      const parts = o.path.split('/').filter(Boolean);
      const labels = parts.map((id) => idToOrg.get(id)?.name || id);
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
    return orgs.filter((o) => {
      const breadcrumb = breadcrumbFor(o);
      return (o.name || '').toLowerCase().includes(term) || breadcrumb.toLowerCase().includes(term);
    });
  }, [orgs, q, breadcrumbFor]);

  const recentOrgs = useMemo(
    () => recent.map((id) => orgs.find((o) => o.id === id)).filter(Boolean) as OrgDto[],
    [recent, orgs],
  );

  async function handleAssign() {
    await onAssign(selected ?? null);
    // persist recent
    if (selected) {
      const next = [selected, ...recent.filter((x) => x !== selected)].slice(0, 5);
      setRecent(next);
      try {
        localStorage.setItem('recent_org_ids', JSON.stringify(next));
      } catch (_e) {
        /* ignore */
      }
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const parentId =
      user?.role === 'superadmin'
        ? newParentId || null
        : (newParentId as string) || (user?.orgId as string | undefined) || null;
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
    <Modal
      open={open}
      onClose={onClose}
      title={autoT('ui_3c189622881d', { value0: userName })}
      maxWidth="md"
    >
      <div className="space-y-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={autoT('ui_94116b877ab6')}
          autoFocus
        />
        {/* Quick create toggle */}
        <div>
          <button
            type="button"
            className="text-sm text-viridian underline"
            onClick={() => setCreating((v) => !v)}
          >
            {creating ? autoT('ui_50a05604e20c') : autoT('ui_7080a85ff9d5')}
          </button>
        </div>
        {creating && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
            <FieldLabel className="mb-1">{autoT('ui_709a23220f2c')}</FieldLabel>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              className="mb-2"
              placeholder={autoT('ui_62c2a0bd008d')}
            />
            <FieldLabel className="mb-1">{autoT('ui_734823106a0b')}</FieldLabel>
            <Select
              value={
                user?.role !== 'superadmin' && !newParentId
                  ? ((user?.orgId as string | undefined) ?? '')
                  : newParentId
              }
              onChange={(e) => setNewParentId(e.target.value)}
            >
              {user?.role === 'superadmin' && <option value="">{autoT('ui_b2e9a7616515')}</option>}
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
            <div className="mt-3 flex items-center gap-2">
              <Button onClick={handleCreate} disabled={!newName.trim()} size="sm">
                {autoT('ui_dbc9fb8c7424')}
              </Button>
              <Button onClick={() => setCreating(false)} size="sm" variant="secondary">
                {autoT('ui_07af7cb30fca')}
              </Button>
            </div>
          </div>
        )}

        {/* Recently used */}
        {recentOrgs.length > 0 && (
          <div>
            <div className="mb-1 text-xs text-[var(--text-muted)]">{autoT('ui_72885290a91b')}</div>
            <div className="flex flex-wrap gap-2">
              {recentOrgs.map((o) => (
                <button
                  key={o.id}
                  className={`rounded-full border px-2 py-1 text-xs transition-colors ${selected === o.id ? 'border-viridian bg-viridian text-white' : 'border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:bg-[var(--interactive-soft)]'}`}
                  onClick={() => setSelected(o.id)}
                >
                  {o.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* List */}
        <div className="max-h-[40vh] divide-y divide-[var(--border-subtle)] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] scrollbar-hide">
          {loading && (
            <div className="p-3 text-[var(--text-muted)]">{autoT('ui_240c23fcdd31')}</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="p-3 text-[var(--text-muted)]">{autoT('ui_921d42241b62')}</div>
          )}
          {!loading &&
            filtered.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-[var(--interactive-soft)] active:bg-[var(--interactive-soft-strong)]"
              >
                <input
                  type="radio"
                  className="accent-viridian"
                  checked={selected === o.id}
                  onChange={() => setSelected(o.id)}
                />
                <div className="truncate">
                  <div className="text-sm font-medium text-[var(--text-primary)]">{o.name}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">
                    {breadcrumbFor(o)}
                  </div>
                </div>
              </label>
            ))}
        </div>

        <div className="-mx-4 mt-3 sticky bottom-0 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-2 pb-safe md:-mx-6 md:px-6">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {autoT('ui_07af7cb30fca')}
          </Button>
          <Button size="sm" disabled={selected === (currentOrgId ?? null)} onClick={handleAssign}>
            {autoT('ui_a4ed9add9edd')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
