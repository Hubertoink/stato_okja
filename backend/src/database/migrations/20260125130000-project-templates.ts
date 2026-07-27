import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class ProjectTemplates20260125130000 implements MigrationInterface {
  name = 'ProjectTemplates20260125130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      // Reuse same enum as projects.type
      await queryRunner.query(`DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'projects_type_enum') THEN
    CREATE TYPE "projects_type_enum" AS ENUM ('open_door','project_open','project_closed','event','outreach');
  END IF;
END$$;`);
    }

    const has = await queryRunner.hasTable('project_templates');
    if (!has) {
      const uuidType = isPostgres ? 'uuid' : 'varchar';
      const enumOrVarchar = isPostgres ? 'projects_type_enum' : 'varchar';
      const timestampType = isPostgres ? 'timestamptz' : 'datetime';
      const nowDefault = isPostgres ? 'now()' : 'CURRENT_TIMESTAMP';

      await queryRunner.createTable(
        new Table({
          name: 'project_templates',
          columns: [
            {
              name: 'id',
              type: uuidType,
              isPrimary: true,
              isGenerated: isPostgres,
              generationStrategy: isPostgres ? 'uuid' : undefined,
            },
            { name: 'title', type: 'varchar', length: '120', isNullable: false },
            { name: 'type', type: enumOrVarchar, isNullable: false },
            { name: 'targetGroup', type: 'varchar', length: '120', isNullable: true },
            { name: 'description', type: 'text', isNullable: true },
            { name: 'categoryName', type: 'varchar', length: '120', isNullable: true },
            { name: 'categoryColor', type: 'varchar', length: '16', isNullable: true },
            { name: 'tags', type: 'text', isNullable: true },
            { name: 'imageUrl', type: 'varchar', isNullable: true },
            { name: 'color', type: 'varchar', length: '16', isNullable: true },
            { name: 'archived', type: 'boolean', isNullable: false, default: 'false' },
            { name: 'createdAt', type: timestampType, isNullable: false, default: nowDefault },
            { name: 'updatedAt', type: timestampType, isNullable: false, default: nowDefault },
            { name: 'orgId', type: uuidType, isNullable: true },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'project_templates',
        new TableIndex({ name: 'IDX_project_templates_orgId', columnNames: ['orgId'] }),
      );
      await queryRunner.createIndex(
        'project_templates',
        new TableIndex({ name: 'IDX_project_templates_archived', columnNames: ['archived'] }),
      );
    } else {
      const uuidType = isPostgres ? 'uuid' : 'varchar';
      const ensureColumn = async (name: string, column: TableColumn) => {
        const exists = await queryRunner.hasColumn('project_templates', name);
        if (!exists) await queryRunner.addColumn('project_templates', column);
      };

      await ensureColumn('title', new TableColumn({ name: 'title', type: 'varchar', length: '120', isNullable: false, default: "''" }));
      await ensureColumn('type', new TableColumn({ name: 'type', type: isPostgres ? 'projects_type_enum' : 'varchar', isNullable: false, default: isPostgres ? `'open_door'` : "'open_door'" }));
      await ensureColumn('targetGroup', new TableColumn({ name: 'targetGroup', type: 'varchar', length: '120', isNullable: true }));
      await ensureColumn('description', new TableColumn({ name: 'description', type: 'text', isNullable: true }));
      await ensureColumn('categoryName', new TableColumn({ name: 'categoryName', type: 'varchar', length: '120', isNullable: true }));
      await ensureColumn('categoryColor', new TableColumn({ name: 'categoryColor', type: 'varchar', length: '16', isNullable: true }));
      await ensureColumn('tags', new TableColumn({ name: 'tags', type: 'text', isNullable: true }));
      await ensureColumn('imageUrl', new TableColumn({ name: 'imageUrl', type: 'varchar', isNullable: true }));
      await ensureColumn('color', new TableColumn({ name: 'color', type: 'varchar', length: '16', isNullable: true }));
      await ensureColumn('archived', new TableColumn({ name: 'archived', type: 'boolean', isNullable: false, default: 'false' }));
      await ensureColumn('orgId', new TableColumn({ name: 'orgId', type: uuidType, isNullable: true }));

      const projectTemplatesTable = await queryRunner.getTable('project_templates');
      if (!projectTemplatesTable?.indices.some((index) => index.name === 'IDX_project_templates_orgId')) {
        await queryRunner.createIndex('project_templates', new TableIndex({ name: 'IDX_project_templates_orgId', columnNames: ['orgId'] }));
      }
      if (!projectTemplatesTable?.indices.some((index) => index.name === 'IDX_project_templates_archived')) {
        await queryRunner.createIndex('project_templates', new TableIndex({ name: 'IDX_project_templates_archived', columnNames: ['archived'] }));
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.hasTable('project_templates');
    if (has) await queryRunner.dropTable('project_templates', true);
  }
}
