import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ActivityExecutionStatus20260422120000 implements MigrationInterface {
  name = 'ActivityExecutionStatus20260422120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    const hasActivitiesTable = await queryRunner.hasTable('activities');
    if (!hasActivitiesTable) return;

    if (isPostgres) {
      await queryRunner.query(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activities_executionstatus_enum') THEN
    CREATE TYPE "activities_executionstatus_enum" AS ENUM ('completed', 'cancelled');
  END IF;
END $$;
`);

      await queryRunner.query(
        `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "executionStatus" "activities_executionstatus_enum" NOT NULL DEFAULT 'completed';`,
      );
      await queryRunner.query(
        `UPDATE "activities" SET "executionStatus" = 'completed' WHERE "executionStatus" IS NULL;`,
      );
      return;
    }

    const hasExecutionStatus = await queryRunner.hasColumn('activities', 'executionStatus');
    if (!hasExecutionStatus) {
      await queryRunner.addColumn(
        'activities',
        new TableColumn({
          name: 'executionStatus',
          type: 'varchar',
          isNullable: false,
          default: "'completed'",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    const hasActivitiesTable = await queryRunner.hasTable('activities');
    if (!hasActivitiesTable) return;

    const hasExecutionStatus = await queryRunner.hasColumn('activities', 'executionStatus');
    if (!hasExecutionStatus) return;

    if (isPostgres) {
      await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "executionStatus";`);
      await queryRunner.query(`DROP TYPE IF EXISTS "activities_executionstatus_enum";`);
      return;
    }

    await queryRunner.dropColumn('activities', 'executionStatus');
  }
}