import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { X as XIcon, Boxes } from 'lucide-react';
import { useCreateActivity, type Activity } from '@/lib/activities';
import { useProjects, type Project } from '@/lib/projects';
import { useLocations } from '@/lib/locations';
import { useTags, useCohorts, useCategories, type Cohort } from '@/lib/taxonomy';
import { useStaff } from '@/lib/staff';
import ProjectPickerModal from './ProjectPickerModal';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
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

export default function ActivityCreatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const qpProjectId = params.get('projectId') || undefined;
  const qpDate = params.get('date') || undefined;

  const { data: projects } = useProjects({ archived: false });
  const { data: staff } = useStaff({ active: true });
  const { data: tags } = useTags({ active: true });
  const { data: categories } = useCategories({ active: true });
  const { data: cohorts } = useCohorts({ active: true });
  const { data: locations } = useLocations({ active: true });
  const create = useCreateActivity();
  const { showToast } = useToast();

  const [picker, setPicker] = useState(false);
  const [errorOpen, setErrorOpen] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => ({
    cohortCounts: {},
    date: (qpDate || new Date().toISOString()).slice(0, 10),
    projectId: qpProjectId,
  }));

  const selectedProject: Project | undefined = useMemo(() => {
    const id = form.projectId || qpProjectId;
    return (projects || []).find((p) => p.id === id);
  }, [projects, qpProjectId, form.projectId]);
  const isOpenDoor = selectedProject?.type === 'open_door';

  // Default times; if project provided, prefill from defaults
  useEffect(() => {
    setForm((f) => ({
      start: f.start || selectedProject?.defaultStartTime || '15:00',
      end: f.end || selectedProject?.defaultEndTime || '17:00',
      projectId: f.projectId || qpProjectId,
      date: (f.date || qpDate || new Date().toISOString()).slice(0, 10),
      ...f,
    }));
  }, [selectedProject, qpProjectId, qpDate]);

  // Prefill tags from project defaults when none selected yet
  useEffect(() => {
    const proj = selectedProject;
    if (!proj) return;
    const current = form.tagIds || [];
    if (current.length > 0) return;
    const names = (proj.tag || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const byName = new Map((tags || []).map((t) => [t.name, t.id] as const));
    const ids = Array.from(new Set(names.map((n) => byName.get(n)).filter(Boolean))) as string[];
    if (ids.length > 0) setForm((f) => ({ ...f, tagIds: ids }));
  }, [selectedProject, tags, form.tagIds]);

  // Prefill categories from project when none selected yet (include primary categoryId)
  useEffect(() => {
    const proj = selectedProject;
    if (!proj) return;
    if (proj.type === 'open_door') {
      setForm((f) => ({ ...f, categoryIds: [] }));
      return;
    }
    const cur = form.categoryIds || [];
    if (cur.length > 0) return;
    const set = new Set<string>();
    (proj.categories || []).forEach((c) => set.add(c.id));
    if (proj.categoryId) set.add(proj.categoryId);
    if (set.size > 0) setForm((f) => ({ ...f, categoryIds: Array.from(set) }));
  }, [selectedProject, form.categoryIds]);

  // Clear categories when switching to open-door
  useEffect(() => {
    if (selectedProject?.type === 'open_door') setForm((f) => ({ ...f, categoryIds: [] }));
  }, [selectedProject?.type]);

  // If there is exactly one location, auto-select it to reduce friction
  useEffect(() => {
    if ((locations || []).length === 1 && !form.locationId) {
      setForm((f) => ({ ...f, locationId: locations![0]?.id }));
    }
  }, [locations, form.locationId]);

  // Prefill staff from project's defaultStaff and defaultVolunteers by matching names
  useEffect(() => {
    if (!selectedProject) return;
    setForm((f) => {
      const updated = { ...f };
      const names: string[] = (selectedProject.defaultStaff || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((x): x is string => Boolean(x));
      const volNames: string[] = (selectedProject.defaultVolunteers || '')
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
      return updated;
    });
  }, [selectedProject, staff]);

  const toMinutes = (hhmm?: string | null) => {
    if (!hhmm) return undefined;
    const [hh, mm] = hhmm.split(':').map((v) => parseInt(v, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return undefined;
    return hh * 60 + mm;
  };

  const handleSave = () => {
    if (!form.date) {
      setErrorOpen('Bitte ein Datum wählen.');
      return;
    }
    if (!form.projectId) {
      setErrorOpen('Bitte ein Projekt wählen.');
      return;
    }
    const cohortSums: Record<GenderKey, number> = { m: 0, w: 0, d: 0 };
    Object.values(form.cohortCounts || {}).forEach((e) => {
      cohortSums.m += e.m || 0;
      cohortSums.w += e.w || 0;
      cohortSums.d += e.d || 0;
    });
    const startM = toMinutes(form.start || selectedProject?.defaultStartTime || null);
    const endM = toMinutes(form.end || selectedProject?.defaultEndTime || null);
    const durationMinutes =
      startM !== undefined && endM !== undefined && endM >= startM ? endM - startM : undefined;
    const payload: Partial<Activity> & Record<string, unknown> = {
      date: (form.date || '').slice(0, 10),
      startTime: form.start || null,
      endTime: form.end || null,
      type: (selectedProject?.type as Activity['type']) || 'project_open',
      projectId: form.projectId,
      ...(form.locationId ? { locationId: form.locationId } : {}),
      title: form.title || null,
      notes: form.notes || null,
      categoryIds: isOpenDoor ? [] : form.categoryIds || [],
      tagIds: form.tagIds || [],
      staffIds: form.staffIds || [],
      durationMinutes,
      countMale: cohortSums.m,
      countFemale: cohortSums.w,
      countDiverse: cohortSums.d,
      countTotal: cohortSums.m + cohortSums.w + cohortSums.d,
      cohorts: Object.entries(form.cohortCounts || {}).map(([cohortId, gcounts]) => ({
        cohortId,
        m: (gcounts as { m: number; w: number; d: number }).m || 0,
        w: (gcounts as { m: number; w: number; d: number }).w || 0,
        d: (gcounts as { m: number; w: number; d: number }).d || 0,
      })),
    };
    create.mutate(payload, {
      onSuccess: () => {
        showToast('Aktivität gespeichert');
        navigate(-1);
      },
      onError: () => setErrorOpen('Speichern fehlgeschlagen.'),
    });
  };

  const handleCancel = () => {
    // If we navigated here from the project picker route, go back two steps
    if (picker) setPicker(false);
    const fromPicker = (location.state as unknown as { fromProjectPicker?: boolean })
      ?.fromProjectPicker;
    if (fromPicker) navigate(-2);
    else navigate(-1);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 pb-[calc(var(--mobile-nav-space,56px)+env(safe-area-inset-bottom,0px)+96px)]">
      <div className="flex items-center justify-between mb-4 mt-1">
        <h2 className="text-2xl font-bold text-viridian">Neue Aktivität</h2>
        <button
          type="button"
          className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
          onClick={handleCancel}
          title="Abbrechen"
          aria-label="Abbrechen"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      <form
        className="bg-white rounded-lg shadow p-4 md:p-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="activity-date">
              Datum *
            </label>
            <input
              id="activity-date"
              type="date"
              value={(form.date || '').slice(0, 10)}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
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
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="activity-title">
            Titel
          </label>
          <input
            id="activity-title"
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
            <label className="block text-sm font-medium mb-1" htmlFor="start-time">
              Start
            </label>
            <input
              id="start-time"
              type="time"
              value={form.start || ''}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
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
              onChange={(e) => setForm({ ...form, end: e.target.value })}
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
              const updateEntry = (g: GenderKey, val: number) =>
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
                      onChange={(e) => updateEntry(g, Number(e.target.value || 0))}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, g)}
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
        {selectedProject?.type !== 'open_door' && (
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
          <label className="block text-sm font-medium mb-1">Ehrenamtliche</label>
          <div className="flex flex-wrap gap-2">
            {(staff || [])
              .filter((s) =>
                Array.isArray(s.roles)
                  ? s.roles.includes('volunteer') || s.roles.includes('helper')
                  : s.role === 'volunteer' || s.role === 'helper',
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
          <label className="block text-sm font-medium mb-1" htmlFor="activity-notes">
            Notizen
          </label>
          <textarea
            id="activity-notes"
            value={form.notes || ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full border rounded px-3 py-2"
            placeholder="Notizen zur Aktivität"
            aria-label="Notizen"
          />
        </div>

        {/* Sticky actions above bottom nav on mobile */}
        <div className="sticky z-50 bottom-[calc(var(--mobile-nav-space,56px)+env(safe-area-inset-bottom,0px)+16px)] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-3 pb-safe -mx-4 md:-mx-6 px-4 md:px-6 border-t flex flex-col sm:flex-row gap-4">
          <button
            type="submit"
            className="bg-viridian text-white px-8 py-3 rounded-lg hover:bg-cambridge-blue transition-colors"
          >
            Aktivität speichern
          </button>
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-400 transition-colors"
            onClick={handleCancel}
          >
            Abbrechen
          </button>
        </div>
      </form>

      {picker && (
        <ProjectPickerModal
          onPick={(p) => {
            // Prefill tags if none selected yet from project's tag string
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
              categoryIds:
                p.type === 'open_door'
                  ? []
                  : (() => {
                      const set = new Set<string>(prev.categoryIds || []);
                      (p.categories || []).forEach((c) => set.add(c.id));
                      if (p.categoryId) set.add(p.categoryId);
                      return Array.from(set);
                    })(),
              start: prev.start || p.defaultStartTime || '15:00',
              end: prev.end || p.defaultEndTime || '17:00',
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
    </div>
  );
}
