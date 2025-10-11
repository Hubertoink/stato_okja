import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Project, useCreateProject, useProjects, useUpdateProject, useDeleteProject, useRemoveProject } from '@/lib/projects';
import { Layers, Pencil, Save as SaveIcon, X as XIcon, Archive as ArchiveIcon, ArchiveRestore as ArchiveRestoreIcon, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useCategories, useTags } from '@/lib/taxonomy';
import { useStaff } from '@/lib/staff';
import { useToast } from '@/components/Toast';

function ArchiveRestoreControls({
  id,
  archived,
  archiving,
  deleting,
  onArchivingChange,
  onDeletingChange,
}: {
  id: string;
  archived: boolean;
  archiving: boolean;
  deleting: boolean;
  onArchivingChange: (v: boolean) => void;
  onDeletingChange: (v: boolean) => void;
}) {
  const archive = useDeleteProject();
  const remove = useRemoveProject();
  return (
    <div className="flex gap-2 items-center">
      <span className="tooltip-wrapper">
      <button
        type="button"
        className="inline-flex items-center justify-center p-2 rounded-full border border-gray-300 text-gray-700 disabled:opacity-50 bg-white/80"
        title={archived ? 'Wiederherstellen' : 'Archivieren'}
        aria-label={archived ? 'Wiederherstellen' : 'Archivieren'}
        disabled={archiving || archive.isPending}
        onClick={() => {
          onArchivingChange(true);
          archive.mutate(
            { id, archived: !archived },
            { onSettled: () => onArchivingChange(false) },
          );
        }}
      >
        {archived ? <ArchiveRestoreIcon className="w-5 h-5" /> : <ArchiveIcon className="w-5 h-5" />}
      </button>
      <span className="tooltip-bubble">{archived ? 'Wiederherstellen' : 'Archivieren'}</span>
      </span>
      {archived && (
        <span className="tooltip-wrapper">
        <button
          type="button"
          className="inline-flex items-center justify-center p-2 rounded-full border border-red-300 text-red-700 disabled:opacity-50 bg-white/80"
          title="Löschen"
          aria-label="Löschen"
          disabled={deleting || remove.isPending}
          onClick={() => {
            if (!confirm('Dieses Projekt dauerhaft löschen?')) return;
            onDeletingChange(true);
            remove.mutate(id, { onSettled: () => onDeletingChange(false) });
          }}
        >
          <Trash2 className="w-5 h-5" />
        </button>
        <span className="tooltip-bubble">Löschen</span>
        </span>
      )}
    </div>
  );
}

