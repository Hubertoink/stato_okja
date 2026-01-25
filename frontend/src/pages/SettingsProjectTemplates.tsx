import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import ConfirmModal from '@/components/ConfirmModal';
import { useAuth } from '@/lib/auth';
import { useCategories } from '@/lib/taxonomy';
import {
  ProjectTemplateDto,
  useCreateProjectTemplate,
  useDeleteProjectTemplate,
  useOwnedProjectTemplates,
  useUpdateProjectTemplate,
} from '@/lib/projectTemplatesApi';

type FormState = Partial<ProjectTemplateDto> & { categoryId?: string };

export default function SettingsProjectTemplates() {
  const { user } = useAuth();
  const canManage = user?.role === 'superadmin' || user?.role === 'org_admin';
  const { showToast } = useToast();

  const { data: templates } = useOwnedProjectTemplates();
  const { data: categories } = useCategories({ active: true });

  const create = useCreateProjectTemplate();
  const update = useUpdateProjectTemplate();
  const del = useDeleteProjectTemplate();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectTemplateDto | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; id?: string; title?: string }>(
    { open: false },
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initialForm = useMemo<FormState>(() => {
    if (editing) {
      const cat = (categories || []).find(
        (c) => (editing.categoryName || '').trim().toLowerCase() === (c.name || '').trim().toLowerCase(),
      );
      return {
        ...editing,
        categoryId: cat?.id,
      };
    }
    return {
      title: '',
      type: 'project_open',
      targetGroup: '',
      description: '',
      categoryId: '',
      imageUrl: '',
      color: '#7aa39a',
      archived: false,
    };
  }, [editing, categories]);

  const [form, setForm] = useState<FormState>(initialForm);

  // Keep form in sync when editing changes
  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const uploadImage = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post('/uploads/images', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const url = res.data?.url as string;
    if (url) setForm((f) => ({ ...f, imageUrl: url }));
  };

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
                  <img src={t.imageUrl} alt={t.title} className="w-full h-full object-cover" />
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
                {t.description && (
                  <div className="mt-2 text-sm text-gray-700 line-clamp-2">{t.description}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
        maxWidth="md"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Titel *</label>
            <input
              value={form.title || ''}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Kategorie</label>
            <select
              value={form.categoryId || ''}
              onChange={(e) => {
                const id = e.target.value;
                const cat = (categories || []).find((c) => c.id === id);
                setForm((f) => ({
                  ...f,
                  categoryId: id,
                  categoryName: cat?.name || '',
                }));
              }}
              className="w-full border rounded px-3 py-2"
              disabled={(form.type as string) === 'open_door'}
            >
              <option value="">Keine</option>
              {(categories || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {(form.type as string) === 'open_door' && (
              <div className="text-xs text-gray-500 mt-1">Bei „Offene Tür“ wird keine Kategorie verwendet.</div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Beschreibung</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border rounded px-3 py-2"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Bild</label>
              {form.imageUrl ? (
                <div className="space-y-2">
                  <img src={form.imageUrl} alt="Vorlagenbild" className="w-full h-28 object-cover rounded border" />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-3 py-1 rounded bg-gray-200 text-gray-700"
                      onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                    >
                      Entfernen
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 rounded bg-viridian text-white"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Ersetzen…
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded p-3 text-sm text-gray-600 bg-azure-web/30">
                  <div className="flex gap-2 items-center">
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
                    <div className="text-xs text-gray-500">JPG/PNG</div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Farbe</label>
              <input
                type="color"
                value={(form.color as string) || '#7aa39a'}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="w-20 h-10 p-1 border rounded bg-white"
              />

              <label className="block text-sm font-medium mt-4 mb-1">Status</label>
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

          <div className="flex items-center justify-end gap-2 pt-2">
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
      </Modal>

      <ConfirmModal
        open={confirm.open}
        title="Vorlage löschen?"
        message={
          <div>
            <p>Vorlage „{confirm.title}“ wirklich löschen?</p>
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
