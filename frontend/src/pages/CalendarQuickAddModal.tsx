import { Project, useProjects } from '@/lib/projects';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  Save as SaveIcon,
  X as XIcon,
  Boxes,
  Plus as PlusIcon,
  Trash2 as TrashIcon,
} from 'lucide-react';
import ActivityExecutionStatusControl from '@/components/ActivityExecutionStatusControl';
import ProjectPickerModal from './ProjectPickerModal';
import { useCreateStaff, useStaff } from '@/lib/staff';
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
import { useAuth } from '@/lib/auth';
import { useActivityInlineCreation } from './useActivityInlineCreation';
import { useKeyboardOpen } from '@/lib/useKeyboardOpen';
import { useFocusedFieldVisibility } from '@/lib/useFocusedFieldVisibility';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/i18n/formatters';
import {
  type ActivityFormState,
  buildActivitySavePayload,
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
import { autoT } from '@/i18n/auto';
import { Button } from '@/components/ui/Button';
import { EditorActions } from '@/components/ui/EditorFrame';
import ActivityTitleField from '@/components/ActivityTitleField';
import { useUnsavedChangesGuard } from '@/lib/useUnsavedChangesGuard';
import { getTimeRangeValidationIssue } from '@/lib/timeRange';
import { useModalHistory } from '@/components/Modal';

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
  const { t } = useTranslation('activities');
  // This modal mounts only while open – lock body scroll while mounted
  useBodyScrollLock(true);
  const keyboardOpen = useKeyboardOpen();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const handlePanelFocus = useFocusedFieldVisibility(panelRef, keyboardOpen);
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
  const { discardDialog, requestDiscard, reset } = useUnsavedChangesGuard(form);
  const initialFormBaselineSetRef = useRef(false);
  const selectedProject: Project | undefined = useMemo(
    () => (projects || []).find((p: Project) => p.id === form.projectId) || initialProject,
    [projects, form.projectId, initialProject],
  );
  const selectedDateWeekday = useMemo(() => getWeekdayLabel(form.date), [form.date]);
  const cohortSums = useMemo(() => getCohortSums(form.cohortCounts), [form.cohortCounts]);
  const cohortTotal = cohortSums.m + cohortSums.w + cohortSums.d;
  const timeRangeIssue = getTimeRangeValidationIssue(form.start, form.end);
  const timeRangeError = timeRangeIssue
    ? t(
        timeRangeIssue === 'incomplete'
          ? 'quickAdd.timeRangeIncomplete'
          : 'quickAdd.timeRangeOrder',
      )
    : undefined;
  const employeeStaff = useMemo(() => getStaffGroupMembers(staff, 'employee'), [staff]);
  const volunteerStaff = useMemo(() => getStaffGroupMembers(staff, 'volunteer'), [staff]);
  const helperStaff = useMemo(() => getStaffGroupMembers(staff, 'helper'), [staff]);
  const activityInlineCreation = useActivityInlineCreation({
    allCategories,
    allTags,
    allStaff,
    taxonomyAccess,
    user,
    setForm,
    showToast,
    createCategory,
    updateCategory,
    createTag,
    updateTag,
    createStaff,
  });
  const {
    addActionButtonClassName,
    canCreateOwnCategories,
    canCreateOwnTags,
    canManageStaff,
    openCategoryCreate,
    openTagCreate,
    openStaffCreate,
  } = activityInlineCreation;

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, []);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('hidden') && element.getClientRects().length > 0);
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

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
        executionStatus:
          activity.executionStatus || f.executionStatus || DEFAULT_ACTIVITY_EXECUTION_STATUS,
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

  // Project defaults and the edit payload are populated asynchronously. They
  // define the initial state of this editor and must not trigger a discard
  // confirmation before the user has changed anything.
  const initialFormReady = Boolean(projects && locations && tags && categories && staff);
  useEffect(() => {
    if (!initialFormReady || initialFormBaselineSetRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (initialFormBaselineSetRef.current) return;
      reset(form);
      initialFormBaselineSetRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [categories, form, initialFormReady, locations, projects, reset, staff, tags]);

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
    requestDiscard(onClose);
  };
  const dismiss = useModalHistory(handleClose);

  const handleSave = () => {
    if (create.isPending || update.isPending || submitLockedRef.current) return;

    if (!form.date) {
      setErrorOpen(t('quickAdd.chooseDate'));
      return;
    }
    if (!form.projectId) {
      setErrorOpen(t('quickAdd.chooseProject'));
      return;
    }
    if (timeRangeError) {
      setErrorOpen(timeRangeError);
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
          showToast(t('quickAdd.saved'));
          onClose();
        },
        onError: (error: unknown) => {
          console.error(error);
          setErrorOpen(t('quickAdd.saveFailed'));
        },
      });

    const doUpdate = () =>
      update.mutate(
        { id: activity!.id, data: payloadBase },
        {
          onSuccess: () => {
            showToast(t('quickAdd.updated'));
            onClose();
          },
          onError: (error: unknown) => {
            console.error(error);
            setErrorOpen(t('quickAdd.saveFailed'));
          },
        },
      );

    if (activity) doUpdate();
    else doCreate();
  };

  useEffect(() => {
    if (!create.isPending && !update.isPending) submitLockedRef.current = false;
  }, [create.isPending, update.isPending]);

  useEditorShortcuts({
    onClose: handleClose,
    onSave:
      create.isPending ||
      update.isPending ||
      picker ||
      Boolean(errorOpen) ||
      deleteOpen ||
      Boolean(timeRangeError)
        ? undefined
        : handleSave,
  });

  const content = (
    <div
      className="visual-viewport-fixed z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6 modal-overlay"
      onWheel={(e) => e.stopPropagation()}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-editor-title"
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        onFocusCapture={handlePanelFocus}
        className={`modal-panel-roomy bg-white w-full md:max-w-3xl lg:max-w-5xl rounded-t-2xl md:rounded-2xl px-3 sm:px-4 md:px-6 bottom-sheet-animate flex flex-col ${keyboardOpen ? 'overflow-y-auto' : 'overflow-hidden'}`}
      >
        <div className="editor-modal-header shrink-0 -mx-3 sm:-mx-4 md:-mx-6 flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-3 pb-3 pt-4 sm:px-4 md:pt-6">
          <h2 id="activity-editor-title" className="text-2xl font-bold text-viridian">
            {t('quickAdd.title', {
              date: formatDate(form.date || dateISO, { dateStyle: 'short' }),
            })}
          </h2>
          <div className="flex items-center gap-2">
            <ActivityExecutionStatusControl
              value={form.executionStatus}
              onChange={(executionStatus) =>
                setForm((current) => ({ ...current, executionStatus }))
              }
            />
            <button
              type="button"
              onClick={dismiss}
              className="modal-close-button hidden h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] md:inline-flex"
              title={t('quickAdd.close')}
              aria-label={t('quickAdd.close')}
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div
          className={
            keyboardOpen
              ? 'flex-none overflow-visible pb-2 pt-2'
              : 'activity-editor-scroll min-h-0 flex-1 overflow-y-auto pb-4 pt-3 md:pb-6 md:pt-4'
          }
        >
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:items-start">
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 flex items-baseline gap-2">
                    <label className="block text-sm font-medium" htmlFor="activity-date">
                      {t('quickAdd.date')}
                    </label>
                    {selectedDateWeekday && (
                      <span className="text-xs font-normal text-gray-500 whitespace-nowrap">
                        · {selectedDateWeekday}
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
                    className="editor-field w-full border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="location-select">
                    {t('quickAdd.location')}
                  </label>
                  <select
                    id="location-select"
                    value={form.locationId || ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setForm({ ...form, locationId: e.target.value || undefined })
                    }
                    className="editor-field w-full border px-3 py-2"
                  >
                    <option value="">{t('quickAdd.selectLocation')}</option>
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
                  {t('quickAdd.titleField')}
                </label>
                <ActivityTitleField
                  id="activity-title"
                  value={form.title || ''}
                  onValueChange={(title) => setForm({ ...form, title })}
                  className="editor-field w-full border px-3 py-2"
                  placeholder={t('quickAdd.titlePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('quickAdd.project')}</label>
                {selectedProject ? (
                  <button
                    type="button"
                    onClick={() => setPicker(true)}
                    className="editor-field w-full border p-2 flex items-center gap-3 text-left"
                  >
                    <div
                      className="w-12 h-10 rounded overflow-hidden flex items-center justify-center"
                      style={
                        selectedProject.imageUrl
                          ? undefined
                          : {
                              backgroundColor:
                                selectedProject.color || 'var(--interactive-soft-strong)',
                            }
                      }
                    >
                      {selectedProject.imageUrl ? (
                        <ProtectedImage
                          src={selectedProject.imageUrl}
                          alt={selectedProject.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Boxes className="w-6 h-6 text-white/90" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-viridian">{selectedProject.title}</div>
                      <div className="text-xs text-gray-600">
                        {selectedProject.targetGroup || '—'}
                      </div>
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPicker(true)}
                    className="editor-field w-full border p-3 text-left text-gray-600"
                  >
                    {t('quickAdd.selectProject')}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="start-time">
                    {t('quickAdd.start')}
                  </label>
                  <input
                    id="start-time"
                    type="time"
                    value={form.start || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setForm({ ...form, start: e.target.value })
                    }
                    aria-invalid={Boolean(timeRangeError)}
                    aria-describedby={timeRangeError ? 'activity-time-range-error' : undefined}
                    className={`editor-field w-full border px-3 py-2 ${timeRangeError ? 'border-red-500' : ''}`}
                    placeholder={autoT('ui_a4c7ee9ba5c9')}
                    title={t('quickAdd.start')}
                  />
                </div>
                <div>
                  <label htmlFor="end-time" className="block text-sm font-medium mb-1">
                    {t('quickAdd.end')}
                  </label>
                  <input
                    id="end-time"
                    type="time"
                    value={form.end || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setForm({ ...form, end: e.target.value })
                    }
                    aria-invalid={Boolean(timeRangeError)}
                    aria-describedby={timeRangeError ? 'activity-time-range-error' : undefined}
                    className={`editor-field w-full border px-3 py-2 ${timeRangeError ? 'border-red-500' : ''}`}
                    placeholder={autoT('ui_a4c7ee9ba5c9')}
                    title={t('quickAdd.end')}
                  />
                </div>
              </div>
              {timeRangeError ? (
                <p id="activity-time-range-error" className="-mt-2 text-sm text-red-700">
                  {timeRangeError}
                </p>
              ) : null}
              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium">{t('quickAdd.ageCohorts')}</label>
                  {isMobile && (
                    <Toggle
                      checked={tapModeEnabled}
                      onChange={setTapModePreferred}
                      ariaLabel={t('quickAdd.tapMode')}
                      label={<ActivityTapModeIcon />}
                      className="shrink-0 gap-1 flex-row-reverse"
                    />
                  )}
                </div>
                {tapModeEnabled && (
                  <div className="mb-2 text-[11px] text-gray-500">{t('quickAdd.tapHelp')}</div>
                )}
                <div className="space-y-2">
                  <div className="activity-cohort-grid">
                    <span className="text-xs text-gray-500" />
                    <span
                      className="activity-cohort-column-icon"
                      title={t('quickAdd.male')}
                      aria-label={t('quickAdd.male')}
                    >
                      {autoT('ui_6b0d31c0d563')}
                    </span>
                    <span
                      className="activity-cohort-column-icon"
                      title={t('quickAdd.female')}
                      aria-label={t('quickAdd.female')}
                    >
                      {autoT('ui_aff024fe4ab0')}
                    </span>
                    <span
                      className="activity-cohort-column-icon"
                      title={t('quickAdd.diverse')}
                      aria-label={t('quickAdd.diverse')}
                    >
                      {autoT('ui_3c363836cf4e')}
                    </span>
                    <span
                      className="text-xs text-gray-600 font-medium text-center"
                      title={t('quickAdd.total')}
                      aria-label={t('quickAdd.total')}
                    >
                      {autoT('ui_ccb9fecbb241')}
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
                    const normalizedCohortName = c.name
                      .toLocaleLowerCase()
                      .replace(/[–—-]/g, '-')
                      .replace(/\s+/g, ' ')
                      .trim();
                    const normalizedAgeLabel = ageLabel
                      .toLocaleLowerCase()
                      .replace(/[–—-]/g, '-')
                      .replace(/\s+/g, ' ')
                      .trim();
                    const showAgeLabel = Boolean(
                      ageLabel && normalizedAgeLabel !== normalizedCohortName,
                    );
                    return (
                      <div key={c.id} className="activity-cohort-grid">
                        <span className="min-w-0 text-sm text-gray-700 leading-tight">
                          <div className="break-words">{c.name}</div>
                          {showAgeLabel && (
                            <div className="text-[11px] text-gray-500 leading-tight">
                              {ageLabel}
                            </div>
                          )}
                        </span>
                        {(['m', 'w', 'd'] as const).map((g) => (
                          <ActivityCohortCountField
                            key={g}
                            mode={tapModeEnabled ? 'tap' : 'input'}
                            value={entry[g] || 0}
                            onChange={(value) => update(g, value)}
                            onKeyDown={
                              tapModeEnabled ? undefined : (e) => handleKeyDown(e, rowIndex, g)
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
                  <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label className="block text-sm font-medium">{t('filters.categories')}</label>
                    {canCreateOwnCategories ? (
                      <button
                        type="button"
                        onClick={openCategoryCreate}
                        className={addActionButtonClassName}
                      >
                        <PlusIcon className="h-4 w-4" />
                        {t('quickAdd.add')}
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
                          className="min-h-8 px-2 py-1 rounded-full text-xs border"
                          style={getSelectableTaxonomyChipStyle(active, c.color)}
                          aria-pressed={active}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                    {(categories || []).length === 0 && (
                      <span className="text-xs text-gray-400">{t('quickAdd.noCategories')}</span>
                    )}
                  </div>
                </div>
              )}
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <label className="block text-sm font-medium">{t('filters.tags')}</label>
                  {canCreateOwnTags ? (
                    <button
                      type="button"
                      onClick={openTagCreate}
                      className={addActionButtonClassName}
                    >
                      <PlusIcon className="h-4 w-4" />
                      {t('quickAdd.add')}
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
                        className="min-h-8 px-2 py-1 rounded-full text-xs border"
                        style={getSelectableTaxonomyChipStyle(active, t.color)}
                        aria-pressed={Boolean(active)}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              {employeeStaff.length > 0 && (
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label className="block text-sm font-medium">{t('filters.staff')}</label>
                    {canManageStaff ? (
                      <button
                        type="button"
                        onClick={() => openStaffCreate('employee')}
                        className={addActionButtonClassName}
                      >
                        <PlusIcon className="h-4 w-4" />
                        {t('quickAdd.add')}
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
                          className={`min-h-8 px-2 py-1 rounded-full text-xs border ${
                            active ? 'bg-viridian text-white' : 'bg-white text-gray-700'
                          }`}
                          aria-pressed={Boolean(active)}
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
                  <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label className="block text-sm font-medium">{autoT('ui_4ac524334f49')}</label>
                    {canManageStaff ? (
                      <button
                        type="button"
                        onClick={() => openStaffCreate('volunteer')}
                        className={addActionButtonClassName}
                      >
                        <PlusIcon className="h-4 w-4" />
                        {t('quickAdd.add')}
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
                          className={`min-h-8 px-2 py-1 rounded-full text-xs border ${
                            active ? 'bg-cambridge-blue text-white' : 'bg-white text-gray-700'
                          }`}
                          aria-pressed={Boolean(active)}
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
                  <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label className="block text-sm font-medium">{autoT('ui_01bfae305e69')}</label>
                    {canManageStaff ? (
                      <button
                        type="button"
                        onClick={() => openStaffCreate('helper')}
                        className={addActionButtonClassName}
                      >
                        <PlusIcon className="h-4 w-4" />
                        {t('quickAdd.add')}
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
                          className={`min-h-8 px-2 py-1 rounded-full text-xs border ${
                            active
                              ? 'bg-amber-400 text-amber-950'
                              : 'bg-[var(--surface-1)] text-[var(--text-primary)]'
                          }`}
                          aria-pressed={Boolean(active)}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">{t('quickAdd.notes')}</label>
                <textarea
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={4}
                  className="editor-field w-full border px-3 py-2"
                  placeholder={t('quickAdd.notesPlaceholder')}
                  aria-label={t('quickAdd.notes')}
                />
              </div>
            </div>
          </div>
        </div>

        <EditorActions
          className={`-mx-3 px-3 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6 ${keyboardOpen ? '' : 'pb-safe'}`}
          leading={
            activity ? (
              <Button variant="danger" size="lg" onClick={() => setDeleteOpen(true)}>
                <TrashIcon className="h-4 w-4" />
                {t('quickAdd.delete')}
              </Button>
            ) : undefined
          }
          secondary={
            <Button variant="secondary" size="lg" onClick={dismiss}>
              {t('quickAdd.cancel')}
            </Button>
          }
          primary={
            <Button
              size="lg"
              onClick={handleSave}
              title={t('quickAdd.save')}
              aria-label={t('quickAdd.save')}
              disabled={
                create.isPending ||
                update.isPending ||
                picker ||
                deleteOpen ||
                Boolean(errorOpen) ||
                Boolean(timeRangeError)
              }
            >
              <SaveIcon className="h-4 w-4" />
              {t('quickAdd.save')}
            </Button>
          }
        />
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
        {activityInlineCreation.modals}
        <ConfirmModal
          open={Boolean(errorOpen)}
          title={t('quickAdd.error')}
          message={errorOpen || ''}
          onCancel={() => setErrorOpen(null)}
          onConfirm={() => setErrorOpen(null)}
          showCancel={false}
          confirmLabel={autoT('ui_9ce3bd4224c8')}
        />
        {activity && (
          <ConfirmModal
            open={deleteOpen}
            title={t('quickAdd.deleteTitle')}
            message={t('quickAdd.deleteMessage')}
            onCancel={() => setDeleteOpen(false)}
            onConfirm={() => {
              remove.mutate(activity.id, {
                onSuccess: () => {
                  showToast(t('quickAdd.deleted'));
                  setDeleteOpen(false);
                  onClose();
                },
                onError: (e: unknown) => {
                  console.error(e);
                  setDeleteOpen(false);
                  setErrorOpen(t('quickAdd.deleteFailed'));
                },
              });
            }}
            confirmLabel={t('quickAdd.delete')}
          />
        )}
      </div>
    </div>
  );
  return (
    <>
      {typeof document !== 'undefined' ? createPortal(content, document.body) : content}
      {discardDialog}
    </>
  );
}
