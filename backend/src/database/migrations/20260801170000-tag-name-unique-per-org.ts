import { MigrationInterface, QueryRunner } from 'typeorm';

export class TagNameUniquePerOrg20260801170000 implements MigrationInterface {
  name = 'TagNameUniquePerOrg20260801170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    // Tags are organization-scoped. The former global unique constraint on
    // name prevented the same legitimate tag from being imported into two
    // independent organizations.
    await queryRunner.query(`
      DO $$
      DECLARE constraint_name text;
      BEGIN
        FOR constraint_name IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace ns ON ns.oid = rel.relnamespace
          WHERE rel.relname = 'tags'
            AND ns.nspname = current_schema()
            AND con.contype = 'u'
            AND con.conkey::smallint[] = ARRAY[
              (SELECT attnum FROM pg_attribute WHERE attrelid = rel.oid AND attname = 'name')
            ]::smallint[]
        LOOP
          EXECUTE format('ALTER TABLE tags DROP CONSTRAINT %I', constraint_name);
        END LOOP;
      END $$;
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tags_org_name" ON "tags" ("orgId", "name")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_tags_org_name"');
  }
}
