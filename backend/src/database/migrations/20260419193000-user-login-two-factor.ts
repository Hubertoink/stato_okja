import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserLoginTwoFactor20260419193000 implements MigrationInterface {
  name = 'UserLoginTwoFactor20260419193000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorTokenVersion" integer NOT NULL DEFAULT 0;`,
      );
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorCodeHash" varchar(255) NULL;`,
      );
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorCodeExpiresAt" timestamp NULL;`,
      );
      return;
    }

    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "twoFactorTokenVersion" integer NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "twoFactorCodeHash" varchar(255) NULL;`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "twoFactorCodeExpiresAt" datetime NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "twoFactorCodeExpiresAt";`);
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "twoFactorCodeHash";`);
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "twoFactorTokenVersion";`);
      return;
    }

    return;
  }
}