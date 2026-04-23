import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrgClosureDays20260422133000 implements MigrationInterface {
  name = 'OrgClosureDays20260422133000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.connection.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query(
        `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "closureDays" text NULL;`,
      );
      return;
    }

    const hasTable = await queryRunner.hasTable('organizations');
    if (!hasTable) return;

    const hasColumn = await queryRunner.hasColumn('organizations', 'closureDays');
    if (!hasColumn) {
      await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN "closureDays" text NULL;`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.connection.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "closureDays";`);
      return;
    }

    const hasTable = await queryRunner.hasTable('organizations');
    if (!hasTable) return;
    const hasColumn = await queryRunner.hasColumn('organizations', 'closureDays');
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "closureDays";`);
    }
  }
}