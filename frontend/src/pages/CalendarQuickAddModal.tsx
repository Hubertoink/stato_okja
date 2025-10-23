import { Project, useProjects } from '@/lib/projects';
import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Save as SaveIcon, X as XIcon, Boxes, Trash2 as TrashIcon } from 'lucide-react';
import ProjectPickerModal from './ProjectPickerModal';
import { useStaff } from '@/lib/staff';
import { useTags, useCohorts, useCategories } from '@/lib/taxonomy';
import type { Activity } from '@/lib/activities';
import { useCreateActivity, useUpdateActivity, useRemoveActivity } from '@/lib/activities';
import ConfirmModal from '@/components/ConfirmModal';
import { useLocations } from '@/lib/locations';
import { useToast } from '@/components/Toast';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { createPortal } from 'react-dom';
import { getBgClass } from '@/lib/colorPalette';

type GenderKey = 'm' | 'w' | 'd';

type FormState = {
  date?: string;
  projectId?: string;
  locationId?: string;
  start?: string;
  end?: string;
  title?: string;
  categoryIds?: string[];
  tagIds?: string[];
  notes?: string;
  staffIds?: string[];
  cohortCounts?: Record<string, { m: number; w: number; d: number }>;
};

export default function ActivityQuickAdd({
  dateISO,
  onClose,
  project: initialProject,
  activity,
}: {
  dateISO: string;
  onClose: () => void;
  project?: Project;
  activity?: Activity;
}) {
  // This modal mounts only while open – lock body scroll while mounted
  useBodyScrollLock(true);
  const { data: projects } = useProjects({ archived: false });
  const { data: staff } = useStaff({ active: true });
  const { data: tags } = useTags({ active: true });
  const { data: categories } = useCategories({ active: true });
  const { data: cohorts } = useCohorts({ active: true });
  const { data: locations } = useLocations({ active: true });
  const [picker, setPicker] = useState(false);
  // mismatch confirm removed; totals derive from cohort columns now
  const [errorOpen, setErrorOpen] = useState<string | null>(null);
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(() => {
    return { cohortCounts: {}, date: (dateISO || '').slice(0, 10) };
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const selectedProject: Project | undefined = useMemo(
    () => (projects || []).find((p: Project) => p.id === form.projectId) || initialProject,
    [projects, form.projectId, initialProject],
  );
  const isOpenDoor = (selectedProject || initialProject)?.type === 'open_door';

  useEffect(() => {
    // Default times; if project provided, prefill from defaults
    setForm((f: FormState) => ({
      start: f.start || initialProject?.defaultStartTime || '15:00',
      end: f.end || initialProject?.defaultEndTime || '17:00',
      projectId: f.projectId || initialProject?.id,
      date: f.date || (dateISO || '').slice(0, 10),
      ...f,
    }));
  }, [initialProject]);
  // Prefill tags from project defaults when creating (not editing) and when none selected yet
  useEffect(() => {
    if (activity) return; // don't override existing tags in edit mode
    const proj = selectedProject || initialProject;
    if (!proj) return;
    const current = form.tagIds || [];
    if (current.length > 0) return; // user already has a selection
    const names = (proj.tag || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const byName = new Map(
      (tags || []).map((t: { name: string; id: string }) => [t.name, t.id] as const),
    );
    const ids = Array.from(new Set(names.map((n) => byName.get(n)).filter(Boolean))) as string[];
    if (ids.length > 0) setForm((f: FormState) => ({ ...f, tagIds: ids }));
  }, [selectedProject, initialProject, tags, activity]);
  // Prefill categories from project when creating (include primary categoryId)
  useEffect(() => {
    if (activity) return; // editing: don't override
    const proj = selectedProject || initialProject;
    if (!proj) return;
    if (proj.type === 'open_door') {
      // Ensure no categories for open-door
      setForm((f: FormState) => ({ ...f, categoryIds: [] }));
      return;
    }
    const cur = form.categoryIds || [];
    if (cur.length > 0) return; // already chosen
    const set = new Set<string>();
    (proj.categories || []).forEach((c) => set.add(c.id));
    if (proj.categoryId) set.add(proj.categoryId);
    if (set.size > 0) setForm((f: FormState) => ({ ...f, categoryIds: Array.from(set) }));
  }, [selectedProject, initialProject, activity]);
  // If switching to an open-door project, clear categories
  useEffect(() => {
    const proj = selectedProject || initialProject;
    if (proj && proj.type === 'open_door') {
      setForm((f: FormState) => ({ ...f, categoryIds: [] }));
    }
  }, [selectedProject?.type, initialProject?.type]);
  useEffect(() => {
    // If there is exactly one location, auto-select it to reduce friction
    if ((locations || []).length === 1 && !form.locationId) {
      setForm((f: FormState) => ({ ...f, locationId: locations![0]?.id }));
    }
  }, [locations]);
  useEffect(() => {
    // Prefill for edit mode
    if (activity) {
      setForm((f: FormState) => ({
        ...f,
        date: (activity.date || f.date || dateISO).slice(0, 10),
        projectId: activity.projectId || activity.project?.id || f.projectId || initialProject?.id,
        locationId: activity.locationId || activity.location?.id || f.locationId,
        start: activity.startTime || f.start || initialProject?.defaultStartTime || '15:00',
        end: activity.endTime || f.end || initialProject?.defaultEndTime || '17:00',
        title: activity.title || f.title,
        categoryIds: (activity.categories || []).map((c) => c.id),
        tagIds: (activity.tags || []).map((t) => t.id),
        staffIds: (activity.staff || []).map((s) => s.id),
        notes: activity.notes || f.notes,
        cohortCounts: (() => {
          const obj: Record<string, { m: number; w: number; d: number }> = {};
          (activity.cohorts || []).forEach((c) => {
            obj[c.cohortId] = { m: c.m || 0, w: c.w || 0, d: c.d || 0 };
          });
          return Object.keys(obj).length ? obj : f.cohortCounts;
        })(),
      }));
      return;
    }
    // Default times; if project provided, prefill from defaults
    setForm((f: FormState) => ({
      start: f.start || initialProject?.defaultStartTime || '15:00',
      end: f.end || initialProject?.defaultEndTime || '17:00',
      projectId: f.projectId || initialProject?.id,
      date: f.date || (dateISO || '').slice(0, 10),
      ...f,
    }));
  }, [initialProject, activity]);

  // Prefill default staff/category from project if provided
  useEffect(() => {
    if (!initialProject) return;
    setForm((f: FormState) => {
      const updated = { ...f };
      // Staff: parse CSVs, we only prefill staffIds by name match where possible
      const names: string[] = (initialProject.defaultStaff || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((x): x is string => Boolean(x));
      const volNames: string[] = (initialProject.defaultVolunteers || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((x): x is string => Boolean(x));
      const byName = new Map(
        (staff || []).map((s: { name: string; id: string }) => [s.name, s.id] as const),
      );
      const ids = new Set<string>(f.staffIds || []);
      names.forEach((n: string) => {
        const id = byName.get(n) as string | undefined;
        if (id) ids.add(id as string);
      });
      volNames.forEach((n: string) => {
        const id = byName.get(n) as string | undefined;
        if (id) ids.add(id as string);
      });
      updated.staffIds = Array.from(ids);
      // category -> we don't store in activity payload yet; skip for now (backend accepts categoryIds)
      return updated;
    });
  }, [initialProject, staff]);

  const create = useCreateActivity();
  const update = useUpdateActivity();
  const remove = useRemoveActivity();

  const content = (
    <div
      className="fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6 modal-overlay"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto bottom-sheet-animate">
        <h3 className="text-xl font-semibold text-viridian mb-2">
          Aktivität am{' '}
          {(() => {
            const s = (form.date || dateISO || '').slice(0, 10);
            const [y, m, d] = s.split('-');
            return `${d}.${m}.${y}`;
          })()}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="activity-date">
              Datum *
            </label>
            <input
              id="activity-date"
              type="date"
              value={(form.date || '').slice(0, 10)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, date: e.target.value })
              }
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="location-select">
              Standort
            </label>
            <select
              id="location-select"
              value={form.locationId || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setForm({ ...form, locationId: e.target.value || undefined })
              }
              className="w-full border rounded px-3 py-2"
            >
              <option value="">— Standort wählen —</option>
              {(locations || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="activity-title">
              Titel
            </label>
            <input
              id="activity-title"
              value={form.title || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, title: e.target.value })
              }
              className="w-full border rounded px-3 py-2"
              placeholder="z. B. Werkraum, Offene Tür"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Projekt *</label>
            {selectedProject ? (
              <button
                type="button"
                onClick={() => setPicker(true)}
                className="w-full border rounded p-2 flex items-center gap-3 text-left"
              >
                <div className="w-12 h-10 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                  {selectedProject.imageUrl ? (
                    <img
                      src={selectedProject.imageUrl}
                      alt={selectedProject.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Boxes className="w-6 h-6 text-gray-500" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-viridian">{selectedProject.title}</div>
                  <div className="text-xs text-gray-600">{selectedProject.targetGroup || '—'}</div>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPicker(true)}
                className="w-full border rounded p-3 text-left text-gray-600"
              >
                Projekt wählen…
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="start-time">
                Start
              </label>
              <input
                id="start-time"
                type="time"
                value={form.start || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm({ ...form, start: e.target.value })
                }
                className="w-full border rounded px-3 py-2"
                placeholder="HH:MM"
                title="Start"
              />
            </div>
            <div>
              <label htmlFor="end-time" className="block text-sm font-medium mb-1">
                Ende
              </label>
              <input
                id="end-time"
                type="time"
                value={form.end || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm({ ...form, end: e.target.value })
                }
                className="w-full border rounded px-3 py-2"
                placeholder="HH:MM"
                title="Ende"
              />
            </div>
          </div>
          {/* Cohort breakdown per gender */}
          <div>
            <label className="block text-sm font-medium mb-1">Alterskohorten</label>
            <div className="space-y-2">
              {/* Column headers for gender columns */}
              <div className="grid grid-cols-[auto_repeat(3,minmax(3.5rem,5rem))] items-center gap-2">
                <span className="text-xs text-gray-500" />
                <span
                  className="text-xs text-gray-600 font-medium text-center"
                  title="Männlich"
                  aria-label="Männlich"
                >
                  ♂
                </span>
                <span
                  className="text-xs text-gray-600 font-medium text-center"
                  title="Weiblich"
                  aria-label="Weiblich"
                >
                  ♀
                </span>
                <span
                  className="text-xs text-gray-600 font-medium text-center"
                  title="Divers"
                  aria-label="Divers"
                >
                  ⚧
                </span>
              </div>
              {(cohorts || []).map((c, rowIndex: number) => {
                const entry = form.cohortCounts?.[c.id] || { m: 0, w: 0, d: 0 };
                const update = (g: GenderKey, val: number) => {
                  setForm({
                    ...form,
                    cohortCounts: {
                      ...form.cohortCounts!,
                      [c.id]: { ...entry, [g]: val },
                    },
                  });
                };
                const genders: GenderKey[] = ['m', 'w', 'd'];
                const handleKeyDown = (
                  e: KeyboardEvent<HTMLInputElement>,
                  currentRow: number,
                  g: GenderKey,
                ) => {
                  const list = cohorts || [];
                  const col = genders.indexOf(g);
                  let nextRow = currentRow;
                  let nextCol = col;
                  if (e.key === 'Enter' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    nextCol = col + 1;
                    if (nextCol >= genders.length) {
                      nextCol = 0;
                      nextRow = currentRow + 1;
                    }
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    nextCol = col - 1;
                    if (nextCol < 0) {
                      nextCol = genders.length - 1;
                      nextRow = Math.max(0, currentRow - 1);
                    }
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    nextRow = currentRow + 1;
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    nextRow = Math.max(0, currentRow - 1);
                  } else {
                    return;
                  }
                  const targetC = list[nextRow];
                  const targetG = genders[nextCol];
                  if (targetC && targetG) {
                    const el = document.querySelector<HTMLInputElement>(
                      `input[data-cohort-id='${targetC.id}'][data-gender='${targetG}']`,
                    );
                    el?.focus();
                    el?.select();
                  }
                };
                const ageLabel = (() => {
                  const from =
                    typeof (c as { minAge?: number }).minAge === 'number'
                      ? (c as { minAge?: number }).minAge
                      : undefined;
                  const to =
                    typeof (c as { maxAge?: number }).maxAge === 'number'
                      ? (c as { maxAge?: number }).maxAge
                      : undefined;
                  if (from != null && to != null) return `${from}–${to} Jahre`;
                  if (from != null) return `ab ${from} Jahre`;
                  if (to != null) return `bis ${to} Jahre`;
                  return '';
                })();
                return (
                  <div
                    key={c.id}
                    className="grid grid-cols-[auto_repeat(3,minmax(3.5rem,5rem))] items-center gap-2"
                  >
                    <span className="text-sm text-gray-700 truncate">
                      <div className="truncate">{c.name}</div>
                      {ageLabel && (
                        <div className="text-[11px] text-gray-500 leading-tight">{ageLabel}</div>
                      )}
                    </span>
                    {(['m', 'w', 'd'] as const).map((g) => (
                      <input
                        key={g}
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={0}
                        value={entry[g] ? String(entry[g]) : ''}
                        onFocus={(e: React.FocusEvent<HTMLInputElement>) =>
                          e.currentTarget.select()
                        }
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          update(g, Number(e.target.value || 0))
                        }
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                          handleKeyDown(e, rowIndex, g)
                        }
                        data-cohort-id={c.id}
                        data-gender={g}
                        enterKeyHint="next"
                        className="w-full border rounded px-2 py-1 text-center"
                        placeholder={g === 'm' ? '♂' : g === 'w' ? '♀' : '⚧'}
                        aria-label={`${c.name} ${g.toUpperCase()}`}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Kategorien: ausblenden bei "Offene Tür" */}
          {(!selectedProject || selectedProject.type !== 'open_door') && (
            <div>
              <label className="block text-sm font-medium mb-1">Kategorien</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(categories || []).map((c) => {
                  const active = (form.categoryIds || []).includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const set = new Set(form.categoryIds || []);
                        if (set.has(c.id)) set.delete(c.id);
                        else set.add(c.id);
                        setForm({ ...form, categoryIds: Array.from(set) });
                      }}
                      className={`px-2 py-1 rounded-full text-xs border ${active ? `${getBgClass(c.color as string, 'bg-slate-400')} text-white border-transparent` : 'bg-white text-gray-700 border-gray-300'}`}
                    >
                      {c.name}
                    </button>
                  );
                })}
                {(categories || []).length === 0 && (
                  <span className="text-xs text-gray-400">Keine Kategorien vorhanden.</span>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <div className="flex flex-wrap gap-2">
              {(tags || []).map((t) => {
                const active = form.tagIds?.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const set = new Set(form.tagIds || []);
                      if (set.has(t.id)) set.delete(t.id);
                      else set.add(t.id);
                      setForm({ ...form, tagIds: Array.from(set) });
                    }}
                    className={`px-2 py-1 rounded-full text-xs border ${active ? `${getBgClass(t.color as string, 'bg-slate-500')} text-white border-transparent` : 'bg-white text-gray-700 border-gray-300'}`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Staff multi-select split by roles */}
          <div>
            <label className="block text-sm font-medium mb-1">Mitarbeitende</label>
            <div className="flex flex-wrap gap-2">
              {(staff || [])
                .filter((s) =>
                  Array.isArray(s.roles)
                    ? s.roles.includes('lead') || s.roles.includes('employee')
                    : s.role === 'lead' || s.role === 'employee',
                )
                .map((s) => {
                  const active = form.staffIds?.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const set = new Set(form.staffIds || []);
                        if (set.has(s.id)) set.delete(s.id);
                        else set.add(s.id);
                        setForm({ ...form, staffIds: Array.from(set) });
                      }}
                      className={`px-2 py-1 rounded-full text-xs border ${
                        active ? 'bg-viridian text-white' : 'bg-white text-gray-700'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ehrenamtliche</label>
            <div className="flex flex-wrap gap-2">
              {(staff || [])
                .filter((s) =>
                  Array.isArray(s.roles)
                    ? s.roles.includes('volunteer')
                    : s.role === 'volunteer',
                )
                .map((s) => {
                  const active = form.staffIds?.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const set = new Set(form.staffIds || []);
                        if (set.has(s.id)) set.delete(s.id);
                        else set.add(s.id);
                        setForm({ ...form, staffIds: Array.from(set) });
                      }}
                      className={`px-2 py-1 rounded-full text-xs border ${
                        active ? 'bg-cambridge-blue text-white' : 'bg-white text-gray-700'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Helfer</label>
            <div className="flex flex-wrap gap-2">
              {(staff || [])
                .filter((s) =>
                  Array.isArray(s.roles) ? s.roles.includes('helper') : s.role === 'helper',
                )
                .map((s) => {
                  const active = form.staffIds?.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const set = new Set(form.staffIds || []);
                        if (set.has(s.id)) set.delete(s.id);
                        else set.add(s.id);
                        setForm({ ...form, staffIds: Array.from(set) });
                      }}
                      className={`px-2 py-1 rounded-full text-xs border ${
                        active ? 'bg-amber-400 text-white' : 'bg-white text-gray-700'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
            </div>
          </div>
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notizen</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full border rounded px-3 py-2"
              placeholder="Notizen zur Aktivität"
              aria-label="Notizen"
            />
          </div>
        </div>

        <div className="mt-4 sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 -mb-4 md:-mb-6 px-4 md:px-6 flex items-center gap-3">
          <div className="flex-1 flex items-center">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
              onClick={onClose}
              title="Abbrechen"
              aria-label="Abbrechen"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            {activity ? (
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-full bg-red-100 text-red-700"
                onClick={() => setDeleteOpen(true)}
                title="Löschen"
                aria-label="Löschen"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            ) : (
              <span className="inline-block w-10 h-10" aria-hidden="true" />
            )}
          </div>
          <div className="flex-1 flex items-center justify-end">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
              onClick={() => {
                // Validation: require project, and per-gender sums must match
                if (!form.date) {
                  setErrorOpen('Bitte ein Datum wählen.');
                  return;
                }
                if (!form.projectId) {
                  setErrorOpen('Bitte ein Projekt wählen.');
                  return;
                }
                // Standort optional – keine Validierung nötig
                const cohortSums: Record<GenderKey, number> = { m: 0, w: 0, d: 0 };
                Object.values(form.cohortCounts || {}).forEach((e) => {
                  cohortSums.m += e.m || 0;
                  cohortSums.w += e.w || 0;
                  cohortSums.d += e.d || 0;
                });
                const totalsByGender: Record<GenderKey, number> = { ...cohortSums };
                // Build payload for POST
                const toMinutes = (hhmm?: string | null) => {
                  if (!hhmm) return undefined;
                  const [hh, mm] = hhmm.split(':').map((v) => parseInt(v, 10));
                  if (Number.isNaN(hh) || Number.isNaN(mm)) return undefined;
                  return hh * 60 + mm;
                };
                const startM = toMinutes(form.start || selectedProject?.defaultStartTime || null);
                const endM = toMinutes(form.end || selectedProject?.defaultEndTime || null);
                const durationMinutes =
                  startM !== undefined && endM !== undefined && endM >= startM
                    ? endM - startM
                    : undefined;
                const payloadBase = {
                  date: (form.date || activity?.date || dateISO).slice(0, 10),
                  startTime: form.start || null,
                  endTime: form.end || null,
                  // Always derive activity type from selected project (matches data model)
                  type: selectedProject?.type || activity?.type || 'project_open',
                  projectId: form.projectId,
                  ...(form.locationId ? { locationId: form.locationId } : {}),
                  title: form.title || null,
                  notes: form.notes || null,
                  categoryIds: isOpenDoor ? [] : form.categoryIds || [],
                  tagIds: form.tagIds || [],
                  staffIds: form.staffIds || [],
                  durationMinutes,
                } as Record<string, unknown>;
                // Always send per-gender cohort breakdown
                payloadBase.countMale = totalsByGender.m;
                payloadBase.countFemale = totalsByGender.w;
                payloadBase.countDiverse = totalsByGender.d;
                payloadBase.countTotal = totalsByGender.m + totalsByGender.w + totalsByGender.d;
                payloadBase.cohorts = Object.entries(form.cohortCounts || {}).map(
                  ([cohortId, gcounts]) => ({
                    cohortId,
                    m: (gcounts as { m: number; w: number; d: number }).m || 0,
                    w: (gcounts as { m: number; w: number; d: number }).w || 0,
                    d: (gcounts as { m: number; w: number; d: number }).d || 0,
                  }),
                );
                // POST/PATCH and close (error handling basic for now)
                const doCreate = () =>
                  create.mutate(payloadBase, {
                    onSuccess: () => {
                      showToast('Aktivität gespeichert');
                      onClose();
                    },
                    onError: (e: unknown) => {
                      console.error(e);
                      setErrorOpen('Speichern fehlgeschlagen.');
                    },
                  });
                const doUpdate = () =>
                  update.mutate(
                    { id: activity!.id, data: payloadBase },
                    {
                      onSuccess: () => {
                        showToast('Aktivität aktualisiert');
                        onClose();
                      },
                      onError: (e: unknown) => {
                        console.error(e);
                        setErrorOpen('Speichern fehlgeschlagen.');
                      },
                    },
                  );
                if (activity) doUpdate();
                else doCreate();
              }}
              title="Speichern"
              aria-label="Speichern"
            >
              <SaveIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        {picker && (
          <ProjectPickerModal
            onPick={(p) => {
              // When picking a project, also prefill tags if none selected yet
              const names = (p.tag || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              const byName = new Map((tags || []).map((t) => [t.name, t.id] as const));
              const defaultTagIds = Array.from(
                new Set(names.map((n) => byName.get(n)).filter(Boolean)),
              ) as string[];
              setForm((prev) => ({
                ...prev,
                projectId: p.id,
                tagIds: prev.tagIds && prev.tagIds.length > 0 ? prev.tagIds : defaultTagIds,
                // Prefill categories from project's categories plus primary categoryId if set
                categoryIds:
                  p.type === 'open_door'
                    ? []
                    : (() => {
                        const set = new Set<string>(prev.categoryIds || []);
                        (p.categories || []).forEach((c) => set.add(c.id));
                        if (p.categoryId) set.add(p.categoryId);
                        return Array.from(set);
                      })(),
              }));
              setPicker(false);
            }}
            onClose={() => setPicker(false)}
          />
        )}
        <ConfirmModal
          open={Boolean(errorOpen)}
          title="Fehler"
          message={errorOpen || ''}
          onCancel={() => setErrorOpen(null)}
          onConfirm={() => setErrorOpen(null)}
          showCancel={false}
          confirmLabel="OK"
        />
        {activity && (
          <ConfirmModal
            open={deleteOpen}
            title="Aktivität löschen?"
            message="Diese Aktion kann nicht rückgängig gemacht werden."
            onCancel={() => setDeleteOpen(false)}
            onConfirm={() => {
              remove.mutate(activity.id, {
                onSuccess: () => {
                  showToast('Aktivität gelöscht');
                  setDeleteOpen(false);
                  onClose();
                },
                onError: (e: unknown) => {
                  console.error(e);
                  setDeleteOpen(false);
                  setErrorOpen('Löschen fehlgeschlagen.');
                },
              });
            }}
            confirmLabel="Löschen"
          />
        )}
      </div>
    </div>
  );
  if (typeof document !== 'undefined') return createPortal(content, document.body);
  return content;
}
