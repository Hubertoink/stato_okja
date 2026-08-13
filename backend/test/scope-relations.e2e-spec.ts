import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { ActivitiesController } from '../src/activities/activities.controller';
import { ActivitiesService } from '../src/activities/activities.service';
import { Activity } from '../src/activities/entities/activity.entity';
import { Location } from '../src/locations/entities/location.entity';
import { LocationsController } from '../src/locations/locations.controller';
import { LocationsService } from '../src/locations/locations.service';
import { Staff } from '../src/staff/entities/staff.entity';
import { StaffController } from '../src/staff/staff.controller';
import { StaffService } from '../src/staff/staff.service';
import { Project } from '../src/projects/entities/project.entity';
import { ProjectDocument } from '../src/projects/entities/project-document.entity';
import { ProjectsController } from '../src/projects/projects.controller';
import { ProjectsService } from '../src/projects/projects.service';
import { Category } from '../src/taxonomy/entities/category.entity';
import { Tag } from '../src/taxonomy/entities/tag.entity';
import { Cohort } from '../src/taxonomy/entities/cohort.entity';
import { OrgsService } from '../src/orgs/orgs.service';
import { AuditService } from '../src/common/audit.service';
import { JwtAuthGuard } from '../src/auth/jwt.guard';
import { OrgScopeGuard } from '../src/auth/org-scope.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { ActivityType, StaffRole } from '../src/common/enums';

const ROOT_ORG_ID = '10000000-0000-4000-8000-000000000001';
const CHILD_ORG_ID = '10000000-0000-4000-8000-000000000002';
const OUTSIDE_ORG_ID = '10000000-0000-4000-8000-000000000003';
const CHILD_ACTIVITY_ID = '20000000-0000-4000-8000-000000000001';
const OUTSIDE_ACTIVITY_ID = '20000000-0000-4000-8000-000000000002';
const CHILD_LOCATION_ID = '30000000-0000-4000-8000-000000000001';
const OUTSIDE_LOCATION_ID = '30000000-0000-4000-8000-000000000002';
const CHILD_STAFF_ID = '40000000-0000-4000-8000-000000000001';
const OUTSIDE_STAFF_ID = '40000000-0000-4000-8000-000000000002';
const CHILD_PROJECT_ID = '50000000-0000-4000-8000-000000000001';
const OUTSIDE_PROJECT_ID = '50000000-0000-4000-8000-000000000002';

class HeaderTestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest() as {
      headers: Record<string, string | undefined>;
      user?: unknown;
    };
    request.user = JSON.parse(request.headers['x-test-user'] || '{}');
    return true;
  }
}

function scopedEditorHeader() {
  return JSON.stringify({
    id: '60000000-0000-4000-8000-000000000001',
    role: 'editor',
    orgId: ROOT_ORG_ID,
    name: 'Scope Test',
  });
}

