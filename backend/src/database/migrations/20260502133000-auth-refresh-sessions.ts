import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthRefreshSessions20260502133000 implements MigrationInterface {
  name = 'AuthRefreshSessions20260502133000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.connection.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "auth_refresh_sessions" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "userId" uuid NOT NULL,
          "tokenId" varchar(80) NOT NULL,
          "tokenHash" varchar(255) NOT NULL,
          "csrfHash" varchar(255) NOT NULL,
          "expiresAt" timestamp NOT NULL,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "lastUsedAt" timestamp NOT NULL DEFAULT now(),
          "userAgent" varchar(255) NULL,
          "ipAddress" varchar(80) NULL,
          CONSTRAINT "FK_auth_refresh_sessions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
        );
      `);
      await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_auth_refresh_sessions_tokenId" ON "auth_refresh_sessions" ("tokenId");`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_auth_refresh_sessions_userId" ON "auth_refresh_sessions" ("userId");`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_auth_refresh_sessions_expiresAt" ON "auth_refresh_sessions" ("expiresAt");`);
      await queryRunner.query(`
        INSERT INTO "auth_refresh_sessions" (
          "userId", "tokenId", "tokenHash", "csrfHash", "expiresAt", "createdAt", "lastUsedAt"
        )
        SELECT
          "id", "refreshTokenId", "refreshTokenHash", "refreshTokenCsrfHash", "refreshTokenExpiresAt", now(), now()
        FROM "users"
        WHERE "refreshTokenId" IS NOT NULL
          AND "refreshTokenHash" IS NOT NULL
          AND "refreshTokenCsrfHash" IS NOT NULL
          AND "refreshTokenExpiresAt" IS NOT NULL
          AND "refreshTokenExpiresAt" > now()
        ON CONFLICT ("tokenId") DO NOTHING;
      `);
      return;
    }

    await queryRunner.query(`
      CREATE TABLE "auth_refresh_sessions" (
        "id" varchar(36) PRIMARY KEY,
        "userId" varchar(36) NOT NULL,
        "tokenId" varchar(80) NOT NULL,
        "tokenHash" varchar(255) NOT NULL,
        "csrfHash" varchar(255) NOT NULL,
        "expiresAt" datetime NOT NULL,
        "createdAt" datetime NOT NULL,
        "lastUsedAt" datetime NOT NULL,
        "userAgent" varchar(255) NULL,
        "ipAddress" varchar(80) NULL
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_auth_refresh_sessions_tokenId" ON "auth_refresh_sessions" ("tokenId");`);
    await queryRunner.query(`CREATE INDEX "IDX_auth_refresh_sessions_userId" ON "auth_refresh_sessions" ("userId");`);
    await queryRunner.query(`CREATE INDEX "IDX_auth_refresh_sessions_expiresAt" ON "auth_refresh_sessions" ("expiresAt");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.connection.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_auth_refresh_sessions_expiresAt";`);
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_auth_refresh_sessions_userId";`);
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_auth_refresh_sessions_tokenId";`);
      await queryRunner.query(`DROP TABLE IF EXISTS "auth_refresh_sessions";`);
      return;
    }

    await queryRunner.query(`DROP TABLE "auth_refresh_sessions";`);
  }
}