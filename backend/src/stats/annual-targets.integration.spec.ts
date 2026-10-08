import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgsService } from '../orgs/orgs.service';
import { Activity } from '../activities/entities/activity.entity';
import { Project } from '../projects/entities/project.entity';
import { AnnualTarget } from './entities/annual-target.entity';
import { AnnualTargets20261008120000 } from '../database/migrations/20261008120000-annual-targets';
import { AnnualTargetPeriod20261008180000 } from '../database/migrations/20261008180000-annual-target-period';
import { AnnualTargetsController } from './annual-targets.controller';
import { AnnualTargetsService } from './annual-targets.service';
import { StatsService } from './stats.service';
import { AnnualTargetDto } from './dto/annual-target.dto';
import { annualTargetValue, berlinToday, evaluateAnnualTarget } from './annual-target-metrics';
import * as metrics from './annual-target-metrics';

const ORG = '11111111-1111-4111-8111-111111111111';
const FOREIGN = '22222222-2222-4222-8222-222222222222';
const PROJECT = '33333333-3333-4333-8333-333333333333';
const ACTIVITY = '44444444-4444-4444-8444-444444444444';
const columns = { id: { type: String, primary: true }, orgId: { type: String, nullable: true } };
const activitySchema = new EntitySchema({
  name: 'TargetActivityFixture',
  tableName: 'activities',
  columns: {
    ...columns,
    title: { type: String, nullable: true },
    date: { type: String },
    type: { type: String },
    executionStatus: { type: String },
    projectId: { type: String, nullable: true },
    durationMinutes: { type: Number },
    countTotal: { type: Number },
    countMale: { type: Number },
    countFemale: { type: Number },
    countDiverse: { type: Number },
  },
});
const projectSchema = new EntitySchema({
  name: 'TargetProjectFixture',
  tableName: 'projects',
  columns: { ...columns, title: { type: String }, imageUrl: { type: String, nullable: true } },
});

