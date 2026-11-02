import { DataSource } from 'typeorm';
import { ActivityPlannedStatus20261102090000 } from '../migrations/20261102090000-activity-planned-status';

const describePostgres = process.env.MIGRATION_TEST_POSTGRES === 'true' ? describe : describe.skip;

describePostgres('planned activity migration on PostgreSQL', () => {
  it('upgrades an existing enum transactionally and refuses a rollback that would lose plans', async () => {
    const schema = `planning_test_${process.pid}_${Date.now()}`;
    const db = await new DataSource({
      type: 'postgres', schema,
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USERNAME || 'stato_migration_test',
      password: process.env.DB_PASSWORD || 'stato_migration_test',
      database: process.env.DB_DATABASE || 'stato_migration_test',
      entities: [],
    }).initialize();
    const runner = db.createQueryRunner();
    try {
      await runner.query(`CREATE SCHEMA "${schema}"`);
      await runner.query(`SET search_path TO "${schema}"`);
      await runner.query(`CREATE TYPE "activities_executionstatus_enum" AS ENUM ('completed', 'cancelled')`);
      await runner.query(`CREATE TABLE "activities" (id int PRIMARY KEY, "executionStatus" "activities_executionstatus_enum" NOT NULL DEFAULT 'completed')`);
      await runner.query(`INSERT INTO "activities" (id) VALUES (1)`);
      const migration = new ActivityPlannedStatus20261102090000();
      await runner.startTransaction();
      await migration.up(runner);
      await runner.commitTransaction();
      await migration.up(runner);
      await runner.query(`INSERT INTO "activities" VALUES (2, 'planned')`);
      expect(await runner.query(`SELECT "executionStatus" FROM "activities" ORDER BY id`)).toEqual([
        { executionStatus: 'completed' }, { executionStatus: 'planned' },
      ]);
      await expect(migration.down(runner)).rejects.toThrow('vor dem Rollback');
      await runner.query(`UPDATE "activities" SET "executionStatus" = 'cancelled' WHERE id = 2`);
      await runner.startTransaction();
      await migration.down(runner);
      await runner.commitTransaction();
      expect(await runner.query(`SELECT "executionStatus" FROM "activities" ORDER BY id`)).toEqual([
        { executionStatus: 'completed' }, { executionStatus: 'cancelled' },
      ]);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.query('SET search_path TO public');
      await runner.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await runner.release();
      await db.destroy();
    }
  }, 30_000);
});
