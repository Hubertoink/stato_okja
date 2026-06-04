import { Project, useProjects } from '@/lib/projects';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Save as SaveIcon, X as XIcon, Boxes, Plus as PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import ActivityExecutionStatusControl from '@/components/ActivityExecutionStatusControl';
import ProjectPickerModal from './ProjectPickerModal';
import { type StaffRole, useCreateStaff, useStaff } from '@/lib/staff';
import {
  useTags,
  useCohorts,
  useCategories,
  useCreateCategory,
  useCreateTag,
  useTaxonomyAccess,
  useUpdateCategory,
  useUpdateTag,
} from '@/lib/taxonomy';
import type { Activity } from '@/lib/activities';
import { useCreateActivity, useUpdateActivity, useRemoveActivity } from '@/lib/activities';
import ConfirmModal from '@/components/ConfirmModal';
import ProtectedImage from '@/components/ProtectedImage';
import ActivityCohortCountField from '@/components/ActivityCohortCountField';
import ActivityCohortTotalsRow from '@/components/ActivityCohortTotalsRow';
import ActivityTapModeIcon from '@/components/ActivityTapModeIcon';
import Toggle from '@/components/Toggle';
import { useLocations } from '@/lib/locations';
import { useToast } from '@/components/Toast';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { createPortal } from 'react-dom';
import { getSelectableTaxonomyChipStyle } from '@/lib/taxonomyChipStyles';
import { useActivityModalCountMode } from '@/lib/useActivityModalCountMode';
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
  getActivityCohortCounts,
  getActivityFormStateFromActivity,
  getCohortSums,
  type GenderKey,
  getProjectCategoryIds,
  getProjectTagIds,
  getStaffGroupMembers,
  getWeekdayLabel,
  mergeProjectStaffIds,
} from './activityEditorShared';

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
  const submitLockedRef = useRef(false);
  const { data: projects } = useProjects({ archived: false });
  const { data: staff } = useStaff({ active: true });
  const { data: allStaff } = useStaff();
  const { data: tags } = useTags({ active: true });
  const { data: allTags } = useTags();
  const { data: categories } = useCategories({ active: true });
  const { data: allCategories } = useCategories();
  const { data: cohorts } = useCohorts({ active: true });
  const { data: locations } = useLocations({ active: true });
  const { data: taxonomyAccess } = useTaxonomyAccess();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const createStaff = useCreateStaff();
  const [picker, setPicker] = useState(false);
  // mismatch confirm removed; totals derive from cohort columns now
  const [errorOpen, setErrorOpen] = useState<string | null>(null);
  const [tagCreateOpen, setTagCreateOpen] = useState(false);
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false);
  const [staffCreateState, setStaffCreateState] = useState<{ open: boolean; role: StaffRole }>({
    open: false,
    role: 'employee',
  });
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isMobile, tapModeEnabled, setTapModePreferred } = useActivityModalCountMode();
  const [form, setForm] = useState<ActivityFormState>(() => {
    return {
      cohortCounts: {},
      date: (dateISO || '').slice(0, 10),
      executionStatus: DEFAULT_ACTIVITY_EXECUTION_STATUS,
    };
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const selectedProject: Project | undefined = useMemo(
    () => (projects || []).find((p: Project) => p.id === form.projectId) || initialProject,
    [projects, form.projectId, initialProject],
  );
  const selectedDateWeekday = useMemo(() => getWeekdayLabel(form.date), [form.date]);
  const cohortSums = useMemo(() => getCohortSums(form.cohortCounts), [form.cohortCounts]);
  const cohortTotal = cohortSums.m + cohortSums.w + cohortSums.d;
  const employeeStaff = useMemo(() => getStaffGroupMembers(staff, 'employee'), [staff]);
  const volunteerStaff = useMemo(() => getStaffGroupMembers(staff, 'volunteer'), [staff]);
  const helperStaff = useMemo(() => getStaffGroupMembers(staff, 'helper'), [staff]);
  const canCreateOwnTags = Boolean(taxonomyAccess?.tags.canCreateOwn);
  const canCreateOwnCategories = Boolean(taxonomyAccess?.categories.canCreateOwn);
  const canManageStaff = Boolean(user && (user.role === 'superadmin' || user.role === 'org_admin'));
  const addActionButtonClassName =
    'inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-viridian hover:border-viridian/40';

  useEffect(() => {
    // Default times; if project provided, prefill from defaults
    setForm((f: ActivityFormState) => ({
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
    const ids = getProjectTagIds(proj, tags);
    if (ids.length > 0) setForm((f: ActivityFormState) => ({ ...f, tagIds: ids }));
  }, [selectedProject, initialProject, tags, activity]);
  // Prefill categories from project when creating (include primary categoryId)
  useEffect(() => {
    if (activity) return; // editing: don't override
    const proj = selectedProject || initialProject;
    if (!proj) return;
    if (proj.type === 'open_door') {
      // Ensure no categories for open-door
      setForm((f: ActivityFormState) => ({ ...f, categoryIds: [] }));
      return;
    }
    const cur = form.categoryIds || [];
    if (cur.length > 0) return; // already chosen
    const categoryIds = getProjectCategoryIds(proj);
    if (categoryIds.length > 0) setForm((f: ActivityFormState) => ({ ...f, categoryIds }));
  }, [selectedProject, initialProject, activity]);
  // If switching to an open-door project, clear categories
  useEffect(() => {
    const proj = selectedProject || initialProject;
    if (proj && proj.type === 'open_door') {
      setForm((f: ActivityFormState) => ({ ...f, categoryIds: [] }));
    }
  }, [selectedProject?.type, initialProject?.type]);
  useEffect(() => {
    // If there is exactly one location, auto-select it to reduce friction
    if ((locations || []).length === 1 && !form.locationId) {
      setForm((f: ActivityFormState) => ({ ...f, locationId: locations![0]?.id }));
    }
  }, [locations]);
  useEffect(() => {
    // Prefill for edit mode
    if (activity) {
      setForm((f: ActivityFormState) => ({
        ...f,
        ...getActivityFormStateFromActivity(activity, {
          date: f.date || dateISO,
          projectId: f.projectId || initialProject?.id,
          start: f.start || initialProject?.defaultStartTime || '15:00',
          end: f.end || initialProject?.defaultEndTime || '17:00',
        }),
        executionStatus: activity.executionStatus || f.executionStatus || DEFAULT_ACTIVITY_EXECUTION_STATUS,
        cohortCounts: (() => {
          const cohortCounts = getActivityCohortCounts(activity);
          return Object.keys(cohortCounts).length ? cohortCounts : f.cohortCounts;
        })(),
      }));
      return;
    }
    // Default times; if project provided, prefill from defaults
    setForm((f: ActivityFormState) => ({
      start: f.start || initialProject?.defaultStartTime || '15:00',
      end: f.end || initialProject?.defaultEndTime || '17:00',
      projectId: f.projectId || initialProject?.id,
      date: f.date || (dateISO || '').slice(0, 10),
      executionStatus: f.executionStatus || DEFAULT_ACTIVITY_EXECUTION_STATUS,
      ...f,
    }));
  }, [initialProject, activity]);

  // Prefill default staff/category from project if provided
  useEffect(() => {
    if (!initialProject) return;
    setForm((f: ActivityFormState) => {
      return { ...f, staffIds: mergeProjectStaffIds(f.staffIds, initialProject, staff) };
    });
  }, [initialProject, staff]);

  const create = useCreateActivity();
  const update = useUpdateActivity();
  const remove = useRemoveActivity();

  const handleClose = () => {
    if (picker) {
      setPicker(false);
      return;
    }
    if (errorOpen) {
      setErrorOpen(null);
      return;
    }
    if (deleteOpen) {
      setDeleteOpen(false);
      return;
    }
    onClose();
  };

  const handleSave = () => {
    if (create.isPending || update.isPending || submitLockedRef.current) return;

    if (!form.date) {
      setErrorOpen('Bitte ein Datum wählen.');
      return;
    }
    if (!form.projectId) {
      setErrorOpen('Bitte ein Projekt wählen.');
      return;
    }
    const payloadBase = buildActivitySavePayload({
      form: {
        ...form,
        executionStatus: form.executionStatus || DEFAULT_ACTIVITY_EXECUTION_STATUS,
      },
      selectedProject,
      fallbackDate: activity?.date || dateISO,
      fallbackType: activity?.type,
    });

    submitLockedRef.current = true;

    const doCreate = () =>
      create.mutate(payloadBase, {
        onSuccess: () => {
          showToast('Aktivität gespeichert');
          onClose();
        },
        onError: (error: unknown) => {
          console.error(error);
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
          onError: (error: unknown) => {
            console.error(error);
            setErrorOpen('Speichern fehlgeschlagen.');
          },
        },
      );

    if (activity) doUpdate();
    else doCreate();
  };

  useEffect(() => {
    if (!create.isPending && !update.isPending) submitLockedRef.current = false;
  }, [create.isPending, update.isPending]);

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

  useEditorShortcuts({
    onClose: handleClose,
    onSave:
      create.isPending || update.isPending || picker || Boolean(errorOpen) || deleteOpen
        ? undefined
        : handleSave,
  });

  const content = (
    <div
      className="fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6 modal-overlay"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="modal-panel-roomy bg-white w-full md:max-w-3xl lg:max-w-5xl rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-3 sm:px-4 md:px-6 bottom-sheet-animate flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-start justify-between gap-3 mb-2">
          <h3 className="text-xl font-semibold text-viridian">
            Aktivität am{' '}
            {(() => {
              const s = (form.date || dateISO || '').slice(0, 10);
              const [y, m, d] = s.split('-');
              return `${d}.${m}.${y}`;
            })()}
          </h3>
          <div className="flex items-center gap-2">
            <ActivityExecutionStatusControl
              value={form.executionStatus}
              onChange={(executionStatus) => setForm((current) => ({ ...current, executionStatus }))}
            />
            <button
              type="button"
              onClick={handleClose}
              className="hidden md:inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
              title="Schließen"
              aria-label="Schließen"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4 md:pb-6">
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:items-start">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                {(cohorts || []).map((c, rowIndex: number) => {
                  const entry = form.cohortCounts?.[c.id] || { m: 0, w: 0, d: 0 };
                  const rowTotal = (entry.m || 0) + (entry.w || 0) + (entry.d || 0);
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
                          onChange={(value) => update(g, value)}
                          onKeyDown={
                            tapModeEnabled
                              ? undefined
                              : (e) => handleKeyDown(e, rowIndex, g)
                          }
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
          </div>
          <div className="space-y-3">
            {(!selectedProject || selectedProject.type !== 'open_door') && (
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
            <div>
              <label className="block text-sm font-medium mb-1">Notizen</label>
              <textarea
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={4}
                className="w-full border rounded px-3 py-2"
                placeholder="Notizen zur Aktivität"
                aria-label="Notizen"
              />
            </div>
          </div>
        </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 flex items-center gap-3">
          <div className="flex-1 flex items-center">
            <button
              type="button"
              className="inline-flex md:hidden items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
              onClick={handleClose}
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
                className="danger-icon-button p-2"
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
              className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleSave}
              title="Speichern"
              aria-label="Speichern"
              disabled={create.isPending || update.isPending || picker || deleteOpen || Boolean(errorOpen)}
            >
              {activity ? <SaveIcon className="w-5 h-5" /> : <PlusIcon className="w-5 h-5" />}
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
                start: prev.start || p.defaultStartTime || '15:00',
                end: prev.end || p.defaultEndTime || '17:00',
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
