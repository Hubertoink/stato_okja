import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailChanges20261122120000 implements MigrationInterface {
  async up(runner: QueryRunner) {
    const expiresType = runner.dataSource.options.type === 'postgres' ? 'timestamptz' : 'datetime';
    await runner.query(`CREATE TABLE IF NOT EXISTS "auth_email_changes" (
      "userId" uuid CONSTRAINT "PK_auth_email_changes_user" PRIMARY KEY,
      "requestId" uuid NOT NULL,
      "oldEmail" varchar(200) NOT NULL,
      "newEmail" varchar(200) NOT NULL,
      "passwordFingerprint" varchar(64) NOT NULL,
      "expiresAt" ${expiresType} NOT NULL,
      "approveHash" varchar(64),
      "verifyHash" varchar(64),
      "cancelHash" varchar(64) NOT NULL,
      CONSTRAINT "FK_auth_email_changes_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await runner.query('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_auth_email_changes_request" ON "auth_email_changes" ("requestId")');
  }

  async down(runner: QueryRunner) {
    await runner.dropTable('auth_email_changes', true);
  }
}
