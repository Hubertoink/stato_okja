import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import {
  createOrgApi,
  inviteUserApi,
  listOrgs,
  acceptInviteApi,
  type OrgDto,
  type OrgMoveImpactItem,
  type OrgMovePreview,
  type OrgTaxonomySettingsSnapshot,
  listUsersByOrg,
  previewMoveOrgApi,
  moveOrgWithConfirmationApi,
  getOrgTaxonomySettings,
  updateOrgTaxonomySettings,
} from '@/lib/orgs';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccessOrgMove } from '@/lib/orgMoveConfig';
import { Link as LinkIcon, Shield, User as UserIcon, Trash2, Plus, Building2, ChevronDown, ChevronRight, Users, Settings2, ArrowRightLeft } from 'lucide-react';
import DeleteOrgModal from '@/components/DeleteOrgModal';
import PasswordRequirementsHint from '@/components/PasswordRequirementsHint';
import { getPasswordValidationMessage } from '@/lib/passwordPolicy';

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

function OrgTaxonomySettingsModal({ org, open, onClose, onSaved }: { org: OrgDto | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState<OrgTaxonomySettingsSnapshot | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<OrgTaxonomySettingsSnapshot['settings'] | null>(null);
  const [childDefaultsDraft, setChildDefaultsDraft] = useState<OrgTaxonomySettingsSnapshot['childDefaults'] | null>(null);
  const [activePanel, setActivePanel] = useState<'self' | 'children'>('self');
  const [clearOwnSettings, setClearOwnSettings] = useState(false);
  const [clearChildDefaults, setClearChildDefaults] = useState(false);

  useEffect(() => {
    if (!open || !org) return;
    let mounted = true;
    setLoading(true);
    void getOrgTaxonomySettings(org.id)
      .then((data) => {
        if (!mounted) return;
        setSnapshot(data);
        setSettingsDraft(data.settings);
        setChildDefaultsDraft(data.childDefaults);
        setActivePanel(data.parentId ? 'self' : 'children');
        setClearOwnSettings(false);
        setClearChildDefaults(false);
      })
      .catch((error: unknown) => {
        const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Vererbungsregeln konnten nicht geladen werden.';
        showToast(String(message), { type: 'error' });
        if (mounted) onClose();
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open, org, onClose, showToast]);

  const updateInherited = (
    target: 'self' | 'children',
    key: keyof OrgTaxonomySettingsSnapshot['settings'],
    id: string,
  ) => {
    const setDraft = target === 'self' ? setSettingsDraft : setChildDefaultsDraft;
    if (target === 'self') setClearOwnSettings(false);
    else setClearChildDefaults(false);
    setDraft((current) => {
      if (!current) return current;
      const nextIds = new Set(current[key].inheritedIds || []);
      if (nextIds.has(id)) nextIds.delete(id);
      else nextIds.add(id);
      return {
        ...current,
        [key]: { ...current[key], inheritedIds: Array.from(nextIds) },
      };
    });
  };

  const updateAllowOwn = (
    target: 'self' | 'children',
    key: keyof OrgTaxonomySettingsSnapshot['settings'],
    allowOwn: boolean,
  ) => {
    const setDraft = target === 'self' ? setSettingsDraft : setChildDefaultsDraft;
    if (target === 'self') setClearOwnSettings(false);
    else setClearChildDefaults(false);
    setDraft((current) => current ? { ...current, [key]: { ...current[key], allowOwn } } : current);
  };

  const updateInheritAll = (
    target: 'self' | 'children',
    key: keyof OrgTaxonomySettingsSnapshot['settings'],
    inheritAll: boolean,
  ) => {
    const setDraft = target === 'self' ? setSettingsDraft : setChildDefaultsDraft;
    if (target === 'self') setClearOwnSettings(false);
    else setClearChildDefaults(false);
    setDraft((current) => current ? { ...current, [key]: { ...current[key], inheritAll } } : current);
  };

  const sections = [
    {
      key: 'categories' as const,
      title: 'Kategorien',
      inheritAllLabel: 'Alle aktuellen und zukünftigen Kategorien vererben',
      allowLabel: 'Eigene Kategorien erlauben',
      renderItem: (item: OrgTaxonomySettingsSnapshot['parentOptions']['categories'][number]) => item.name,
    },
    {
      key: 'tags' as const,
      title: 'Tags',
      inheritAllLabel: 'Alle aktuellen und zukünftigen Tags vererben',
      allowLabel: 'Eigene Tags erlauben',
      renderItem: (item: OrgTaxonomySettingsSnapshot['parentOptions']['tags'][number]) => item.name,
    },
    {
      key: 'cohorts' as const,
      title: 'Kohorten',
      inheritAllLabel: 'Alle aktuellen und zukünftigen Kohorten vererben',
      allowLabel: 'Eigene Kohorten erlauben',
      renderItem: (item: OrgTaxonomySettingsSnapshot['parentOptions']['cohorts'][number]) => `${item.name}${typeof item.minAge === 'number' && typeof item.maxAge === 'number' ? ` (${item.minAge}–${item.maxAge})` : ''}`,
    },
  ];

  const settingsEqual = (
    left: OrgTaxonomySettingsSnapshot['settings'],
    right: OrgTaxonomySettingsSnapshot['settings'],
  ) => sections.every((section) => {
    const leftEntry = left[section.key];
    const rightEntry = right[section.key];
    if (leftEntry.allowOwn !== rightEntry.allowOwn || leftEntry.inheritAll !== rightEntry.inheritAll) return false;
    if (leftEntry.inheritedIds.length !== rightEntry.inheritedIds.length) return false;
    return leftEntry.inheritedIds.every((id, index) => id === rightEntry.inheritedIds[index]);
  });

  const isSectionItemSelected = (
    settings: OrgTaxonomySettingsSnapshot['settings'],
    key: keyof OrgTaxonomySettingsSnapshot['settings'],
    id: string,
  ) => settings[key].inheritAll || settings[key].inheritedIds.includes(id);

  const renderSettingsEditor = ({
    draft,
    target,
    options,
    baseline,
    intro,
    reset,
  }: {
    draft: OrgTaxonomySettingsSnapshot['settings'];
    target: 'self' | 'children';
    options: OrgTaxonomySettingsSnapshot['parentOptions'] | OrgTaxonomySettingsSnapshot['childDefaultOptions'];
    baseline?: OrgTaxonomySettingsSnapshot['settings'];
    intro: React.ReactNode;
    reset?: React.ReactNode;
  }) => (
    <div className="space-y-5">
      {intro}
      {reset}
      {target === 'self' && baseline ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Gelb markierte Felder weichen von der aktuell geerbten Standardregel der übergeordneten Organisation ab.
        </div>
      ) : null}
      {sections.map((section) => {
        const sectionOptions = options[section.key];
        const source = target === 'self' ? snapshot?.settingsSource[section.key] : null;
        const baselineEntry = baseline?.[section.key];
        const hasAllowOwnDiff = !!baselineEntry && draft[section.key].allowOwn !== baselineEntry.allowOwn;
        const hasInheritAllDiff = !!baselineEntry && draft[section.key].inheritAll !== baselineEntry.inheritAll;
        const changedItemCount = baselineEntry
          ? sectionOptions.filter((item) => isSectionItemSelected(draft, section.key, item.id) !== isSectionItemSelected(baseline, section.key, item.id)).length
          : 0;
        const hasSectionDiff = hasAllowOwnDiff || hasInheritAllDiff || changedItemCount > 0;
        return (
          <div key={`${target}-${section.key}`} className={`rounded-xl border p-4 space-y-3 ${hasSectionDiff ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'}`}>
            <div>
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold text-gray-900">{section.title}</h4>
                {hasSectionDiff ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">Override aktiv</span> : null}
              </div>
              <p className="text-xs text-gray-500">
                {target === 'self'
                  ? 'Wähle, welche Einträge aus der Parent-Organisation in dieser Unterorganisation sichtbar sind.'
                  : 'Lege fest, welche Einträge Unterorganisationen standardmäßig von dieser Organisation sehen.'}
              </p>
            </div>
            {target === 'self' && source && source.mode !== 'explicit' ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                Derzeit greift {source.mode === 'default' ? `der Standard von ${source.sourceOrgName || 'einer übergeordneten Organisation'}` : 'das bisherige Standardsystem ohne expliziten Override'}.
              </div>
            ) : null}
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
              <label className={`flex items-start gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 ${hasInheritAllDiff ? 'border border-amber-300 bg-amber-50' : 'bg-white'}`}>
                <input
                  type="checkbox"
                  checked={draft[section.key].inheritAll}
                  onChange={(event) => updateInheritAll(target, section.key, event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-viridian focus:ring-viridian"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-gray-800">{section.inheritAllLabel}</span>
                  <span className="block text-xs text-gray-500">
                    {target === 'self'
                      ? 'Bestehende und künftig sichtbare Parent-Einträge werden automatisch übernommen.'
                      : 'Direkte und weitere Unterorganisationen übernehmen bestehende und künftig sichtbare Einträge automatisch, solange dort kein eigener Override gesetzt ist.'}
                  </span>
                </span>
              </label>
              <label className={`flex items-start gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 ${hasAllowOwnDiff ? 'border border-amber-300 bg-amber-50' : 'bg-white'}`}>
                <input
                  type="checkbox"
                  checked={draft[section.key].allowOwn}
                  onChange={(event) => updateAllowOwn(target, section.key, event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-viridian focus:ring-viridian"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-gray-800">{section.allowLabel}</span>
                  <span className="block text-xs text-gray-500">
                    {target === 'self'
                      ? 'Lokale Einträge können zusätzlich in dieser Organisation angelegt werden.'
                      : 'Unterorganisationen dürfen zusätzlich eigene lokale Einträge anlegen, sofern sie keinen eigenen Override setzen.'}
                  </span>
                </span>
              </label>
            </div>
            {sectionOptions.length > 0 ? (
              <>
                {draft[section.key].inheritAll && (
                  <div className="rounded-lg border border-viridian/20 bg-viridian/5 px-3 py-2 text-xs text-viridian">
                    {target === 'self'
                      ? 'Alle aktuell sichtbaren Parent-Einträge sind aktiv und neue Einträge werden künftig automatisch mit vererbt.'
                      : 'Unterorganisationen erhalten alle aktuell sichtbaren Einträge dieser Organisation und künftig sichtbare Einträge automatisch.'}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {sectionOptions.map((item) => {
                    const selected = draft[section.key].inheritAll || draft[section.key].inheritedIds.includes(item.id);
                    const differsFromBaseline = baselineEntry
                      ? isSectionItemSelected(draft, section.key, item.id) !== isSectionItemSelected(baseline, section.key, item.id)
                      : false;
                    return (
                      <label key={`${target}-${section.key}-${item.id}`} className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${draft[section.key].inheritAll ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${differsFromBaseline ? 'border-amber-300 bg-amber-50' : selected ? 'border-viridian bg-viridian/5' : 'border-gray-200 bg-white'}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => updateInherited(target, section.key, item.id)}
                          disabled={draft[section.key].inheritAll}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-viridian focus:ring-viridian"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-800">{section.renderItem(item as never)}</span>
                          {item.sourceOrgName && target === 'self' && item.sourceOrgName !== snapshot?.parentName && (
                            <span className="block text-xs text-gray-500">Im Parent-Kontext geerbt aus {item.sourceOrgName}</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">
                {draft[section.key].inheritAll
                  ? 'Derzeit sind noch keine passenden Einträge sichtbar. Neue Einträge werden nach dem Anlegen automatisch berücksichtigt.'
                  : target === 'self'
                    ? 'In der Parent-Organisation sind derzeit keine passenden Einträge sichtbar.'
                    : 'In dieser Organisation sind derzeit keine passenden Einträge sichtbar.'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={org ? `Vererbung für „${org.name}“` : 'Vererbung'} maxWidth="5xl">
      {loading && <div className="py-8 text-center text-gray-500">Lade Vererbungsregeln…</div>}
      {!loading && snapshot && settingsDraft && childDefaultsDraft && (
        <div className="space-y-5">
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
            {snapshot.parentName ? (
              <>
                Quelle der geerbten Einträge: <strong>{snapshot.parentName}</strong>
              </>
            ) : (
              <>
                Oberste Organisation: Hier kannst du Standardregeln für Unterorganisationen definieren.
              </>
            )}
          </div>
          <div className="inline-flex items-center rounded-xl border border-gray-300 bg-white p-1 shadow-sm">
            {snapshot.parentId ? (
              <button
                type="button"
                onClick={() => setActivePanel('self')}
                aria-pressed={activePanel === 'self'}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activePanel === 'self' ? 'bg-viridian text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Diese Organisation
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setActivePanel('children')}
              aria-pressed={activePanel === 'children'}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activePanel === 'children' ? 'bg-viridian text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              Unterorganisationen
            </button>
          </div>
          {activePanel === 'self' && snapshot.parentId ? renderSettingsEditor({
            draft: settingsDraft,
            target: 'self',
            options: snapshot.parentOptions,
            baseline: snapshot.fallbackSettings,
            intro: (
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
                Diese Regeln gelten nur für <strong>{snapshot.orgName}</strong>. Wenn kein eigener Override gesetzt ist, werden Standards aus der Hierarchie verwendet.
                {snapshot.hasExplicitSettings ? (
                  <div className="mt-1 text-xs text-gray-500">
                    Vergleichsbasis: {snapshot.fallbackSource.categories.sourceOrgName || snapshot.fallbackSource.tags.sourceOrgName || snapshot.fallbackSource.cohorts.sourceOrgName || 'übergeordnete Standardvererbung'}
                  </div>
                ) : null}
              </div>
            ),
            reset: snapshot.hasExplicitSettings || clearOwnSettings ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    if (clearOwnSettings) {
                      setClearOwnSettings(false);
                      setSettingsDraft(snapshot.settings);
                      return;
                    }
                    setClearOwnSettings(true);
                    setSettingsDraft(snapshot.fallbackSettings);
                  }}
                >
                  {clearOwnSettings ? 'Override wiederherstellen' : 'Eigenen Override entfernen'}
                </button>
              </div>
            ) : clearOwnSettings ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Beim Speichern wird der eigene Override entfernt. Danach gelten wieder die Standards der übergeordneten Organisation.
              </div>
            ) : null,
          }) : renderSettingsEditor({
            draft: childDefaultsDraft,
            target: 'children',
            options: snapshot.childDefaultOptions,
            intro: (
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
                Diese Standardregeln gelten für direkte und weitere Unterorganisationen von <strong>{snapshot.orgName}</strong>, solange dort kein eigener Override gesetzt ist.
                <div className="mt-1 text-xs text-gray-500">Direkte Unterorganisationen aktuell: {snapshot.childCount}</div>
              </div>
            ),
            reset: snapshot.hasChildDefaults ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setClearChildDefaults(true);
                    setChildDefaultsDraft(snapshot.childDefaults);
                  }}
                >
                  Standardregeln entfernen
                </button>
              </div>
            ) : clearChildDefaults ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Beim Speichern werden keine Standardregeln mehr vorgegeben. Unterorganisationen verwenden dann den nächsthöheren Standard oder ihre eigenen Overrides.
              </div>
            ) : null,
          })}
          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <button className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={onClose}>Abbrechen</button>
            <button
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={saving}
              onClick={async () => {
                if (!org || !settingsDraft || !childDefaultsDraft) return;
                try {
                  setSaving(true);
                  const payload = {
                    settings: snapshot.parentId
                      ? clearOwnSettings
                        ? null
                        : settingsEqual(settingsDraft, snapshot.settings)
                          ? undefined
                          : settingsDraft
                      : undefined,
                    childDefaults: clearChildDefaults
                      ? null
                      : settingsEqual(childDefaultsDraft, snapshot.childDefaults)
                        ? undefined
                        : childDefaultsDraft,
                  };
                  const saved = await updateOrgTaxonomySettings(org.id, {
                    settings: payload.settings,
                    childDefaults: payload.childDefaults,
                  });
                  setSnapshot(saved);
                  setSettingsDraft(saved.settings);
                  setChildDefaultsDraft(saved.childDefaults);
                  setClearOwnSettings(false);
                  setClearChildDefaults(false);
                  showToast('Vererbungsregeln gespeichert.', { type: 'success' });
                  onSaved();
                  onClose();
                } catch (error: unknown) {
                  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Speichern fehlgeschlagen.';
                  showToast(String(message), { type: 'error' });
                } finally {
                  setSaving(false);
                }
              }}
            >
              Speichern
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function MoveImpactList({ title, items }: { title: string; items: OrgMoveImpactItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h5 className="text-sm font-medium text-gray-800 mb-1">{title}</h5>
      <ul className="space-y-1 text-sm text-gray-700">
        {items.slice(0, 6).map((item) => (
          <li key={item.id}>
            {item.name}{item.sourceOrgName ? ` (${item.sourceOrgName})` : ''}
          </li>
        ))}
        {items.length > 6 && <li className="text-gray-500">… und {items.length - 6} weitere</li>}
      </ul>
    </div>
  );
}

export default function AdminOrgSetup() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [orgs, setOrgs] = useState<OrgDto[]>([]);
  const [loading, setLoading] = useState(true);
  const isSuperadmin = user?.role === 'superadmin';
  const [settingsOrg, setSettingsOrg] = useState<OrgDto | null>(null);
  
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

  async function invalidateTaxonomyQueriesForOrgTree(rootOrgId: string) {
    const rootOrg = orgs.find((candidate) => candidate.id === rootOrgId);
    const affectedScopeKeys = new Set<string>([rootOrgId]);

    if (rootOrg?.path) {
      for (const candidate of orgs) {
        if (candidate.id === rootOrgId) continue;
        if ((candidate.path || '').startsWith(`${rootOrg.path}/`)) {
          affectedScopeKeys.add(candidate.id);
        }
      }
    } else {
      const childrenByParent = new Map<string, string[]>();
      for (const candidate of orgs) {
        if (!candidate.parentId) continue;
        const siblings = childrenByParent.get(candidate.parentId) || [];
        siblings.push(candidate.id);
        childrenByParent.set(candidate.parentId, siblings);
      }
      const queue = [rootOrgId];
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;
        for (const childId of childrenByParent.get(current) || []) {
          if (affectedScopeKeys.has(childId)) continue;
          affectedScopeKeys.add(childId);
          queue.push(childId);
        }
      }
    }

    await Promise.all(
      Array.from(affectedScopeKeys).flatMap((scopeKey) => [
        qc.invalidateQueries({ queryKey: ['categories', scopeKey] }),
        qc.invalidateQueries({ queryKey: ['tags', scopeKey] }),
        qc.invalidateQueries({ queryKey: ['cohorts', scopeKey] }),
        qc.invalidateQueries({ queryKey: ['taxonomy-access', scopeKey] }),
      ]),
    );
  }

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
  const fixedParentName = useMemo(() => {
    if (!user?.orgId) return user?.orgName || 'Eigene Organisation';
    return orgs.find((o) => o.id === user.orgId)?.name || user.orgName || 'Eigene Organisation';
  }, [orgs, user?.orgId, user?.orgName]);

  const resetCreateForm = () => {
    setOrgName('');
    setParentId(isSuperadmin ? 'root' : (user?.orgId ?? 'root'));
    setWithAdmin(false);
    setAdminEmail('');
    setAdminName('');
  };

  const handleCreate = async () => {
    if (!orgName.trim()) return;
    if (withAdmin && !adminEmail.trim()) return;
    
    setCreating(true);
    try {
      const effectiveParentId = isSuperadmin ? (parentId === 'root' ? null : parentId || null) : (user?.orgId ?? null);
      const org = await createOrgApi(orgName.trim(), effectiveParentId);
      
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
                <OrgTree key={n.org.id} node={n} depth={0} allOrgs={orgs} onMoved={reloadOrgs} onOpenSettings={setSettingsOrg} />
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
            {isSuperadmin ? (
              <>
                <select 
                  value={parentId} 
                  onChange={(e)=> setParentId((e.target.value || 'root') as 'root' | string)} 
                  className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-viridian focus:border-viridian"
                >
                  <option value="root">(Keine – oberste Ebene)</option>
                  {orgs.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Leer lassen, um eine eigenständige Organisation zu erstellen</p>
              </>
            ) : (
              <>
                <input
                  value={fixedParentName}
                  disabled
                  className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Org-Admins können neue Organisationen nur direkt unter ihrer eigenen Organisation anlegen.</p>
              </>
            )}
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
              disabled={!orgName.trim() || (withAdmin && !adminEmail.trim()) || creating || (!isSuperadmin && !user?.orgId)}
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
          <PasswordRequirementsHint password={invitePassword} className="mt-2" />
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
            disabled={!invitePassword || inviteBusy || Boolean(getPasswordValidationMessage(invitePassword))}
            onClick={async()=>{
              if (!inviteToken) return;
              const validationMessage = getPasswordValidationMessage(invitePassword);
              if (validationMessage) {
                showToast(validationMessage, { type: 'error', durationMs: 3500 });
                return;
              }
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

      <OrgTaxonomySettingsModal
        org={settingsOrg}
        open={!!settingsOrg}
        onClose={() => setSettingsOrg(null)}
        onSaved={() => {
          if (!settingsOrg) return;
          void Promise.all([
            reloadOrgs(),
            invalidateTaxonomyQueriesForOrgTree(settingsOrg.id),
          ]);
        }}
      />
    </div>
  );
}

type OrgTreeNode = { org: OrgDto; children: OrgTreeNode[] };
function OrgTree({ node, depth, allOrgs, onMoved, onOpenSettings }: { node: OrgTreeNode; depth: number; allOrgs: OrgDto[]; onMoved: () => void; onOpenSettings: (org: OrgDto) => void }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  
  return (
    <>
      <OrgRow 
        org={node.org} 
        depth={depth} 
        allOrgs={allOrgs} 
        onMoved={onMoved} 
        onOpenSettings={onOpenSettings}
        hasChildren={hasChildren}
        expanded={expanded}
        onToggleExpand={() => setExpanded(!expanded)}
      />
      {expanded && node.children.map((c) => (
        <OrgTree key={c.org.id} node={c} depth={depth + 1} allOrgs={allOrgs} onMoved={onMoved} onOpenSettings={onOpenSettings} />
      ))}
    </>
  );
}

function OrgRow({ org, depth, allOrgs, onMoved, onOpenSettings, hasChildren, expanded, onToggleExpand }: { 
  org: OrgDto; 
  depth: number; 
  allOrgs: OrgDto[]; 
  onMoved: () => void;
  onOpenSettings: (org: OrgDto) => void;
  hasChildren: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canConfigureTaxonomy = !!user && (user.role === 'superadmin' || (user.role === 'org_admin' && (org.id === user.orgId || org.parentId === user.orgId)));
  const [orgUsers, setOrgUsers] = useState<{ admins: { name: string }[]; users: { name: string }[] } | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Array<{ id: string; email: string; name: string; role: string }> | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [movePicker, setMovePicker] = useState<{ open: boolean; targetParentId: string | null }>({
    open: false,
    targetParentId: org.parentId ?? null,
  });
  const [moveDialog, setMoveDialog] = useState<{ open: boolean; loading: boolean; preview: OrgMovePreview | null; targetParentId: string | null }>({
    open: false,
    loading: false,
    preview: null,
    targetParentId: null,
  });
  const byId = useMemo(() => Object.fromEntries(allOrgs.map(o => [o.id, o] as const)), [allOrgs]);

  // Compute valid parents (exclude self and descendants)
  const validParents = useMemo(() => {
    const currentPath = org.path || '';
    const isDescendant = (candidate: OrgDto) => {
      if (!currentPath || !candidate.path) return candidate.id !== org.id;
      return candidate.id !== org.id && !candidate.path.startsWith(currentPath + '/');
    };
    const withDepth = allOrgs
      .filter((candidate) => candidate.id !== (org.parentId ?? ''))
      .filter(isDescendant)
      .map(o => ({ o, depth: o.path ? Math.max(0, o.path.split('/').length - 1) : getDepthByChain(o, byId) }));
    withDepth.sort((a,b)=> a.depth - b.depth || a.o.name.localeCompare(b.o.name,'de'));
    return withDepth;
  }, [allOrgs, byId, org.id, org.path]);

  const canMoveOrg = canAccessOrgMove(user?.role) && validParents.length > 0;
  const defaultMoveTargetId = validParents[0]?.o.id ?? null;

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
        // Use listUsersByOrg to fetch users for this specific org, ignoring scope
        const list = await listUsersByOrg(org.id, false);
        const admins = list.filter((u: { role: string; name?: string; email?: string }) => u.role === 'org_admin').map((u: { name?: string; email?: string }) => ({ name: u.name || u.email || '' }));
        const users = list.filter((u: { role: string; name?: string; email?: string }) => u.role === 'user').map((u: { name?: string; email?: string }) => ({ name: u.name || u.email || '' }));
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

  const targetParentName = moveDialog.targetParentId
    ? allOrgs.find((candidate) => candidate.id === moveDialog.targetParentId)?.name || 'Zielorganisation'
    : 'Obere Ebene';

  const selectedMoveParentName = movePicker.targetParentId
    ? allOrgs.find((candidate) => candidate.id === movePicker.targetParentId)?.name || 'Zielorganisation'
    : 'Obere Ebene';

  const openMovePicker = () => {
    if (!canMoveOrg) return;
    setMovePicker({ open: true, targetParentId: defaultMoveTargetId });
  };

  const openMovePreview = async (parentId: string | null) => {
    try {
      setMoveDialog({ open: true, loading: true, preview: null, targetParentId: parentId });
      const preview = await previewMoveOrgApi(org.id, parentId);
      setMoveDialog({ open: true, loading: false, preview, targetParentId: parentId });
    } catch (error: unknown) {
      setMoveDialog({ open: false, loading: false, preview: null, targetParentId: null });
      const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Verschiebe-Vorschau konnte nicht geladen werden.';
      showToast(String(message), { type: 'error' });
    }
  };

  return (
    <li 
      className="border rounded-lg bg-white hover:bg-gray-50 transition-colors" 
      style={{ marginLeft: depth * 12 }}
    >
      {/* Mobile: Stacked layout */}
      <div className="flex flex-col gap-1.5 px-3 py-2 sm:hidden">
        {/* Row 1: Toggle + Org Name (full width) */}
        <div className="flex items-center gap-2">
          <button 
            className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded hover:bg-gray-200 transition-colors ${!hasChildren ? 'invisible' : ''}`}
            onClick={onToggleExpand}
          >
            {hasChildren && (expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />)}
          </button>
          <button 
            className="flex-1 text-left font-medium text-gray-800 hover:text-viridian transition-colors"
            onClick={async()=>{ setOpen(true); try { setMembers(await listUsersByOrg(org.id, true)); } catch { /* ignore */ } }}
            title="Benutzer anzeigen"
          >
            {org.name}
          </button>
        </div>
        {/* Row 2: Counts + Actions */}
        <div className="flex items-center gap-2 pl-7">
          <Tooltip label="Administratoren" names={orgUsers?.admins.map(a => a.name)}>
            <span className="inline-flex items-center gap-1 bg-gray-100 rounded px-2 py-1 text-xs text-gray-600 cursor-default">
              <Shield className="w-3.5 h-3.5" /> {orgUsers?.admins.length ?? '–'}
            </span>
          </Tooltip>
          <Tooltip label="Benutzer" names={orgUsers?.users.map(u => u.name)}>
            <span className="inline-flex items-center gap-1 bg-gray-100 rounded px-2 py-1 text-xs text-gray-600 cursor-default">
              <UserIcon className="w-3.5 h-3.5" /> {orgUsers?.users.length ?? '–'}
            </span>
          </Tooltip>
          {canConfigureTaxonomy && (
            <button
              className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-200 bg-white text-gray-600 hover:text-viridian hover:border-viridian"
              title="Vererbungsregeln"
              onClick={() => onOpenSettings(org)}
            >
              <Settings2 className="w-4 h-4" />
            </button>
          )}
          {canMoveOrg && (
            <button
              className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-200 bg-white text-gray-600 hover:text-viridian hover:border-viridian"
              title="Organisation verschieben"
              onClick={openMovePicker}
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          )}
          {user?.role === 'superadmin' && (
            <button
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-xs flex-shrink-0"
              title="Organisation löschen"
              onClick={()=> setDeleteModalOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop: Single row layout */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-2">
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

        {canConfigureTaxonomy && (
          <button
            className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-200 bg-white text-gray-600 hover:text-viridian hover:border-viridian"
            title="Vererbungsregeln"
            onClick={() => onOpenSettings(org)}
          >
            <Settings2 className="w-4 h-4" />
          </button>
        )}
        
        {/* Move Dropdown */}
        {canMoveOrg && (
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:text-viridian hover:border-viridian text-xs"
            title="Organisation verschieben"
            onClick={openMovePicker}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Verschieben</span>
          </button>
        )}
        
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

      <Modal
        open={movePicker.open}
        onClose={() => setMovePicker({ open: false, targetParentId: defaultMoveTargetId })}
        title={`Organisation verschieben: „${org.name}“`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Wähle bewusst das neue übergeordnete Ziel. Die Auswirkungen werden im nächsten Schritt geprüft, bevor etwas gespeichert wird.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Neue übergeordnete Organisation</label>
            <select
              className="w-full border rounded-lg px-3 py-2 bg-white"
              value={movePicker.targetParentId ?? ''}
              onChange={(event) => {
                const nextValue = event.target.value;
                setMovePicker({ open: true, targetParentId: nextValue || null });
              }}
            >
              {validParents.map(({ o, depth: d }) => (
                <option key={o.id} value={o.id}>{`${'  '.repeat(d)}${o.name}`}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Aktuell: <strong>{org.parentId ? allOrgs.find((candidate) => candidate.id === org.parentId)?.name || 'Unbekannt' : 'Obere Ebene'}</strong>
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Neues Ziel: <strong>{selectedMoveParentName}</strong>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <button
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              onClick={() => setMovePicker({ open: false, targetParentId: defaultMoveTargetId })}
            >
              Abbrechen
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue"
              disabled={!movePicker.targetParentId}
              onClick={async () => {
                if (!movePicker.targetParentId) return;
                setMovePicker({ open: false, targetParentId: movePicker.targetParentId });
                await openMovePreview(movePicker.targetParentId);
              }}
            >
              Auswirkungen prüfen
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={moveDialog.open} onClose={() => setMoveDialog({ open: false, loading: false, preview: null, targetParentId: null })} title={`Organisation verschieben: „${org.name}“`} maxWidth="lg">
        {moveDialog.loading && <div className="py-8 text-center text-gray-500">Analysiere Auswirkungen des Verschiebens…</div>}
        {!moveDialog.loading && moveDialog.preview && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Ziel: <strong>{targetParentName}</strong>
              <div className="mt-1 text-xs text-gray-500">Betroffene Organisationen im verschobenen Teilbaum: {moveDialog.preview.affectedOrgs}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MoveImpactList title="Wegfallende Kategorien" items={moveDialog.preview.lost.categories} />
              <MoveImpactList title="Neu hinzukommende Kategorien" items={moveDialog.preview.gained.categories} />
              <MoveImpactList title="Wegfallende Tags" items={moveDialog.preview.lost.tags} />
              <MoveImpactList title="Neu hinzukommende Tags" items={moveDialog.preview.gained.tags} />
              <MoveImpactList title="Wegfallende Kohorten" items={moveDialog.preview.lost.cohorts} />
              <MoveImpactList title="Neu hinzukommende Kohorten" items={moveDialog.preview.gained.cohorts} />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {moveDialog.preview.resetNotice}
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              <div>Aktivitäten mit ungültigen Kategorien nach dem Move: <strong>{moveDialog.preview.activityConflicts.categories.activities}</strong></div>
              <div>Aktivitäten mit ungültigen Tags nach dem Move: <strong>{moveDialog.preview.activityConflicts.tags.activities}</strong></div>
              <div>Aktivitäten mit ungültigen Kohorten nach dem Move: <strong>{moveDialog.preview.activityConflicts.cohorts.activities}</strong></div>
              <div>Projekte mit ungültigen Kategorien nach dem Move: <strong>{moveDialog.preview.projectConflicts.categories.projects}</strong></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MoveImpactList title="Konflikt-Kategorien in Aktivitäten" items={moveDialog.preview.activityConflicts.categories.items} />
              <MoveImpactList title="Konflikt-Tags in Aktivitäten" items={moveDialog.preview.activityConflicts.tags.items} />
              <MoveImpactList title="Konflikt-Kohorten in Aktivitäten" items={moveDialog.preview.activityConflicts.cohorts.items} />
              <MoveImpactList title="Konflikt-Kategorien in Projekten" items={moveDialog.preview.projectConflicts.categories.items} />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                onClick={() => setMoveDialog({ open: false, loading: false, preview: null, targetParentId: null })}
              >
                Abbrechen
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue"
                onClick={async () => {
                  try {
                    await moveOrgWithConfirmationApi(org.id, moveDialog.targetParentId, true);
                    showToast('Organisation verschoben.', { type: 'success' });
                    setMoveDialog({ open: false, loading: false, preview: null, targetParentId: null });
                    onMoved();
                  } catch (error: unknown) {
                    const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Verschieben fehlgeschlagen.';
                    showToast(String(message), { type: 'error' });
                  }
                }}
              >
                Trotzdem verschieben
              </button>
            </div>
          </div>
        )}
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