describe('Annual targets: persisted lifecycle, calculations and HTTP access', () => {
  let db: DataSource;
  let service: AnnualTargetsService;
  let app: INestApplication;
  let url: string;
  let membershipRole = 'org_admin';
  const oldFlag = process.env.ANNUAL_TARGETS_ENABLED;
  const payload = (extra: Partial<AnnualTargetDto> = {}): AnnualTargetDto => ({
    title: 'Offene Tür',
    year: 2025,
    metric: 'duration_hours',
    scope: { types: ['open_door'] },
    rule: 'min',
    target: 2,
    upperTarget: null,
    description: '',
    showOnDashboard: true,
    ...extra,
  });
  const request = async (path = '', method = 'GET', body?: unknown, role = membershipRole) => {
    const response = await fetch(`${url}/stats/annual-targets${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-test-role': role, 'X-Org-Scope': ORG },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqljs',
      entities: [AnnualTarget, activitySchema, projectSchema],
      synchronize: true,
    }).initialize();
    const stats = new StatsService(
      db,
      db.getRepository('TargetActivityFixture') as Repository<Activity>,
      {} as never,
      {} as never,
    );
    const module = await Test.createTestingModule({
      controllers: [AnnualTargetsController],
      providers: [
        AnnualTargetsService,
        { provide: getRepositoryToken(AnnualTarget), useValue: db.getRepository(AnnualTarget) },
        {
          provide: getRepositoryToken(Activity),
          useValue: db.getRepository('TargetActivityFixture'),
        },
        {
          provide: getRepositoryToken(Project),
          useValue: db.getRepository('TargetProjectFixture'),
        },
        { provide: StatsService, useValue: stats },
        {
          provide: OrgsService,
          useValue: { listActiveMemberships: async () => [{ orgId: ORG, role: membershipRole }] },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: any) {
          const req = context.switchToHttp().getRequest();
          req.user = { id: 'admin-id', orgId: ORG, role: req.headers['x-test-role'] };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
    service = module.get(AnnualTargetsService);
  });

  beforeEach(async () => {
    process.env.ANNUAL_TARGETS_ENABLED = 'true';
    membershipRole = 'org_admin';
    await db.getRepository(AnnualTarget).clear();
    await db.getRepository('TargetActivityFixture').clear();
    await db.getRepository('TargetProjectFixture').clear();
    await db
      .getRepository('TargetProjectFixture')
      .save([{ id: PROJECT, orgId: FOREIGN, title: 'Foreign project' }]);
    const row = {
      orgId: ORG,
      title: 'Treff',
      type: 'open_door',
      executionStatus: 'completed',
      projectId: null,
      durationMinutes: 60,
      countTotal: 10,
      countMale: 8,
      countFemale: 2,
      countDiverse: 0,
    };
    await db.getRepository('TargetActivityFixture').save([
      { ...row, id: ACTIVITY, date: '2025-01-01' },
      {
        ...row,
        id: 'feb',
        date: '2025-02-01',
        durationMinutes: 90,
        countTotal: 90,
        countMale: 18,
        countFemale: 72,
      },
      { ...row, id: 'cancelled', date: '2025-03-01', executionStatus: 'cancelled' },
      { ...row, id: 'foreign', date: '2025-03-01', orgId: FOREIGN },
      { ...row, id: 'old', date: '2024-12-31' },
      { ...row, id: 'next', date: '2026-01-01' },
      { ...row, id: 'project', date: '2025-04-01', type: 'project_open' },
    ]);
  });
  afterAll(async () => {
    await app?.close();
    await db?.destroy();
    if (oldFlag === undefined) delete process.env.ANNUAL_TARGETS_ENABLED;
    else process.env.ANNUAL_TARGETS_ENABLED = oldFlag;
  });

  it('creates scoped drafts and sums only completed activities in the year', async () => {
    const created = await request('', 'POST', payload());
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ status: 'draft', orgId: ORG, version: 1 });
    const listed = await request('?year=2025');
    expect(listed.data).toHaveLength(1);
    expect(listed.data[0].result).toMatchObject({
      value: 2.5,
      activityCount: 2,
      asOf: '2025-12-31',
    });
    expect(listed.data[0].history).toBeUndefined();
    const activities = await request(`/${created.data.id}/activities?page=1`);
    expect(activities.data.total).toBe(2);
  });

  it('weights gender shares across visits and supports combined types and a single activity', async () => {
    const target = await service.create(
      ORG,
      'admin',
      payload({ metric: 'female_share_percent', target: 40 }),
    );
    expect((await service.detail(ORG, target.id)).result.value).toBe(74);
    const combined = await service.create(
      ORG,
      'admin',
      payload({ metric: 'participant_total', scope: { types: ['open_door', 'project_open'] } }),
    );
    expect((await service.detail(ORG, combined.id)).result.value).toBe(110);
    const single = await service.create(ORG, 'admin', payload({ scope: { activityId: ACTIVITY } }));
    expect((await service.detail(ORG, single.id)).result.value).toBe(1);
  });

  it('denies every mutation to editors and users, including forged admin role in the selected membership', async () => {
    const target = await service.create(ORG, 'admin', payload());
    for (const role of ['editor', 'user']) {
      membershipRole = role;
      expect((await request('?year=2025')).status).toBe(200);
      for (const [path, method, body] of [
        ['', 'POST', payload()],
        [`/${target.id}`, 'PATCH', payload({ version: 1 })],
        [`/${target.id}/command`, 'POST', { version: 1, action: 'activate', reason: '' }],
        [`/${target.id}/copy`, 'POST', { year: 2026 }],
      ] as const) {
        expect((await request(path, method, body, 'org_admin')).status).toBe(403);
      }
    }
  });

  it('does not disclose or mutate another organization and rejects foreign references', async () => {
    const foreign = await service.create(FOREIGN, 'admin', payload());
    expect((await request(`/${foreign.id}`)).status).toBe(404);
    expect((await request(`/${foreign.id}`, 'PATCH', payload({ version: 1 }))).status).toBe(404);
    expect(
      (
        await request(`/${foreign.id}/command`, 'POST', {
          action: 'activate',
          version: 1,
          reason: '',
        })
      ).status,
    ).toBe(404);
    expect((await request(`/${foreign.id}/copy`, 'POST', { year: 2026 })).status).toBe(404);
    expect((await request(`/${foreign.id}/activities?page=1`)).status).toBe(404);
    expect((await request('', 'POST', payload({ scope: { projectId: PROJECT } }))).status).toBe(
      400,
    );
    expect((await request('?year=2025')).data).toHaveLength(0);
  });

  it('locks the closing result, retains history through reopening and rejects stale edits', async () => {
    const target = await service.create(ORG, 'admin', payload());
    const active = await service.command(ORG, 'admin', target.id, {
      action: 'activate',
      version: 1,
      reason: '',
    });
    await expect(service.update(ORG, 'admin', target.id, payload({ version: 2 }))).rejects.toThrow(
      'begründen',
    );
    await expect(
      service.update(ORG, 'admin', target.id, payload({ version: 1, reason: 'Correction' })),
    ).rejects.toThrow('inzwischen');
    const closed = await service.command(ORG, 'admin', active.id, {
      action: 'close',
      version: 2,
      reason: 'Mehr Öffnungstage ermöglicht.',
    });
    expect(closed.snapshot?.value).toBe(2.5);
    await db.getRepository('TargetActivityFixture').update(ACTIVITY, { durationMinutes: 120 });
    const detail = await service.detail(ORG, target.id);
    expect(detail.result.value).toBe(2.5);
    expect(detail.current.value).toBe(3.5);
    expect(detail.dataChanged).toBe(true);
    await expect(
      service.update(ORG, 'admin', target.id, payload({ version: 3, reason: 'Change' })),
    ).rejects.toThrow('wieder geöffnet');
    const reopened = await service.command(ORG, 'admin', target.id, {
      action: 'reopen',
      version: 3,
      reason: 'Dauer nachgetragen',
    });
    expect(reopened.snapshot).toBeNull();
    expect(reopened.history[2].definition.snapshot?.value).toBe(2.5);
    const copied = await service.copy(ORG, 'admin', target.id, 2026);
    expect(copied).toMatchObject({
      year: 2026,
      status: 'draft',
      version: 1,
      review: '',
      snapshot: null,
    });
  });

  it('exposes the activation agreement without leaking history into cards and retains it through lifecycle changes', async () => {
    const created = await service.create(ORG, 'admin', payload());
    expect((await service.detail(ORG, created.id)).agreement).toBeNull();
    const agreement = 'Wir erweitern die Öffnungszeiten.';
    const active = await service.command(ORG, 'admin', created.id, {
      action: 'activate',
      version: 1,
      reason: agreement,
    });
    expect((await service.detail(ORG, active.id)).agreement).toBe(agreement);
    const cards = await service.list(ORG, 2025);
    expect(cards[0].agreement).toBe(agreement);
    expect(cards[0]).not.toHaveProperty('history');
    const updated = await service.update(
      ORG,
      'admin',
      created.id,
      payload({
        version: 2,
        target: 3,
        reason: 'Zusätzlicher Öffnungstag',
      }),
    );
    expect((await service.detail(ORG, updated.id)).agreement).toBe(agreement);
    const closed = await service.command(ORG, 'admin', created.id, {
      action: 'close',
      version: 3,
      reason: 'Abschlussbewertung',
    });
    expect((await service.detail(ORG, closed.id)).agreement).toBe(agreement);
    const reopened = await service.command(ORG, 'admin', created.id, {
      action: 'reopen',
      version: 4,
      reason: 'Datenkorrektur',
    });
    expect((await service.detail(ORG, reopened.id)).agreement).toBe(agreement);
    expect((await service.detail(ORG, created.id)).agreement).toBe(agreement);
    const copied = await service.copy(ORG, 'admin', created.id, 2026);
    expect((await service.detail(ORG, copied.id)).agreement).toBeNull();
  });

  it('does not display the default activation history message as an agreement', async () => {
    const created = await service.create(ORG, 'admin', payload());
    const active = await service.command(ORG, 'admin', created.id, {
      action: 'activate',
      version: 1,
      reason: '',
    });
    expect((await service.detail(ORG, active.id)).agreement).toBeNull();
    expect((await service.detail(ORG, created.id)).agreement).toBeNull();
  });

  it('disables all API routes without deleting stored targets and permits reactivation', async () => {
    const target = await service.create(ORG, 'admin', payload());
    process.env.ANNUAL_TARGETS_ENABLED = 'false';
    for (const [path, method, body] of [
      ['?year=2025', 'GET', undefined],
      [`/${target.id}`, 'GET', undefined],
      ['', 'POST', payload()],
      [`/${target.id}/command`, 'POST', { action: 'activate', version: 1, reason: '' }],
    ] as const)
      expect((await request(path, method, body)).status).toBe(404);
    process.env.ANNUAL_TARGETS_ENABLED = 'true';
    expect((await request('?year=2025')).data).toHaveLength(1);
  });

  it('validates nested scope, percentage limits, ranges and lifecycle', async () => {
    for (const invalid of [
      payload({ metric: 'female_share_percent', target: 101 }),
      payload({ rule: 'range', upperTarget: 1 }),
      payload({ scope: { types: ['invented'] } }),
      payload({ scope: { projectId: PROJECT, types: ['open_door'] } }),
      payload({ year: 2026, scope: { activityId: ACTIVITY } }),
    ])
      expect((await request('', 'POST', invalid)).status).toBe(400);
    const created = await service.create(
      ORG,
      'admin',
      payload({ year: Number(berlinToday().slice(0, 4)) }),
    );
    await service.command(ORG, 'admin', created.id, { action: 'activate', version: 1, reason: '' });
    await expect(
      service.command(ORG, 'admin', created.id, {
        action: 'close',
        version: 2,
        reason: 'Too soon',
      }),
    ).rejects.toThrow('Ende des Zielzeitraums');
  });

  it('uses both inclusive date boundaries for totals, weighted shares, months and activity pages', async () => {
    const created = await request(
      '',
      'POST',
      payload({
        dateFrom: '2025-02-01',
        dateTo: '2025-02-01',
        metric: 'female_share_percent',
        target: 50,
      }),
    );
    expect(created.status).toBe(201);
    const target = await service.detail(ORG, created.data.id);
    expect(target.result).toMatchObject({
      value: 80,
      activityCount: 1,
      asOf: '2025-02-01',
      series: [{ month: '2025-02', value: 80 }],
    });
    const list = await service.activityList(ORG, target.id, 1);
    expect(list.items.map((item) => item.id)).toEqual(['feb']);
    expect(list.total).toBe(1);
    expect(target.history[0].definition).toMatchObject({
      dateFrom: '2025-02-01',
      dateTo: '2025-02-01',
    });
  });

  it('includes cross-year targets in each affected year without leaking other organizations', async () => {
    const definition = payload({ year: 2024, dateFrom: '2024-12-31', dateTo: '2025-02-01' });
    const created = await service.create(ORG, 'admin', definition);
    await service.create(FOREIGN, 'other-admin', definition);
    for (const year of [2024, 2025]) {
      const listed = await service.list(ORG, year);
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({ id: created.id, result: { value: 3.5, activityCount: 3 } });
    }
    expect(await service.list(ORG, 2026)).toEqual([]);
  });

  it('allows closing after a custom period ends in the current year and retains its snapshot', async () => {
    const clock = jest.spyOn(metrics, 'berlinToday').mockReturnValue('2025-03-01');
    try {
      const created = await service.create(
        ORG,
        'admin',
        payload({ dateFrom: '2025-02-01', dateTo: '2025-02-28' }),
      );
      await service.command(ORG, 'admin', created.id, {
        action: 'activate',
        version: 1,
        reason: '',
      });
      const closed = await service.command(ORG, 'admin', created.id, {
        action: 'close',
        version: 2,
        reason: 'Februar ausgewertet',
      });
      expect(closed.snapshot).toMatchObject({ value: 1.5, asOf: '2025-02-28' });
      await db.getRepository('TargetActivityFixture').update('feb', { durationMinutes: 120 });
      const detail = await service.detail(ORG, created.id);
      expect(detail.result.value).toBe(1.5);
      expect(detail.current.value).toBe(2);
      expect(detail.dataChanged).toBe(true);
    } finally {
      clock.mockRestore();
    }
  });

  it('copies the period into the next year and clamps leap days', async () => {
    const source = await service.create(
      ORG,
      'admin',
      payload({ year: 2024, dateFrom: '2024-02-29', dateTo: '2025-01-31' }),
    );
    const copy = await service.copy(ORG, 'admin', source.id, 2025);
    expect(copy).toMatchObject({
      year: 2025,
      dateFrom: '2025-02-28',
      dateTo: '2026-01-31',
      status: 'draft',
    });
  });

  it('rejects incomplete, invalid, reversed and mismatched periods and out-of-period activities', async () => {
    for (const extra of [
      { dateFrom: '2025-01-01' },
      { dateTo: '2025-12-31' },
      { dateFrom: '2025-02-30', dateTo: '2025-03-01' },
      { dateFrom: '2025-03-01', dateTo: '2025-02-01' },
      { dateFrom: '2024-01-01', dateTo: '2025-12-31' },
      { dateFrom: '2025-01-01', dateTo: '2201-01-01' },
      { dateFrom: '2025-02-01', dateTo: '2025-03-01', scope: { activityId: ACTIVITY } },
    ])
      expect((await request('', 'POST', payload(extra))).status).toBe(400);
  });

  it('returns the linked project image only from the same organization', async () => {
    await db
      .getRepository('TargetProjectFixture')
      .update(PROJECT, { orgId: ORG, imageUrl: '/uploads/projects/picture.png' });
    const target = await service.create(ORG, 'admin', payload({ scope: { projectId: PROJECT } }));
    expect((await service.detail(ORG, target.id)).projectImageUrl).toBe(
      '/uploads/projects/picture.png',
    );
    await db.getRepository('TargetProjectFixture').update(PROJECT, { orgId: FOREIGN });
    expect((await service.detail(ORG, target.id)).projectImageUrl).toBeNull();
  });
});

describe('Annual target boundaries and migration', () => {
  it('keeps zero denominators unknown, handles upper limits and uses Berlin at the year boundary', () => {
    expect(
      annualTargetValue('female_share_percent', {
        activities: 0,
        minutes: 0,
        visits: 0,
        male: 0,
        female: 0,
        diverse: 0,
      }),
    ).toBeNull();
    expect(evaluateAnnualTarget(null, 'min', 40, null).met).toBeNull();
    expect(evaluateAnnualTarget(60, 'range', 40, 60).met).toBe(true);
    expect(evaluateAnnualTarget(61, 'range', 40, 60)).toEqual({ met: false, difference: -1 });
    expect(evaluateAnnualTarget(39.96, 'min', 40, null).met).toBe(false);
    expect(evaluateAnnualTarget(0, 'max', 0, null).met).toBe(true);
    expect(berlinToday(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });
  it('migrates an existing database, is bootstrap-safe, and can roll back', async () => {
    const db = await new DataSource({ type: 'sqljs' }).initialize();
    const runner = db.createQueryRunner();
    try {
      const migration = new AnnualTargets20261008120000();
      await migration.up(runner);
      await runner.query(
        `INSERT INTO annual_targets (id, year, title, metric, scope, rule, target, history) VALUES ('one', 2025, 'Ziel', 'duration_hours', '{}', 'min', 5, '[]')`,
      );
      await migration.up(runner);
      expect(await runner.query('SELECT title FROM annual_targets')).toEqual([{ title: 'Ziel' }]);
      const periodMigration = new AnnualTargetPeriod20261008180000();
      await periodMigration.up(runner);
      await periodMigration.up(runner);
      expect(await runner.query('SELECT dateFrom, dateTo FROM annual_targets')).toEqual([
        { dateFrom: null, dateTo: null },
      ]);
      await runner.query(
        "UPDATE annual_targets SET dateFrom = '2025-02-01', dateTo = '2025-02-28'",
      );
      await periodMigration.down(runner);
      expect(await runner.query('SELECT title FROM annual_targets')).toEqual([{ title: 'Ziel' }]);
      await migration.down(runner);
      expect(await runner.hasTable('annual_targets')).toBe(false);
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
