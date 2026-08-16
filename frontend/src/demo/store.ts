import { DEMO_ORG_ID, DEMO_USER_ID, demoUser } from './config';
import type { Activity, PagedActivitiesResult } from '../lib/activities';
import type { AuditLog, AuditLogAction } from '../lib/audit';
import type { AuthUser } from '../lib/auth';
import type { Location } from '../lib/locations';
import type { OpeningHours, OrganizationClosureDay, OrgDto, OrgTaxonomySettingsSnapshot } from '../lib/orgs';
import type { ProjectTemplateDto } from '../lib/projectTemplatesApi';
import type { Project } from '../lib/projects';
import type { ProcessDefinition, ProcessDto, ProcessWriteData } from '../lib/processes';
import type { LogbookComment, LogbookEntry, LogbookEntryInput, LogbookEntryStatus, LogbookEntryType } from '../lib/logbook';
import type { StaffMember, StaffRole } from '../lib/staff';
import type { ActiveSurveyDashboardSummary, Survey, SurveyAnalytics, SurveyInput, SurveyQuestion, SurveyResponse, SurveyTrend } from '../lib/surveys';
import type { Category, Cohort, Tag } from '../lib/taxonomy';
import type { WeeklyProfile, WeeklyProfileDay, WeeklyProfileSlot } from '../lib/weeklyProfile';
import { getCurrentIntlLocale } from '@/i18n/formatters';

type DemoActivityRecord = Omit<Activity, 'project' | 'location' | 'categories' | 'tags' | 'staff'> & {
  orgId: string;
  categoryIds: string[];
  tagIds: string[];
  staffIds: string[];
};

type DemoProject = Project & { orgId: string };
type DemoProjectTemplate = ProjectTemplateDto & { orgId: string | null };
type DemoLogbookEntry = LogbookEntry;
type DemoSurvey = Survey & { createdAt: string; updatedAt: string };

type DemoStore = {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  sequence: number;
  user: AuthUser;
  orgs: OrgDto[];
  categories: Category[];
  tags: Tag[];
  cohorts: Cohort[];
  locations: Location[];
  staff: StaffMember[];
  projects: DemoProject[];
  activities: DemoActivityRecord[];
  projectTemplates: DemoProjectTemplate[];
  openingHours: OpeningHours;
  closureDays: OrganizationClosureDay[];
  acks: Record<string, boolean>;
  auditLogs: AuditLog[];
  logbookEntries: DemoLogbookEntry[];
  surveys: DemoSurvey[];
  surveyResponses: Record<string, SurveyResponse[]>;
  processes: ProcessDto[];
};

type StatsOverviewResponse = {
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
    totalDurationMinutes: number;
  }>;
  byCohort: Array<{ cohortId: string; name: string; total: number; male: number; female: number; diverse: number }>;
  byCategory: Array<{ id: string; name: string; count: number }>;
  topTags: Array<{ id: string; name: string; count: number }>;
  topProjects: Array<{ id: string; name: string; count: number }>;
  availableYears: string[];
  weeklyProfile: WeeklyProfile;
};

