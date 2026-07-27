import { MigrationInterface, QueryRunner } from 'typeorm';

function getLegacySessionTimezone() {
  const configured = String(process.env.TZ || '').trim();
  if (/^[A-Za-z0-9_+\u002F-]+$/.test(configured)) return configured;
  return 'Europe/Berlin';
}

export class AuthRefreshSessionsTimestamptz20260602183000 implements MigrationInterface {
  name = 'AuthRefreshSessionsTimestamptz20260602183000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    if (dbType !== 'postgres') return;

    const hasTable = await queryRunner.hasTable('auth_refresh_sessions');
    if (!hasTable) return;

    const legacyTimezone = getLegacySessionTimezone();

    await queryRunner.query(
      `ALTER TABLE "auth_refresh_sessions"
        ALTER COLUMN "expiresAt" TYPE timestamptz USING "expiresAt" AT TIME ZONE '${legacyTimezone}',
        ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE '${legacyTimezone}',
        ALTER COLUMN "lastUsedAt" TYPE timestamptz USING "lastUsedAt" AT TIME ZONE '${legacyTimezone}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    if (dbType !== 'postgres') return;

    const hasTable = await queryRunner.hasTable('auth_refresh_sessions');
    if (!hasTable) return;

    const legacyTimezone = getLegacySessionTimezone();

    await queryRunner.query(
      `ALTER TABLE "auth_refresh_sessions"
        ALTER COLUMN "expiresAt" TYPE timestamp USING "expiresAt" AT TIME ZONE '${legacyTimezone}',
        ALTER COLUMN "createdAt" TYPE timestamp USING "createdAt" AT TIME ZONE '${legacyTimezone}',
        ALTER COLUMN "lastUsedAt" TYPE timestamp USING "lastUsedAt" AT TIME ZONE '${legacyTimezone}'`,
    );
  }
}
