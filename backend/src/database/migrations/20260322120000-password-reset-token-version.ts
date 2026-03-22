import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordResetTokenVersion20260322120000 implements MigrationInterface {
  name = 'PasswordResetTokenVersion20260322120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.connection.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetTokenVersion" integer NOT NULL DEFAULT 0;`,
      );
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "passwordResetTokenVersion" integer NOT NULL DEFAULT 0;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.connection.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetTokenVersion";`);
      return;
    }

    return;
  }
}