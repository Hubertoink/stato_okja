import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Activity } from '@/lib/activities';
import type { ActivityExecutionStatus } from '@/lib/activityExecutionStatus';
import type { Project } from '@/lib/projects';
import type { StaffMember, StaffRole } from '@/lib/staff';
import type { Tag } from '@/lib/taxonomy';

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

export function FieldInfoHint({ label, settingsTab }: { label: string; settingsTab: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-normal leading-none text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
        aria-label="Info"
      >
        i
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 top-full z-[81] mt-2 w-56 -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-lg space-y-2">
            <p>{label} können Sie in den Einstellungen anlegen und verwalten.</p>
            <Link
              to={`/settings?tab=${settingsTab}`}
              className="inline-flex items-center gap-1 text-viridian font-medium hover:underline"
              onClick={() => setOpen(false)}
            >
              Zu Einstellungen {'→'}
            </Link>
          </div>
        </>
      )}
    </span>
  );
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

export function toMinutes(hhmm?: string | null): number | undefined {
  if (!hhmm) return undefined;

  const [hh, mm] = hhmm.split(':').map((value) => parseInt(value, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return undefined;
  return hh * 60 + mm;
}