type DemoQueryParams = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function parseDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1);
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => readStringList(entry));
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === 'number') return [String(value)];
  return [];
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function hashNumber(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickOne<T>(items: T[], seed: string): T {
  return items[hashNumber(seed) % items.length];
}

function durationMinutes(startTime?: string | null, endTime?: string | null): number | null {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return start !== undefined && end !== undefined && end >= start ? end - start : null;
}

function timeToMinutes(time?: string | null): number | undefined {
  if (!time) return undefined;
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
  return hours * 60 + minutes;
}

function activityType(value: unknown): Activity['type'] {
  return value === 'open_door' ||
    value === 'project_open' ||
    value === 'project_closed' ||
    value === 'event' ||
    value === 'outreach'
    ? value
    : 'project_open';
}

function status(value: unknown): Activity['executionStatus'] {
  return value === 'cancelled' ? 'cancelled' : 'completed';
}

function createDemoImage(label: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720"><rect width="1200" height="720" fill="${color}"/><circle cx="1000" cy="120" r="260" fill="rgba(255,255,255,.18)"/><circle cx="170" cy="620" r="220" fill="rgba(255,255,255,.16)"/><text x="80" y="390" font-family="Inter, Arial, sans-serif" font-size="76" font-weight="800" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function categorySeed(): Category[] {
  return [
    { id: 'cat-open', name: 'Offene Arbeit', color: '#2563eb', active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'cat-culture', name: 'Kultur & Kreatives', color: '#ec4899', active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'cat-sports', name: 'Sport & Bewegung', color: '#10b981', active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'cat-media', name: 'Medienbildung', color: '#8b5cf6', active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'cat-advice', name: 'Beratung', color: '#f59e0b', active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'cat-outreach', name: 'Aufsuchende Arbeit', color: '#14b8a6', active: true, orgId: DEMO_ORG_ID, canManage: true },
  ];
}

function tagSeed(): Tag[] {
  return [
    { id: 'tag-holiday', name: 'Ferienprogramm', color: '#1d4ed8', active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'tag-dropin', name: 'Drop-in', color: '#059669', active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'tag-girls', name: 'Maedchenarbeit', color: '#be185d', active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'tag-digital', name: 'Digital', color: '#7c3aed', active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'tag-food', name: 'Kochen', color: '#c2410c', active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'tag-school', name: 'Schulkooperation', color: '#0284c7', active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'tag-team', name: 'Teamangebot', color: '#475569', active: true, orgId: DEMO_ORG_ID, canManage: true },
  ];
}

function cohortSeed(): Cohort[] {
  return [
    { id: 'cohort-6-10', name: '6-10 Jahre', minAge: 6, maxAge: 10, sortOrder: 10, active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'cohort-11-13', name: '11-13 Jahre', minAge: 11, maxAge: 13, sortOrder: 20, active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'cohort-14-17', name: '14-17 Jahre', minAge: 14, maxAge: 17, sortOrder: 30, active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'cohort-18-21', name: '18-21 Jahre', minAge: 18, maxAge: 21, sortOrder: 40, active: true, orgId: DEMO_ORG_ID, canManage: true },
    { id: 'cohort-22-27', name: '22-27 Jahre', minAge: 22, maxAge: 27, sortOrder: 50, active: true, orgId: DEMO_ORG_ID, canManage: true },
  ];
}

function locationSeed(): Location[] {
  return [
    { id: 'loc-house', name: 'Jugendhaus Mitte', address: 'Marktplatz 4', roomType: 'Offener Bereich', active: true },
    { id: 'loc-workshop', name: 'Werkraum', address: 'Marktplatz 4', roomType: 'Kreativraum', active: true },
    { id: 'loc-sports', name: 'Sporthalle Nord', address: 'Schulstrasse 18', roomType: 'Sport', active: true },
    { id: 'loc-park', name: 'Stadtpark', address: 'Parkallee', roomType: 'Outdoor', active: true },
    { id: 'loc-mobile', name: 'Mobiler Treff', address: 'wechselnd', roomType: 'Aufsuchend', active: true },
  ];
}

function staffSeed(): StaffMember[] {
  return [
    { id: 'staff-mara', name: 'Mara Nguyen', email: 'mara.nguyen@example.org', role: 'lead', roles: ['lead'], active: true },
    { id: 'staff-jonas', name: 'Jonas Keller', email: 'jonas.keller@example.org', role: 'employee', roles: ['employee'], active: true },
    { id: 'staff-samira', name: 'Samira Yilmaz', email: 'samira.yilmaz@example.org', role: 'employee', roles: ['employee'], active: true },
    { id: 'staff-lea', name: 'Lea Sommer', email: 'lea.sommer@example.org', role: 'volunteer', roles: ['volunteer'], active: true },
    { id: 'staff-tom', name: 'Tom Becker', email: 'tom.becker@example.org', role: 'helper', roles: ['helper'], active: true },
    { id: 'staff-nora', name: 'Nora Stein', email: 'nora.stein@example.org', role: 'analyst', roles: ['analyst'], active: true },
  ];
}

function projectSeed(windowStart: string, windowEnd: string): DemoProject[] {
  return [
    {
      id: 'project-open-door',
      orgId: DEMO_ORG_ID,
      title: 'Offene Tuer im Jugendhaus',
      type: 'open_door',
      categoryId: null,
      categories: [],
      targetGroup: '12-21 Jahre',
      imageUrl: createDemoImage('Offene Tuer', '#2563eb'),
      imageSize: 42000,
      color: '#2563eb',
      dateFrom: windowStart,
      dateTo: windowEnd,
      defaultStartTime: '15:00',
      defaultEndTime: '19:00',
      defaultStaff: 'Mara Nguyen, Jonas Keller',
      defaultVolunteers: 'Lea Sommer',
      tag: 'Drop-in, Teamangebot',
      activityField: 'Offene Arbeit',
      description: 'Regelmaessiger Treffpunkt mit Spielen, Gespraechen, Snacks und spontanen Angeboten.',
      archived: false,
    },
    {
      id: 'project-creative-lab',
      orgId: DEMO_ORG_ID,
      title: 'Kreativwerkstatt',
      type: 'project_open',
      categoryId: 'cat-culture',
      categories: [{ id: 'cat-culture', name: 'Kultur & Kreatives', color: '#ec4899' }],
      targetGroup: '10-16 Jahre',
      imageUrl: createDemoImage('Kreativwerkstatt', '#ec4899'),
      imageSize: 43000,
      color: '#ec4899',
      dateFrom: windowStart,
      dateTo: windowEnd,
      defaultStartTime: '16:00',
      defaultEndTime: '18:00',
      defaultStaff: 'Samira Yilmaz',
      defaultVolunteers: 'Tom Becker',
      tag: 'Ferienprogramm, Kochen',
      activityField: 'Kulturpaedagogik',
      description: 'Werkeln, Basteln, Graffiti-Skizzen, Textil und kleine Ausstellungen.',
      archived: false,
    },
    {
      id: 'project-digital-club',
      orgId: DEMO_ORG_ID,
      title: 'Digital Club',
      type: 'project_closed',
      categoryId: 'cat-media',
      categories: [{ id: 'cat-media', name: 'Medienbildung', color: '#8b5cf6' }],
      targetGroup: '13-18 Jahre',
      imageUrl: createDemoImage('Digital Club', '#8b5cf6'),
      imageSize: 44000,
      color: '#8b5cf6',
      dateFrom: windowStart,
      dateTo: windowEnd,
      defaultStartTime: '17:00',
      defaultEndTime: '19:00',
      defaultStaff: 'Jonas Keller, Nora Stein',
      defaultVolunteers: '',
      tag: 'Digital, Schulkooperation',
      activityField: 'Medienbildung',
      description: 'Coding, Games, Medienkritik und kreative Technikprojekte in fester Gruppe.',
      archived: false,
    },
    {
      id: 'project-sports-night',
      orgId: DEMO_ORG_ID,
      title: 'Sports Night',
      type: 'project_open',
      categoryId: 'cat-sports',
      categories: [{ id: 'cat-sports', name: 'Sport & Bewegung', color: '#10b981' }],
      targetGroup: '12-20 Jahre',
      imageUrl: createDemoImage('Sports Night', '#10b981'),
      imageSize: 41000,
      color: '#10b981',
      dateFrom: windowStart,
      dateTo: windowEnd,
      defaultStartTime: '18:00',
      defaultEndTime: '20:00',
      defaultStaff: 'Mara Nguyen',
      defaultVolunteers: 'Lea Sommer, Tom Becker',
      tag: 'Teamangebot',
      activityField: 'Sport',
      description: 'Bewegung, Fair Play und niedrigschwellige Turnierformate.',
      archived: false,
    },
    {
      id: 'project-outreach',
      orgId: DEMO_ORG_ID,
      title: 'Streetwork Runde',
      type: 'outreach',
      categoryId: 'cat-outreach',
      categories: [{ id: 'cat-outreach', name: 'Aufsuchende Arbeit', color: '#14b8a6' }],
      targetGroup: '14-27 Jahre',
      imageUrl: createDemoImage('Streetwork', '#14b8a6'),
      imageSize: 39000,
      color: '#14b8a6',
      dateFrom: windowStart,
      dateTo: windowEnd,
      defaultStartTime: '19:00',
      defaultEndTime: '21:00',
      defaultStaff: 'Samira Yilmaz, Jonas Keller',
      defaultVolunteers: '',
      tag: 'Drop-in',
      activityField: 'Aufsuchende Arbeit',
      description: 'Kontakte im Sozialraum, Kurzberatung und Vermittlung ins Jugendhaus.',
      archived: false,
    },
    {
      id: 'project-community-event',
      orgId: DEMO_ORG_ID,
      title: 'Community Event',
      type: 'event',
      categoryId: 'cat-open',
      categories: [{ id: 'cat-open', name: 'Offene Arbeit', color: '#2563eb' }],
      targetGroup: 'alle Jugendlichen',
      imageUrl: createDemoImage('Community Event', '#f59e0b'),
      imageSize: 45000,
      color: '#f59e0b',
      dateFrom: windowStart,
      dateTo: windowEnd,
      defaultStartTime: '16:00',
      defaultEndTime: '21:00',
      defaultStaff: 'Mara Nguyen, Samira Yilmaz',
      defaultVolunteers: 'Lea Sommer, Tom Becker',
      tag: 'Ferienprogramm, Teamangebot',
      activityField: 'Veranstaltung',
      description: 'Monatliches Event mit Musik, Essen, Beteiligungsformaten und offenen Aktionen.',
      archived: false,
    },
  ];
}

function tagIdsFromProject(project: DemoProject, tags: Tag[]): string[] {
  const names = new Set(
    (project.tag || '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );
  return tags.filter((tag) => names.has(tag.name)).map((tag) => tag.id);
}

function staffIdsFromNames(names: string, staff: StaffMember[]): string[] {
  const wantedNames = new Set(
    names
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );
  return staff.filter((member) => wantedNames.has(member.name)).map((member) => member.id);
}

function splitParticipants(total: number, seed: string): Pick<Activity, 'countMale' | 'countFemale' | 'countDiverse' | 'countTotal'> {
  const diverse = hashNumber(`${seed}:d`) % 3 === 0 ? 1 : 0;
  const remaining = Math.max(0, total - diverse);
  const male = Math.floor(remaining * (42 + (hashNumber(`${seed}:m`) % 17)) / 100);
  const female = Math.max(0, remaining - male);
  return { countMale: male, countFemale: female, countDiverse: diverse, countTotal: total };
}

function cohortBreakdown(
  counts: Pick<Activity, 'countMale' | 'countFemale' | 'countDiverse'>,
  seed: string,
): NonNullable<Activity['cohorts']> {
  const cohortIds = ['cohort-11-13', 'cohort-14-17', 'cohort-18-21'];
  const firstWeight = 25 + (hashNumber(`${seed}:first`) % 20);
  const secondWeight = 35 + (hashNumber(`${seed}:second`) % 25);
  const weights = [firstWeight, secondWeight, Math.max(10, 100 - firstWeight - secondWeight)];
  const allocate = (value: number | undefined, index: number) => Math.floor(((value || 0) * weights[index]) / 100);
  const rows = cohortIds.map((cohortId, index) => ({
    cohortId,
    m: allocate(counts.countMale, index),
    w: allocate(counts.countFemale, index),
    d: allocate(counts.countDiverse, index),
  }));
  const totals = rows.reduce(
    (sum, row) => ({ m: sum.m + row.m, w: sum.w + row.w, d: sum.d + row.d }),
    { m: 0, w: 0, d: 0 },
  );
  rows[rows.length - 1].m += (counts.countMale || 0) - totals.m;
  rows[rows.length - 1].w += (counts.countFemale || 0) - totals.w;
  rows[rows.length - 1].d += (counts.countDiverse || 0) - totals.d;
  return rows.filter((row) => row.m + row.w + row.d > 0);
}

function makeActivity(
  id: string,
  date: string,
  project: DemoProject,
  options: {
    title?: string;
    locationId: string;
    total: number;
    startTime?: string | null;
    endTime?: string | null;
    tagIds?: string[];
    categoryIds?: string[];
    staffIds?: string[];
    cancelled?: boolean;
    notes?: string | null;
  },
  tags: Tag[],
  staff: StaffMember[],
): DemoActivityRecord {
  const startTime = options.startTime ?? project.defaultStartTime ?? null;
  const endTime = options.endTime ?? project.defaultEndTime ?? null;
  const executionStatus = options.cancelled ? 'cancelled' : 'completed';
  const counts = executionStatus === 'cancelled'
    ? { countMale: 0, countFemale: 0, countDiverse: 0, countTotal: 0 }
    : splitParticipants(options.total, `${id}:${date}`);
  return {
    id,
    orgId: DEMO_ORG_ID,
    date,
    startTime,
    endTime,
    durationMinutes: durationMinutes(startTime, endTime),
    executionStatus,
    type: activityType(project.type),
    locationId: options.locationId,
    projectId: project.id,
    title: options.title || project.title,
    notes: options.notes || null,
    categoryIds: options.categoryIds ?? (project.categoryId ? [project.categoryId] : []),
    tagIds: options.tagIds ?? tagIdsFromProject(project, tags),
    staffIds: options.staffIds ?? staffIdsFromNames(`${project.defaultStaff || ''},${project.defaultVolunteers || ''}`, staff),
    ...counts,
    cohorts: cohortBreakdown(counts, `${id}:${date}`),
  };
}

function activitySeed(
  windowStart: string,
  windowEnd: string,
  projects: DemoProject[],
  tags: Tag[],
  staff: StaffMember[],
): DemoActivityRecord[] {
  const activities: DemoActivityRecord[] = [];
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const start = parseDate(windowStart);
  const end = parseDate(windowEnd);

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const date = localIsoDate(cursor);
    const weekday = cursor.getDay();
    const dayOfMonth = cursor.getDate();
    const weekInMonth = Math.floor((dayOfMonth - 1) / 7) + 1;
    const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;

    if (weekday >= 1 && weekday <= 5) {
      activities.push(makeActivity(
        `act-open-${date}`,
        date,
        projectById.get('project-open-door')!,
        {
          locationId: 'loc-house',
          total: 18 + (hashNumber(`${date}:open`) % 34),
          cancelled: dayOfMonth === 24 && weekday === 5,
          notes: weekday === 5 ? 'Freitag mit Kuechenaktion und freiem Spiel.' : null,
        },
        tags,
        staff,
      ));
    }

    if (weekday === 2) {
      activities.push(makeActivity(
        `act-creative-${date}`,
        date,
        projectById.get('project-creative-lab')!,
        { locationId: 'loc-workshop', total: 8 + (hashNumber(`${date}:creative`) % 14) },
        tags,
        staff,
      ));
    }

    if (weekday === 3 && weekInMonth !== 5) {
      activities.push(makeActivity(
        `act-digital-${date}`,
        date,
        projectById.get('project-digital-club')!,
        { locationId: 'loc-house', total: 7 + (hashNumber(`${date}:digital`) % 11), cancelled: dayOfMonth === 17 },
        tags,
        staff,
      ));
    }

    if (weekday === 4) {
      activities.push(makeActivity(
        `act-sports-${date}`,
        date,
        projectById.get('project-sports-night')!,
        { locationId: 'loc-sports', total: 12 + (hashNumber(`${date}:sports`) % 20) },
        tags,
        staff,
      ));
    }

    if (weekday === 1 && weekInMonth % 2 === 0) {
      activities.push(makeActivity(
        `act-outreach-${date}`,
        date,
        projectById.get('project-outreach')!,
        { locationId: pickOne(['loc-park', 'loc-mobile'], date), total: 6 + (hashNumber(`${date}:outreach`) % 18) },
        tags,
        staff,
      ));
    }

    if (weekday === 5 && dayOfMonth <= 7) {
      activities.push(makeActivity(
        `act-event-${monthKey}`,
        date,
        projectById.get('project-community-event')!,
        {
          title: `Community Event ${cursor.toLocaleDateString(getCurrentIntlLocale(), { month: 'long', year: 'numeric' })}`,
          locationId: 'loc-house',
          total: 35 + (hashNumber(`${monthKey}:event`) % 55),
        },
        tags,
        staff,
      ));
    }
  }

  return activities.sort(compareActivityRecordsDesc);
}

function closureDaySeed(windowStart: string, windowEnd: string): OrganizationClosureDay[] {
  const closures: OrganizationClosureDay[] = [];
  const start = parseDate(windowStart);
  const end = parseDate(windowEnd);
  for (let monthDate = start; monthDate <= end; monthDate = addMonths(monthDate, 4)) {
    const closure = new Date(monthDate.getFullYear(), monthDate.getMonth(), 15);
    if (closure >= start && closure <= end) closures.push({ date: localIsoDate(closure), from: null, to: null });
  }
  return closures;
}

function openingHoursSeed(): OpeningHours {
  return {
    monday: { open: true, from: '14:00', to: '20:00' },
    tuesday: { open: true, from: '14:00', to: '20:00' },
    wednesday: { open: true, from: '14:00', to: '20:00' },
    thursday: { open: true, from: '14:00', to: '20:00' },
    friday: { open: true, from: '14:00', to: '21:00' },
    saturday: { open: false, from: '10:00', to: '16:00' },
    sunday: { open: false, from: '10:00', to: '16:00' },
  };
}

function projectTemplateSeed(): DemoProjectTemplate[] {
  return [
    {
      id: 'template-cooking',
      title: 'Kochabend',
      type: 'project_open',
      targetGroup: '12-18 Jahre',
      description: 'Gemeinsam planen, einkaufen, kochen und essen.',
      categoryName: 'Kultur & Kreatives',
      categoryColor: '#ec4899',
      tags: 'Kochen:#c2410c,Teamangebot:#475569',
      imageUrl: createDemoImage('Kochabend', '#c2410c'),
      color: '#c2410c',
      archived: false,
      orgId: DEMO_ORG_ID,
      org: { id: DEMO_ORG_ID, name: 'Demo Jugendhaus' },
    },
    {
      id: 'template-holiday',
      title: 'Ferienaktion',
      type: 'event',
      targetGroup: '10-16 Jahre',
      description: 'Tagesaktion fuer Ferienzeiten mit offenem Zugang.',
      categoryName: 'Offene Arbeit',
      categoryColor: '#2563eb',
      tags: 'Ferienprogramm:#1d4ed8',
      imageUrl: createDemoImage('Ferienaktion', '#1d4ed8'),
      color: '#1d4ed8',
      archived: false,
      orgId: DEMO_ORG_ID,
      org: { id: DEMO_ORG_ID, name: 'Demo Jugendhaus' },
    },
  ];
}

function processSeed(now: Date): ProcessDto[] {
  const createdAt = now.toISOString();
  const definition = (nodes: ProcessDefinition['nodes'], edges: ProcessDefinition['edges']): ProcessDefinition => ({ schemaVersion: 1, nodes, edges });
  return [
    {
      id: 'demo-process-event',
      orgId: DEMO_ORG_ID,
      title: 'Veranstaltung planen',
      purpose: 'Von der ersten Idee bis zur gemeinsamen Auswertung einer Veranstaltung.',
      createdByUserId: DEMO_USER_ID,
      createdAt,
      updatedAt: createdAt,
      definition: definition([
        { id: 'event-input', type: 'input', position: { x: 40, y: 210 }, data: { label: 'Idee und Bedarf', description: 'Welches Anliegen oder welchen Bedarf greifen wir auf?', responsibleRole: 'Team' } },
        { id: 'event-plan', type: 'activity', position: { x: 330, y: 210 }, data: { label: 'Planung im Team', description: 'Zielgruppe, Termin, Raum und Ressourcen gemeinsam klären.', responsibleRole: 'Teamleitung' } },
        { id: 'event-decision', type: 'decision', position: { x: 620, y: 210 }, data: { label: 'Ist die Planung tragfähig?', description: 'Sind Ressourcen, Schutz und Beteiligung ausreichend berücksichtigt?' } },
        { id: 'event-branch', type: 'branch', position: { x: 910, y: 185 }, data: { label: 'Nächste Schritte' } },
        { id: 'event-marketing', type: 'subprocess', position: { x: 1210, y: 100 }, data: { label: 'Öffentlichkeitsarbeit', linkedProcessId: 'demo-process-marketing', description: 'Kommunikation und Bewerbung als eigener Teilprozess.' } },
        { id: 'event-run', type: 'activity', position: { x: 1210, y: 300 }, data: { label: 'Veranstaltung durchführen', responsibleRole: 'Veranstaltungsteam' } },
        { id: 'event-output', type: 'output', position: { x: 1500, y: 300 }, data: { label: 'Durchgeführte Veranstaltung' } },
        { id: 'event-reflection', type: 'reflection', position: { x: 1790, y: 300 }, data: { label: 'Gemeinsam reflektieren', description: 'Was hat gut geklappt, wen haben wir erreicht und was verändern wir beim nächsten Mal?' } },
      ], [
        { id: 'event-edge-1', source: 'event-input', target: 'event-plan' },
        { id: 'event-edge-2', source: 'event-plan', target: 'event-decision' },
        { id: 'event-edge-3', source: 'event-decision', target: 'event-branch' },
        { id: 'event-edge-4', source: 'event-branch', sourceHandle: 'branch-a', target: 'event-marketing' },
        { id: 'event-edge-5', source: 'event-branch', sourceHandle: 'branch-b', target: 'event-run' },
        { id: 'event-edge-6', source: 'event-run', target: 'event-output' },
        { id: 'event-edge-7', source: 'event-output', target: 'event-reflection' },
      ]),
    },
    {
      id: 'demo-process-marketing',
      orgId: DEMO_ORG_ID,
      title: 'Öffentlichkeitsarbeit',
      purpose: 'Nebenprozess für eine zielgruppengerechte und nachvollziehbare Bewerbung.',
      createdByUserId: DEMO_USER_ID,
      createdAt,
      updatedAt: createdAt,
      definition: definition([
        { id: 'marketing-input', type: 'input', position: { x: 40, y: 150 }, data: { label: 'Veranstaltungsinfos', responsibleRole: 'Planungsteam' } },
        { id: 'marketing-activity', type: 'activity', position: { x: 340, y: 150 }, data: { label: 'Botschaft und Kanäle wählen', description: 'Welche Sprache, Bilder und Kanäle erreichen die Zielgruppe?' } },
        { id: 'marketing-output', type: 'output', position: { x: 650, y: 150 }, data: { label: 'Bewerbung veröffentlicht' } },
        { id: 'marketing-outcome', type: 'outcome', position: { x: 940, y: 150 }, data: { label: 'Zielgruppe informiert', description: 'Rückmeldungen und Reichweite beobachten.' } },
      ], [
        { id: 'marketing-edge-1', source: 'marketing-input', target: 'marketing-activity' },
        { id: 'marketing-edge-2', source: 'marketing-activity', target: 'marketing-output' },
        { id: 'marketing-edge-3', source: 'marketing-output', target: 'marketing-outcome' },
      ]),
    },
    {
      id: 'demo-process-team-reflection',
      orgId: DEMO_ORG_ID,
      title: 'Teamreflexion nach einem Angebot',
      purpose: 'Lernerfahrungen festhalten und konkrete Verbesserungen vereinbaren.',
      createdByUserId: DEMO_USER_ID,
      createdAt,
      updatedAt: createdAt,
      definition: definition([
        { id: 'reflection-input', type: 'input', position: { x: 40, y: 150 }, data: { label: 'Beobachtungen sammeln', description: 'Perspektiven der Jugendlichen und des Teams zusammentragen.' } },
        { id: 'reflection-activity', type: 'activity', position: { x: 340, y: 150 }, data: { label: 'Auswertung im Team', responsibleRole: 'Moderation' } },
        { id: 'reflection-note', type: 'reflection', position: { x: 640, y: 150 }, data: { label: 'Lernfrage beantworten', description: 'Was behalten wir bei, was ändern wir und wer übernimmt den nächsten Schritt?' } },
        { id: 'reflection-output', type: 'output', position: { x: 940, y: 150 }, data: { label: 'Vereinbarung dokumentiert' } },
      ], [
        { id: 'reflection-edge-1', source: 'reflection-input', target: 'reflection-activity' },
        { id: 'reflection-edge-2', source: 'reflection-activity', target: 'reflection-note' },
        { id: 'reflection-edge-3', source: 'reflection-note', target: 'reflection-output' },
      ]),
    },
  ];
}

function createInitialAuditLogs(activities: DemoActivityRecord[], projects: DemoProject[]): AuditLog[] {
  const recentActivities = activities.slice(0, 8);
  return [
    {
      id: 'audit-login-demo',
      entityType: 'auth',
      entityId: demoUser.id,
      action: 'login',
      userId: demoUser.id,
      userName: demoUser.name,
      orgId: DEMO_ORG_ID,
      orgName: 'Demo Jugendhaus',
      entityTitle: demoUser.name,
      createdAt: new Date().toISOString(),
    },
    ...recentActivities.map((activity, index) => ({
      id: `audit-activity-${index}`,
      entityType: 'activity',
      entityId: activity.id,
      action: index % 3 === 0 ? 'update' : 'create',
      userId: demoUser.id,
      userName: demoUser.name,
      orgId: DEMO_ORG_ID,
      orgName: 'Demo Jugendhaus',
      entityTitle: activity.title || projects.find((project) => project.id === activity.projectId)?.title || 'Aktivitaet',
      createdAt: new Date(Date.now() - index * 1000 * 60 * 60 * 7).toISOString(),
    } satisfies AuditLog)),
  ];
}

function surveySeed(now: Date): { surveys: DemoSurvey[]; surveyResponses: Record<string, SurveyResponse[]> } {
  const feedbackQuestions: SurveyQuestion[] = [
    { id: 'survey-feedback-mood', type: 'scale', label: 'Wie wohl fühlst du dich bei uns?', required: true, scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Gar nicht wohl', scaleMaxLabel: 'Sehr wohl' },
    { id: 'survey-feedback-offers', type: 'multiple_choice', label: 'Was machst du bei uns besonders gerne?', options: [
      { id: 'offer-sport', label: 'Sport und Bewegung' }, { id: 'offer-creative', label: 'Musik und Kreatives' }, { id: 'offer-media', label: 'Gaming und Medien' }, { id: 'offer-meet', label: 'Chillen und Leute treffen' },
    ] },
    { id: 'survey-feedback-more', type: 'single_choice', label: 'Was sollte es häufiger geben?', options: [
      { id: 'more-workshops', label: 'Workshops' }, { id: 'more-trips', label: 'Ausflüge' }, { id: 'more-sports', label: 'Sportangebote' }, { id: 'more-nothing', label: 'So ist es gut' },
    ] },
    { id: 'survey-feedback-text', type: 'text', label: 'Was möchtest du uns noch sagen?' },
  ];
  const holidayQuestions: SurveyQuestion[] = [
    { id: 'survey-holiday-fun', type: 'scale', label: 'Das Ferienprogramm hat mir Spaß gemacht.', required: true, scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Trifft nicht zu', scaleMaxLabel: 'Trifft völlig zu' },
    { id: 'survey-holiday-again', type: 'single_choice', label: 'Würdest du wieder mitmachen?', options: [
      { id: 'again-yes', label: 'Ja, auf jeden Fall' }, { id: 'again-maybe', label: 'Vielleicht' }, { id: 'again-no', label: 'Eher nicht' },
    ] },
    { id: 'survey-holiday-text', type: 'text', label: 'Welche Aktion wünschst du dir fürs nächste Mal?' },
  ];
  const digitalClubQuestions: SurveyQuestion[] = [
    { id: 'survey-digital-club-rating', type: 'scale', label: 'Wie hilfreich sind die Termine im Digital Club für dich?', required: true, scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Gar nicht hilfreich', scaleMaxLabel: 'Sehr hilfreich' },
    { id: 'survey-digital-club-topics', type: 'multiple_choice', label: 'Was möchtest du in den nächsten Wochen ausprobieren?', options: [
      { id: 'digital-coding', label: 'Coding und Apps' }, { id: 'digital-games', label: 'Games entwickeln' }, { id: 'digital-video', label: 'Video und Social Media' }, { id: 'digital-robotics', label: 'Robotics und Technik' },
    ] },
    { id: 'survey-digital-club-time', type: 'single_choice', label: 'Wann passt dir der nächste Termin am besten?', options: [
      { id: 'digital-tuesday', label: 'Dienstag' }, { id: 'digital-thursday', label: 'Donnerstag' }, { id: 'digital-friday', label: 'Freitag' },
    ] },
    { id: 'survey-digital-club-text', type: 'text', label: 'Welche Idee hast du für den Digital Club?' },
  ];
  const iso = (daysAgo: number, hour = 15) => new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - (now.getHours() - hour) * 60 * 60 * 1000).toISOString();
  const feedbackRound1: DemoSurvey = {
    id: 'survey-feedback-round-1', seriesId: 'survey-feedback-round-1', roundNumber: 1, orgId: DEMO_ORG_ID, projectId: null,
    title: 'Wünsche für den offenen Treff', introduction: 'Deine Meinung hilft uns, den offenen Treff noch besser zu machen. Die Antworten sind anonym.', status: 'closed', publicToken: 'demo-feedback-june', questions: feedbackQuestions,
    allowMultiplePerDevice: true, expectedParticipants: 24, startsAt: iso(36), startedAt: iso(36), endsAt: iso(28), closedAt: iso(28), rawResponsesPurgeAt: null, archived: false, responsesCount: 8, rawResponsesAvailable: true, createdAt: iso(38), updatedAt: iso(28),
  };
  const feedbackRound2: DemoSurvey = {
    ...feedbackRound1, id: 'survey-feedback-round-2', seriesId: 'survey-feedback-round-1', roundNumber: 2, status: 'active', publicToken: 'demo-feedback-now', startsAt: iso(5), startedAt: iso(5), endsAt: null, closedAt: null, rawResponsesPurgeAt: null, responsesCount: 6, createdAt: iso(6), updatedAt: iso(1),
  };
  const holidaySurvey: DemoSurvey = {
    id: 'survey-holiday-2026', seriesId: 'survey-holiday-2026', roundNumber: 1, orgId: DEMO_ORG_ID, projectId: null,
    title: 'Feedback zum Ferienprogramm', introduction: 'Danke, dass du beim Ferienprogramm dabei warst. Deine Rückmeldung hilft bei der Planung der nächsten Aktionen.', status: 'closed', publicToken: 'demo-holiday-feedback', questions: holidayQuestions,
    allowMultiplePerDevice: true, expectedParticipants: 18, startsAt: iso(18), startedAt: iso(18), endsAt: iso(14), closedAt: iso(14), rawResponsesPurgeAt: null, archived: false, responsesCount: 7, rawResponsesAvailable: true, createdAt: iso(20), updatedAt: iso(14),
  };
  const digitalClubSurvey: DemoSurvey = {
    id: 'survey-digital-club-2026', seriesId: 'survey-digital-club-2026', roundNumber: 1, orgId: DEMO_ORG_ID, projectId: 'project-digital-club',
    title: 'Digital Club: Themenwahl', introduction: 'Welche Themen interessieren dich im Digital Club? Deine Antworten helfen uns bei der Planung der nächsten Termine.', status: 'active', publicToken: 'demo-digital-club-topics', questions: digitalClubQuestions,
    allowMultiplePerDevice: true, expectedParticipants: 20, startsAt: iso(4), startedAt: iso(4), endsAt: null, closedAt: null, rawResponsesPurgeAt: null, archived: false, responsesCount: 7, rawResponsesAvailable: true, createdAt: iso(5), updatedAt: iso(0),
  };
  const response = (id: string, surveyId: string, daysAgo: number, answers: SurveyResponse['answers']): SurveyResponse => ({ id, surveyId, submittedAt: iso(daysAgo), answers, number: 0 });
  const feedbackResponses1 = [
    response('demo-feedback-1-1', feedbackRound1.id, 35, { 'survey-feedback-mood': 5, 'survey-feedback-offers': ['offer-creative', 'offer-meet'], 'survey-feedback-more': 'more-trips', 'survey-feedback-text': 'Mehr Ausflüge in den Ferien wären toll.' }),
    response('demo-feedback-1-2', feedbackRound1.id, 34, { 'survey-feedback-mood': 4, 'survey-feedback-offers': ['offer-sport'], 'survey-feedback-more': 'more-sports', 'survey-feedback-text': 'Das Fußballturnier war super.' }),
    response('demo-feedback-1-3', feedbackRound1.id, 33, { 'survey-feedback-mood': 5, 'survey-feedback-offers': ['offer-media', 'offer-meet'], 'survey-feedback-more': 'more-workshops', 'survey-feedback-text': 'Ein Podcast-Workshop wäre cool.' }),
    response('demo-feedback-1-4', feedbackRound1.id, 32, { 'survey-feedback-mood': 4, 'survey-feedback-offers': ['offer-creative'], 'survey-feedback-more': 'more-trips', 'survey-feedback-text': null }),
    response('demo-feedback-1-5', feedbackRound1.id, 31, { 'survey-feedback-mood': 3, 'survey-feedback-offers': ['offer-meet'], 'survey-feedback-more': 'more-sports', 'survey-feedback-text': 'Manchmal ist es sehr voll.' }),
    response('demo-feedback-1-6', feedbackRound1.id, 30, { 'survey-feedback-mood': 5, 'survey-feedback-offers': ['offer-sport', 'offer-media'], 'survey-feedback-more': 'more-nothing', 'survey-feedback-text': null }),
    response('demo-feedback-1-7', feedbackRound1.id, 29, { 'survey-feedback-mood': 4, 'survey-feedback-offers': ['offer-creative', 'offer-media'], 'survey-feedback-more': 'more-workshops', 'survey-feedback-text': 'Mehr Zeit für Musik bitte.' }),
    response('demo-feedback-1-8', feedbackRound1.id, 28, { 'survey-feedback-mood': 5, 'survey-feedback-offers': ['offer-meet'], 'survey-feedback-more': 'more-trips', 'survey-feedback-text': null }),
  ];
  const feedbackResponses2 = [
    response('demo-feedback-2-1', feedbackRound2.id, 5, { 'survey-feedback-mood': 5, 'survey-feedback-offers': ['offer-creative', 'offer-meet'], 'survey-feedback-more': 'more-workshops', 'survey-feedback-text': 'Der Kreativraum ist mein Lieblingsort.' }),
    response('demo-feedback-2-2', feedbackRound2.id, 4, { 'survey-feedback-mood': 4, 'survey-feedback-offers': ['offer-sport'], 'survey-feedback-more': 'more-sports', 'survey-feedback-text': null }),
    response('demo-feedback-2-3', feedbackRound2.id, 3, { 'survey-feedback-mood': 5, 'survey-feedback-offers': ['offer-media'], 'survey-feedback-more': 'more-workshops', 'survey-feedback-text': 'Gaming-Turnier machen!' }),
    response('demo-feedback-2-4', feedbackRound2.id, 2, { 'survey-feedback-mood': 4, 'survey-feedback-offers': ['offer-meet', 'offer-sport'], 'survey-feedback-more': 'more-trips', 'survey-feedback-text': null }),
    response('demo-feedback-2-5', feedbackRound2.id, 1, { 'survey-feedback-mood': 5, 'survey-feedback-offers': ['offer-creative'], 'survey-feedback-more': 'more-nothing', 'survey-feedback-text': 'Alles gut so.' }),
    response('demo-feedback-2-6', feedbackRound2.id, 1, { 'survey-feedback-mood': 3, 'survey-feedback-offers': ['offer-meet'], 'survey-feedback-more': 'more-sports', 'survey-feedback-text': 'Vielleicht später offen lassen.' }),
  ];
  const holidayResponses = [
    response('demo-holiday-1', holidaySurvey.id, 18, { 'survey-holiday-fun': 5, 'survey-holiday-again': 'again-yes', 'survey-holiday-text': 'Noch einmal ins Kletterzentrum.' }),
    response('demo-holiday-2', holidaySurvey.id, 17, { 'survey-holiday-fun': 5, 'survey-holiday-again': 'again-yes', 'survey-holiday-text': 'Graffiti-Workshop.' }),
    response('demo-holiday-3', holidaySurvey.id, 16, { 'survey-holiday-fun': 4, 'survey-holiday-again': 'again-yes', 'survey-holiday-text': null }),
    response('demo-holiday-4', holidaySurvey.id, 15, { 'survey-holiday-fun': 4, 'survey-holiday-again': 'again-maybe', 'survey-holiday-text': 'Mehr Zeit zum Kochen.' }),
    response('demo-holiday-5', holidaySurvey.id, 15, { 'survey-holiday-fun': 5, 'survey-holiday-again': 'again-yes', 'survey-holiday-text': null }),
    response('demo-holiday-6', holidaySurvey.id, 14, { 'survey-holiday-fun': 3, 'survey-holiday-again': 'again-maybe', 'survey-holiday-text': 'Etwas später anfangen.' }),
    response('demo-holiday-7', holidaySurvey.id, 14, { 'survey-holiday-fun': 4, 'survey-holiday-again': 'again-yes', 'survey-holiday-text': null }),
  ];
  const digitalClubResponses = [
    response('demo-digital-club-1', digitalClubSurvey.id, 4, { 'survey-digital-club-rating': 5, 'survey-digital-club-topics': ['digital-coding', 'digital-games'], 'survey-digital-club-time': 'digital-thursday', 'survey-digital-club-text': 'Ein kleines eigenes Spiel programmieren.' }),
    response('demo-digital-club-2', digitalClubSurvey.id, 3, { 'survey-digital-club-rating': 4, 'survey-digital-club-topics': ['digital-video'], 'survey-digital-club-time': 'digital-friday', 'survey-digital-club-text': 'Videos schneiden und Effekte ausprobieren.' }),
    response('demo-digital-club-3', digitalClubSurvey.id, 3, { 'survey-digital-club-rating': 5, 'survey-digital-club-topics': ['digital-robotics', 'digital-coding'], 'survey-digital-club-time': 'digital-thursday', 'survey-digital-club-text': 'Roboter mit Sensoren bauen.' }),
    response('demo-digital-club-4', digitalClubSurvey.id, 2, { 'survey-digital-club-rating': 4, 'survey-digital-club-topics': ['digital-games'], 'survey-digital-club-time': 'digital-tuesday', 'survey-digital-club-text': null }),
    response('demo-digital-club-5', digitalClubSurvey.id, 2, { 'survey-digital-club-rating': 5, 'survey-digital-club-topics': ['digital-coding', 'digital-video'], 'survey-digital-club-time': 'digital-thursday', 'survey-digital-club-text': 'Eine eigene Website machen.' }),
    response('demo-digital-club-6', digitalClubSurvey.id, 1, { 'survey-digital-club-rating': 3, 'survey-digital-club-topics': ['digital-robotics'], 'survey-digital-club-time': 'digital-friday', 'survey-digital-club-text': 'Mehr Zeit für die Projekte wäre gut.' }),
    response('demo-digital-club-7', digitalClubSurvey.id, 0, { 'survey-digital-club-rating': 5, 'survey-digital-club-topics': ['digital-games', 'digital-video'], 'survey-digital-club-time': 'digital-thursday', 'survey-digital-club-text': null }),
  ];
  return {
    surveys: [feedbackRound1, feedbackRound2, holidaySurvey, digitalClubSurvey],
    surveyResponses: {
      [feedbackRound1.id]: feedbackResponses1,
      [feedbackRound2.id]: feedbackResponses2,
      [holidaySurvey.id]: holidayResponses,
      [digitalClubSurvey.id]: digitalClubResponses,
    },
  };
}

function createDemoStore(now = new Date()): DemoStore {
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const windowStart = localIsoDate(addMonths(currentMonthStart, -12));
  const windowEnd = localIsoDate(now);
  const categories = categorySeed();
  const tags = tagSeed();
  const cohorts = cohortSeed();
  const locations = locationSeed();
  const staff = staffSeed();
  const projects = projectSeed(windowStart, windowEnd);
  const activities = activitySeed(windowStart, windowEnd, projects, tags, staff);
  const surveyData = surveySeed(now);
  const processes = processSeed(now);
  return {
    generatedAt: now.toISOString(),
    windowStart,
    windowEnd,
    sequence: 10000,
    user: { ...demoUser },
    orgs: [{ id: DEMO_ORG_ID, name: 'Demo Jugendhaus', parentId: null, path: DEMO_ORG_ID, processesEnabled: true }],
    categories,
    tags,
    cohorts,
    locations,
    staff,
    projects,
    activities,
    projectTemplates: projectTemplateSeed(),
    openingHours: openingHoursSeed(),
    closureDays: closureDaySeed(windowStart, windowEnd),
    acks: {},
    auditLogs: createInitialAuditLogs(activities, projects),
    logbookEntries: logbookSeed(activities, projects),
    processes,
    ...surveyData,
  };
}

let store = createDemoStore();

export function resetDemoStore() {
  store = createDemoStore();
}

function nextId(prefix: string): string {
  store.sequence += 1;
  return `${prefix}-${store.sequence}`;
}

function addAudit(entityType: string, entityId: string, action: AuditLogAction, entityTitle?: string | null) {
  store.auditLogs.unshift({
    id: nextId('audit'),
    entityType,
    entityId,
    action,
    userId: store.user.id,
    userName: store.user.name,
    orgId: DEMO_ORG_ID,
    orgName: 'Demo Jugendhaus',
    entityTitle: entityTitle || null,
    createdAt: new Date().toISOString(),
  });
  store.auditLogs = store.auditLogs.slice(0, 80);
}

function surveyResponses(surveyId: string) {
  return store.surveyResponses[surveyId] || [];
}

function surveyDto(survey: DemoSurvey): Survey {
  return clone({ ...survey, responsesCount: surveyResponses(survey.id).length, rawResponsesAvailable: true });
}

function surveySeriesId(survey: DemoSurvey) {
  return survey.seriesId || survey.id;
}

function surveyRounds(survey: DemoSurvey) {
  return store.surveys
    .filter((entry) => surveySeriesId(entry) === surveySeriesId(survey))
    .sort((left, right) => (left.roundNumber || 1) - (right.roundNumber || 1));
}

export function listDemoSurveys(params: DemoQueryParams = {}) {
  const archived = readBoolean(params.archived) || false;
  const search = String(params.search || '').trim().toLocaleLowerCase(getCurrentIntlLocale());
  return store.surveys
    .filter((survey) => survey.id === surveySeriesId(survey) && survey.archived === archived)
    .filter((survey) => !search || survey.title.toLocaleLowerCase(getCurrentIntlLocale()).includes(search))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((root) => {
      const rounds = surveyRounds(root);
      const latest = rounds[rounds.length - 1] || root;
      return clone({
        ...surveyDto(root),
        status: latest.status,
        publicToken: latest.publicToken,
        responsesCount: surveyResponses(latest.id).length,
        rawResponsesAvailable: true,
        roundNumber: latest.roundNumber,
        roundsCount: rounds.length,
      });
    });
}

export function listDemoActiveSurveyDashboardSummaries(): ActiveSurveyDashboardSummary[] {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sevenDayStart = new Date(todayStart);
  sevenDayStart.setDate(sevenDayStart.getDate() - 6);

  return store.surveys
    .filter((survey) => survey.status === 'active' && !survey.archived)
    .map((survey) => {
      const projectId = survey.projectId || null;
      const responses = surveyResponses(survey.id);
      const responseDates = responses.map((response) => new Date(response.submittedAt));
      const lastResponseAt = responseDates.length
        ? new Date(Math.max(...responseDates.map((date) => date.getTime()))).toISOString()
        : null;
      const expectedParticipants = survey.expectedParticipants && survey.expectedParticipants > 0
        ? survey.expectedParticipants
        : null;
      return {
        id: survey.id,
        title: survey.title,
        projectId,
        projectTitle: projectId ? store.projects.find((project) => project.id === projectId)?.title || null : null,
        roundNumber: survey.roundNumber || 1,
        questionCount: survey.questions?.length || 0,
        status: 'active',
        responsesCount: responses.length,
        expectedParticipants,
        responseRate: expectedParticipants ? Math.round((responses.length / expectedParticipants) * 1000) / 10 : null,
        responsesToday: responseDates.filter((date) => date >= todayStart).length,
        responsesLast7Days: responseDates.filter((date) => date >= sevenDayStart).length,
        lastResponseAt,
        startedAt: survey.startedAt || null,
        endsAt: survey.endsAt || null,
      } satisfies ActiveSurveyDashboardSummary;
    })
    .sort((left, right) => {
      const leftEnd = left.endsAt ? new Date(left.endsAt).getTime() : Number.POSITIVE_INFINITY;
      const rightEnd = right.endsAt ? new Date(right.endsAt).getTime() : Number.POSITIVE_INFINITY;
      if (leftEnd !== rightEnd) return leftEnd - rightEnd;
      const leftResponse = left.lastResponseAt ? new Date(left.lastResponseAt).getTime() : Number.NEGATIVE_INFINITY;
      const rightResponse = right.lastResponseAt ? new Date(right.lastResponseAt).getTime() : Number.NEGATIVE_INFINITY;
      return rightResponse - leftResponse;
    })
    .slice(0, 3);
}

export function hasDemoArchivedSurveys() {
  return store.surveys.some((survey) => survey.id === surveySeriesId(survey) && survey.archived);
}

export function getDemoSurvey(id: string) {
  const survey = store.surveys.find((entry) => entry.id === id);
  return survey ? surveyDto(survey) : null;
}

export function listDemoSurveyRounds(id: string) {
  const survey = store.surveys.find((entry) => entry.id === id);
  return survey ? surveyRounds(survey).map(surveyDto) : [];
}

export function createDemoSurvey(data: SurveyInput) {
  const now = new Date().toISOString();
  const id = nextId('survey');
  const survey: DemoSurvey = {
    id, seriesId: id, roundNumber: 1, orgId: DEMO_ORG_ID, projectId: data.projectId || null,
    title: String(data.title || 'Neue Umfrage').trim(), introduction: data.introduction || null, status: 'draft', publicToken: `${id}-token`,
    questions: clone(data.questions || []), allowMultiplePerDevice: !!data.allowMultiplePerDevice, expectedParticipants: data.expectedParticipants || null,
    startsAt: data.startsAt || null, startedAt: null, endsAt: data.endsAt || null, closedAt: null, rawResponsesPurgeAt: null,
    archived: false, responsesCount: 0, rawResponsesAvailable: true, createdAt: now, updatedAt: now,
  };
  store.surveys.unshift(survey); store.surveyResponses[id] = []; addAudit('survey', id, 'create', survey.title);
  return surveyDto(survey);
}

export function updateDemoSurvey(id: string, data: SurveyInput & { archived?: boolean }) {
  const survey = store.surveys.find((entry) => entry.id === id);
  if (!survey) throw new Error('Umfrage nicht gefunden');
  if (typeof data.title === 'string') survey.title = data.title.trim();
  if (typeof data.introduction !== 'undefined') survey.introduction = data.introduction || null;
  if (typeof data.projectId !== 'undefined') survey.projectId = data.projectId || null;
  if (typeof data.questions !== 'undefined') survey.questions = clone(data.questions || []);
  if (typeof data.allowMultiplePerDevice !== 'undefined') survey.allowMultiplePerDevice = data.allowMultiplePerDevice;
  if (typeof data.expectedParticipants !== 'undefined') survey.expectedParticipants = data.expectedParticipants || null;
  if (typeof data.startsAt !== 'undefined') survey.startsAt = data.startsAt || null;
  if (typeof data.endsAt !== 'undefined') survey.endsAt = data.endsAt || null;
  if (typeof data.archived === 'boolean') { survey.archived = data.archived; survey.status = data.archived ? 'archived' : (survey.closedAt ? 'closed' : 'draft'); }
  survey.updatedAt = new Date().toISOString(); addAudit('survey', id, 'update', survey.title);
  return surveyDto(survey);
}

export function startDemoSurvey(id: string) {
  const survey = store.surveys.find((entry) => entry.id === id);
  if (!survey) throw new Error('Umfrage nicht gefunden');
  survey.status = 'active'; survey.archived = false; survey.startedAt ||= new Date().toISOString(); survey.updatedAt = new Date().toISOString();
  addAudit('survey', id, 'update', survey.title); return surveyDto(survey);
}

export function closeDemoSurvey(id: string) {
  const survey = store.surveys.find((entry) => entry.id === id);
  if (!survey) throw new Error('Umfrage nicht gefunden');
  const now = new Date(); survey.status = 'closed'; survey.closedAt = now.toISOString(); survey.rawResponsesPurgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); survey.updatedAt = survey.closedAt;
  addAudit('survey', id, 'update', survey.title); return surveyDto(survey);
}

export function createDemoSurveyRound(id: string) {
  const source = store.surveys.find((entry) => entry.id === id);
  if (!source) throw new Error('Umfrage nicht gefunden');
  const rounds = surveyRounds(source);
  if (rounds.some((round) => round.status === 'active')) throw new Error('Beende die aktive Umfragerunde, bevor du eine neue anlegst.');
  const now = new Date().toISOString(); const roundId = nextId('survey-round');
  const round: DemoSurvey = { ...source, id: roundId, seriesId: surveySeriesId(source), roundNumber: rounds.length + 1, status: 'draft', publicToken: `${roundId}-token`, startsAt: null, startedAt: null, endsAt: null, closedAt: null, rawResponsesPurgeAt: null, archived: false, responsesCount: 0, createdAt: now, updatedAt: now, questions: clone(source.questions) };
  store.surveys.push(round); store.surveyResponses[roundId] = []; addAudit('survey_round', roundId, 'create', round.title);
  return surveyDto(round);
}

export function deleteDemoSurveyRound(surveyId: string, roundId: string) {
  const seed = store.surveys.find((entry) => entry.id === surveyId);
  const round = store.surveys.find((entry) => entry.id === roundId);
  if (!seed || !round || surveySeriesId(round) !== surveySeriesId(seed))
    throw new Error('Umfragerunde nicht gefunden');
  if ((round.roundNumber || 1) <= 1)
    throw new Error('Die erste Umfragerunde kann nicht einzeln gelöscht werden.');
  if (round.status !== 'draft')
    throw new Error('Nur noch nicht gestartete Umfragerunden können gelöscht werden.');
  if (surveyResponses(round.id).length > 0)
    throw new Error('Umfragerunden mit Antworten können nicht gelöscht werden.');

  const index = store.surveys.findIndex((entry) => entry.id === roundId);
  store.surveys.splice(index, 1);
  delete store.surveyResponses[roundId];
  surveyRounds(seed)
    .filter((entry) => (entry.roundNumber || 1) > (round.roundNumber || 1))
    .forEach((entry) => {
      entry.roundNumber = (entry.roundNumber || 1) - 1;
      entry.updatedAt = new Date().toISOString();
    });
  addAudit('survey_round', roundId, 'delete', round.title);
  return { id: roundId };
}

export function listDemoSurveyResponses(id: string) {
  const responses = [...surveyResponses(id)].sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
  return { rawResponsesAvailable: true, responses: clone(responses.map((response, index) => ({ ...response, number: responses.length - index }))) };
}

export function deleteDemoSurveyResponse(surveyId: string, responseId: string) {
  store.surveyResponses[surveyId] = surveyResponses(surveyId).filter((response) => response.id !== responseId);
  const survey = store.surveys.find((entry) => entry.id === surveyId); if (survey) { survey.updatedAt = new Date().toISOString(); addAudit('survey_response', responseId, 'delete', survey.title); }
  return { ok: true };
}

export function getDemoSurveyAnalytics(id: string): SurveyAnalytics {
  const survey = store.surveys.find((entry) => entry.id === id);
  if (!survey) throw new Error('Umfrage nicht gefunden');
  const responses = surveyResponses(id);
  const questions = (survey.questions || []).map((question) => {
    const answered = responses.map((response) => response.answers[question.id]).filter((value) => value !== null && typeof value !== 'undefined' && value !== '');
    if (question.type === 'text') return { id: question.id, type: question.type, label: question.label, answeredCount: answered.length, texts: answered.filter((value): value is string => typeof value === 'string') };
    const counts: Record<string, number> = {};
    if (question.type === 'scale') {
      for (let value = question.scaleMin || 1; value <= (question.scaleMax || 5); value += 1) counts[String(value)] = 0;
      answered.forEach((value) => { counts[String(value)] = (counts[String(value)] || 0) + 1; });
      const numbers = answered.filter((value): value is number => typeof value === 'number').sort((left, right) => left - right);
      return { id: question.id, type: question.type, label: question.label, answeredCount: answered.length, counts, median: numbers.length ? numbers[Math.floor((numbers.length - 1) / 2)] : null, mean: numbers.length ? Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length * 100) / 100 : null };
    }
    (question.options || []).forEach((option) => { counts[option.id] = 0; });
    answered.forEach((value) => (Array.isArray(value) ? value : [value]).forEach((entry) => { if (typeof entry === 'string') counts[entry] = (counts[entry] || 0) + 1; }));
    return { id: question.id, type: question.type, label: question.label, answeredCount: answered.length, counts };
  });
  return { responsesCount: responses.length, expectedParticipants: survey.expectedParticipants, responseRate: survey.expectedParticipants ? Math.round(responses.length / survey.expectedParticipants * 1000) / 10 : null, questions, generatedAt: new Date().toISOString() };
}

export function getDemoSurveyTrend(id: string): SurveyTrend {
  const seed = store.surveys.find((entry) => entry.id === id);
  if (!seed) throw new Error('Umfrage nicht gefunden');
  const rounds = surveyRounds(seed).filter((round) => round.status !== 'draft');
  const analytics = rounds.map((round) => getDemoSurveyAnalytics(round.id));
  const point = (round: DemoSurvey, result: SurveyAnalytics['questions'][number]) => ({ roundId: round.id, roundNumber: round.roundNumber || 1, date: round.closedAt || round.startsAt || round.createdAt, responsesCount: surveyResponses(round.id).length, answeredCount: result.answeredCount, median: result.median || null, mean: result.mean || null, counts: result.counts || {}, suppressed: false });
  return {
    rounds: rounds.map((round) => ({ id: round.id, roundNumber: round.roundNumber || 1, status: round.status, date: round.closedAt || round.startsAt || round.createdAt, responsesCount: surveyResponses(round.id).length, expectedParticipants: round.expectedParticipants, responseRate: round.expectedParticipants ? Math.round(surveyResponses(round.id).length / round.expectedParticipants * 1000) / 10 : null })),
    questions: (seed.questions || []).map((question) => {
      const points = rounds.map((round, index) => point(round, analytics[index].questions.find((entry) => entry.id === question.id) || { id: question.id, type: question.type, label: question.label, answeredCount: 0 }));
      if (question.type === 'single_choice' || question.type === 'multiple_choice') return { id: question.id, label: question.label, type: question.type, options: (question.options || []).map((option) => ({ id: option.id, label: option.label, points: points.map((entry) => ({ ...entry, percentage: entry.answeredCount ? Math.round((entry.counts[option.id] || 0) / entry.answeredCount * 1000) / 10 : null })) })) };
      return { id: question.id, label: question.label, type: question.type, points };
    }),
  };
}

export function getDemoPublicSurvey(token: string) {
  const survey = store.surveys.find((entry) => entry.publicToken === token && entry.status === 'active');
  if (!survey) throw new Error('Diese Umfrage ist nicht aktiv.');
  return clone({ title: survey.title, introduction: survey.introduction, questions: survey.questions, allowMultiplePerDevice: survey.allowMultiplePerDevice, organizationName: 'Demo Jugendhaus' });
}

export function submitDemoPublicSurvey(token: string, answers: SurveyResponse['answers']) {
  const survey = store.surveys.find((entry) => entry.publicToken === token && entry.status === 'active');
  if (!survey) throw new Error('Diese Umfrage ist nicht aktiv.');
  const response: SurveyResponse = { id: nextId('survey-response'), surveyId: survey.id, submittedAt: new Date().toISOString(), answers: clone(answers), number: 0 };
  store.surveyResponses[survey.id] = [...surveyResponses(survey.id), response]; survey.updatedAt = response.submittedAt;
  return { ok: true };
}

function compareActivityRecordsDesc(left: Pick<Activity, 'date' | 'startTime'>, right: Pick<Activity, 'date' | 'startTime'>) {
  const leftKey = `${left.date || ''}T${left.startTime || '00:00'}`;
  const rightKey = `${right.date || ''}T${right.startTime || '00:00'}`;
  return rightKey.localeCompare(leftKey);
}

function compareActivityRecordsAsc(left: Pick<Activity, 'date' | 'startTime'>, right: Pick<Activity, 'date' | 'startTime'>) {
  return compareActivityRecordsDesc(right, left);
}

function hydrateProject(project: DemoProject): Project {
  const categories = project.categoryId
    ? store.categories
        .filter((category) => category.id === project.categoryId)
        .map((category) => ({ id: category.id, name: category.name, color: category.color }))
    : [];
  return { ...project, categories };
}

function hydrateActivity(activity: DemoActivityRecord): Activity {
  const project = store.projects.find((entry) => entry.id === activity.projectId);
  const location = store.locations.find((entry) => entry.id === activity.locationId);
  return {
    ...activity,
    project: project ? hydrateProject(project) : null,
    location: location ? clone(location) : undefined,
    categories: store.categories
      .filter((category) => activity.categoryIds.includes(category.id))
      .map((category) => ({ id: category.id, name: category.name, color: category.color })),
    tags: store.tags
      .filter((tag) => activity.tagIds.includes(tag.id))
      .map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
    staff: store.staff
      .filter((member) => activity.staffIds.includes(member.id))
      .map((member) => ({ id: member.id, name: member.name, role: member.role, roles: member.roles } as { id: string; name: string })),
  };
}

function filterByActive<T extends { active?: boolean }>(items: T[], params: DemoQueryParams): T[] {
  const active = readBoolean(params.active);
  if (typeof active === 'undefined') return items;
  return items.filter((item) => (item.active !== false) === active);
}

function filterActivityRecords(params: DemoQueryParams = {}): DemoActivityRecord[] {
  const from = typeof params.from === 'string' ? params.from.slice(0, 10) : undefined;
  const to = typeof params.to === 'string' ? params.to.slice(0, 10) : undefined;
  const search = typeof params.search === 'string' ? params.search.trim().toLowerCase() : '';
  const types = new Set(readStringList(params.types).concat(readStringList(params.type)));
  const locationIds = new Set(readStringList(params.locationIds).concat(readStringList(params.locationId)));
  const projectIds = new Set(readStringList(params.projectIds).concat(readStringList(params.projectId)));
  const categoryIds = new Set(readStringList(params.categoryIds));
  const tagIds = new Set(readStringList(params.tagIds));
  const staffIds = new Set(readStringList(params.staffIds));
  const cohortIds = new Set(readStringList(params.cohortIds));
  const executionStatuses = new Set(readStringList(params.executionStatuses));
  const weekdays = new Set(readStringList(params.weekdays).map((value) => Number(value)).filter(Number.isFinite));
  const participantsMin = readNumber(params.participantsMin);
  const participantsMax = readNumber(params.participantsMax);
  const durationMin = readNumber(params.durationMin);
  const durationMax = readNumber(params.durationMax);
  const closureDates = new Set(store.closureDays.map((closure) => closure.date));
  const closureState = typeof params.closureState === 'string' ? params.closureState : '';

  return store.activities.filter((activity) => {
    if (from && activity.date < from) return false;
    if (to && activity.date > to) return false;
    if (types.size > 0 && !types.has(activity.type)) return false;
    if (locationIds.size > 0 && (!activity.locationId || !locationIds.has(activity.locationId))) return false;
    if (projectIds.size > 0 && (!activity.projectId || !projectIds.has(activity.projectId))) return false;
    if (categoryIds.size > 0 && !activity.categoryIds.some((id) => categoryIds.has(id))) return false;
    if (tagIds.size > 0 && !activity.tagIds.some((id) => tagIds.has(id))) return false;
    if (staffIds.size > 0 && !activity.staffIds.some((id) => staffIds.has(id))) return false;
    if (cohortIds.size > 0 && !(activity.cohorts || []).some((cohort) => cohortIds.has(cohort.cohortId))) return false;
    if (executionStatuses.size > 0 && !executionStatuses.has(activity.executionStatus || 'completed')) return false;
    if (weekdays.size > 0 && !weekdays.has(parseDate(activity.date).getDay())) return false;
    if (typeof participantsMin === 'number' && (activity.countTotal || 0) < participantsMin) return false;
    if (typeof participantsMax === 'number' && (activity.countTotal || 0) > participantsMax) return false;
    if (typeof durationMin === 'number' && (activity.durationMinutes || 0) < durationMin) return false;
    if (typeof durationMax === 'number' && (activity.durationMinutes || 0) > durationMax) return false;
    if (closureState === 'closed' && !closureDates.has(activity.date)) return false;
    if (closureState === 'open' && closureDates.has(activity.date)) return false;
    if (readBoolean(params.uncategorized) === true && activity.categoryIds.length > 0) return false;
    if (readBoolean(params.hasNotes) === true && !activity.notes) return false;
    if (search) {
      const hydrated = hydrateActivity(activity);
      const haystack = [
        hydrated.title,
        hydrated.project?.title,
        hydrated.location?.name,
        hydrated.notes,
        ...(hydrated.tags || []).map((tag) => tag.name),
        ...(hydrated.categories || []).map((category) => category.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function getDemoUser(): AuthUser {
  return clone(store.user);
}

export function updateDemoUserProfile(patch: Partial<AuthUser>): AuthUser {
  store.user = { ...store.user, ...patch, id: store.user.id, role: store.user.role, orgId: DEMO_ORG_ID, orgName: 'Demo Jugendhaus' };
  return getDemoUser();
}

export function getDemoPublicConfig() {
  return {
    appName: 'StatO Demo',
    orgName: 'Demo Jugendhaus',
    loginTitle: 'StatO Demo',
    loginSubtitle: 'OKJA Statistik & Dokumentation ohne Anmeldung',
    liveRefreshIntervalMs: 0,
    twoFactorEnabled: false,
    passwordResetMode: 'email',
    forgotPasswordEnabled: false,
    adminTemporaryPasswordEnabled: false,
  };
}

export function listDemoOrgs(): OrgDto[] {
  return clone(store.orgs);
}

export function updateDemoOrgBranding(
  orgId: string,
  patch: Pick<OrgDto, 'bannerUrl' | 'brandColor' | 'bannerPosition'>,
): OrgDto {
  const index = store.orgs.findIndex((org) => org.id === orgId);
  if (index < 0) throw new Error('Organisation nicht gefunden');
  store.orgs[index] = { ...store.orgs[index], ...patch };
  return clone(store.orgs[index]);
}

export function listDemoUsers() {
  return [{ id: store.user.id, email: store.user.email, name: store.user.name, role: store.user.role, orgId: DEMO_ORG_ID, org: { id: DEMO_ORG_ID, name: 'Demo Jugendhaus' } }];
}

export function getDemoTaxonomySettings(): OrgTaxonomySettingsSnapshot {
  const typeSetting = { allowOwn: true, inheritedIds: [], inheritAll: false };
  const access = { canCreateOwn: true };
  return {
    orgId: DEMO_ORG_ID,
    orgName: 'Demo Jugendhaus',
    parentId: null,
    parentName: null,
    hasExplicitSettings: true,
    hasChildDefaults: true,
    childCount: 0,
    directChildCount: 0,
    descendantCount: 0,
    settings: { categories: typeSetting, tags: typeSetting, cohorts: typeSetting },
    settingsSource: {
      categories: { mode: 'explicit', sourceOrgId: DEMO_ORG_ID, sourceOrgName: 'Demo Jugendhaus' },
      tags: { mode: 'explicit', sourceOrgId: DEMO_ORG_ID, sourceOrgName: 'Demo Jugendhaus' },
      cohorts: { mode: 'explicit', sourceOrgId: DEMO_ORG_ID, sourceOrgName: 'Demo Jugendhaus' },
    },
    fallbackSettings: { categories: typeSetting, tags: typeSetting, cohorts: typeSetting },
    fallbackSource: {
      categories: { mode: 'default', sourceOrgId: null, sourceOrgName: null },
      tags: { mode: 'default', sourceOrgId: null, sourceOrgName: null },
      cohorts: { mode: 'default', sourceOrgId: null, sourceOrgName: null },
    },
    childDefaults: { categories: typeSetting, tags: typeSetting, cohorts: typeSetting, allowChildAdminOverrides: true },
    ownAdminPolicy: { allowChildAdminOverrides: true, sourceOrgId: DEMO_ORG_ID, sourceOrgName: 'Demo Jugendhaus' },
    permissions: { canEditSelf: true, canEditChildDefaults: true },
    access: { categories: access, tags: access, cohorts: access },
    parentOptions: { categories: [], tags: [], cohorts: [] },
    childDefaultOptions: { categories: [], tags: [], cohorts: [] },
  };
}

export function listDemoCategories(params: DemoQueryParams = {}): Category[] {
  return clone(filterByActive(store.categories, params));
}

export function createDemoCategory(data: Partial<Category>): Category {
  const category: Category = {
    id: nextId('cat'),
    name: String(data.name || 'Neue Kategorie'),
    description: data.description ?? null,
    standardRef: data.standardRef ?? null,
    color: data.color || '#64748b',
    active: data.active ?? true,
    orgId: DEMO_ORG_ID,
    canManage: true,
  };
  store.categories.push(category);
  addAudit('category', category.id, 'create', category.name);
  return clone(category);
}

export function updateDemoCategory(id: string, data: Partial<Category>): Category {
  const category = store.categories.find((entry) => entry.id === id);
  if (!category) throw new Error('Kategorie nicht gefunden');
  Object.assign(category, data, { id, orgId: DEMO_ORG_ID, canManage: true });
  addAudit('category', category.id, 'update', category.name);
  return clone(category);
}

export function deleteDemoCategory(id: string) {
  store.categories = store.categories.filter((entry) => entry.id !== id);
  store.activities.forEach((activity) => {
    activity.categoryIds = activity.categoryIds.filter((entry) => entry !== id);
  });
  addAudit('category', id, 'delete', id);
}

export function listDemoTags(params: DemoQueryParams = {}): Tag[] {
  const search = typeof params.search === 'string' ? params.search.toLowerCase().trim() : '';
  const items = filterByActive(store.tags, params).filter((tag) => !search || tag.name.toLowerCase().includes(search));
  return clone(items);
}

export function createDemoTag(data: Partial<Tag>): Tag {
  const tag: Tag = {
    id: nextId('tag'),
    name: String(data.name || 'Neues Tag'),
    synonyms: data.synonyms ?? null,
    color: data.color || '#475569',
    active: data.active ?? true,
    description: data.description ?? null,
    orgId: DEMO_ORG_ID,
    canManage: true,
  };
  store.tags.push(tag);
  addAudit('tag', tag.id, 'create', tag.name);
  return clone(tag);
}

export function updateDemoTag(id: string, data: Partial<Tag>): Tag {
  const tag = store.tags.find((entry) => entry.id === id);
  if (!tag) throw new Error('Tag nicht gefunden');
  Object.assign(tag, data, { id, orgId: DEMO_ORG_ID, canManage: true });
  addAudit('tag', tag.id, 'update', tag.name);
  return clone(tag);
}

export function deleteDemoTag(id: string) {
  store.tags = store.tags.filter((entry) => entry.id !== id);
  store.activities.forEach((activity) => {
    activity.tagIds = activity.tagIds.filter((entry) => entry !== id);
  });
  addAudit('tag', id, 'delete', id);
}

export function listDemoCohorts(params: DemoQueryParams = {}): Cohort[] {
  return clone(filterByActive(store.cohorts, params).sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0)));
}

export function createDemoCohort(data: Partial<Cohort>): Cohort {
  const cohort: Cohort = {
    id: nextId('cohort'),
    name: String(data.name || 'Neue Kohorte'),
    minAge: Number(data.minAge || 0),
    maxAge: Number(data.maxAge || 0),
    sortOrder: Number(data.sortOrder || store.cohorts.length * 10),
    active: data.active ?? true,
    orgId: DEMO_ORG_ID,
    canManage: true,
  };
  store.cohorts.push(cohort);
  addAudit('cohort', cohort.id, 'create', cohort.name);
  return clone(cohort);
}

export function updateDemoCohort(id: string, data: Partial<Cohort>): Cohort {
  const cohort = store.cohorts.find((entry) => entry.id === id);
  if (!cohort) throw new Error('Kohorte nicht gefunden');
  Object.assign(cohort, data, { id, orgId: DEMO_ORG_ID, canManage: true });
  addAudit('cohort', cohort.id, 'update', cohort.name);
  return clone(cohort);
}

export function deleteDemoCohort(id: string) {
  store.cohorts = store.cohorts.filter((entry) => entry.id !== id);
  store.activities.forEach((activity) => {
    activity.cohorts = (activity.cohorts || []).filter((cohort) => cohort.cohortId !== id);
  });
  addAudit('cohort', id, 'delete', id);
}

export function getDemoTaxonomyAccess() {
  return { categories: { canCreateOwn: true }, tags: { canCreateOwn: true }, cohorts: { canCreateOwn: true } };
}

export function listDemoLocations(params: DemoQueryParams = {}): Location[] {
  return clone(filterByActive(store.locations, params));
}

export function createDemoLocation(data: Partial<Location>): Location {
  const location: Location = {
    id: nextId('loc'),
    name: String(data.name || 'Neue Einrichtung'),
    address: data.address ?? null,
    roomType: data.roomType ?? null,
    active: data.active ?? true,
  };
  store.locations.push(location);
  return clone(location);
}

export function updateDemoLocation(id: string, data: Partial<Location>): Location {
  const location = store.locations.find((entry) => entry.id === id);
  if (!location) throw new Error('Einrichtung nicht gefunden');
  Object.assign(location, data, { id });
  return clone(location);
}

export function deleteDemoLocation(id: string) {
  store.locations = store.locations.filter((entry) => entry.id !== id);
  store.activities.forEach((activity) => {
    if (activity.locationId === id) activity.locationId = null;
  });
}

export function listDemoStaff(params: DemoQueryParams = {}): StaffMember[] {
  return clone(filterByActive(store.staff, params));
}

export function createDemoStaff(data: Partial<StaffMember>): StaffMember {
  const role = (data.role || (Array.isArray(data.roles) ? data.roles[0] : data.roles) || 'employee') as StaffRole;
  const staff: StaffMember = {
    id: nextId('staff'),
    name: String(data.name || 'Neue Person'),
    email: data.email ?? null,
    phone: data.phone ?? null,
    role,
    roles: [role],
    notes: data.notes ?? null,
    active: data.active ?? true,
  };
  store.staff.push(staff);
  return clone(staff);
}

export function updateDemoStaff(id: string, data: Partial<StaffMember>): StaffMember {
  const staff = store.staff.find((entry) => entry.id === id);
  if (!staff) throw new Error('Mitarbeitende Person nicht gefunden');
  const role = (data.role || (Array.isArray(data.roles) ? data.roles[0] : data.roles) || staff.role || 'employee') as StaffRole;
  Object.assign(staff, data, { id, role, roles: [role] });
  return clone(staff);
}

export function deleteDemoStaff(id: string) {
  store.staff = store.staff.filter((entry) => entry.id !== id);
  store.activities.forEach((activity) => {
    activity.staffIds = activity.staffIds.filter((entry) => entry !== id);
  });
}

export function listDemoProjects(params: DemoQueryParams = {}): Project[] {
  const search = typeof params.search === 'string' ? params.search.toLowerCase().trim() : '';
  const archived = readBoolean(params.archived);
  const projects = store.projects.filter((project) => {
    if (typeof archived === 'boolean' && !!project.archived !== archived) return false;
    if (search && !`${project.title} ${project.description || ''} ${project.targetGroup || ''}`.toLowerCase().includes(search)) return false;
    return true;
  });
  return clone(projects.map(hydrateProject));
}

export function getDemoProject(id: string): Project | null {
  const project = store.projects.find((entry) => entry.id === id);
  return project ? clone(hydrateProject(project)) : null;
}

export function createDemoProject(data: Partial<Project>): Project {
  if (data.clientRequestId) {
    const existing = store.projects.find((project) => project.clientRequestId === data.clientRequestId);
    if (existing) return clone(hydrateProject(existing));
  }
  const project: DemoProject = {
    id: nextId('project'),
    orgId: DEMO_ORG_ID,
    title: String(data.title || 'Neues Projekt'),
    type: data.type || 'project_open',
    categoryId: data.categoryId ?? null,
    targetGroup: data.targetGroup ?? null,
    imageUrl: data.imageUrl ?? null,
    imageSize: data.imageSize ?? null,
    color: data.color || '#2563eb',
    dateFrom: data.dateFrom ?? store.windowStart,
    dateTo: data.dateTo ?? store.windowEnd,
    defaultStartTime: data.defaultStartTime ?? '15:00',
    defaultEndTime: data.defaultEndTime ?? '17:00',
    defaultStaff: data.defaultStaff ?? null,
    defaultVolunteers: data.defaultVolunteers ?? null,
    tag: data.tag ?? null,
    activityField: data.activityField ?? null,
    description: data.description ?? null,
    clientRequestId: data.clientRequestId ?? null,
    archived: data.archived ?? false,
  };
  store.projects.push(project);
  addAudit('project', project.id, 'create', project.title);
  return clone(hydrateProject(project));
}

export function updateDemoProject(id: string, data: Partial<Project>): Project {
  const project = store.projects.find((entry) => entry.id === id);
  if (!project) throw new Error('Projekt nicht gefunden');
  Object.assign(project, data, { id, orgId: DEMO_ORG_ID });
  addAudit('project', project.id, 'update', project.title);
  return clone(hydrateProject(project));
}

export function deleteDemoProject(id: string) {
  const activityCount = store.activities.filter((activity) => activity.projectId === id).length;
  if (activityCount > 0) {
    throw new Error('Das Projekt kann nicht gelöscht werden, solange noch Aktivitäten zugeordnet sind.');
  }
  store.projects = store.projects.filter((entry) => entry.id !== id);
  addAudit('project', id, 'delete', id);
}

export function listDemoActivities(params: DemoQueryParams = {}): Activity[] | PagedActivitiesResult {
  const order = params.order === 'asc' ? 'asc' : 'desc';
  const records = filterActivityRecords(params).sort(order === 'asc' ? compareActivityRecordsAsc : compareActivityRecordsDesc);
  const activities = records.map(hydrateActivity);
  const page = readNumber(params.page);
  const limit = readNumber(params.limit);
  if (page || limit) {
    const pageNumber = Math.max(1, Math.trunc(page || 1));
    const pageSize = Math.min(50, Math.max(1, Math.trunc(limit || 50)));
    const startIndex = (pageNumber - 1) * pageSize;
    return clone({ data: activities.slice(startIndex, startIndex + pageSize), total: activities.length, page: pageNumber, pageSize });
  }
  return clone(activities);
}

export function getDemoActivity(id: string): Activity | null {
  const activity = store.activities.find((entry) => entry.id === id);
  return activity ? clone(hydrateActivity(activity)) : null;
}

function normalizeActivityPayload(data: Partial<Activity> & Record<string, unknown>, fallback?: DemoActivityRecord): DemoActivityRecord {
  const project = store.projects.find((entry) => entry.id === (data.projectId || fallback?.projectId)) || store.projects[0];
  const categoryIds = readStringList(data.categoryIds).length > 0
    ? readStringList(data.categoryIds)
    : fallback?.categoryIds ?? (project.categoryId ? [project.categoryId] : []);
  const tagIds = readStringList(data.tagIds).length > 0 ? readStringList(data.tagIds) : fallback?.tagIds ?? tagIdsFromProject(project, store.tags);
  const staffIds = readStringList(data.staffIds).length > 0
    ? readStringList(data.staffIds)
    : fallback?.staffIds ?? staffIdsFromNames(`${project.defaultStaff || ''},${project.defaultVolunteers || ''}`, store.staff);
  const startTime = typeof data.startTime === 'string' ? data.startTime : fallback?.startTime ?? project.defaultStartTime ?? null;
  const endTime = typeof data.endTime === 'string' ? data.endTime : fallback?.endTime ?? project.defaultEndTime ?? null;
  const countMale = readNumber(data.countMale) ?? fallback?.countMale ?? 0;
  const countFemale = readNumber(data.countFemale) ?? fallback?.countFemale ?? 0;
  const countDiverse = readNumber(data.countDiverse) ?? fallback?.countDiverse ?? 0;
  const countTotal = readNumber(data.countTotal) ?? countMale + countFemale + countDiverse;
  const counts = { countMale, countFemale, countDiverse, countTotal };
  return {
    id: fallback?.id || nextId('act'),
    orgId: DEMO_ORG_ID,
    date: String(data.date || fallback?.date || localIsoDate(new Date())).slice(0, 10),
    startTime,
    endTime,
    durationMinutes: readNumber(data.durationMinutes) ?? durationMinutes(startTime, endTime),
    executionStatus: status(data.executionStatus ?? fallback?.executionStatus),
    type: activityType(data.type || project.type || fallback?.type),
    locationId: typeof data.locationId === 'string' ? data.locationId : fallback?.locationId ?? null,
    projectId: project.id,
    title: typeof data.title === 'string' ? data.title : fallback?.title ?? project.title,
    notes: typeof data.notes === 'string' ? data.notes : fallback?.notes ?? null,
    categoryIds,
    tagIds,
    staffIds,
    ...counts,
    cohorts: Array.isArray(data.cohorts) ? data.cohorts : fallback?.cohorts ?? cohortBreakdown(counts, `${fallback?.id || 'new'}:${Date.now()}`),
  };
}

export function createDemoActivity(data: Partial<Activity> & Record<string, unknown>): Activity {
  const activity = normalizeActivityPayload(data);
  store.activities.unshift(activity);
  store.activities.sort(compareActivityRecordsDesc);
  addAudit('activity', activity.id, 'create', activity.title);
  return clone(hydrateActivity(activity));
}

export function updateDemoActivity(id: string, data: Partial<Activity> & Record<string, unknown>): Activity {
  const index = store.activities.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error('Aktivitaet nicht gefunden');
  const updated = normalizeActivityPayload(data, store.activities[index]);
  store.activities[index] = updated;
  store.activities.sort(compareActivityRecordsDesc);
  addAudit('activity', updated.id, 'update', updated.title);
  return clone(hydrateActivity(updated));
}

export function deleteDemoActivity(id: string) {
  store.activities = store.activities.filter((entry) => entry.id !== id);
  delete store.acks[id];
  addAudit('activity', id, 'delete', id);
}

export function getDemoActivityAcks(activityIds: string[]): Record<string, boolean> {
  return Object.fromEntries(activityIds.map((id) => [id, store.acks[id] === true]));
}

export function setDemoActivityAck(activityId: string, done: boolean) {
  store.acks[activityId] = done;
  return { activityId, done };
}

function participantValue(activity: Activity, field: 'countMale' | 'countFemale' | 'countDiverse' | 'countTotal'): number {
  if (activity.executionStatus === 'cancelled') return 0;
  return Number(activity[field] || 0);
}

export function getDemoStatsSummary(params: DemoQueryParams = {}) {
  const activities = filterActivityRecords(params).map(hydrateActivity);
  const totalActivities = activities.length;
  const totalParticipants = activities.reduce((sum, activity) => sum + participantValue(activity, 'countTotal'), 0);
  const totalDurationMinutes = activities.reduce(
    (sum, activity) => sum + (activity.executionStatus === 'cancelled' ? 0 : activity.durationMinutes || 0),
    0,
  );
  return {
    totalActivities,
    totalParticipants,
    totalDurationMinutes,
    totalHours: Math.round((totalDurationMinutes / 60) * 10) / 10,
    averageParticipants: totalActivities > 0 ? Math.round((totalParticipants / totalActivities) * 10) / 10 : 0,
  };
}

function incrementMap(map: Map<string, number>, key: string, value = 1) {
  map.set(key, (map.get(key) || 0) + value);
}

function mergeIntervals(intervals: Array<[number, number]>) {
  if (!intervals.length) return 0;
  const sorted = [...intervals].sort((left, right) => left[0] - right[0]);
  let total = 0;
  let [start, end] = sorted[0];
  for (const [nextStart, nextEnd] of sorted.slice(1)) {
    if (nextStart <= end) end = Math.max(end, nextEnd);
    else {
      total += end - start;
      start = nextStart;
      end = nextEnd;
    }
  }
  return total + end - start;
}

function getDemoWeeklyProfile(activities: Activity[]): WeeklyProfile {
  const slotMinutes = 30;
  const dayDates = Array.from({ length: 7 }, () => new Set<string>());
  const dayActivityMinutes = Array<number>(7).fill(0);
  const dayParticipantTotals = Array<number>(7).fill(0);
  const dayActivityCounts = Array<number>(7).fill(0);
  const dayIntervals = new Map<string, Array<[number, number]>>();
  const slotStats = new Map<string, WeeklyProfileSlot>();
  const slotIntervals = new Map<string, Array<[number, number]>>();
  let excludedWithoutTime = 0;
  let earliest = 24 * 60;
  let latest = 0;

  for (const activity of activities) {
    const date = activity.date?.slice(0, 10);
    if (!date) {
      excludedWithoutTime += 1;
      continue;
    }
    const weekday = parseDate(date).getDay();
    dayDates[weekday].add(date);
    const start = timeToMinutes(activity.startTime);
    const end = timeToMinutes(activity.endTime);
    if (start === undefined || end === undefined || end <= start) {
      excludedWithoutTime += 1;
      continue;
    }

    const participants = Number(activity.countTotal || 0);
    earliest = Math.min(earliest, start);
    latest = Math.max(latest, end);
    dayActivityMinutes[weekday] += end - start;
    dayParticipantTotals[weekday] += participants;
    dayActivityCounts[weekday] += 1;
    const intervals = dayIntervals.get(`${weekday}:${date}`) || [];
    intervals.push([start, end]);
    dayIntervals.set(`${weekday}:${date}`, intervals);

    const firstSlot = Math.floor(start / slotMinutes) * slotMinutes;
    const lastSlot = Math.ceil(end / slotMinutes) * slotMinutes - slotMinutes;
    for (let slotStart = firstSlot; slotStart <= lastSlot; slotStart += slotMinutes) {
      const slotEnd = slotStart + slotMinutes;
      const overlap = Math.max(0, Math.min(end, slotEnd) - Math.max(start, slotStart));
      if (!overlap) continue;
      const key = `${weekday}:${slotStart}`;
      const stat = slotStats.get(key) || {
        weekday,
        startMinute: slotStart,
        endMinute: slotEnd,
        activityMinutes: 0,
        coveredMinutes: 0,
        activityCount: 0,
        participantTotal: 0,
        averageOffers: 0,
        coverageFrequency: 0,
        averageParticipants: 0,
      };
      stat.activityMinutes += overlap;
      stat.activityCount += 1;
      stat.participantTotal += participants;
      slotStats.set(key, stat);
      const intervalKey = `${key}:${date}`;
      const slotIntervalList = slotIntervals.get(intervalKey) || [];
      slotIntervalList.push([Math.max(start, slotStart), Math.min(end, slotEnd)]);
      slotIntervals.set(intervalKey, slotIntervalList);
    }
  }

  for (const [key, intervals] of slotIntervals) {
    const [weekday, startMinute] = key.split(':');
    const stat = slotStats.get(`${weekday}:${startMinute}`);
    if (stat) stat.coveredMinutes += mergeIntervals(intervals);
  }

  const days: WeeklyProfileDay[] = Array.from({ length: 7 }, (_, weekday) => {
    const coveredMinutes = Array.from(dayDates[weekday]).reduce(
      (total, date) => total + mergeIntervals(dayIntervals.get(`${weekday}:${date}`) || []),
      0,
    );
    const occurrences = dayDates[weekday].size;
    return {
      weekday,
      occurrences,
      activityCount: dayActivityCounts[weekday],
      activityMinutes: dayActivityMinutes[weekday],
      coveredMinutes,
      participantTotal: dayParticipantTotals[weekday],
      averageParticipants:
        dayActivityCounts[weekday] > 0
          ? +(dayParticipantTotals[weekday] / dayActivityCounts[weekday]).toFixed(1)
          : 0,
    };
  });
  const rangeStart = earliest < 24 * 60 ? Math.max(0, Math.floor(earliest / slotMinutes) * slotMinutes) : 8 * 60;
  const rangeEnd = latest > 0 ? Math.min(24 * 60, Math.ceil(latest / slotMinutes) * slotMinutes) : 22 * 60;
  const slots = Array.from(slotStats.values())
    .filter((slot) => slot.startMinute >= rangeStart && slot.startMinute < rangeEnd)
    .map((slot) => {
      const occurrences = dayDates[slot.weekday].size;
      return {
        ...slot,
        averageOffers: slot.activityMinutes / (slotMinutes * Math.max(1, occurrences)),
        coverageFrequency: slot.coveredMinutes / (slotMinutes * Math.max(1, occurrences)),
        averageParticipants:
          slot.activityCount > 0 ? +(slot.participantTotal / slot.activityCount).toFixed(1) : 0,
      };
    })
    .sort((left, right) => left.weekday - right.weekday || left.startMinute - right.startMinute);

  return { slotMinutes, rangeStart, rangeEnd, excludedWithoutTime, days, slots };
}

export function getDemoStatsOverview(params: DemoQueryParams = {}): StatsOverviewResponse {
  const activities = filterActivityRecords(params).map(hydrateActivity);
  const summaryBase = getDemoStatsSummary(params);
  const byType = new Map<string, { count: number; totalParticipants: number }>();
  const byCohort = new Map<string, { male: number; female: number; diverse: number }>();
  const byCategory = new Map<string, number>();
  const byTag = new Map<string, number>();
  const byProject = new Map<string, number>();
  const byDate = new Map<string, { totalParticipants: number; activityCount: number; totalDurationMinutes: number }>();
  let totalMale = 0;
  let totalFemale = 0;
  let totalDiverse = 0;

  for (const activity of activities) {
    const male = participantValue(activity, 'countMale');
    const female = participantValue(activity, 'countFemale');
    const diverse = participantValue(activity, 'countDiverse');
    const total = participantValue(activity, 'countTotal');
    totalMale += male;
    totalFemale += female;
    totalDiverse += diverse;
    const typeEntry = byType.get(activity.type) || { count: 0, totalParticipants: 0 };
    typeEntry.count += 1;
    typeEntry.totalParticipants += total;
    byType.set(activity.type, typeEntry);
    const dateEntry = byDate.get(activity.date) || { totalParticipants: 0, activityCount: 0, totalDurationMinutes: 0 };
    dateEntry.totalParticipants += total;
    dateEntry.activityCount += 1;
    if (activity.executionStatus !== 'cancelled') dateEntry.totalDurationMinutes += activity.durationMinutes || 0;
    byDate.set(activity.date, dateEntry);
    (activity.cohorts || []).forEach((cohort) => {
      const entry = byCohort.get(cohort.cohortId) || { male: 0, female: 0, diverse: 0 };
      entry.male += activity.executionStatus === 'cancelled' ? 0 : cohort.m || 0;
      entry.female += activity.executionStatus === 'cancelled' ? 0 : cohort.w || 0;
      entry.diverse += activity.executionStatus === 'cancelled' ? 0 : cohort.d || 0;
      byCohort.set(cohort.cohortId, entry);
    });
    (activity.categories || []).forEach((category) => incrementMap(byCategory, category.id));
    (activity.tags || []).forEach((tag) => incrementMap(byTag, tag.id));
    if (activity.project?.id) incrementMap(byProject, activity.project.id);
  }

  const availableYears = Array.from(new Set(store.activities.map((activity) => activity.date.slice(0, 4)))).sort();
  return {
    summary: {
      ...summaryBase,
      totalMale,
      totalFemale,
      totalDiverse,
      closureDaysCount: store.closureDays.filter((closure) => {
        const from = typeof params.from === 'string' ? params.from : store.windowStart;
        const to = typeof params.to === 'string' ? params.to : store.windowEnd;
        return closure.date >= from && closure.date <= to;
      }).length,
    },
    byType: Array.from(byType.entries()).map(([type, value]) => ({ type, ...value })),
    gender: { male: totalMale, female: totalFemale, diverse: totalDiverse },
    participantsTimeseries: Array.from(byDate.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, value]) => ({ date, ...value })),
    byCohort: Array.from(byCohort.entries()).map(([cohortId, value]) => ({
      cohortId,
      name: store.cohorts.find((cohort) => cohort.id === cohortId)?.name || cohortId,
      total: value.male + value.female + value.diverse,
      ...value,
    })),
    byCategory: Array.from(byCategory.entries()).map(([id, count]) => ({ id, name: store.categories.find((category) => category.id === id)?.name || id, count })),
    topTags: Array.from(byTag.entries()).map(([id, count]) => ({ id, name: store.tags.find((tag) => tag.id === id)?.name || id, count })).sort((left, right) => right.count - left.count),
    topProjects: Array.from(byProject.entries()).map(([id, count]) => ({ id, name: store.projects.find((project) => project.id === id)?.title || id, count })).sort((left, right) => right.count - left.count),
    availableYears,
    weeklyProfile: getDemoWeeklyProfile(activities),
  };
}

export function getDemoStatsByCohort() {
  const overview = getDemoStatsOverview({});
  return overview.byCohort.map((entry) => ({ cohortId: entry.cohortId, name: entry.name, total: entry.total, activities: filterActivityRecords({ cohortIds: entry.cohortId }).length }));
}

export function listDemoAuditLogs(params: DemoQueryParams = {}): AuditLog[] {
  const limit = Math.max(1, Math.min(100, readNumber(params.limit) || 10));
  const actions = new Set(readStringList(params.actions));
  const logs = store.auditLogs.filter((log) => actions.size === 0 || actions.has(log.action));
  return clone(logs.slice(0, limit));
}

export function getDemoAuditMetrics() {
  return {
    global: {
      totalUsers: 1,
      totalOrgs: 1,
      totalActivities: store.activities.length,
      totalProjects: store.projects.length,
      loginsLast7Days: 1,
      activeUsersLast30Days: 1,
    },
    orgs: [{ id: DEMO_ORG_ID, name: 'Demo Jugendhaus', users: 1, activities: store.activities.length, projects: store.projects.length, attachmentCount: 0, attachmentBytes: 0 }],
    topUsers30d: [{ id: store.user.id, name: store.user.name, email: store.user.email, role: store.user.role, orgId: DEMO_ORG_ID, lastLoginAt: store.generatedAt, loginCount30d: 1 }],
  };
}

export function getDemoOpeningHours(): OpeningHours {
  return clone(store.openingHours);
}

export function updateDemoOpeningHours(hours: OpeningHours): OpeningHours {
  store.openingHours = clone(hours);
  return getDemoOpeningHours();
}

export function listDemoClosureDays(params: DemoQueryParams = {}): OrganizationClosureDay[] {
  const from = typeof params.from === 'string' ? params.from : undefined;
  const to = typeof params.to === 'string' ? params.to : undefined;
  return clone(store.closureDays.filter((closure) => (!from || closure.date >= from) && (!to || closure.date <= to)));
}

export function upsertDemoClosureDay(date: string, data: Partial<OrganizationClosureDay>): OrganizationClosureDay[] {
  const existing = store.closureDays.find((closure) => closure.date === date);
  if (existing) Object.assign(existing, { from: data.from ?? null, to: data.to ?? null });
  else store.closureDays.push({ date, from: data.from ?? null, to: data.to ?? null });
  store.closureDays.sort((left, right) => left.date.localeCompare(right.date));
  return listDemoClosureDays();
}

export function deleteDemoClosureDay(date: string): OrganizationClosureDay[] {
  store.closureDays = store.closureDays.filter((closure) => closure.date !== date);
  return listDemoClosureDays();
}

export function listDemoProjectTemplates(ownedOnly = false): ProjectTemplateDto[] {
  return clone(store.projectTemplates.filter((template) => !ownedOnly || template.orgId === DEMO_ORG_ID));
}

export function createDemoProjectTemplate(data: Partial<ProjectTemplateDto>): ProjectTemplateDto {
  const template: DemoProjectTemplate = {
    id: nextId('template'),
    title: String(data.title || 'Neue Vorlage'),
    type: activityType(data.type) as ProjectTemplateDto['type'],
    targetGroup: data.targetGroup ?? null,
    description: data.description ?? null,
    categoryName: data.categoryName ?? null,
    categoryColor: data.categoryColor ?? null,
    tags: data.tags ?? null,
    imageUrl: data.imageUrl ?? null,
    color: data.color ?? null,
    archived: data.archived ?? false,
    orgId: DEMO_ORG_ID,
    org: { id: DEMO_ORG_ID, name: 'Demo Jugendhaus' },
  };
  store.projectTemplates.push(template);
  return clone(template);
}

export function updateDemoProjectTemplate(id: string, data: Partial<ProjectTemplateDto>): ProjectTemplateDto {
  const template = store.projectTemplates.find((entry) => entry.id === id);
  if (!template) throw new Error('Vorlage nicht gefunden');
  Object.assign(template, data, { id, orgId: DEMO_ORG_ID });
  return clone(template);
}

export function deleteDemoProjectTemplate(id: string) {
  store.projectTemplates = store.projectTemplates.filter((entry) => entry.id !== id);
}

export function getDemoProcessAccess() {
  return { enabled: true, canEdit: true, orgId: DEMO_ORG_ID };
}

export function listDemoProcesses(): ProcessDto[] {
  return clone([...store.processes].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title)));
}

export function createDemoProcess(data: Partial<ProcessWriteData>): ProcessDto {
  const now = new Date().toISOString();
  const process: ProcessDto = {
    id: nextId('process'),
    orgId: DEMO_ORG_ID,
    title: String(data.title || 'Neuer Prozess').trim() || 'Neuer Prozess',
    purpose: typeof data.purpose === 'string' ? data.purpose : null,
    definition: data.definition || { schemaVersion: 1, nodes: [], edges: [] },
    createdByUserId: DEMO_USER_ID,
    createdAt: now,
    updatedAt: now,
  };
  store.processes.unshift(process);
  addAudit('process', process.id, 'create', process.title);
  return clone(process);
}

export function updateDemoProcess(id: string, data: Partial<ProcessWriteData>): ProcessDto {
  const process = store.processes.find((entry) => entry.id === id);
  if (!process) throw new Error('Prozess nicht gefunden');
  if (typeof data.title === 'string') process.title = data.title.trim() || process.title;
  if (typeof data.purpose !== 'undefined') process.purpose = typeof data.purpose === 'string' ? data.purpose : null;
  if (data.definition) process.definition = data.definition;
  process.updatedAt = new Date().toISOString();
  addAudit('process', process.id, 'update', process.title);
  return clone(process);
}

export function deleteDemoProcess(id: string) {
  const process = store.processes.find((entry) => entry.id === id);
  if (!process) throw new Error('Prozess nicht gefunden');
  store.processes = store.processes.filter((entry) => entry.id !== id);
  addAudit('process', process.id, 'delete', process.title);
}

export function getDemoGeneratedInfo() {
  return { generatedAt: store.generatedAt, windowStart: store.windowStart, windowEnd: store.windowEnd };
}

export function runDemoTestDataGeneration() {
  resetDemoStore();
  return {
    orgId: DEMO_ORG_ID,
    orgName: 'Demo Jugendhaus',
    preset: 'realistic',
    config: { projects: store.projects.length, activities: store.activities.length, monthsBack: 12, clearExisting: true },
    cleanedUp: { deletedActivities: 0, deletedProjects: 0 },
    created: {
      projects: store.projects.length,
      activities: store.activities.length,
      categories: store.categories.length,
      tags: store.tags.length,
      locations: store.locations.length,
      cohorts: store.cohorts.length,
      staff: store.staff.length,
    },
  };
}

export function deleteDemoGeneratedTestData() {
  const deletedActivities = store.activities.length;
  const deletedProjects = store.projects.length;
  store.activities = [];
  store.projects = [];
  return { deletedActivities, deletedProjects };
}

function hydrateLogbookEntry(entry: DemoLogbookEntry): LogbookEntry {
  const activity = entry.activityId ? store.activities.find((item) => item.id === entry.activityId) : undefined;
  const project = entry.projectId ? store.projects.find((item) => item.id === entry.projectId) : undefined;
  return clone({
    ...entry,
    activity: activity ? hydrateActivity(activity) : null,
    project: project ? hydrateProject(project) : null,
    comments: entry.comments || [],
    commentCount: entry.comments?.length || 0,
  });
}

export function listDemoLogbookEntries(params: DemoQueryParams) {
  const search = String(params.search || '').trim().toLowerCase();
  const filtered = store.logbookEntries
    .filter((entry) => {
      if (params.includeArchived !== true && params.includeArchived !== 'true' && entry.status === 'archived') return false;
      if (params.type && entry.type !== params.type) return false;
      if (params.status && entry.status !== params.status) return false;
      if (params.activityId && entry.activityId !== params.activityId) return false;
      if (params.projectId && entry.projectId !== params.projectId) return false;
      if (params.from && entry.occurredAt.slice(0, 10) < String(params.from)) return false;
      if (params.to && entry.occurredAt.slice(0, 10) > String(params.to)) return false;
      return !search || `${entry.title} ${entry.body}`.toLowerCase().includes(search);
    })
    .sort((left, right) => {
      const priority: Record<string, number> = { open: 0, follow_up: 1, discussed: 2, archived: 3 };
      const statusDiff = (priority[left.status] ?? 3) - (priority[right.status] ?? 3);
      return statusDiff || right.occurredAt.localeCompare(left.occurredAt);
    });
  const page = Math.max(Number(params.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(params.limit) || 30, 1), 100);
  return clone({ data: filtered.slice((page - 1) * pageSize, page * pageSize).map(hydrateLogbookEntry), total: filtered.length, page, pageSize });
}

export function getDemoLogbookEntry(id: string) {
  const entry = store.logbookEntries.find((item) => item.id === id);
  return entry ? hydrateLogbookEntry(entry) : undefined;
}

export function createDemoLogbookEntry(data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const status = (data.status === 'follow_up' || data.status === 'discussed' ? data.status : 'open') as LogbookEntryStatus;
  const entry: DemoLogbookEntry = {
    id: nextId('logbook'), orgId: DEMO_ORG_ID, occurredAt: typeof data.occurredAt === 'string' ? data.occurredAt : now,
    type: (typeof data.type === 'string' ? data.type : 'observation') as LogbookEntryType,
    title: String(data.title || 'Ohne Titel'), body: String(data.body || ''), highlights: typeof data.highlights === 'string' ? data.highlights : null, challenges: typeof data.challenges === 'string' ? data.challenges : null, nextSteps: typeof data.nextSteps === 'string' ? data.nextSteps : null,
    status, visibility: data.visibility === 'admins' ? 'admins' : 'team', activityId: typeof data.activityId === 'string' ? data.activityId : null, projectId: typeof data.projectId === 'string' ? data.projectId : null,
    createdByUserId: store.user.id, createdByName: store.user.name, updatedByUserId: store.user.id, updatedByName: store.user.name,
    documentationUpdatedByUserId: null, documentationUpdatedByName: null, documentationUpdatedAt: null,
    discussedByUserId: status === 'discussed' ? store.user.id : null, discussedByName: status === 'discussed' ? store.user.name : null, discussedAt: status === 'discussed' ? now : null, archivedAt: null, createdAt: now, updatedAt: now, comments: [], commentCount: 0,
  };
  store.logbookEntries.unshift(entry);
  addAudit('logbook_entry', entry.id, 'create', entry.title);
  return hydrateLogbookEntry(entry);
}

export function updateDemoLogbookEntry(id: string, data: LogbookEntryInput) {
  const entry = store.logbookEntries.find((item) => item.id === id);
  if (!entry) throw new Error('Logbucheintrag nicht gefunden');
  const now = new Date().toISOString();
  const documentationFields: (keyof LogbookEntryInput)[] = [
    'occurredAt', 'type', 'title', 'body', 'highlights', 'challenges', 'nextSteps',
    'visibility', 'activityId', 'projectId',
  ];
  const documentationChanged = documentationFields.some((field) =>
    Object.prototype.hasOwnProperty.call(data, field) &&
    entry[field as keyof DemoLogbookEntry] !== data[field],
  );
  Object.assign(entry, data, { updatedByUserId: store.user.id, updatedByName: store.user.name, updatedAt: now });
  if (documentationChanged) {
    entry.documentationUpdatedByUserId = store.user.id;
    entry.documentationUpdatedByName = store.user.name;
    entry.documentationUpdatedAt = now;
  }
  if (entry.status === 'discussed' && !entry.discussedAt) {
    entry.discussedAt = new Date().toISOString(); entry.discussedByUserId = store.user.id; entry.discussedByName = store.user.name;
  }
  addAudit('logbook_entry', entry.id, 'update', entry.title);
  return hydrateLogbookEntry(entry);
}

export function setDemoLogbookStatus(id: string, status: LogbookEntryStatus) {
  const entry = store.logbookEntries.find((item) => item.id === id);
  if (!entry) throw new Error('Logbucheintrag nicht gefunden');
  entry.status = status; entry.updatedAt = new Date().toISOString();
  if (status === 'discussed') { entry.discussedAt = entry.updatedAt; entry.discussedByUserId = store.user.id; entry.discussedByName = store.user.name; }
  else { entry.discussedAt = null; entry.discussedByUserId = null; entry.discussedByName = null; }
  addAudit('logbook_entry', entry.id, 'update', entry.title);
  return hydrateLogbookEntry(entry);
}

export function archiveDemoLogbookEntry(id: string) {
  const entry = store.logbookEntries.find((item) => item.id === id);
  if (!entry) throw new Error('Logbucheintrag nicht gefunden');
  entry.status = 'archived'; entry.archivedAt = new Date().toISOString(); entry.updatedAt = entry.archivedAt;
  addAudit('logbook_entry', entry.id, 'delete', entry.title);
  return { id, archived: true };
}

export function restoreDemoLogbookEntry(id: string) {
  const entry = store.logbookEntries.find((item) => item.id === id);
  if (!entry) throw new Error('Logbucheintrag nicht gefunden');
  if (entry.status !== 'archived') throw new Error('Nur archivierte Einträge können wiederhergestellt werden');
  entry.status = 'open';
  entry.archivedAt = null;
  entry.updatedAt = new Date().toISOString();
  entry.updatedByUserId = store.user.id;
  entry.updatedByName = store.user.name;
  addAudit('logbook_entry', entry.id, 'update', entry.title);
  return hydrateLogbookEntry(entry);
}

export function createDemoLogbookComment(entryId: string, body: string): LogbookComment {
  const entry = store.logbookEntries.find((item) => item.id === entryId);
  if (!entry) throw new Error('Logbucheintrag nicht gefunden');
  const comment: LogbookComment = { id: nextId('logbook-comment'), entryId, body, createdByUserId: store.user.id, createdByName: store.user.name, createdAt: new Date().toISOString() };
  entry.comments = [...(entry.comments || []), comment]; entry.commentCount = entry.comments.length;
  addAudit('logbook_comment', comment.id, 'create', entry.title);
  return clone(comment);
}

export function removeDemoLogbookComment(entryId: string, commentId: string) {
  const entry = store.logbookEntries.find((item) => item.id === entryId);
  if (!entry) throw new Error('Logbucheintrag nicht gefunden');
  entry.comments = (entry.comments || []).filter((comment) => comment.id !== commentId); entry.commentCount = entry.comments.length;
  addAudit('logbook_comment', commentId, 'delete', entry.title);
  return { id: commentId, deleted: true };
}

function logbookSeed(activities: DemoActivityRecord[], projects: DemoProject[]): DemoLogbookEntry[] {
  const firstActivity = activities[0];
  const secondActivity = activities[1] || firstActivity;
  const thirdActivity = activities[2] || secondActivity;
  const project = projects.find((item) => item.id === firstActivity?.projectId) || projects[0];
  const secondProject = projects.find((item) => item.id !== project?.id) || project;
  const now = new Date();
  return [
    {
      id: 'logbook-demo-1', orgId: DEMO_ORG_ID, occurredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), type: 'handover', title: 'Übergabe am Nachmittag',
      body: 'Der offene Treff war gut besucht. Im Medienraum bitte vor dem nächsten Termin die Kopfhörer prüfen.', highlights: 'Neue Besucher:innen haben schnell Anschluss gefunden.', challenges: null, nextSteps: 'Kopfhörerbestand prüfen und bei Bedarf nachbestellen.',
      status: 'follow_up', visibility: 'team', activityId: firstActivity?.id || null, projectId: project?.id || null,
      createdByUserId: demoUser.id, createdByName: demoUser.name, updatedByUserId: demoUser.id, updatedByName: demoUser.name, documentationUpdatedByUserId: null, documentationUpdatedByName: null, documentationUpdatedAt: null, discussedByUserId: null, discussedByName: null, discussedAt: null, archivedAt: null,
      createdAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString(), updatedAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
      comments: [{ id: 'logbook-comment-demo-1', entryId: 'logbook-demo-1', body: 'Ich kümmere mich morgen um die Bestandsaufnahme.', createdByUserId: demoUser.id, createdByName: demoUser.name, createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString() }], commentCount: 1,
    },
    {
      id: 'logbook-demo-2', orgId: DEMO_ORG_ID, occurredAt: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(), type: 'success', title: 'Gelungener Projektabschluss',
      body: 'Die Abschlusspräsentation wurde von Jugendlichen und Eltern sehr positiv aufgenommen.', highlights: 'Gute Rollenverteilung und starke Beteiligung.', challenges: null, nextSteps: null,
      status: 'discussed', visibility: 'team', activityId: null, projectId: project?.id || null,
      createdByUserId: demoUser.id, createdByName: demoUser.name, updatedByUserId: demoUser.id, updatedByName: demoUser.name, documentationUpdatedByUserId: null, documentationUpdatedByName: null, documentationUpdatedAt: null, discussedByUserId: demoUser.id, discussedByName: demoUser.name, discussedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), archivedAt: null,
      createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(), updatedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), comments: [], commentCount: 0,
    },
    {
      id: 'logbook-demo-3', orgId: DEMO_ORG_ID, occurredAt: new Date(now.getTime() - 50 * 60 * 60 * 1000).toISOString(), type: 'observation', title: 'Neue Clique nutzt den Kreativraum',
      body: 'Vier Jugendliche kamen ohne Anmeldung vorbei und haben den Kreativraum eigenständig für Sticker-Entwürfe genutzt. Die Gruppe wirkte neugierig, aber noch zurückhaltend gegenüber dem Team.',
      highlights: 'Gute Gelegenheit, das offene Kreativangebot als niedrigschwelligen Einstieg zu zeigen.', challenges: 'Material wurde teilweise offen liegen gelassen.', nextSteps: 'Beim nächsten Besuch kurz Materialregeln erklären und eine feste Box für angefangene Entwürfe anbieten.',
      status: 'open', visibility: 'team', activityId: secondActivity?.id || null, projectId: secondProject?.id || null,
      createdByUserId: demoUser.id, createdByName: demoUser.name, updatedByUserId: demoUser.id, updatedByName: demoUser.name, discussedByUserId: null, discussedByName: null, discussedAt: null, archivedAt: null,
      createdAt: new Date(now.getTime() - 49 * 60 * 60 * 1000).toISOString(), updatedAt: new Date(now.getTime() - 49 * 60 * 60 * 1000).toISOString(),
      comments: [{ id: 'logbook-comment-demo-3', entryId: 'logbook-demo-3', body: 'Ich lege morgen eine beschriftete Materialbox bereit.', createdByUserId: demoUser.id, createdByName: demoUser.name, createdAt: new Date(now.getTime() - 47 * 60 * 60 * 1000).toISOString() }], commentCount: 1,
    },
    {
      id: 'logbook-demo-4', orgId: DEMO_ORG_ID, occurredAt: new Date(now.getTime() - 74 * 60 * 60 * 1000).toISOString(), type: 'incident', title: 'Konflikt beim Kochabend',
      body: 'Beim gemeinsamen Kochen gab es eine kurze verbale Auseinandersetzung zwischen zwei Teilnehmenden. Das Team konnte die Situation im Nebenraum beruhigen.',
      highlights: 'Beide Jugendlichen konnten danach wieder in die Gruppe zurückkehren.', challenges: 'Auslöser war vermutlich die Rollenverteilung in der Küche.', nextSteps: 'Beim nächsten Kochabend Aufgaben vorab sichtbar verteilen und kurz nachfragen, ob die Rollen passen.',
      status: 'follow_up', visibility: 'admins', activityId: thirdActivity?.id || null, projectId: project?.id || null,
      createdByUserId: demoUser.id, createdByName: demoUser.name, updatedByUserId: demoUser.id, updatedByName: demoUser.name, discussedByUserId: null, discussedByName: null, discussedAt: null, archivedAt: null,
      createdAt: new Date(now.getTime() - 73 * 60 * 60 * 1000).toISOString(), updatedAt: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
      comments: [
        { id: 'logbook-comment-demo-4a', entryId: 'logbook-demo-4', body: 'Bitte im Teammeeting kurz aufnehmen, damit alle dieselbe Ansprache nutzen.', createdByUserId: demoUser.id, createdByName: demoUser.name, createdAt: new Date(now.getTime() - 71 * 60 * 60 * 1000).toISOString() },
        { id: 'logbook-comment-demo-4b', entryId: 'logbook-demo-4', body: 'Rollenkarte für Küche ist vorbereitet.', createdByUserId: demoUser.id, createdByName: demoUser.name, createdAt: new Date(now.getTime() - 68 * 60 * 60 * 1000).toISOString() },
      ], commentCount: 2,
    },
    {
      id: 'logbook-demo-5', orgId: DEMO_ORG_ID, occurredAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), type: 'debrief', title: 'Debriefing zur Ferienaktion',
      body: 'Die Ferienaktion lief stabil, die spontanen Tagesgäste konnten gut integriert werden. Für das nächste Mal sollte die Materialplanung früher abgeschlossen sein.',
      highlights: 'Hohe Beteiligung am Abschlusstag und mehrere neue Kontakte für Folgeangebote.', challenges: 'Zu wenig Puffer beim Aufbau und bei der Ausgabe von Material.', nextSteps: 'Checkliste für Aufbau, Material und Zuständigkeiten in die Projektvorlage übernehmen.',
      status: 'discussed', visibility: 'team', activityId: null, projectId: secondProject?.id || null,
      createdByUserId: demoUser.id, createdByName: demoUser.name, updatedByUserId: demoUser.id, updatedByName: demoUser.name, discussedByUserId: demoUser.id, discussedByName: demoUser.name, discussedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(), archivedAt: null,
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(), updatedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      comments: [{ id: 'logbook-comment-demo-5', entryId: 'logbook-demo-5', body: 'Checkliste passt gut als Vorlage für Herbstferien.', createdByUserId: demoUser.id, createdByName: demoUser.name, createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString() }], commentCount: 1,
    },
  ];
}