describe('Organization scope and activity relation regression (HTTP)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const activities = new Map<string, Record<string, unknown>>([
      [CHILD_ACTIVITY_ID, { id: CHILD_ACTIVITY_ID, date: '2026-08-13', type: ActivityType.EVENT, title: 'Child activity', orgId: CHILD_ORG_ID }],
      [OUTSIDE_ACTIVITY_ID, { id: OUTSIDE_ACTIVITY_ID, date: '2026-08-13', type: ActivityType.EVENT, title: 'Outside activity', orgId: OUTSIDE_ORG_ID }],
    ]);
    const locations = new Map<string, Record<string, unknown>>([
      [CHILD_LOCATION_ID, { id: CHILD_LOCATION_ID, name: 'Child location', orgId: CHILD_ORG_ID, active: true }],
      [OUTSIDE_LOCATION_ID, { id: OUTSIDE_LOCATION_ID, name: 'Outside location', orgId: OUTSIDE_ORG_ID, active: true }],
    ]);
    const staff = new Map<string, Record<string, unknown>>([
      [CHILD_STAFF_ID, { id: CHILD_STAFF_ID, name: 'Child staff', role: StaffRole.EMPLOYEE, orgId: CHILD_ORG_ID, active: true }],
      [OUTSIDE_STAFF_ID, { id: OUTSIDE_STAFF_ID, name: 'Outside staff', role: StaffRole.EMPLOYEE, orgId: OUTSIDE_ORG_ID, active: true }],
    ]);
    const projects = new Map<string, Record<string, unknown>>([
      [CHILD_PROJECT_ID, { id: CHILD_PROJECT_ID, title: 'Child project', type: ActivityType.EVENT, orgId: CHILD_ORG_ID }],
      [OUTSIDE_PROJECT_ID, { id: OUTSIDE_PROJECT_ID, title: 'Outside project', type: ActivityType.EVENT, orgId: OUTSIDE_ORG_ID }],
    ]);
    let generatedActivityId = 0;

    const findByIds = (source: Map<string, Record<string, unknown>>, ids: string[]) =>
      ids.map((id) => source.get(id)).filter((entry): entry is Record<string, unknown> => Boolean(entry));
    const subtree = (orgId: string) => orgId === ROOT_ORG_ID ? [ROOT_ORG_ID, CHILD_ORG_ID] : [orgId];
    const orgs = {
      getSubtreeOrgIds: jest.fn(async (orgId: string) => subtree(orgId)),
      getResolvedOrgScope: jest.fn(async (orgId: string | null) =>
        orgId === null ? { orgId: null } : { orgId, orgIds: subtree(orgId) },
      ),
      assertTaxonomyIdsVisibleForOrg: jest.fn(async () => undefined),
    };
    const activityRepository = {
      findOne: jest.fn(async ({ where }: { where: { id: string } }) => activities.get(where.id) ?? null),
      create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
      save: jest.fn(async (activity: Record<string, unknown>) => {
        const id = String(activity.id || `90000000-0000-4000-8000-${String(++generatedActivityId).padStart(12, '0')}`);
        const saved = { ...activity, id };
        activities.set(id, saved);
        return saved;
      }),
    };
    const locationRepository = {
      find: jest.fn(),
      findOne: jest.fn(async ({ where }: { where: { id: string } }) => locations.get(where.id) ?? null),
      create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
      save: jest.fn(async (value: Record<string, unknown>) => value),
      update: jest.fn(async (id: string, data: Record<string, unknown>) => {
        locations.set(id, { ...locations.get(id), ...data });
      }),
      delete: jest.fn(),
    };
    const staffRepository = {
      find: jest.fn(),
      findOne: jest.fn(async ({ where }: { where: { id: string } }) => staff.get(where.id) ?? null),
      findBy: jest.fn(async ({ id }: { id: { _value: string[] } | string[] }) => {
        const ids = Array.isArray(id) ? id : id._value;
        return findByIds(staff, ids);
      }),
      create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
      save: jest.fn(async (value: Record<string, unknown>) => value),
      update: jest.fn(async (id: string, data: Record<string, unknown>) => {
        staff.set(id, { ...staff.get(id), ...data });
      }),
      delete: jest.fn(),
    };
    const projectRepository = {
      findOne: jest.fn(async ({ where }: { where: { id: string } }) => projects.get(where.id) ?? null),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivitiesController, LocationsController, StaffController, ProjectsController],
      providers: [
        ActivitiesService,
        LocationsService,
        StaffService,
        ProjectsService,
        OrgScopeGuard,
        RolesGuard,
        Reflector,
        { provide: OrgsService, useValue: orgs },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: getRepositoryToken(Activity), useValue: activityRepository },
        { provide: getRepositoryToken(Location), useValue: locationRepository },
        { provide: getRepositoryToken(Staff), useValue: staffRepository },
        { provide: getRepositoryToken(Project), useValue: projectRepository },
        { provide: getRepositoryToken(ProjectDocument), useValue: {} },
        { provide: getRepositoryToken(Category), useValue: { findBy: jest.fn() } },
        { provide: getRepositoryToken(Tag), useValue: { findBy: jest.fn() } },
        { provide: getRepositoryToken(Cohort), useValue: { findBy: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(HeaderTestAuthGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  async function request(path: string, options: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        'x-test-user': scopedEditorHeader(),
        'x-org-scope': CHILD_ORG_ID,
        ...options.headers,
      },
    });
  }

  it('uses the selected child subtree consistently for details and mutations', async () => {
    for (const path of [
      `/activities/${CHILD_ACTIVITY_ID}`,
      `/locations/${CHILD_LOCATION_ID}`,
      `/staff/${CHILD_STAFF_ID}`,
      `/projects/${CHILD_PROJECT_ID}`,
    ]) {
      expect((await request(path)).status).toBe(200);
    }

    expect(
      (await request(`/activities/${CHILD_ACTIVITY_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated in child scope' }),
      })).status,
    ).toBe(200);

    for (const path of [
      `/activities/${OUTSIDE_ACTIVITY_ID}`,
      `/locations/${OUTSIDE_LOCATION_ID}`,
      `/staff/${OUTSIDE_STAFF_ID}`,
      `/projects/${OUTSIDE_PROJECT_ID}`,
    ]) {
      expect((await request(path)).status).toBe(403);
    }
  });

  it('rejects activity relations outside the activity organization', async () => {
    const baseActivity = {
      date: '2026-08-13',
      type: ActivityType.EVENT,
      title: 'Relation test',
      projectId: CHILD_PROJECT_ID,
      locationId: CHILD_LOCATION_ID,
      staffIds: [CHILD_STAFF_ID],
    };
    expect((await request('/activities', { method: 'POST', body: JSON.stringify(baseActivity) })).status).toBe(201);

    for (const invalidRelation of [
      { locationId: OUTSIDE_LOCATION_ID },
      { projectId: OUTSIDE_PROJECT_ID },
      { staffIds: [OUTSIDE_STAFF_ID] },
      { staffIds: ['70000000-0000-4000-8000-000000000001'] },
    ]) {
      expect(
        (await request('/activities', {
          method: 'POST',
          body: JSON.stringify({ ...baseActivity, ...invalidRelation }),
        })).status,
      ).toBe(400);
    }
  });

  it('applies DTO validation before a mutation reaches the service layer', async () => {
    expect(
      (await request('/activities', {
        method: 'POST',
        body: JSON.stringify({ date: '2026-08-13', type: ActivityType.EVENT, unexpected: 'must not be persisted' }),
      })).status,
    ).toBe(400);
    expect(
      (await request('/activities', {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-08-13',
          type: ActivityType.EVENT,
          cohorts: [{ cohortId: '80000000-0000-4000-8000-000000000001', m: -1 }],
        }),
      })).status,
    ).toBe(400);
  });
});
