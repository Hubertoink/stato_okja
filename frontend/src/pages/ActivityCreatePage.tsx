import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { X as XIcon, Boxes, Plus as PlusIcon } from 'lucide-react';
import ActivityExecutionStatusControl from '@/components/ActivityExecutionStatusControl';
import { useCreateActivity } from '@/lib/activities';
import { DEFAULT_ACTIVITY_EXECUTION_STATUS } from '@/lib/activityExecutionStatus';
import { useProjects, type Project } from '@/lib/projects';
import { useLocations } from '@/lib/locations';
import { useTags, useCohorts, useCategories, type Cohort } from '@/lib/taxonomy';
import { useStaff } from '@/lib/staff';
import ActivityCohortCountField from '@/components/ActivityCohortCountField';
import ActivityCohortTotalsRow from '@/components/ActivityCohortTotalsRow';
import ActivityTapModeIcon from '@/components/ActivityTapModeIcon';
import ProjectPickerModal from './ProjectPickerModal';
import ProtectedImage from '@/components/ProtectedImage';
import { useToast } from '@/components/Toast';
import Toggle from '@/components/Toggle';
import ConfirmModal from '@/components/ConfirmModal';
import { getSelectableTaxonomyChipStyle } from '@/lib/taxonomyChipStyles';
import { useActivityModalCountMode } from '@/lib/useActivityModalCountMode';
import { useKeyboardOpen } from '@/lib/useKeyboardOpen';
import { useEditorShortcuts } from '@/lib/useEditorShortcuts';
import {
  type ActivityFormState,
  FieldInfoHint,
  buildActivitySavePayload,
  type GenderKey,
  getCohortSums,
  getProjectCategoryIds,
  getProjectTagIds,
  getStaffGroupMembers,
  getWeekdayLabel,
  mergeProjectStaffIds,
} from './activityEditorShared';

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
  const { isMobile, tapModeEnabled, setTapModePreferred } = useActivityModalCountMode();
  const keyboardOpen = useKeyboardOpen();
  const submitLockedRef = useRef(false);

  const [picker, setPicker] = useState(false);
  const [errorOpen, setErrorOpen] = useState<string | null>(null);
  const [form, setForm] = useState<ActivityFormState>(() => ({
    cohortCounts: {},
    date: (qpDate || new Date().toISOString()).slice(0, 10),
    executionStatus: DEFAULT_ACTIVITY_EXECUTION_STATUS,
    projectId: qpProjectId,
  }));

  const selectedProject: Project | undefined = useMemo(() => {
    const id = form.projectId || qpProjectId;
    return (projects || []).find((p) => p.id === id);
  }, [projects, qpProjectId, form.projectId]);
  const selectedDateWeekday = useMemo(() => getWeekdayLabel(form.date), [form.date]);
  const cohortSums = useMemo(() => getCohortSums(form.cohortCounts), [form.cohortCounts]);
  const cohortTotal = cohortSums.m + cohortSums.w + cohortSums.d;
  const employeeStaff = useMemo(() => getStaffGroupMembers(staff, 'employee'), [staff]);
  const volunteerStaff = useMemo(() => getStaffGroupMembers(staff, 'volunteer'), [staff]);
  const helperStaff = useMemo(() => getStaffGroupMembers(staff, 'helper'), [staff]);

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
    const ids = getProjectTagIds(proj, tags);
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
    const categoryIds = getProjectCategoryIds(proj);
    if (categoryIds.length > 0) setForm((f) => ({ ...f, categoryIds: categoryIds }));
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
      return { ...f, staffIds: mergeProjectStaffIds(f.staffIds, selectedProject, staff) };
    });
  }, [selectedProject, staff]);

  const handleSave = () => {
    if (create.isPending || submitLockedRef.current) return;

    if (!form.date) {
      setErrorOpen('Bitte ein Datum wählen.');
      return;
    }
    if (!form.projectId) {
      setErrorOpen('Bitte ein Projekt wählen.');
      return;
    }
    const payload = buildActivitySavePayload({
      form: {
        ...form,
        executionStatus: form.executionStatus || DEFAULT_ACTIVITY_EXECUTION_STATUS,
      },
      selectedProject,
    });
    submitLockedRef.current = true;
    create.mutate(payload, {
      onSuccess: () => {
        showToast('Aktivität gespeichert');
        navigate(-1);
      },
      onError: () => setErrorOpen('Speichern fehlgeschlagen.'),
    });
  };

  useEffect(() => {
    if (!create.isPending) submitLockedRef.current = false;
  }, [create.isPending]);

  const handleCancel = () => {
    // If we navigated here from the project picker route, go back two steps
    if (picker) setPicker(false);
    const fromPicker = (location.state as unknown as { fromProjectPicker?: boolean })
      ?.fromProjectPicker;
    if (fromPicker) navigate(-2);
    else navigate(-1);
  };

  const handleShortcutClose = () => {
    if (picker) {
      setPicker(false);
      return;
    }
    if (errorOpen) {
      setErrorOpen(null);
      return;
    }
    handleCancel();
  };

  useEditorShortcuts({
    onClose: handleShortcutClose,
    onSave: create.isPending || picker || Boolean(errorOpen) ? undefined : handleSave,
  });

  // Vereinfachte Strategie: Keine sticky Action-Bar mehr auf Mobil/Route-Seiten.
  // So kann die Tastatur ohne Layout-Konflikte aufgehen. Wir behalten nur die echte Safe-Area unten.
  const containerPad = 'pb-[env(safe-area-inset-bottom,0px)]';
  const actionBarClass =
    'relative z-10 bg-white border-t -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 py-2 flex items-center justify-between gap-3';
  // Etwas kompakter, wenn die Tastatur offen ist
  const formSpacing = keyboardOpen ? 'space-y-2' : 'space-y-4';

  return (
    <div className={`max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 ${containerPad}`}>
      <div className="flex items-center justify-between mb-4 mt-1">
        <h2 className="text-2xl font-bold text-viridian">Neue Aktivität</h2>
        <div className="flex items-center gap-2">
          <ActivityExecutionStatusControl
            value={form.executionStatus}
            onChange={(executionStatus) => setForm((current) => ({ ...current, executionStatus }))}
          />
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
      </div>

      <form
        className={`bg-white rounded-lg shadow p-4 md:p-6 ${formSpacing}`}
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-sm font-medium" htmlFor="activity-date">
                Datum *
              </label>
              {selectedDateWeekday && (
                <span className="pl-2 text-xs font-medium text-gray-500 whitespace-nowrap">
                  {selectedDateWeekday}
                </span>
              )}
            </div>
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
                        <ProtectedImage
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
          <div className="mb-1 flex items-center justify-between gap-3">
            <label className="block text-sm font-medium">Alterskohorten</label>
            {isMobile && (
              <Toggle
                checked={tapModeEnabled}
                onChange={setTapModePreferred}
                ariaLabel="Tippen statt Tastatur"
                label={<ActivityTapModeIcon />}
                className="shrink-0 gap-1 flex-row-reverse"
              />
            )}
          </div>
          {tapModeEnabled && (
            <div className="mb-2 text-[11px] text-gray-500">
              Tippen +1, lang drücken oder nach unten wischen -1.
            </div>
          )}
          <div className="space-y-2">
            <div className="activity-cohort-grid">
              <span className="text-xs text-gray-500" />
              <span
                className="activity-cohort-column-icon"
                title="Männlich"
                aria-label="Männlich"
              >
                m
              </span>
              <span
                className="activity-cohort-column-icon"
                title="Weiblich"
                aria-label="Weiblich"
              >
                w
              </span>
              <span
                className="activity-cohort-column-icon"
                title="Divers"
                aria-label="Divers"
              >
                d
              </span>
              <span className="text-xs text-gray-600 font-medium text-center" title="Summe" aria-label="Summe">
                Σ
              </span>
            </div>
            {(cohorts || []).map((c: Cohort, rowIndex: number) => {
              const entry = form.cohortCounts?.[c.id] || { m: 0, w: 0, d: 0 };
              const rowTotal = (entry.m || 0) + (entry.w || 0) + (entry.d || 0);
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
                  className="activity-cohort-grid"
                >
                  <span className="min-w-0 text-sm text-gray-700 leading-tight">
                    <div className="break-words">{c.name}</div>
                    {ageLabel && (
                      <div className="text-[11px] text-gray-500 leading-tight">{ageLabel}</div>
                    )}
                  </span>
                  {(['m', 'w', 'd'] as const).map((g) => (
                    <ActivityCohortCountField
                      key={g}
                      mode={tapModeEnabled ? 'tap' : 'input'}
                      value={entry[g] || 0}
                      onChange={(value) => updateEntry(g, value)}
                      onKeyDown={tapModeEnabled ? undefined : (e) => handleKeyDown(e, rowIndex, g)}
                      cohortId={c.id}
                      gender={g}
                      placeholder={g}
                      ariaLabel={`${c.name} ${g.toUpperCase()}`}
                    />
                  ))}
                  <div className="flex h-12 items-center justify-center rounded border border-gray-200 bg-gray-50 text-sm font-medium tabular-nums text-gray-600 md:h-9">
                    {rowTotal}
                  </div>
                </div>
              );
            })}
            <ActivityCohortTotalsRow
              male={cohortSums.m}
              female={cohortSums.w}
              diverse={cohortSums.d}
              total={cohortTotal}
            />
          </div>
        </div>

        {/* Kategorien: ausblenden bei "Offene Tür" */}
        {selectedProject?.type !== 'open_door' && (
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <label className="block text-sm font-medium">Kategorien</label>
              <FieldInfoHint label="Kategorien" settingsTab="categories" />
            </div>
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
                    className="px-2 py-1 rounded-full text-xs border"
                    style={getSelectableTaxonomyChipStyle(active, c.color)}
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
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <label className="block text-sm font-medium">Tags</label>
            <FieldInfoHint label="Tags" settingsTab="tags" />
          </div>
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
                  className="px-2 py-1 rounded-full text-xs border"
                  style={getSelectableTaxonomyChipStyle(active, t.color)}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Staff multi-select split by roles */}
        {employeeStaff.length > 0 && (
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <label className="block text-sm font-medium">Mitarbeitende</label>
            <FieldInfoHint label="Teammitglieder" settingsTab="team" />
          </div>
          <div className="flex flex-wrap gap-2">
            {employeeStaff.map((s) => {
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
        )}

        {volunteerStaff.length > 0 && (
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <label className="block text-sm font-medium">Ehrenamtliche</label>
            <FieldInfoHint label="Teammitglieder" settingsTab="team" />
          </div>
          <div className="flex flex-wrap gap-2">
            {volunteerStaff.map((s) => {
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
        )}

        {helperStaff.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1">Helfer</label>
          <div className="flex flex-wrap gap-2">
            {helperStaff.map((s) => {
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
        )}

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
        <div className={actionBarClass}>
          <div className="flex-1 flex items-center">
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
          <div className="flex-1 flex items-center justify-end">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleSave}
              title="Aktivität speichern"
              aria-label="Aktivität speichern"
              disabled={create.isPending || picker || Boolean(errorOpen)}
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
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
