import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomKpis20260504120000 implements MigrationInterface {
  name = 'CustomKpis20260504120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String(
      (queryRunner.dataSource.options as { type?: unknown }).type || '',
    ).toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "custom_kpis" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "userId" uuid NOT NULL,
          "title" varchar(120) NOT NULL,
          "surface" varchar(20) NOT NULL DEFAULT 'both',
          "position" integer NOT NULL DEFAULT 0,
          "enabled" boolean NOT NULL DEFAULT true,
          "backgroundColor" varchar(7) NOT NULL DEFAULT '#ffffff',
          "metric" varchar(50) NOT NULL,
          "dateMode" varchar(30) NOT NULL DEFAULT 'inherit',
          "rollingWeeks" integer NULL,
          "filters" text NULL,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "FK_custom_kpis_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
        );
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_custom_kpis_userId" ON "custom_kpis" ("userId");`,
      );
      await queryRunner.query(
        `ALTER TABLE "custom_kpis" ADD COLUMN IF NOT EXISTS "backgroundColor" varchar(7) NOT NULL DEFAULT '#ffffff';`,
      );
      return;
    }

    await queryRunner.query(`
      CREATE TABLE "custom_kpis" (
        "id" varchar(36) PRIMARY KEY,
        "userId" varchar(36) NOT NULL,
        "title" varchar(120) NOT NULL,
        "surface" varchar(20) NOT NULL DEFAULT 'both',
        "position" integer NOT NULL DEFAULT 0,
        "enabled" boolean NOT NULL DEFAULT true,
        "backgroundColor" varchar(7) NOT NULL DEFAULT '#ffffff',
        "metric" varchar(50) NOT NULL,
        "dateMode" varchar(30) NOT NULL DEFAULT 'inherit',
        "rollingWeeks" integer NULL,
        "filters" text NULL,
        "createdAt" datetime NOT NULL,
        "updatedAt" datetime NOT NULL
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_custom_kpis_userId" ON "custom_kpis" ("userId");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = String(
      (queryRunner.dataSource.options as { type?: unknown }).type || '',
    ).toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_kpis_userId";`);
      await queryRunner.query(`DROP TABLE IF EXISTS "custom_kpis";`);
      return;
    }

    await queryRunner.query(`DROP TABLE "custom_kpis";`);
  }
}
