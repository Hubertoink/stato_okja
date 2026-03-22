import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import Modal from '@/components/Modal';
import { MAX_IMAGE_BYTES, processImageForUpload } from '@/lib/imageProcessing';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import { useAuth } from '@/lib/auth';
import { useCategories, useTags, useCreateCategory, useCreateTag } from '@/lib/taxonomy';
import ProtectedImage from '@/components/ProtectedImage';
import {
  ProjectTemplateDto,
  useCreateProjectTemplate,
  useDeleteProjectTemplate,
  useOwnedProjectTemplates,
  useUpdateProjectTemplate,
} from '@/lib/projectTemplatesApi';

type TagWithColor = { name: string; color: string };

function parseTagsString(s: string | null | undefined): TagWithColor[] {
  if (!s) return [];
  return s.split(',').map((part) => {
    const [name, color] = part.split(':');
    return { name: (name || '').trim(), color: (color || '#7aa39a').trim() };
  }).filter((t) => t.name);
}

function serializeTagsString(tags: TagWithColor[]): string {
  return tags.map((t) => `${t.name}:${t.color}`).join(',');
}

type FormState = Partial<ProjectTemplateDto> & {
  categoryId?: string;
  selectedTags?: TagWithColor[];
};

export default function SettingsProjectTemplates() {
  const { user } = useAuth();
  const canManage = user?.role === 'superadmin' || user?.role === 'org_admin';
  const { showToast } = useToast();

  const { data: templates } = useOwnedProjectTemplates();
  const { data: categories } = useCategories({ active: true });
  const { data: tags } = useTags({ active: true });

  const createCategory = useCreateCategory();
  const createTag = useCreateTag();

  const create = useCreateProjectTemplate();
  const update = useUpdateProjectTemplate();
  const del = useDeleteProjectTemplate();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectTemplateDto | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; id?: string; title?: string }>({ open: false });

  // Inline create modals
  const [newCatModal, setNewCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#7aa39a');

  const [newTagModal, setNewTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#7aa39a');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initialForm = useMemo<FormState>(() => {
    if (editing) {
      const cat = (categories || []).find(
        (c) => (editing.categoryName || '').trim().toLowerCase() === (c.name || '').trim().toLowerCase(),
      );
      return {
        ...editing,
        categoryId: cat?.id,
        selectedTags: parseTagsString(editing.tags),
      };
    }
    return {
      title: '',
      type: 'project_open',
      targetGroup: '',
      description: '',
      categoryId: '',
      categoryName: '',
      categoryColor: '#7aa39a',
      selectedTags: [],
      imageUrl: '',
      color: '#7aa39a',
      archived: false,
    };
  }, [editing, categories]);

  const [form, setForm] = useState<FormState>(initialForm);
  const [imageIssue, setImageIssue] = useState<{ open: boolean; title: string; message: string }>(
    { open: false, title: '', message: '' },
  );

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const uploadImage = async (file: File) => {
    try {
      const processed = await processImageForUpload(file);
      const fd = new FormData();
      fd.append('file', processed.file);
      const res = await api.post('/uploads/images', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.url as string;
      if (url) setForm((f) => ({ ...f, imageUrl: url }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bild konnte nicht verarbeitet werden.';
      setImageIssue({
        open: true,
        title: 'Bild zu groß oder nicht unterstützt',
        message: `${msg} (Max ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB, wird auf ${600}px Breite reduziert)`,
      });
    }
  };

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        await uploadImage(e.dataTransfer.files[0]);
      }
    },
    [],
  );

  // Global paste handler
  useEffect(() => {
    if (!modalOpen) return;
    const handler = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (const item of items) {
          if (item.type?.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              await uploadImage(file);
              return;
            }
          }
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [modalOpen]);

  if (!canManage) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-viridian mb-2">Projekt-Vorlagen</h3>
        <p className="text-gray-600">Nur Admins können Vorlagen verwalten.</p>
      </div>
    );
  }

  const owned = templates || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xl font-semibold text-viridian">Projekt-Vorlagen</h3>
          <p className="text-sm text-gray-600">
            Vorlagen gelten für die aktuell ausgewählte Organisation (Org-Scope) und werden automatisch an Unterorganisationen vererbt.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-3 py-2 rounded bg-viridian text-white"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          Neue Vorlage
        </button>
      </div>

      {owned.length === 0 ? (
        <div className="text-sm text-gray-600">Noch keine Vorlagen in dieser Organisation.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {owned.map((t) => (
            <div key={t.id} className="border rounded p-3 flex gap-3">
              <div className="w-20 h-14 rounded overflow-hidden border bg-gray-50 shrink-0">
                {t.imageUrl ? (
                  <ProtectedImage src={t.imageUrl} alt={t.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">kein Bild</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="text-xs text-gray-600 truncate">
                      {t.categoryName ? `Kategorie: ${t.categoryName}` : 'Keine Kategorie'}
                      {t.archived ? ' · Archiviert' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="p-2 rounded border hover:bg-gray-50"
                      title="Bearbeiten"
                      onClick={() => {
                        setEditing(t);
                        setModalOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded border border-red-200 text-red-700 hover:bg-red-50"
                      title="Löschen"
                      onClick={() => setConfirm({ open: true, id: t.id, title: t.title })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {t.tags && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {parseTagsString(t.tags).slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded text-[10px] text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {parseTagsString(t.tags).length > 3 && (
                      <span className="text-[10px] text-gray-500">+{parseTagsString(t.tags).length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template Edit/Create Modal - styled like project modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-end md:items-center justify-center p-0 md:p-6">
          <div
            className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[85vh] overflow-y-auto bottom-sheet-animate"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-viridian">
                {editing ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Titel *</label>
                <input
                  value={form.title || ''}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Typ *</label>
                <select
                  value={(form.type as string) || 'project_open'}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ProjectTemplateDto['type'] }))}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="open_door">Offene Tür</option>
                  <option value="project_open">Projekt (offen)</option>
                  <option value="project_closed">Projekt (geschlossen)</option>
                  <option value="event">Veranstaltung</option>
                  <option value="outreach">Aufsuchend</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Zielgruppe</label>
                <input
                  value={form.targetGroup || ''}
                  onChange={(e) => setForm((f) => ({ ...f, targetGroup: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Bild</label>
                {form.imageUrl ? (
                  <div className="space-y-2">
                    <ProtectedImage
                      src={form.imageUrl}
                      alt="Vorlagenbild"
                      className="w-full h-40 object-cover rounded border"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                        className="px-3 py-1 rounded bg-gray-200 text-gray-700"
                      >
                        Entfernen
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1 rounded bg-viridian text-white"
                      >
                        Ersetzen…
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded p-3 text-sm text-gray-600 bg-azure-web/30">
                    <div className="mb-2">
                      Bild hierher ziehen, klicken zum Auswählen oder per Strg+V einfügen
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1 rounded bg-white border"
                      >
                        Datei wählen…
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) await uploadImage(file);
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Unterstützt JPG/PNG/WEBP. Wird auf max. 600px Breite reduziert. Max. 3MB.
                    </div>
                  </div>
                )}

                <Modal
                  open={imageIssue.open}
                  onClose={() => setImageIssue((s) => ({ ...s, open: false }))}
                  title={imageIssue.title}
                  maxWidth="sm"
                >
                  <div className="text-sm text-gray-700 space-y-4">
                    <div>{imageIssue.message}</div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="px-3 py-2 rounded bg-viridian text-white"
                        onClick={() => setImageIssue((s) => ({ ...s, open: false }))}
                      >
                        Ok
                      </button>
                    </div>
                  </div>
                </Modal>
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1">Farbe</label>
                  <input
                    type="color"
                    value={(form.color as string) || '#7aa39a'}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-20 h-10 p-1 border rounded bg-white"
                  />
                </div>
              </div>

              {/* Tags Section */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">Tags (mehrfach)</label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewTagName('');
                      setNewTagColor('#7aa39a');
                      setNewTagModal(true);
                    }}
                    className="text-xs text-viridian hover:underline"
                  >
                    + Neuen Tag anlegen
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(tags || []).map((t) => {
                    const selected = (form.selectedTags || []).some(
                      (st) => st.name.toLowerCase() === t.name.toLowerCase(),
                    );
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (selected) {
                            setForm((f) => ({
                              ...f,
                              selectedTags: (f.selectedTags || []).filter(
                                (st) => st.name.toLowerCase() !== t.name.toLowerCase(),
                              ),
                            }));
                          } else {
                            setForm((f) => ({
                              ...f,
                              selectedTags: [
                                ...(f.selectedTags || []),
                                { name: t.name, color: t.color || '#7aa39a' },
                              ],
                            }));
                          }
                        }}
                        className="px-2 py-1 rounded-full text-xs border"
                        style={
                          selected
                            ? { backgroundColor: t.color || '#7aa39a', color: '#fff', borderColor: t.color || '#7aa39a' }
                            : { backgroundColor: '#fff', color: '#374151', borderColor: t.color || '#7aa39a' }
                        }
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                {(form.selectedTags || []).length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Ausgewählt: {(form.selectedTags || []).map((t) => t.name).join(', ')}
                  </div>
                )}
              </div>

              {/* Category Section */}
              {(form.type as string) !== 'open_door' && (
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium">Kategorie</label>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCatName('');
                        setNewCatColor('#7aa39a');
                        setNewCatModal(true);
                      }}
                      className="text-xs text-viridian hover:underline"
                    >
                      + Neue Kategorie anlegen
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(categories || []).map((c) => {
                      const active = String(form.categoryId || '') === c.id;
                      const color = c.color || '#7aa39a';
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            if (active) {
                              setForm((f) => ({ ...f, categoryId: '', categoryName: '', categoryColor: '' }));
                            } else {
                              setForm((f) => ({ ...f, categoryId: c.id, categoryName: c.name, categoryColor: c.color || '#7aa39a' }));
                            }
                          }}
                          className="px-2 py-1 rounded-full text-xs border"
                          style={
                            active
                              ? { backgroundColor: color, color: '#fff', borderColor: color }
                              : { backgroundColor: '#fff', color: '#374151', borderColor: color }
                          }
                          title={c.name}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Beschreibung</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  rows={4}
                />
              </div>

              <div className="md:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.archived}
                    onChange={(e) => setForm((f) => ({ ...f, archived: e.target.checked }))}
                  />
                  <span>Archiviert (nicht in Auswahl anzeigen)</span>
                </label>
              </div>
            </div>

            {/* Sticky footer */}
            <div className="sticky bottom-0 bg-white border-t mt-4 py-4 flex items-center justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded bg-gray-200 text-gray-700"
                onClick={() => setModalOpen(false)}
              >
                Abbrechen
              </button>
              <button
                className="px-3 py-1.5 rounded bg-viridian text-white disabled:opacity-60"
                disabled={!String(form.title || '').trim() || create.isPending || update.isPending}
                onClick={async () => {
                  try {
                    const payload: Partial<ProjectTemplateDto> = {
                      title: String(form.title || '').trim(),
                      type: (form.type as ProjectTemplateDto['type']) || 'project_open',
                      targetGroup: String(form.targetGroup || ''),
                      description: String(form.description || ''),
                      categoryName: (form.type as string) === 'open_door' ? '' : String(form.categoryName || ''),
                      categoryColor: (form.type as string) === 'open_door' ? '' : String(form.categoryColor || ''),
                      tags: serializeTagsString(form.selectedTags || []),
                      imageUrl: String(form.imageUrl || ''),
                      color: String(form.color || ''),
                      archived: !!form.archived,
                    };
                    if (editing) {
                      await update.mutateAsync({ id: editing.id, data: payload });
                      showToast('Vorlage gespeichert.', { type: 'success' });
                    } else {
                      await create.mutateAsync(payload);
                      showToast('Vorlage angelegt.', { type: 'success' });
                    }
                    setModalOpen(false);
                  } catch (e: unknown) {
                    const msg =
                      (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message ||
                      'Speichern fehlgeschlagen';
                    showToast(String(msg), { type: 'error', durationMs: 3500 });
                  }
                }}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Category Modal */}
      {newCatModal && (
        <div className="fixed inset-0 bg-black/30 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h4 className="text-lg font-semibold text-viridian mb-4">Neue Kategorie</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Farbe</label>
                <input
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="w-20 h-10 p-1 border rounded bg-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                className="px-3 py-1.5 rounded bg-gray-200 text-gray-700"
                onClick={() => setNewCatModal(false)}
              >
                Abbrechen
              </button>
              <button
                className="px-3 py-1.5 rounded bg-viridian text-white disabled:opacity-60"
                disabled={!newCatName.trim() || createCategory.isPending}
                onClick={async () => {
                  try {
                    const created = await createCategory.mutateAsync({
                      name: newCatName.trim(),
                      color: newCatColor,
                      active: true,
                    });
                    setForm((f) => ({
                      ...f,
                      categoryId: created.id,
                      categoryName: created.name,
                      categoryColor: created.color || newCatColor,
                    }));
                    setNewCatModal(false);
                    showToast('Kategorie angelegt.', { type: 'success' });
                  } catch {
                    showToast('Anlegen fehlgeschlagen', { type: 'error' });
                  }
                }}
              >
                Anlegen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Tag Modal */}
      {newTagModal && (
        <div className="fixed inset-0 bg-black/30 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h4 className="text-lg font-semibold text-viridian mb-4">Neuer Tag</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Farbe</label>
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-20 h-10 p-1 border rounded bg-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                className="px-3 py-1.5 rounded bg-gray-200 text-gray-700"
                onClick={() => setNewTagModal(false)}
              >
                Abbrechen
              </button>
              <button
                className="px-3 py-1.5 rounded bg-viridian text-white disabled:opacity-60"
                disabled={!newTagName.trim() || createTag.isPending}
                onClick={async () => {
                  try {
                    const created = await createTag.mutateAsync({
                      name: newTagName.trim(),
                      color: newTagColor,
                      active: true,
                    });
                    // Add to selection
                    setForm((f) => ({
                      ...f,
                      selectedTags: [
                        ...(f.selectedTags || []),
                        { name: created.name, color: created.color || newTagColor },
                      ],
                    }));
                    setNewTagModal(false);
                    showToast('Tag angelegt.', { type: 'success' });
                  } catch {
                    showToast('Anlegen fehlgeschlagen', { type: 'error' });
                  }
                }}
              >
                Anlegen
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirm.open}
        title="Vorlage löschen?"
        message={
          <div>
            <p>Vorlage „{confirm.title}" wirklich löschen?</p>
            <p className="text-sm text-gray-600">Hinweis: Bestehende Projekte bleiben unverändert.</p>
          </div>
        }
        cancelLabel="Abbrechen"
        confirmLabel="Löschen"
        onCancel={() => setConfirm({ open: false })}
        onConfirm={async () => {
          if (!confirm.id) return;
          try {
            await del.mutateAsync(confirm.id);
            showToast('Vorlage gelöscht.', { type: 'success' });
          } catch {
            showToast('Löschen fehlgeschlagen', { type: 'error' });
          } finally {
            setConfirm({ open: false });
          }
        }}
      />
    </div>
  );
}
