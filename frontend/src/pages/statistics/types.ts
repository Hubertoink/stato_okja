import type { Activity } from '@/lib/activities';
import type { ActivityExecutionStatus } from '@/lib/activityExecutionStatus';
import type { OrganizationClosureStateFilter } from '@/lib/orgs';
import type { WeeklyProfile } from '@/lib/weeklyProfile';

export type StatsOverviewResponse = {
  summary: {
    totalActivities: number;
    totalParticipants: number;
    totalMale: number;
    totalFemale: number;
    totalDiverse: number;
    totalDurationMinutes: number;
    totalHours: number;
    averageParticipants: number;
    closureDaysCount?: number;
  };
  byType: Array<{ type: string; count: number; totalParticipants: number }>;
  gender: { male: number; female: number; diverse: number };
  participantsTimeseries: Array<{
    date: string;
    totalParticipants: number;
    activityCount: number;
    totalDurationMinutes?: number;
  }>;
  byCohort: Array<{
    cohortId: string;
    name: string;
    total: number;
    male: number;
    female: number;
    diverse: number;
  }>;
  byCategory: Array<{ id: string; name: string; count: number }>;
  topTags: Array<{ id: string; name: string; count: number }>;
  topProjects: Array<{ id: string; name: string; count: number }>;
  availableYears: string[];
  weeklyProfile: WeeklyProfile;
};

export type StatisticsRealtimeOptions = {
  refetchOnWindowFocus?: boolean | 'always';
  refetchIntervalMs?: number;
};

export type StatisticsOverviewParams = {
  from?: string;
  to?: string;
  projectId?: string;
  type?: string;
  executionStatuses?: ActivityExecutionStatus[];
  closureState?: OrganizationClosureStateFilter;
  weekdays?: number[];
};

export type ActivitiesExportFormat = 'csv' | 'xlsx';

export type ControllingExportRow = Activity & {
  project?: { title?: string | null; type?: string | null } | null;
};

export type ActivityExportRow = {
  date: string;
  type: string;
  title: string;
  project: string;
  total: number;
  male: number;
  female: number;
  diverse: number;
  duration: number | '';
};
