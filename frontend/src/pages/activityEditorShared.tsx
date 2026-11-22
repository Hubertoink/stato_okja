import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { mergeActivityCategoryDefaults, type ActivityCategoryMode } from '@/lib/activityCategories';
import { getTimeRangeValidationIssue } from '@/lib/timeRange';
import { resolveContributionTimes, type ContributionTime } from '@/lib/contributionTimes';
import type { Activity } from '@/lib/activities';
import {
  DEFAULT_ACTIVITY_EXECUTION_STATUS, activityStatusForDate, isPlannedActivity, isFutureActivityDate,
  type ActivityExecutionStatus,
} from '@/lib/activityExecutionStatus';
import type { Project } from '@/lib/projects';
import type { StaffMember, StaffRole } from '@/lib/staff';
import { getSelectableStaff } from '@/lib/staffSelection';
import type { Tag } from '@/lib/taxonomy';
import { formatDate } from '@/i18n/formatters';
import { activityFormMinutes, customStaffTimes } from '@/lib/staffTimes';

type NamedEntity = {
  id: string;
  name: string;
  active?: boolean | null;
};

export type GenderKey = 'm' | 'w' | 'd';

export type ActivityFormState = {
  date?: string;
  projectId?: string;
  locationId?: string;
  start?: string;
  end?: string;
  executionStatus?: ActivityExecutionStatus;
  title?: string;
  categoryIds?: string[];
  tagIds?: string[];
  notes?: string;
  staffIds?: string[];
  staffTimes?: Array<{ staffId: string; minutes: number }>;
  contributions?: ContributionTime[];
  cohortCounts?: Record<string, { m: number; w: number; d: number }>;
  // Existing records may store attendance totals without an age breakdown.
  // Keep these until someone explicitly changes or clears the attendance.
  recordedAttendance?: Record<GenderKey | 'total', number>;
};

/**
 * Returns the activity data in the form in which it is saved. This prevents
 * presentation-only differences (undefined vs. empty fields, selection order,
 * or zero-only cohort rows) from being treated as an unsaved edit.
 */
export function getActivityFormSnapshot(form: ActivityFormState): string {
  const normalizedIds = (ids: string[] | undefined) => Array.from(new Set(ids || [])).sort();
  const cohortCounts = Object.entries(form.cohortCounts || {})
    .map(([cohortId, counts]) => ({
      cohortId,
      m: counts.m || 0,
      w: counts.w || 0,
      d: counts.d || 0,
    }))
    .filter((counts) => counts.m !== 0 || counts.w !== 0 || counts.d !== 0)
    .sort((left, right) => left.cohortId.localeCompare(right.cohortId));

  return JSON.stringify({
    date: form.date || '',
    projectId: form.projectId || '',
    locationId: form.locationId || '',
    start: form.start || '',
    end: form.end || '',
    executionStatus: form.executionStatus || DEFAULT_ACTIVITY_EXECUTION_STATUS,
    title: form.title || '',
    categoryIds: normalizedIds(form.categoryIds),
    tagIds: normalizedIds(form.tagIds),
    notes: form.notes || '',
    staffIds: normalizedIds(form.staffIds),
    staffTimes: customStaffTimes(form.staffTimes, form.staffIds, activityFormMinutes(form)).sort((a, b) => a.staffId.localeCompare(b.staffId)),
    cohortCounts,
    attendance: getFormAttendance(form),
    contributions: resolveContributionTimes(form.contributions || [], activityFormMinutes(form)).sort((a, b) => a.contributorId.localeCompare(b.contributorId)),
  });
}

export function findNamedEntity<T extends NamedEntity>(items: T[] | undefined, name: string): T | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return (items || []).find((item) => item.name.trim().toLowerCase() === needle);
}

export function appendUniqueId(currentIds: string[] | undefined, id: string): string[] {
  const next = new Set(currentIds || []);
  next.add(id);
  return Array.from(next);
}

export function getWeekdayLabel(value?: string, includeDate = false): string {
  const isoDate = (value || '').slice(0, 10);
  if (!isoDate) return '';

  const [year, month, day] = isoDate.split('-').map((part) => Number(part));
  if (!year || !month || !day) return '';

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return '';

  return formatDate(date, { weekday: 'long', ...(includeDate ? { day: '2-digit', month: '2-digit', year: 'numeric' } as const : {}) });
}

export function getCohortSums(
  cohortCounts?: ActivityFormState['cohortCounts'],
): Record<GenderKey, number> {
  const sums: Record<GenderKey, number> = { m: 0, w: 0, d: 0 };

  Object.values(cohortCounts || {}).forEach((entry) => {
    sums.m += entry.m || 0;
    sums.w += entry.w || 0;
    sums.d += entry.d || 0;
  });

  return sums;
}

