import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { X as XIcon, Save as SaveIcon, Trash2 as TrashIcon, Boxes, Plus as PlusIcon } from 'lucide-react';
import ActivityExecutionStatusControl from '@/components/ActivityExecutionStatusControl';
import { useActivity, useUpdateActivity, useRemoveActivity, type Activity } from '@/lib/activities';
import { useProjects, type Project } from '@/lib/projects';
import { useLocations } from '@/lib/locations';
import {
  useTags,
  useCohorts as useCohortsQuery,
  useCategories,
  useCreateCategory,
  useCreateTag,
  useTaxonomyAccess,
  useUpdateCategory,
  useUpdateTag,
  type Cohort,
} from '@/lib/taxonomy';
import { type StaffRole, useCreateStaff, useStaff } from '@/lib/staff';
import ActivityCohortCountField from '@/components/ActivityCohortCountField';
import ActivityCohortTotalsRow from '@/components/ActivityCohortTotalsRow';
import ActivityTapModeIcon from '@/components/ActivityTapModeIcon';
import ConfirmModal from '@/components/ConfirmModal';
import ProjectPickerModal from './ProjectPickerModal';
import { useToast } from '@/components/Toast';
import Toggle from '@/components/Toggle';
import { getSelectableTaxonomyChipStyle } from '@/lib/taxonomyChipStyles';
import { useActivityModalCountMode } from '@/lib/useActivityModalCountMode';
import { useKeyboardOpen } from '@/lib/useKeyboardOpen';
import ProtectedImage from '@/components/ProtectedImage';
import { useEditorShortcuts } from '@/lib/useEditorShortcuts';
import { DEFAULT_ACTIVITY_EXECUTION_STATUS } from '@/lib/activityExecutionStatus';
import { CategoryFormModal, StaffFormModal, TagFormModal } from '@/components/settings/EntityFormModals';
import { FIXED_PALETTE, TAG_PALETTE, isInFixedPalette, isInTagPalette } from '@/lib/colorPalette';
import { useAuth } from '@/lib/auth';
import {
  type ActivityFormState,
  appendUniqueId,
  buildActivitySavePayload,
  findNamedEntity,
  getActivityFormStateFromActivity,
  getCohortSums,
  type GenderKey,
  getProjectCategoryIds,
  getProjectTagIds,
  getStaffGroupMembers,
  getWeekdayLabel,
} from './activityEditorShared';

