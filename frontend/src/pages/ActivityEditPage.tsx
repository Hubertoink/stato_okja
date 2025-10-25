import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X as XIcon, Save as SaveIcon, Trash2 as TrashIcon, Boxes } from 'lucide-react';
import { useActivity, useUpdateActivity, useRemoveActivity, type Activity } from '@/lib/activities';
import { useProjects, type Project } from '@/lib/projects';
import { useLocations } from '@/lib/locations';
import { useTags, useCohorts as useCohortsQuery, useCategories, type Cohort } from '@/lib/taxonomy';
import { useStaff } from '@/lib/staff';
import ConfirmModal from '@/components/ConfirmModal';
import ProjectPickerModal from './ProjectPickerModal';
import { useToast } from '@/components/Toast';
import { getBgClass } from '@/lib/colorPalette';
import { useKeyboardOpen } from '@/lib/useKeyboardOpen';

type GenderKey = 'm' | 'w' | 'd';

export default function ActivityEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: activity } = useActivity(id);
  const { data: projects } = useProjects({ archived: false });
  const { data: locations } = useLocations({ active: true });
  const { data: tags } = useTags({ active: true });
  const { data: cohorts } = useCohortsQuery({ active: true });
  const { data: categories } = useCategories({ active: true });
  const { data: staff } = useStaff({ active: true });
  const update = useUpdateActivity();
  const remove = useRemoveActivity();
  const { showToast } = useToast();
  const [picker, setPicker] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const keyboardOpen = useKeyboardOpen();

  const [form, setForm] = useState<{
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
  }>({ cohortCounts: {} });

  useEffect(() => {
    if (!activity) return;
    const cohortCounts: Record<string, { m: number; w: number; d: number }> = {};
    if (Array.isArray(activity.cohorts)) {
      for (const c of activity.cohorts) {
        const prev = cohortCounts[c.cohortId] || { m: 0, w: 0, d: 0 };
        cohortCounts[c.cohortId] = {
          m: (prev.m || 0) + (c.m || 0),
          w: (prev.w || 0) + (c.w || 0),
          d: (prev.d || 0) + (c.d || 0),
        };
      }
    }
    setForm({
      projectId: activity.projectId || activity.project?.id || undefined,
      locationId: activity.locationId || activity.location?.id || undefined,
      start: activity.startTime || undefined,
      end: activity.endTime || undefined,
      title: activity.title || undefined,
      categoryIds: (activity.categories || []).map((c) => c.id),
      tagIds: (activity.tags || []).map((t) => t.id),
      notes: activity.notes || undefined,
      staffIds: (activity.staff || []).map((s) => s.id),
      cohortCounts,
    });
  }, [activity]);

  const selectedProject: Project | undefined = useMemo(
    () => (projects || []).find((p) => p.id === form.projectId),
    [projects, form.projectId],
  );
  const isOpenDoor = selectedProject?.type === 'open_door';

  // Prefill tags from project's default tag names if none chosen yet
  useEffect(() => {
    if (!selectedProject) return;
    const cur = form.tagIds || [];
    if (cur.length > 0) return;
    const names = (selectedProject.tag || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const byName = new Map((tags || []).map((t) => [t.name, t.id] as const));
    const ids = Array.from(new Set(names.map((n) => byName.get(n)).filter(Boolean))) as string[];
    if (ids.length > 0) setForm((f) => ({ ...f, tagIds: ids }));
  }, [selectedProject, tags]);

  // Prefill categories from project unless open_door
  useEffect(() => {
    if (!selectedProject) return;
    if (selectedProject.type === 'open_door') {
      setForm((f) => ({ ...f, categoryIds: [] }));
      return;
    }
    const cur = form.categoryIds || [];
    if (cur.length > 0) return;
    const set = new Set<string>();
    (selectedProject.categories || []).forEach((c) => set.add(c.id));
    if (selectedProject.categoryId) set.add(selectedProject.categoryId);
    if (set.size > 0) setForm((f) => ({ ...f, categoryIds: Array.from(set) }));
  }, [selectedProject]);

  if (!activity) return null;

  // Derive cohort-based totals
  const cohortSums = useMemo(() => {
    const sums: { m: number; w: number; d: number } = { m: 0, w: 0, d: 0 };
    Object.values(form.cohortCounts || {}).forEach((e) => {
      sums.m += e.m || 0;
      sums.w += e.w || 0;
      sums.d += e.d || 0;
    });
    return sums;
  }, [form.cohortCounts]);
  // const cohortTotal = cohortSums.m + cohortSums.w + cohortSums.d;

  // Bottom nav ist im Activity-Route ausgeblendet; orientiere dich nur an Safe-Area
  const stickyBottom = 'bottom-[calc(env(safe-area-inset-bottom,0px)+16px)]';
  // Keyboard offen: Action-Bar nicht sticky, minimales Padding, kein backdrop-blur
  const actionBarClass = keyboardOpen
    ? 'relative z-10 bg-white border-t -mx-4 md:-mx-6 px-4 md:px-6 py-1.5 flex items-center justify-between gap-3'
    : `mt-4 sticky z-50 ${stickyBottom} bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 px-4 md:px-6 flex items-center justify-between gap-3 border-t`;
  // Reduziere Container-Spacing bei Tastatur
  const contentSpacing = keyboardOpen ? 'space-y-2' : 'space-y-3';

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-4">
      <div className="flex items-center justify-between mb-4 mt-1">
        <h2 className="text-2xl font-bold text-viridian">Aktivität bearbeiten</h2>
        <button
          type="button"
          className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
          onClick={() => navigate(-1)}
          title="Abbrechen"
          aria-label="Abbrechen"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      <div className={`bg-white rounded-lg shadow p-4 md:p-6 ${contentSpacing}`}>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="location-select-edit">
            Standort *
          </label>
          <select
            id="location-select-edit"
            value={form.locationId || ''}
            onChange={(e) => setForm({ ...form, locationId: e.target.value || undefined })}
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
          <label className="block text-sm font-medium mb-1">Titel</label>
          <input
            value={form.title || ''}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
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
            <label className="block text-sm font-medium mb-1" htmlFor="start-time-edit">
              Start
            </label>
            <input
              id="start-time-edit"
              type="time"
              value={form.start || ''}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="HH:MM"
              title="Start"
            />
          </div>
          <div>
            <label htmlFor="end-time-edit" className="block text-sm font-medium mb-1">
              Ende
            </label>
            <input
              id="end-time-edit"
              type="time"
              value={form.end || ''}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="HH:MM"
              title="Ende"
            />
          </div>
        </div>

        {/* Cohorts */}
        <div>
          <label className="block text-sm font-medium mb-1">Alterskohorten</label>
          <div className="text-xs text-gray-600 mb-2">
            Summe aktuell: m:{cohortSums.m ?? 0} · w:{cohortSums.w ?? 0} · d:{cohortSums.d ?? 0}
          </div>
          <div className="space-y-2">
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
            {(cohorts || []).map((c: Cohort, rowIndex: number) => {
              const entry = form.cohortCounts?.[c.id] || { m: 0, w: 0, d: 0 };
              const updateC = (g: GenderKey, val: number) =>
                setForm({
                  ...form,
                  cohortCounts: { ...form.cohortCounts!, [c.id]: { ...entry, [g]: val } },
                });
              const genders: GenderKey[] = ['m', 'w', 'd'];
              const handleKeyDown = (
                e: React.KeyboardEvent<HTMLInputElement>,
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
                const targetC = list[nextRow] as Cohort | undefined;
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
                const from = typeof c.minAge === 'number' ? c.minAge : undefined;
                const to = typeof c.maxAge === 'number' ? c.maxAge : undefined;
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
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => updateC(g, Number(e.target.value || 0))}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, g)}
                      data-cohort-id={c.id}
                      data-gender={g}
                      enterKeyHint="next"
                      className="w-full border rounded px-2 py-1 text-center"
                      placeholder={g.toUpperCase()}
                      aria-label={`${c.name} ${g.toUpperCase()}`}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Kategorien */}
        {selectedProject?.type !== 'open_door' && (
          <div>
            <label className="block text-sm font-medium mb-1">Kategorien</label>
            <div className="flex flex-wrap gap-2">
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
                    className={`px-2 py-1 rounded-full text-xs border ${
                      active
                        ? `${getBgClass(c.color as string, 'bg-slate-400')} text-white border-transparent`
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tags */}
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
                  className={`px-2 py-1 rounded-full text-xs border ${
                    active
                      ? `${getBgClass(t.color as string, 'bg-slate-500')} text-white border-transparent`
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Staff */}
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
                Array.isArray(s.roles) ? s.roles.includes('volunteer') : s.role === 'volunteer',
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
          <label className="block text-sm font-medium mb-1" htmlFor="activity-notes-edit">
            Notizen
          </label>
          <textarea
            id="activity-notes-edit"
            value={form.notes || ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full border rounded px-3 py-2"
            placeholder="Notizen zur Aktivität"
            aria-label="Notizen zur Aktivität"
          />
        </div>

        <div className={actionBarClass}>
          <div className="flex-1 flex items-center">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
              onClick={() => navigate(-1)}
              title="Abbrechen"
              aria-label="Abbrechen"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-full bg-red-100 text-red-700"
              onClick={() => setDeleteOpen(true)}
              title="Löschen"
              aria-label="Löschen"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-end">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
              onClick={() => {
                if (!form.projectId) return;
                const cohortSumsLocal: Record<GenderKey, number> = { m: 0, w: 0, d: 0 };
                Object.values(form.cohortCounts || {}).forEach((e) => {
                  cohortSumsLocal.m += e.m || 0;
                  cohortSumsLocal.w += e.w || 0;
                  cohortSumsLocal.d += e.d || 0;
                });
                const counts = cohortSumsLocal;
                const payload: Record<string, unknown> = {
                  date: activity.date,
                  startTime: form.start || null,
                  endTime: form.end || null,
                  type: activity.type,
                  projectId: form.projectId,
                  ...(form.locationId ? { locationId: form.locationId } : {}),
                  title: form.title || null,
                  notes: form.notes || null,
                  tagIds: form.tagIds || [],
                  staffIds: form.staffIds || [],
                  durationMinutes: activity.durationMinutes,
                  countMale: counts.m,
                  countFemale: counts.w,
                  countDiverse: counts.d,
                  countTotal: counts.m + counts.w + counts.d,
                  cohorts: Object.entries(form.cohortCounts || {}).flatMap(
                    ([cohortId, gcounts]) => {
                      const arr: Array<{ cohortId: string; count: number; gender: GenderKey }> = [];
                      (['m', 'w', 'd'] as GenderKey[]).forEach((g) => {
                        const v = (gcounts as { m: number; w: number; d: number })[g] || 0;
                        if (v > 0) arr.push({ cohortId, count: v, gender: g });
                      });
                      return arr;
                    },
                  ),
                  categoryIds: isOpenDoor ? [] : form.categoryIds || [],
                };
                update.mutate(
                  { id: activity.id, data: payload as Partial<Activity> & Record<string, unknown> },
                  {
                    onSuccess: () => {
                      showToast('Aktivität aktualisiert');
                      navigate(-1);
                    },
                  },
                );
              }}
              title="Speichern"
              aria-label="Speichern"
            >
              <SaveIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {picker && (
        <ProjectPickerModal
          onPick={(p) => {
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
              categoryIds: (() => {
                if (p.type === 'open_door') return [];
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
                navigate(-1);
              },
              onError: () => {
                setDeleteOpen(false);
                showToast('Löschen fehlgeschlagen');
              },
            });
          }}
          confirmLabel="Löschen"
        />
      )}
    </div>
  );
}