export function getFormAttendance(form: ActivityFormState) {
  if (form.recordedAttendance) return form.recordedAttendance;
  const sums = getCohortSums(form.cohortCounts);
  return { ...sums, total: sums.m + sums.w + sums.d };
}

export function setActivityCohortCount(form: ActivityFormState, id: string, gender: GenderKey, value: number): ActivityFormState {
  const entry = form.cohortCounts?.[id] ?? { m: 0, w: 0, d: 0 };
  if (entry[gender] === value) return form;
  return {
    ...form,
    recordedAttendance: undefined,
    cohortCounts: { ...form.cohortCounts, [id]: { ...entry, [gender]: value } },
  };
}

function hasStaffRole(member: StaffMember, roles: StaffRole[]) {
  if (Array.isArray(member.roles)) {
    return roles.some((role) => member.roles?.includes(role));
  }

  return typeof member.role === 'string' ? roles.includes(member.role) : false;
}

export function getStaffGroupMembers(
  staff: StaffMember[] | undefined,
  group: 'employee' | 'volunteer' | 'helper',
  selectedIds: readonly string[] = [],
): StaffMember[] {
  const rolesByGroup: Record<typeof group, StaffRole[]> = {
    employee: ['lead', 'employee'],
    volunteer: ['volunteer'],
    helper: ['helper'],
  };

  return getSelectableStaff(staff, selectedIds).filter((member) => hasStaffRole(member, rolesByGroup[group]));
}

