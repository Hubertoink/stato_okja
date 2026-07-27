import { readdir } from 'fs/promises';
import { resolve } from 'path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { LogbookEntry } from '../../logbook/entities/logbook-entry.entity';

const enabled = process.env.MIGRATION_TEST_POSTGRES === 'true';
const describePostgres = enabled ? describe : describe.skip;
const environmentKeys = [
  'NODE_ENV',
  'DB_TYPE',
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
  'DB_SYNCHRONIZE',
  'DB_MIGRATIONS_RUN',
  'DB_BOOTSTRAP_ON_EMPTY',
  'DB_LOGGING',
] as const;

describePostgres('PostgreSQL-First-Run und Migrationen', () => {
  const originalEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));
  let options: DataSourceOptions;

  const openRuntimeDataSource = async () => {
    const dataSource = new DataSource({ ...options, synchronize: false, migrationsRun: true });
    await dataSource.initialize();
    return dataSource;
  };

  const resetPublicSchema = async () => {
    const dataSource = new DataSource({ ...options, synchronize: false, migrationsRun: false });
    await dataSource.initialize();
    try {
      await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
      await dataSource.query('CREATE SCHEMA public');
      await dataSource.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
    } finally {
      await dataSource.destroy();
    }
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_TYPE = 'postgres';
    process.env.DB_HOST ||= '127.0.0.1';
    process.env.DB_PORT ||= '5432';
    process.env.DB_USERNAME ||= 'stato_migration_test';
    process.env.DB_PASSWORD ||= 'stato_migration_test';
    process.env.DB_DATABASE ||= 'stato_migration_test';
    process.env.DB_SYNCHRONIZE = 'false';
    process.env.DB_MIGRATIONS_RUN = 'true';
    process.env.DB_BOOTSTRAP_ON_EMPTY = 'true';
    process.env.DB_LOGGING = 'false';

    ({ typeormConfig: options } = await import('../../config/typeorm.config'));
    await resetPublicSchema();
  }, 60_000);

  afterAll(async () => {
    await resetPublicSchema();
    for (const [key, value] of originalEnvironment) {
      if (typeof value === 'undefined') delete process.env[key];
      else process.env[key] = value;
    }
  }, 60_000);

  it('bootstraps eine leere Datenbank, führt jede Migration aus und hinterlässt keinen Schema-Drift', async () => {
    const { bootstrapEmptyDatabase } = await import('../bootstrap-empty-database');
    await bootstrapEmptyDatabase();

    const dataSource = await openRuntimeDataSource();
    try {
      expect(await dataSource.showMigrations()).toBe(false);
      expect(await dataSource.query(`SELECT to_regclass('public.users') AS users`)).toEqual([
        expect.objectContaining({ users: 'users' }),
      ]);

      const migrationFiles = (await readdir(resolve(__dirname, '../migrations'))).filter((file) =>
        file.endsWith('.ts'),
      );
      const applied = await dataSource.query('SELECT "name" FROM "migrations"');
      expect(applied).toHaveLength(migrationFiles.length);

      const schemaLog = await dataSource.driver.createSchemaBuilder().log();
      expect(schemaLog.upQueries).toHaveLength(0);
    } finally {
      await dataSource.destroy();
    }
  }, 60_000);

  it('ist bei einem zweiten Start idempotent', async () => {
    const { bootstrapEmptyDatabase } = await import('../bootstrap-empty-database');
    await bootstrapEmptyDatabase();

    const dataSource = await openRuntimeDataSource();
    try {
      expect(await dataSource.showMigrations()).toBe(false);
      expect(await dataSource.query('SELECT COUNT(*)::int AS count FROM "migrations"')).toEqual([
        expect.objectContaining({ count: expect.any(Number) }),
      ]);
    } finally {
      await dataSource.destroy();
    }
  }, 60_000);

  it('berechnet virtuelle Logbuch-Kommentarzahlen unter TypeORM 1.x', async () => {
    const entryId = '10000000-0000-4000-8000-000000000001';
    const dataSource = await openRuntimeDataSource();
    try {
      await dataSource.query(
        `INSERT INTO "logbook_entries" ("id", "occurredAt", "title", "body", "createdByName")
         VALUES ($1, NOW(), 'TypeORM-Test', 'Virtuelle Spalte', 'Migrationstest')`,
        [entryId],
      );
      await dataSource.query(
        `INSERT INTO "logbook_comments" ("id", "entryId", "body", "createdByName")
         VALUES
           ('20000000-0000-4000-8000-000000000001', $1, 'Erster Kommentar', 'Migrationstest'),
           ('20000000-0000-4000-8000-000000000002', $1, 'Zweiter Kommentar', 'Migrationstest')`,
        [entryId],
      );

      const entry = await dataSource.getRepository(LogbookEntry).findOneByOrFail({ id: entryId });
      expect(entry.commentCount).toBe(2);
    } finally {
      await dataSource.destroy();
    }
  }, 60_000);
});
