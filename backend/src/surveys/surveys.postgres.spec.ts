import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AuditService } from '../common/audit.service';
import { Organization } from '../orgs/entities/organization.entity';
import { Project } from '../projects/entities/project.entity';
import { Survey } from './entities/survey.entity';
import { SurveyResponse } from './entities/survey-response.entity';
import { SurveysService } from './surveys.service';

const postgres = process.env.MIGRATION_TEST_POSTGRES === 'true' ? describe : describe.skip;

postgres('survey retention and series lists on PostgreSQL', () => {
  const schema = 'surveys_test_' + randomUUID().replaceAll('-', '');
  let db: DataSource;
  const audit = { log: jest.fn() };
  function service() {
    return new SurveysService(db.getRepository(Survey), db.getRepository(SurveyResponse),
      db.getRepository(Project), db.getRepository(Organization), audit as unknown as AuditService);
  }
  beforeAll(async () => {
    db = await new DataSource({
      type: 'postgres', schema, entities: [Survey, SurveyResponse], uuidExtension: 'pgcrypto',
      host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USERNAME || 'stato_migration_test',
      password: process.env.DB_PASSWORD || 'stato_migration_test',
      database: process.env.DB_DATABASE || 'stato_migration_test',
      extra: { options: '-c search_path=' + schema + ',public' },
    }).initialize();
    await db.query('CREATE SCHEMA ' + schema);
    await db.synchronize();
  });
  afterAll(async () => {
    if (db?.isInitialized) {
      try { await db.query('DROP SCHEMA ' + schema + ' CASCADE'); }
      finally { await db.destroy(); }
    }
  });
  const orgId = randomUUID();
  async function round(fields: Partial<Survey> = {}) {
    const id = randomUUID();
    const surveys = db.getRepository(Survey);
    return surveys.save(surveys.create({ id, seriesId: id, orgId, title: 'Befragung',
      status: 'closed', publicToken: randomUUID(), questions: [{ id: 'q', type: 'text', label: 'Kommentar' }], ...fields }));
  }
  async function respond(surveyId: string, count: number) {
    const responses = db.getRepository(SurveyResponse);
    await responses.save(Array.from({ length: count }, () => responses.create({ surveyId, answers: { q: 'Einzelantwort' } })));
  }
  it('rolls back a failed delete, retries and preserves existing snapshots during repair', async () => {
    const rawResponsesPurgeAt = new Date(0);
    const first = await round({ rawResponsesPurgeAt });
    await respond(first.id, 5);
    const actor = { orgId, role: 'org_admin' };
    const response = await db.getRepository(SurveyResponse).findOneByOrFail({ surveyId: first.id });
    expect(await service().listResponses(first.id, actor)).toEqual({ rawResponsesAvailable: false, responses: [] });
    await expect(service().deleteResponse(first.id, response.id, 'Test', actor)).rejects.toThrow('Aufbewahrungsfrist');
    await db.query(`CREATE FUNCTION reject_purge() RETURNS trigger LANGUAGE plpgsql AS
      $$ BEGIN RAISE EXCEPTION 'test deletion failure'; END; $$`);
    await db.query('CREATE TRIGGER test_purge BEFORE DELETE ON survey_responses FOR EACH ROW EXECUTE FUNCTION reject_purge()');
    try {
      await expect(service().purgeExpiredRawResponses()).rejects.toThrow('test deletion failure');
      expect((await db.getRepository(Survey).findOneByOrFail({ id: first.id })).aggregateSnapshot).toBeNull();
      expect(await db.getRepository(SurveyResponse).countBy({ surveyId: first.id })).toBe(5);
    } finally {
      await db.query('DROP TRIGGER test_purge ON survey_responses');
    }
    const snapshot = { responsesCount: 7, questions: [], generatedAt: 'original' };
    const old = await round({ rawResponsesPurgeAt, aggregateSnapshot: snapshot });
    const small = await round({ rawResponsesPurgeAt });
    await respond(old.id, 1);
    await respond(small.id, 2);
    await Promise.all([service().purgeExpiredRawResponses(), service().purgeExpiredRawResponses()]);
    expect(await db.getRepository(SurveyResponse).count()).toBe(0);
    const stored = (await db.getRepository(Survey).findOneByOrFail({ id: first.id })).aggregateSnapshot;
    expect(stored).toMatchObject({ responsesCount: 5, questions: [{ answeredCount: 5 }] });
    expect(JSON.stringify(stored)).not.toContain('Einzelantwort');
    expect((await db.getRepository(Survey).findOneByOrFail({ id: old.id })).aggregateSnapshot).toEqual(snapshot);
    expect((await db.getRepository(Survey).findOneByOrFail({ id: small.id })).aggregateSnapshot)
      .toMatchObject({ responsesCount: 2, suppressed: true, questions: [] });
    expect(audit.log).toHaveBeenCalledTimes(3);
  });
  it('lists matching roots with the latest round and grouped counts in a bounded number of queries', async () => {
    const roots = await Promise.all(Array.from({ length: 12 }, () => round({ title: 'Serienliste' })));
    const latest = await round({ seriesId: roots[0].id, roundNumber: 2, status: 'active' });
    await respond(roots[0].id, 1);
    await respond(latest.id, 3);
    await round({ seriesId: roots[1].id, roundNumber: 2, aggregateSnapshot: { responsesCount: 11 } });
    await round({ orgId: randomUUID(), title: 'Serienliste' });
    const log = jest.spyOn(db.logger, 'logQuery');
    try {
      const rows = await service().findAll(orgId, 'Serienliste', false);
      // Candidate scan, series roots, round details, grouped response totals.
      expect(log).toHaveBeenCalledTimes(4);
      expect(rows).toHaveLength(12);
      expect(rows.find(r => r.id === roots[0].id)).toMatchObject({ roundNumber: 2, status: 'active',
        publicToken: latest.publicToken, responsesCount: 3, roundsCount: 2, rawResponsesAvailable: true });
      expect(rows.find(r => r.id === roots[1].id)).toMatchObject({ responsesCount: 11, rawResponsesAvailable: false });
      expect(rows.find(r => r.id === roots[2].id)).toMatchObject({ responsesCount: 0, roundsCount: 1 });
    } finally { log.mockRestore(); }
  });
});
