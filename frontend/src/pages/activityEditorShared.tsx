import type { Activity } from '@/lib/activities';
import type { ActivityExecutionStatus } from '@/lib/activityExecutionStatus';
import type { Project } from '@/lib/projects';
import type { StaffMember, StaffRole } from '@/lib/staff';
import type { Tag } from '@/lib/taxonomy';

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
  cohortCounts?: Record<string, { m: number; w: number; d: number }>;
};

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

export function getWeekdayLabel(value?: string): string {
  const isoDate = (value || '').slice(0, 10);
  if (!isoDate) return '';

  const [year, month, day] = isoDate.split('-').map((part) => Number(part));
  if (!year || !month || !day) return '';

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(date);
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

function hasStaffRole(member: StaffMember, roles: StaffRole[]) {
  if (Array.isArray(member.roles)) {
    return roles.some((role) => member.roles?.includes(role));
  }

  return typeof member.role === 'string' ? roles.includes(member.role) : false;
}

export function getStaffGroupMembers(
  staff: StaffMember[] | undefined,
  group: 'employee' | 'volunteer' | 'helper',
): StaffMember[] {
  const rolesByGroup: Record<typeof group, StaffRole[]> = {
    employee: ['lead', 'employee'],
    volunteer: ['volunteer'],
    helper: ['helper'],
  };

  return (staff || []).filter((member) => hasStaffRole(member, rolesByGroup[group]));
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

  const categoryIds = new Set<string>();
  (project.categories || []).forEach((category) => categoryIds.add(category.id));
  if (project.categoryId) categoryIds.add(project.categoryId);
  return Array.from(categoryIds);
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

  const byName = new Map((staff || []).map((member) => [member.name, member.id] as const));
  const ids = new Set(existingStaffIds || []);
  defaultNames.forEach((name) => {
    const id = byName.get(name);
    if (id) ids.add(id);
  });
  return Array.from(ids);
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

export function getActivityFormStateFromActivity(
  activity: Activity,
  fallback?: { date?: string; projectId?: string; start?: string; end?: string },
): ActivityFormState {
  return {
    date: (activity.date || fallback?.date || '').slice(0, 10) || undefined,
    projectId: activity.projectId || activity.project?.id || fallback?.projectId || undefined,
    locationId: activity.locationId || activity.location?.id || undefined,
    start: activity.startTime || fallback?.start || undefined,
    end: activity.endTime || fallback?.end || undefined,
    executionStatus: activity.executionStatus || undefined,
    title: activity.title || undefined,
    categoryIds: (activity.categories || []).map((category) => category.id),
    tagIds: (activity.tags || []).map((tag) => tag.id),
    notes: activity.notes || undefined,
    staffIds: (activity.staff || []).map((member) => member.id),
    cohortCounts: getActivityCohortCounts(activity),
  };
}

export function buildActivitySavePayload({
  form,
  selectedProject,
  fallbackDate,
  fallbackType,
  durationMinutesOverride,
}: {
  form: ActivityFormState;
  selectedProject?: Project;
  fallbackDate?: string;
  fallbackType?: Activity['type'];
  durationMinutesOverride?: number | null;
}): Partial<Activity> & Record<string, unknown> {
  const cohortSums = getCohortSums(form.cohortCounts);
  const startMinutes = toMinutes(form.start || selectedProject?.defaultStartTime || null);
  const endMinutes = toMinutes(form.end || selectedProject?.defaultEndTime || null);
  const computedDurationMinutes =
    startMinutes !== undefined && endMinutes !== undefined && endMinutes >= startMinutes
      ? endMinutes - startMinutes
      : undefined;
  const durationMinutes = durationMinutesOverride ?? computedDurationMinutes;
  const isOpenDoor = selectedProject?.type === 'open_door';

  return {
    date: (form.date || fallbackDate || '').slice(0, 10),
    startTime: form.start || null,
    endTime: form.end || null,
    executionStatus: form.executionStatus,
    type: (selectedProject?.type as Activity['type'] | undefined) || fallbackType || 'project_open',
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
    cohorts: Object.entries(form.cohortCounts || {}).map(([cohortId, genderCounts]) => ({
      cohortId,
      m: genderCounts.m || 0,
      w: genderCounts.w || 0,
      d: genderCounts.d || 0,
    })),
  };
}

function toMinutes(hhmm?: string | null): number | undefined {
  if (!hhmm) return undefined;

  const [hh, mm] = hhmm.split(':').map((value) => parseInt(value, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return undefined;
  return hh * 60 + mm;
}