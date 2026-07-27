import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLoginAction20260127103000 implements MigrationInterface {
  name = 'AuditLoginAction20260127103000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';
    if (!isPostgres) return;

    // TypeORM's default enum type naming: "<table>_<column>_enum" (typname without quotes)
    // We make this migration defensive: if the type doesn't exist, do nothing.
    await queryRunner.query(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'audit_logs_action_enum') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'audit_logs_action_enum'
        AND e.enumlabel = 'login'
    ) THEN
      ALTER TYPE "audit_logs_action_enum" ADD VALUE 'login';
    END IF;
  END IF;
END $$;
`);
  }

  // Down migrations for enum values are not supported in Postgres.
  public async down(): Promise<void> {
    return;
  }
}