export function getProjectTagIds(project: Project | undefined, tags: Tag[] | undefined): string[] {
  if (!project) return [];

  const names = (project.tag || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (names.length === 0) return [];

  const byName = new Map((tags || []).map((tag) => [tag.name, tag.id] as const));
  return Array.from(new Set(names.map((name) => byName.get(name)).filter(Boolean))) as string[];
}

export function getProjectCategoryIds(project: Project | undefined): string[] {
  if (!project || project.type === 'open_door') return [];

  // Projects always have one category; categoryId is authoritative. The
  // relation fallback supports older responses without collecting stale IDs.
  const categoryId = project.categoryId || project.categories?.[0]?.id;
  return categoryId ? [categoryId] : [];
}

export function mergeProjectStaffIds(
  existingStaffIds: string[] | undefined,
  project: Project | undefined,
  staff: StaffMember[] | undefined,
): string[] {
  if (!project) return existingStaffIds || [];

  const defaultNames = [project.defaultStaff || '', project.defaultVolunteers || '']
    .join(',')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (defaultNames.length === 0) return existingStaffIds || [];

  const byName = new Map(getSelectableStaff(staff).map((member) => [member.name, member.id] as const));
  const ids = new Set(existingStaffIds || []);
  defaultNames.forEach((name) => {
    const id = byName.get(name);
    if (id) ids.add(id);
  });
  return Array.from(ids);
}

export function createActivityDraft(date: string, projectId?: string): ActivityFormState {
  return { date: date.slice(0, 10), projectId, cohortCounts: {}, executionStatus: activityStatusForDate(undefined, date) };
}

type ProjectDefaults = { tags?: Tag[]; staff?: StaffMember[]; categoryMode?: ActivityCategoryMode };

export function applyActivityProjectDefaults(form: ActivityFormState, project: Project, { tags, staff, categoryMode }: ProjectDefaults): ActivityFormState {
  const switched = form.projectId !== project.id;
  const patch: Partial<ActivityFormState> = {};
  if (switched) patch.projectId = project.id;
  if (form.start === undefined && project.defaultStartTime) patch.start = project.defaultStartTime;
  if (form.end === undefined && project.defaultEndTime) patch.end = project.defaultEndTime;
  // Undefined means the defaults haven't arrived. An empty selection is a deliberate edit.
  if (tags && (form.tagIds === undefined || (switched && !form.tagIds.length))) {
    patch.tagIds = getProjectTagIds(project, tags);
  }
  if (staff && (form.staffIds === undefined || switched)) {
    patch.staffIds = mergeProjectStaffIds(form.staffIds, project, staff);
  }
  if (project.type === 'open_door') {
    if (form.categoryIds?.length) patch.categoryIds = [];
  } else if (categoryMode && (form.categoryIds === undefined || switched)) {
    patch.categoryIds = mergeActivityCategoryDefaults(form.categoryIds, getProjectCategoryIds(project), categoryMode);
  }
  return Object.keys(patch).length ? { ...form, ...patch } : form;
}

export function useNewActivityDefaults(
  setForm: Dispatch<SetStateAction<ActivityFormState>>,
  project: Project | undefined,
  { tags, staff, categoryMode }: ProjectDefaults,
  singleLocationId?: string,
) {
  useEffect(() => {
    if (!project && !singleLocationId) return;
    setForm(form => {
      const draft = project ? applyActivityProjectDefaults(form, project, { tags, staff, categoryMode }) : form;
      return draft.locationId === undefined && singleLocationId ? { ...draft, locationId: singleLocationId } : draft;
    });
  }, [setForm, project, tags, staff, categoryMode, singleLocationId]);
}

export function getActivityEditorValidation(form: ActivityFormState, mode: ActivityCategoryMode, project?: Project) {
  const countsLocked = isPlannedActivity(form.executionStatus) || isFutureActivityDate(form.date);
  return {
    countsLocked,
    mustClearCounts: countsLocked && getFormAttendance(form).total > 0,
    tooManyCategories: mode === 'single' && (form.categoryIds?.length ?? 0) > 1 && project?.type !== 'open_door',
    timeRangeIssue: getTimeRangeValidationIssue(form.start, form.end, true),
  };
}

export function getActivityCohortCounts(
  activity: Pick<Activity, 'cohorts'> | null | undefined,
): NonNullable<ActivityFormState['cohortCounts']> {
  const cohortCounts: NonNullable<ActivityFormState['cohortCounts']> = {};

  if (!Array.isArray(activity?.cohorts)) return cohortCounts;

  for (const cohort of activity.cohorts) {
    const previous = cohortCounts[cohort.cohortId] || { m: 0, w: 0, d: 0 };
    cohortCounts[cohort.cohortId] = {
      m: previous.m + (cohort.m || 0),
      w: previous.w + (cohort.w || 0),
      d: previous.d + (cohort.d || 0),
    };
  }

  return cohortCounts;
}

export function getActivityFormStateFromActivity(activity: Activity): ActivityFormState {
  const cohortCounts = getActivityCohortCounts(activity);
  const sums = getCohortSums(cohortCounts);
  const m = activity.countMale ?? sums.m;
  const w = activity.countFemale ?? sums.w;
  const d = activity.countDiverse ?? sums.d;
  const start = activity.startTime || undefined;
  const end = activity.endTime || undefined;
  const duration = activity.durationMinutes ?? activityFormMinutes({ start, end });
  const staffIds = (activity.staff || []).map(member => member.id);
  return {
    date: (activity.date || '').slice(0, 10) || undefined,
    projectId: activity.projectId || activity.project?.id || undefined,
    locationId: activity.locationId || activity.location?.id || undefined,
    start,
    end,
    executionStatus: activityStatusForDate(activity.executionStatus, activity.date),
    title: activity.title || undefined,
    categoryIds: (activity.categories || []).map((category) => category.id),
    tagIds: (activity.tags || []).map((tag) => tag.id),
    notes: activity.notes || undefined,
    staffIds,
    staffTimes: customStaffTimes(activity.staffTimes ?? undefined, staffIds, duration),
    cohortCounts,
    recordedAttendance: { m, w, d, total: activity.countTotal ?? m + w + d },
    contributions: (activity.contributions || []).map(entry => ({ ...entry, automatic: entry.minutes === duration })),
  };
}

export function buildActivitySavePayload({
  form,
  selectedProject,
  fallbackDate,
  fallbackType,
  fallbackDurationMinutes,
}: {
  form: ActivityFormState;
  selectedProject?: Project;
  fallbackDate?: string;
  fallbackType?: Activity['type'];
  fallbackDurationMinutes?: number | null;
}): Partial<Activity> & Record<string, unknown> {
  const cohortSums = getCohortSums(form.cohortCounts);
  const durationMinutes = activityFormMinutes(form) ?? fallbackDurationMinutes ?? undefined;
  const type = selectedProject?.type ?? fallbackType ?? 'project_open';
  const date = (form.date || fallbackDate || '').slice(0, 10);
  return {
    date,
    startTime: form.start || null,
    endTime: form.end || null,
    executionStatus: activityStatusForDate(form.executionStatus, date),
    type: type as Activity['type'],
    projectId: form.projectId,
    ...(form.locationId !== undefined ? { locationId: form.locationId || null } : {}),
    title: form.title || null,
    notes: form.notes || null,
    categoryIds: type === 'open_door' ? [] : form.categoryIds || [],
    tagIds: form.tagIds || [],
    staffIds: form.staffIds || [],
    staffTimes: customStaffTimes(form.staffTimes, form.staffIds, durationMinutes),
    contributions: resolveContributionTimes(form.contributions || [], durationMinutes),
    durationMinutes,
    ...(form.recordedAttendance ? {} : {
      countMale: cohortSums.m,
      countFemale: cohortSums.w,
      countDiverse: cohortSums.d,
      countTotal: cohortSums.m + cohortSums.w + cohortSums.d,
      cohorts: Object.entries(form.cohortCounts || {}).map(([cohortId, genderCounts]) => ({
        cohortId,
        m: genderCounts.m || 0,
        w: genderCounts.w || 0,
        d: genderCounts.d || 0,
      })),
    }),
  };
}
