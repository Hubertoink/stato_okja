import { MigrationInterface, QueryRunner } from 'typeorm';

export class LoginLockout20260129120000 implements MigrationInterface {
  name = 'LoginLockout20260129120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" integer NOT NULL DEFAULT 0;`,
      );
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastFailedLoginAt" timestamp NULL;`,
      );
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lockoutUntil" timestamp NULL;`,
      );
      return;
    }

    // sqljs/sqlite: no IF NOT EXISTS for ADD COLUMN
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "failedLoginAttempts" integer NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "lastFailedLoginAt" datetime NULL;`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "lockoutUntil" datetime NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "lockoutUntil";`);
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "lastFailedLoginAt";`);
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "failedLoginAttempts";`);
      return;
    }

    // sqljs/sqlite: DROP COLUMN may not be supported consistently; keep as no-op.
    return;
  }
}