function ProjectForm({ initial, onSubmit, onCancel }: { initial?: Partial<Project>; onSubmit: (data: Partial<Project>) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Partial<Project> & { categoryIds?: string[] }>({
    title: '',
    // Default to a valid enum value in backend (lowercase)
    type: 'project_open',
    ...initial,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data: categories } = useCategories({ active: true });
  const { data: tags } = useTags({ active: true });
  const { data: staff } = useStaff({ active: true });

  const uploadImage = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post('/uploads/images', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const url = res.data?.url as string;
    if (url) setForm((f) => ({ ...f, imageUrl: url }));
  }, []);

  // Global paste handler to support Ctrl+V for screenshots anywhere while the modal is open
  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      // Prefer items API
      if (items && items.length > 0) {
        for (const item of items) {
          if (item.type && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              await uploadImage(file);
              return;
            }
          }
        }
      }
      // Fallback to files API
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file && file.type.startsWith('image/')) {
          e.preventDefault();
          await uploadImage(file);
          return;
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [uploadImage]);

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await uploadImage(file);
    }
  }, [uploadImage]);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadImage(file);
  }, [uploadImage]);

  const update = <K extends keyof Project>(k: K, v: Project[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
  <div className="fixed inset-0 bg-black/30 z-[60] flex items-end md:items-center justify-center p-0 md:p-6">
  <div className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[85vh] overflow-y-auto bottom-sheet-animate" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <h3 className="text-xl font-semibold text-viridian mb-4">{initial?.id ? 'Projekt bearbeiten' : 'Neues Projekt'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Titel *</label>
            <input value={form.title || ''} onChange={(e) => update('title', e.target.value)} required className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Typ *</label>
            <select value={form.type || 'project_open'} onChange={(e) => update('type', e.target.value)} required className="w-full border rounded px-3 py-2">
              <option value="open_door">Offene Tür</option>
              <option value="project_open">Projekt (offen)</option>
              <option value="project_closed">Projekt (geschlossen)</option>
              <option value="event">Veranstaltung</option>
              <option value="outreach">Aufsuchend</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Zielgruppe</label>
            <input value={form.targetGroup || ''} onChange={(e) => update('targetGroup', e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Bild</label>
            {form.imageUrl ? (
              <div className="space-y-2">
                <img src={form.imageUrl} alt="Projektbild" className="w-full h-40 object-cover rounded border" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => update('imageUrl', '')} className="px-3 py-1 rounded bg-gray-200 text-gray-700">Entfernen</button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1 rounded bg-viridian text-white">Ersetzen…</button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded p-3 text-sm text-gray-600 bg-azure-web/30">
                <div className="mb-2">Bild hierher ziehen, klicken zum Auswählen oder per Strg+V einfügen</div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1 rounded bg-white border">Datei wählen…</button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                </div>
                <div className="text-xs text-gray-500 mt-2">Unterstützt JPG, PNG, GIF. Max ~10MB (Browser-abhängig).</div>
              </div>
            )}
            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">Farbe</label>
              <input type="color" value={(form.color as string) || '#7aa39a'} onChange={(e) => update('color', e.target.value)} className="w-20 h-10 p-1 border rounded bg-white" />
            </div>
          </div>
          {/* Zeitraum von/bis wird in Projekten nicht mehr angezeigt (wird erst bei Aktivitäten wichtig) */}
          <div>
            <label className="block text-sm font-medium mb-1">Standard Startzeit</label>
            <input type="time" value={form.defaultStartTime || ''} onChange={(e) => update('defaultStartTime', e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Standard Endzeit</label>
            <input type="time" value={form.defaultEndTime || ''} onChange={(e) => update('defaultEndTime', e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          {/* Removed upper free-text staff inputs per spec */}
          <div>
            <label className="block text-sm font-medium mb-1">Tags (mehrfach)</label>
            <div className="flex flex-wrap gap-2">
              {(tags || []).map((t) => {
                const set = new Set((form.tag || '').split(',').map(s=>s.trim()).filter(Boolean));
                const active = set.has(t.name);
                return (
                  <button key={t.id} type="button" onClick={() => {
                    if (active) set.delete(t.name); else set.add(t.name);
                    update('tag', Array.from(set).join(', '));
                  }} className={`px-2 py-1 rounded-full text-xs border`} style={active?{ backgroundColor: t.color || '#7aa39a', color: '#fff', borderColor: t.color || '#7aa39a' }:{ backgroundColor: '#fff', color: '#374151', borderColor: t.color || '#7aa39a' }}>
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kategorien (mehrfach)</label>
            <div className="flex flex-wrap gap-2">
              {(categories || []).map((c) => {
                const set = new Set(((form.categoryIds as string[] | undefined) || (form.categoryId ? [String(form.categoryId)] : [])).map(String));
                const active = set.has(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => {
                    if (active) set.delete(c.id); else set.add(c.id);
                    // store an array on the form for UI; backend will get the first as categoryId for now
                    setForm((f)=> ({ ...f, categoryId: (Array.from(set)[0] as string) || '', categoryIds: Array.from(set) }));
                  }} className={`px-2 py-1 rounded-full text-xs border ${active?'bg-cambridge-blue text-white':'bg-white text-gray-700'}`}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Mitarbeitende (mehrfach, Standard)</label>
            <div className="flex flex-wrap gap-2">
              {(staff || []).filter(s=> (Array.isArray(s.roles)? s.roles.includes('lead') || s.roles.includes('employee') : (s.role==='lead' || s.role==='employee'))).map((s) => {
                const set = new Set((form.defaultStaff || '').split(',').map(v=>v.trim()).filter(Boolean));
                const active = set.has(s.name);
                return (
                  <button key={s.id} type="button" onClick={() => {
                    if (active) set.delete(s.name); else set.add(s.name);
                    update('defaultStaff', Array.from(set).join(', '));
                  }} className={`px-2 py-1 rounded-full text-xs border ${active?'bg-cambridge-blue text-white':'bg-white text-gray-700'}`}>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Ehrenamtliche (mehrfach, aktiv)</label>
            <div className="flex flex-wrap gap-2">
              {(staff || []).filter(s=> (Array.isArray(s.roles)? s.roles.includes('volunteer') || s.roles.includes('helper') : (s.role==='volunteer' || s.role==='helper'))).map((s) => {
                const set = new Set((form.defaultVolunteers || '').split(',').map(v=>v.trim()).filter(Boolean));
                const active = set.has(s.name);
                return (
                  <button key={s.id} type="button" onClick={() => {
                    if (active) set.delete(s.name); else set.add(s.name);
                    update('defaultVolunteers', Array.from(set).join(', '));
                  }} className={`px-2 py-1 rounded-full text-xs border ${active?'bg-cambridge-blue text-white':'bg-white text-gray-700'}`}>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Beschreibung</label>
            <textarea value={form.description || ''} onChange={(e) => update('description', e.target.value)} rows={4} className="w-full border rounded px-3 py-2" />
          </div>
        </div>
  <div className="mt-6 sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 px-4 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <span className="tooltip-wrapper">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
              title="Abbrechen"
              aria-label="Abbrechen"
            >
              <XIcon className="w-5 h-5" />
            </button>
            <span className="tooltip-bubble">Abbrechen</span>
            </span>
            <span className="tooltip-wrapper">
            <button
              type="button"
              onClick={() => {
                // Only send DTO-allowed keys. For clearable fields, map empty string to null so backend clears the value.
                const allowed: (keyof Project | 'categoryIds')[] = [
                  'title',
                  'type',
                  'categoryId',
                  'categoryIds',
                  'targetGroup',
                  'imageUrl',
                  'color',
                  'dateFrom',
                  'dateTo',
                  'defaultStartTime',
                  'defaultEndTime',
                  'defaultStaff',
                  'defaultVolunteers',
                  'tag',
                  'activityField',
                  'description',
                  'archived',
                ];
                const clearable = new Set<keyof Project>([ 
                  'categoryId',
                  'targetGroup',
                  'imageUrl',
                  'color',
                  'dateFrom',
                  'dateTo',
                  'defaultStartTime',
                  'defaultEndTime',
                  'defaultStaff',
                  'defaultVolunteers',
                  'tag',
                  'activityField',
                  'description',
                ]);
                const cleaned = allowed.reduce((acc, k) => {
                  const v = form[k as keyof Project] as unknown;
                  if (v === '') {
                    if (clearable.has(k)) (acc as Record<string, unknown>)[k as string] = null;
                  } else if (v !== undefined) {
                    (acc as Record<string, unknown>)[k as string] = v as unknown;
                  }
                  return acc;
                }, {} as Partial<Project> & { categoryIds?: string[] });
                onSubmit(cleaned);
              }}
              className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
              title="Speichern"
              aria-label="Speichern"
            >
              <SaveIcon className="w-5 h-5" />
            </button>
            <span className="tooltip-bubble">Speichern</span>
            </span>
            {initial?.id && (
              <ArchiveRestoreControls
                id={initial.id as string}
                archived={Boolean(initial.archived)}
                archiving={archiving}
                deleting={deleting}
                onArchivingChange={setArchiving}
                onDeletingChange={setDeleting}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Projects() {
  const [search, setSearch] = useState('');
  // Debounce the search to prevent firing a request for every keystroke on first usage
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; project?: Project } | null>(null);
  const { showToast } = useToast();
  // Archivierte Projekte nur anzeigen, wenn Checkbox aktiv ist.
  // Wenn nicht aktiv, filtern wir auf archived=false. Wenn aktiv, keinen Filter (zeigt alle an).
  const { data, isLoading } = useProjects({ search: debounced, archived: showArchived ? undefined : false });
  const create = useCreateProject();
  const update = useUpdateProject();

  const projects = data || [];
  const { data: categoriesList } = useCategories({ active: true });
  const { data: tagsList } = useTags({ active: true });
  const categoryMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color?: string | null }>();
    (categoriesList || []).forEach((c) => m.set(c.id, { id: c.id, name: c.name, color: c.color }));
    return m;
  }, [categoriesList]);
  const tagMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color?: string | null }>();
    (tagsList || []).forEach((t) => m.set(t.name, { id: t.id, name: t.name, color: t.color }));
    return m;
  }, [tagsList]);
  // Fallback Farbpalette wenn kein Bild vorhanden ist (deterministisch aus Titel)
  // 12-farbiges Spektrum (blau, rot, gelb, lila, orange, teal, grün, pink, etc.)
  const palette = [
    '#2563eb', // blue-600
    '#ef4444', // red-500
    '#f59e0b', // amber-500
    '#10b981', // emerald-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#f97316', // orange-500
    '#14b8a6', // teal-500
    '#22c55e', // green-500
    '#eab308', // yellow-500
    '#0ea5e9', // sky-500
    '#a855f7', // purple-500
  ];
  const pickBg = (title?: string) => {
    if (!title) return palette[0];
    let h = 0;
    for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  };

  const truncateWords = (text?: string | null, words = 20) => {
    if (!text) return '';
    const parts = text.trim().split(/\s+/);
    if (parts.length <= words) return text;
    return parts.slice(0, words).join(' ') + '…';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-viridian">Angebote & Projekte</h2>
        <button onClick={() => setModal({ mode: 'create' })} className="bg-viridian text-white px-4 py-2 rounded hover:bg-cambridge-blue">Neues Projekt</button>
      </div>

      <div className="mb-4 flex gap-3 flex-col sm:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suchen…"
          className="w-full md:w-80 border border-gray-300 rounded px-3 py-2"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Archivierte anzeigen
        </label>
      </div>

      {isLoading && !data ? (
        <div className="text-gray-500">Lade…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const typeLabel: Record<string, string> = {
              open_door: 'Offene Tür',
              project_open: 'Projekt (offen)',
              project_closed: 'Projekt (geschlossen)',
              event: 'Veranstaltung',
              outreach: 'Aufsuchend',
            };
            const prettyType = typeLabel[p.type] || p.type;
            const cat = p.categoryId ? categoryMap.get(p.categoryId) : undefined;
            const extraCats = p.categories as Array<{ id: string; name: string; color?: string | null }> | undefined;
            const extraCount = Math.max(0, (extraCats?.length || 0) - (cat ? 1 : 0));
            const tag = p.tag ? tagMap.get(p.tag) : undefined;
            return (
              <div
                key={p.id}
                className="relative rounded-2xl overflow-hidden shadow group min-h-[160px]"
                style={{ backgroundColor: p.imageUrl ? undefined : (p.color || pickBg(p.title)) }}
              >
                {p.imageUrl ? (
                  <>
                    <img src={p.imageUrl} alt={p.title} className="absolute inset-0 w-full h-full object-cover transform scale-105 blur-[2px]" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
                  </>
                ) : (
                  <>
                    {/* subtle overlay for contrast even without image */}
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute inset-0 flex items-center justify-center text-white/90 text-3xl font-bold drop-shadow">
                      {p.title?.charAt(0)}
                    </div>
                  </>
                )}

                {/* Content */}
                <div className="relative z-10 p-4 flex flex-col gap-2 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xl font-semibold drop-shadow-sm">{p.title}</div>
                      <div className="text-sm opacity-90">{prettyType}</div>
                      {cat && (
                        <div className="mt-1 flex items-center gap-2">
                          <div
                            className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.25)',
                              color: '#ffffff',
                              border: cat.color ? `1px solid ${cat.color}` : undefined,
                              boxShadow: cat.color ? `inset 0 0 0 999px ${cat.color}33` : undefined,
                            }}
                          >
                            <Layers className="w-3 h-3" />
                            <span>{cat.name}</span>
                          </div>
                          {extraCount > 0 && (
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold"
                              style={{
                                backgroundColor: 'rgba(255,255,255,0.25)',
                                color: '#ffffff',
                                border: cat.color ? `1px solid ${cat.color}` : '1px solid rgba(255,255,255,0.6)',
                              }}
                              title={`Weitere Kategorien: ${(extraCats || []).filter(ec => !cat || ec.id !== cat.id).map(ec => ec.name).join(', ')}`}
                              aria-label={`Weitere Kategorien: +${extraCount}`}
                            >
                              +{extraCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3 text-sm items-start">
                      <span className="tooltip-wrapper"><button
                        onClick={() => setModal({ mode: 'edit', project: p })}
                        title="Bearbeiten"
                        className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 p-1.5"
                        aria-label={`Projekt ${p.title} bearbeiten`}
                      >
                        <Pencil className="w-4 h-4 text-white" />
                      </button><span className="tooltip-bubble">Bearbeiten</span></span>
                    </div>
                  </div>

                      {p.description && (
                        <div className="text-sm opacity-95">{truncateWords(p.description, 20)}</div>
                      )}

                      {/* Tag Label mit Farbe */}
                      {tag && (
                        <div className="mt-1 text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.25)',
                            color: '#ffffff',
                            border: tag.color ? `1px solid ${tag.color}` : undefined,
                            boxShadow: tag.color ? `inset 0 0 0 999px ${tag.color}33` : undefined,
                          }}
                        >
                          <span>{tag.name}</span>
                        </div>
                      )}

                  {p.archived && (
                    <div className="mt-1 text-xs inline-block px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-sm">Archiviert</div>
                  )}
                </div>
              </div>
            );
          })}
          {projects.length === 0 && (
            <div className="text-gray-500">Keine Projekte gefunden.</div>
          )}
        </div>
      )}

      {modal && (
        <ProjectForm
          initial={modal.mode === 'edit' ? modal.project : undefined}
          onSubmit={(values) => {
            if (modal.mode === 'create') {
              create.mutate(values, { onSuccess: () => { setModal(null); showToast('Projekt erstellt'); } });
            } else if (modal.project?.id) {
              // Omit fields not allowed by UpdateProjectDto (e.g., id)
              const { id: _removed, ...rest } = (values || {}) as Partial<Project>;
              void _removed; // mark as used to satisfy linter
              const data: Partial<Project> = { ...rest };
              update.mutate({ id: modal.project.id, data }, { onSuccess: () => { setModal(null); showToast('Projekt aktualisiert'); } });
            }
          }}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