export default function ActivityEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { data: activity } = useActivity(id);
  const { data: projects } = useProjects({ archived: false });
  const { data: locations } = useLocations({ active: true });
  const { data: tags } = useTags({ active: true });
  const { data: allTags } = useTags();
  const { data: cohorts } = useCohortsQuery({ active: true });
  const { data: categories } = useCategories({ active: true });
  const { data: allCategories } = useCategories();
  const { data: staff } = useStaff({ active: true });
  const { data: allStaff } = useStaff();
  const { data: taxonomyAccess } = useTaxonomyAccess();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const createStaff = useCreateStaff();
  const update = useUpdateActivity();
  const remove = useRemoveActivity();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [picker, setPicker] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tagCreateOpen, setTagCreateOpen] = useState(false);
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false);
  const [staffCreateState, setStaffCreateState] = useState<{ open: boolean; role: StaffRole }>({
    open: false,
    role: 'employee',
  });
  const { isMobile, tapModeEnabled, setTapModePreferred } = useActivityModalCountMode();
  const keyboardOpen = useKeyboardOpen();

  const returnTo = (() => {
    const raw = (location.state as unknown as { from?: unknown } | null)?.from;
    return typeof raw === 'string' && raw.length > 0 ? raw : '/activities';
  })();

  const [form, setForm] = useState<ActivityFormState>({ cohortCounts: {} });

  useEffect(() => {
    if (!activity) return;
    setForm({
      ...getActivityFormStateFromActivity(activity),
      executionStatus: activity.executionStatus || DEFAULT_ACTIVITY_EXECUTION_STATUS,
    });
  }, [activity]);

  const selectedProject: Project | undefined = useMemo(
    () => (projects || []).find((p) => p.id === form.projectId),
    [projects, form.projectId],
  );
  const selectedDateWeekday = useMemo(() => getWeekdayLabel(form.date), [form.date]);
  const employeeStaff = useMemo(() => getStaffGroupMembers(staff, 'employee'), [staff]);
  const volunteerStaff = useMemo(() => getStaffGroupMembers(staff, 'volunteer'), [staff]);
  const helperStaff = useMemo(() => getStaffGroupMembers(staff, 'helper'), [staff]);
  const canCreateOwnTags = Boolean(taxonomyAccess?.tags.canCreateOwn);
  const canCreateOwnCategories = Boolean(taxonomyAccess?.categories.canCreateOwn);
  const canManageStaff = Boolean(user && (user.role === 'superadmin' || user.role === 'org_admin'));
  const addActionButtonClassName =
    'inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-viridian hover:border-viridian/40';

  // Prefill tags from project's default tag names if none chosen yet
  useEffect(() => {
    if (!selectedProject) return;
    const cur = form.tagIds || [];
    if (cur.length > 0) return;
    const ids = getProjectTagIds(selectedProject, tags);
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
    const categoryIds = getProjectCategoryIds(selectedProject);
    if (categoryIds.length > 0) setForm((f) => ({ ...f, categoryIds }));
  }, [selectedProject]);

  if (!activity) return null;

  // Derive cohort-based totals
  const cohortSums = useMemo(() => getCohortSums(form.cohortCounts), [form.cohortCounts]);
  const cohortTotal = cohortSums.m + cohortSums.w + cohortSums.d;

  // Vereinfachung: Action-Bar grundsätzlich nicht sticky, nur Safe-Area berücksichtigen.
  const actionBarClass =
    'relative z-10 bg-white border-t -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 py-2 flex items-center justify-between gap-3';
  // Reduziere Container-Spacing bei Tastatur
  const contentSpacing = keyboardOpen ? 'space-y-2' : 'space-y-3';

  const handleClose = () => {
    if (picker) {
      setPicker(false);
      return;
    }
    if (deleteOpen) {
      setDeleteOpen(false);
      return;
    }
    navigate(-1);
  };

  const handleSave = () => {
    if (!form.projectId) return;
    const payload = buildActivitySavePayload({
      form: {
        ...form,
        executionStatus: form.executionStatus || DEFAULT_ACTIVITY_EXECUTION_STATUS,
      },
      selectedProject,
      fallbackDate: activity.date,
      fallbackType: activity.type,
      durationMinutesOverride: activity.durationMinutes,
    });
    update.mutate(
      { id: activity.id, data: payload as Partial<Activity> & Record<string, unknown> },
      {
        onSuccess: () => {
          showToast('Aktivität aktualisiert');
          navigate(-1);
        },
      },
    );
  };

  useEditorShortcuts({
    onClose: handleClose,
    onSave: update.isPending || picker || deleteOpen ? undefined : handleSave,
  });

  const addStaffId = (staffId: string) => {
    setForm((current) => ({ ...current, staffIds: appendUniqueId(current.staffIds, staffId) }));
  };

  const handleCategoryCreate = async (values: { name?: string; description?: string | null; standardRef?: string | null; color?: string | null }) => {
    const name = String(values.name || '').trim();
    if (!name) return;
    const existing = findNamedEntity(allCategories, name);

    try {
      let categoryId = existing?.id;
      const color = isInFixedPalette(values.color as string) ? values.color : FIXED_PALETTE[0];

      if (existing?.id && existing.active === false) {
        await updateCategory.mutateAsync({
          id: existing.id,
          data: { active: true, description: values.description, standardRef: values.standardRef, color },
        });
      } else if (!existing?.id) {
        const created = await createCategory.mutateAsync({
          name,
          active: true,
          description: values.description,
          standardRef: values.standardRef,
          color,
        });
        categoryId = created.id;
      }

      if (!categoryId) throw new Error('missing-category-id');
      setForm((current) => ({ ...current, categoryIds: appendUniqueId(current.categoryIds, categoryId) }));
      showToast(
        existing?.id ? `Kategorie "${name}" wurde zugeordnet.` : `Kategorie "${name}" hinzugefügt.`,
        existing?.id ? { type: 'info' } : undefined,
      );
      setCategoryCreateOpen(false);
    } catch {
      showToast('Kategorie konnte nicht angelegt werden.', { type: 'error' });
    }
  };

  const handleTagCreate = async (values: { name?: string; description?: string | null; color?: string | null }) => {
    const name = String(values.name || '').trim();
    if (!name) return;
    const existing = findNamedEntity(allTags, name);

    try {
      let tagId = existing?.id;
      const color = isInTagPalette(values.color as string) ? values.color : TAG_PALETTE[0];

      if (existing?.id && existing.active === false) {
        await updateTag.mutateAsync({
          id: existing.id,
          data: { active: true, description: values.description, color },
        });
      } else if (!existing?.id) {
        const created = await createTag.mutateAsync({
          name,
          active: true,
          description: values.description,
          color,
        });
        tagId = created.id;
      }

      if (!tagId) throw new Error('missing-tag-id');
      setForm((current) => ({ ...current, tagIds: appendUniqueId(current.tagIds, tagId) }));
      showToast(
        existing?.id ? `Tag "${name}" wurde zugeordnet.` : `Tag "${name}" hinzugefügt.`,
        existing?.id ? { type: 'info' } : undefined,
      );
      setTagCreateOpen(false);
    } catch {
      showToast('Tag konnte nicht angelegt werden.', { type: 'error' });
    }
  };

  const handleStaffCreate = async (values: { name?: string; roles?: StaffRole[] | StaffRole }) => {
    const name = String(values.name || '').trim();
    if (!name) return;
    const existing = findNamedEntity(allStaff, name);

    if (existing?.id) {
      addStaffId(existing.id);
      showToast(`Teammitglied "${existing.name}" wurde zugeordnet.`, { type: 'info' });
      setStaffCreateState((current) => ({ ...current, open: false }));
      return;
    }

    try {
      const created = await createStaff.mutateAsync({
        ...values,
        roles:
          Array.isArray(values.roles) && values.roles.length > 0
            ? values.roles
            : [staffCreateState.role],
      });
      addStaffId(created.id);
      showToast(`Teammitglied "${created.name}" hinzugefügt.`);
      setStaffCreateState((current) => ({ ...current, open: false }));
    } catch {
      showToast('Teammitglied konnte nicht angelegt werden.', { type: 'error' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4">
      <div className="flex items-center justify-between mb-4 mt-1">
        <h2 className="text-2xl font-bold text-viridian">Aktivität bearbeiten</h2>
        <div className="flex items-center gap-2">
          <ActivityExecutionStatusControl
            value={form.executionStatus}
            onChange={(executionStatus) => setForm((current) => ({ ...current, executionStatus }))}
          />
          <button
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
            onClick={handleClose}
            title="Abbrechen"
            aria-label="Abbrechen"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className={`bg-white rounded-lg shadow p-4 md:p-6 ${contentSpacing}`}>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="block text-sm font-medium" htmlFor="activity-date-edit-page">
              Datum *
            </label>
            {selectedDateWeekday && (
              <span className="pl-2 text-xs font-medium text-gray-500 whitespace-nowrap">
                {selectedDateWeekday}
              </span>
            )}
          </div>
          <input
            id="activity-date-edit-page"
            type="date"
            value={(form.date || '').slice(0, 10)}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>

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
          <div className="text-xs text-gray-600 mb-2">
            Summe aktuell: m:{cohortSums.m ?? 0} · w:{cohortSums.w ?? 0} · d:{cohortSums.d ?? 0}
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
                      onChange={(value) => updateC(g, value)}
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

        {/* Kategorien */}
        {selectedProject?.type !== 'open_door' && (
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-medium">Kategorien</label>
              {canCreateOwnCategories ? (
                <button
                  type="button"
                  onClick={() => setCategoryCreateOpen(true)}
                  className={addActionButtonClassName}
                >
                  <PlusIcon className="h-4 w-4" />
                  Hinzufügen
                </button>
              ) : null}
            </div>
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
                    className="px-2 py-1 rounded-full text-xs border"
                    style={getSelectableTaxonomyChipStyle(active, c.color)}
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
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="block text-sm font-medium">Tags</label>
            {canCreateOwnTags ? (
              <button
                type="button"
                onClick={() => setTagCreateOpen(true)}
                className={addActionButtonClassName}
              >
                <PlusIcon className="h-4 w-4" />
                Hinzufügen
              </button>
            ) : null}
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

        {/* Staff */}
        {employeeStaff.length > 0 && (
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="block text-sm font-medium">Mitarbeitende</label>
            {canManageStaff ? (
              <button
                type="button"
                onClick={() => setStaffCreateState({ open: true, role: 'employee' })}
                className={addActionButtonClassName}
              >
                <PlusIcon className="h-4 w-4" />
                Hinzufügen
              </button>
            ) : null}
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
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="block text-sm font-medium">Ehrenamtliche</label>
            {canManageStaff ? (
              <button
                type="button"
                onClick={() => setStaffCreateState({ open: true, role: 'volunteer' })}
                className={addActionButtonClassName}
              >
                <PlusIcon className="h-4 w-4" />
                Hinzufügen
              </button>
            ) : null}
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
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="block text-sm font-medium">Helfer</label>
            {canManageStaff ? (
              <button
                type="button"
                onClick={() => setStaffCreateState({ open: true, role: 'helper' })}
                className={addActionButtonClassName}
              >
                <PlusIcon className="h-4 w-4" />
                Hinzufügen
              </button>
            ) : null}
          </div>
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
              className="danger-icon-button p-2"
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
              onClick={handleSave}
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

      {tagCreateOpen ? (
        <TagFormModal
          initial={{ color: TAG_PALETTE[0] }}
          onCancel={() => setTagCreateOpen(false)}
          onSubmit={handleTagCreate}
        />
      ) : null}

      {categoryCreateOpen ? (
        <CategoryFormModal
          initial={{ color: FIXED_PALETTE[0] }}
          onCancel={() => setCategoryCreateOpen(false)}
          onSubmit={handleCategoryCreate}
        />
      ) : null}

      {staffCreateState.open ? (
        <StaffFormModal
          initial={{ roles: [staffCreateState.role] }}
          onCancel={() => setStaffCreateState((current) => ({ ...current, open: false }))}
          onSubmit={handleStaffCreate}
        />
      ) : null}

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
                navigate(returnTo, { replace: true });
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
