import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserRefreshTokens20260502120000 implements MigrationInterface {
  name = 'UserRefreshTokens20260502120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refreshTokenId" varchar(80) NULL;`);
      await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refreshTokenHash" varchar(255) NULL;`);
      await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refreshTokenCsrfHash" varchar(255) NULL;`);
      await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" timestamp NULL;`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_refreshTokenId" ON "users" ("refreshTokenId");`);
      return;
    }

    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "refreshTokenId" varchar(80) NULL;`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "refreshTokenHash" varchar(255) NULL;`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "refreshTokenCsrfHash" varchar(255) NULL;`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "refreshTokenExpiresAt" datetime NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_refreshTokenId";`);
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "refreshTokenExpiresAt";`);
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "refreshTokenCsrfHash";`);
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "refreshTokenHash";`);
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "refreshTokenId";`);
    }
  }
}
