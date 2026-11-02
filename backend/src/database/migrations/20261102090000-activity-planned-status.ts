import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActivityPlannedStatus20261102090000 implements MigrationInterface {
  name = 'ActivityPlannedStatus20261102090000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.dataSource.options.type !== 'postgres' || !await queryRunner.hasTable('activities')) return;
    // Do not use the new enum value until this migration's transaction commits.
    await queryRunner.query(`ALTER TYPE "activities_executionstatus_enum" ADD VALUE IF NOT EXISTS 'planned'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasTable('activities')) return;
    const planned = await queryRunner.query(`SELECT 1 FROM "activities" WHERE "executionStatus" = 'planned' LIMIT 1`);
    if (planned.length) throw new Error('Geplante Aktivitäten vor dem Rollback dokumentieren oder als ausgefallen markieren.');
    if (queryRunner.dataSource.options.type !== 'postgres') return;
    await queryRunner.query(`ALTER TABLE "activities" ALTER COLUMN "executionStatus" DROP DEFAULT`);
    await queryRunner.query(`ALTER TYPE "activities_executionstatus_enum" RENAME TO "activities_executionstatus_enum_with_planned"`);
    await queryRunner.query(`CREATE TYPE "activities_executionstatus_enum" AS ENUM ('completed', 'cancelled')`);
    await queryRunner.query(`ALTER TABLE "activities" ALTER COLUMN "executionStatus" TYPE "activities_executionstatus_enum" USING "executionStatus"::text::"activities_executionstatus_enum"`);
    await queryRunner.query(`ALTER TABLE "activities" ALTER COLUMN "executionStatus" SET DEFAULT 'completed'`);
    await queryRunner.query(`DROP TYPE "activities_executionstatus_enum_with_planned"`);
  }
}
