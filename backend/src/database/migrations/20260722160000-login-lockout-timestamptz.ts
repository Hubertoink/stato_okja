import { MigrationInterface, QueryRunner } from 'typeorm';

function getLegacySessionTimezone() {
  const configured = String(process.env.TZ || '').trim();
  if (/^[A-Za-z0-9_+\u002F-]+$/.test(configured)) return configured;
  return 'Europe/Berlin';
}

export class LoginLockoutTimestamptz20260722160000 implements MigrationInterface {
  name = 'LoginLockoutTimestamptz20260722160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    if (dbType !== 'postgres') return;

    const legacyTimezone = getLegacySessionTimezone();
    await queryRunner.query(
      `ALTER TABLE "users"
        ALTER COLUMN "lastFailedLoginAt" TYPE timestamptz USING "lastFailedLoginAt" AT TIME ZONE '${legacyTimezone}',
        ALTER COLUMN "lockoutUntil" TYPE timestamptz USING "lockoutUntil" AT TIME ZONE '${legacyTimezone}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    if (dbType !== 'postgres') return;

    const legacyTimezone = getLegacySessionTimezone();
    await queryRunner.query(
      `ALTER TABLE "users"
        ALTER COLUMN "lastFailedLoginAt" TYPE timestamp USING "lastFailedLoginAt" AT TIME ZONE '${legacyTimezone}',
        ALTER COLUMN "lockoutUntil" TYPE timestamp USING "lockoutUntil" AT TIME ZONE '${legacyTimezone}'`,
    );
  }
}
