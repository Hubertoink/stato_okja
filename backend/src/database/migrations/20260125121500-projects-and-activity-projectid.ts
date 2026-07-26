import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class ProjectsAndActivityProjectId20260125121500 implements MigrationInterface {
  name = 'ProjectsAndActivityProjectId20260125121500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.connection.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      // Ensure enum type exists for projects.type
      await queryRunner.query(`DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'projects_type_enum') THEN
    CREATE TYPE "projects_type_enum" AS ENUM ('open_door','project_open','project_closed','event','outreach');
  END IF;
END$$;`);
    }

    // ---- projects table ----
    const hasProjects = await queryRunner.hasTable('projects');
    if (!hasProjects) {
      const uuidType = isPostgres ? 'uuid' : 'varchar';
      const enumOrVarchar = isPostgres ? 'projects_type_enum' : 'varchar';
      const timestampType = isPostgres ? 'timestamptz' : 'datetime';
      const nowDefault = isPostgres ? 'now()' : 'CURRENT_TIMESTAMP';

      await queryRunner.createTable(
        new Table({
          name: 'projects',
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
            { name: 'categoryId', type: uuidType, isNullable: true },
            { name: 'targetGroup', type: 'varchar', length: '120', isNullable: true },
            { name: 'imageUrl', type: 'varchar', isNullable: true },
            { name: 'color', type: 'varchar', length: '16', isNullable: true },
            { name: 'dateFrom', type: 'date', isNullable: true },
            { name: 'dateTo', type: 'date', isNullable: true },
            { name: 'defaultStartTime', type: 'time', isNullable: true },
            { name: 'defaultEndTime', type: 'time', isNullable: true },
            { name: 'defaultStaff', type: 'text', isNullable: true },
            { name: 'defaultVolunteers', type: 'text', isNullable: true },
            { name: 'tag', type: 'varchar', length: '120', isNullable: true },
            { name: 'activityField', type: 'varchar', length: '120', isNullable: true },
            { name: 'description', type: 'text', isNullable: true },
            { name: 'archived', type: 'boolean', isNullable: false, default: 'false' },
            { name: 'createdAt', type: timestampType, isNullable: false, default: nowDefault },
            { name: 'updatedAt', type: timestampType, isNullable: false, default: nowDefault },
            { name: 'orgId', type: uuidType, isNullable: true },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'projects',
        new TableIndex({ name: 'IDX_projects_orgId', columnNames: ['orgId'] }),
      );
    } else {
      const uuidType = isPostgres ? 'uuid' : 'varchar';

      const ensureColumn = async (name: string, column: TableColumn) => {
        const exists = await queryRunner.hasColumn('projects', name);
        if (!exists) await queryRunner.addColumn('projects', column);
      };

      await ensureColumn('title', new TableColumn({ name: 'title', type: 'varchar', length: '120', isNullable: false, default: "''" }));
      await ensureColumn(
        'type',
        new TableColumn({ name: 'type', type: isPostgres ? 'projects_type_enum' : 'varchar', isNullable: false, default: isPostgres ? `'open_door'` : "'open_door'" }),
      );
      await ensureColumn('categoryId', new TableColumn({ name: 'categoryId', type: uuidType, isNullable: true }));
      await ensureColumn('targetGroup', new TableColumn({ name: 'targetGroup', type: 'varchar', length: '120', isNullable: true }));
      await ensureColumn('imageUrl', new TableColumn({ name: 'imageUrl', type: 'varchar', isNullable: true }));
      await ensureColumn('color', new TableColumn({ name: 'color', type: 'varchar', length: '16', isNullable: true }));
      await ensureColumn('dateFrom', new TableColumn({ name: 'dateFrom', type: 'date', isNullable: true }));
      await ensureColumn('dateTo', new TableColumn({ name: 'dateTo', type: 'date', isNullable: true }));
      await ensureColumn('defaultStartTime', new TableColumn({ name: 'defaultStartTime', type: 'time', isNullable: true }));
      await ensureColumn('defaultEndTime', new TableColumn({ name: 'defaultEndTime', type: 'time', isNullable: true }));
      await ensureColumn('defaultStaff', new TableColumn({ name: 'defaultStaff', type: 'text', isNullable: true }));
      await ensureColumn('defaultVolunteers', new TableColumn({ name: 'defaultVolunteers', type: 'text', isNullable: true }));
      await ensureColumn('tag', new TableColumn({ name: 'tag', type: 'varchar', length: '120', isNullable: true }));
      await ensureColumn('activityField', new TableColumn({ name: 'activityField', type: 'varchar', length: '120', isNullable: true }));
      await ensureColumn('description', new TableColumn({ name: 'description', type: 'text', isNullable: true }));
      await ensureColumn('archived', new TableColumn({ name: 'archived', type: 'boolean', isNullable: false, default: 'false' }));
      await ensureColumn('orgId', new TableColumn({ name: 'orgId', type: uuidType, isNullable: true }));

      // PostgreSQL aborts the surrounding migration transaction on a duplicate
      // index error, even when it is caught. Inspect first instead.
      const projectTable = await queryRunner.getTable('projects');
      if (!projectTable?.indices.some((index) => index.name === 'IDX_projects_orgId')) {
        await queryRunner.createIndex('projects', new TableIndex({ name: 'IDX_projects_orgId', columnNames: ['orgId'] }));
      }
    }

    // ---- project_categories join table ----
    const hasProjectCategories = await queryRunner.hasTable('project_categories');
    if (!hasProjectCategories) {
      const uuidType = isPostgres ? 'uuid' : 'varchar';
      await queryRunner.createTable(
        new Table({
          name: 'project_categories',
          columns: [
            { name: 'projectId', type: uuidType, isNullable: false },
            { name: 'categoryId', type: uuidType, isNullable: false },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'project_categories',
        new TableIndex({
          name: 'IDX_project_categories_project_category_unique',
          columnNames: ['projectId', 'categoryId'],
          isUnique: true,
        }),
      );

      await queryRunner.createIndex(
        'project_categories',
        new TableIndex({ name: 'IDX_project_categories_projectId', columnNames: ['projectId'] }),
      );

      await queryRunner.createIndex(
        'project_categories',
        new TableIndex({ name: 'IDX_project_categories_categoryId', columnNames: ['categoryId'] }),
      );
    }

    // ---- activities.projectId ----
    const hasActivitiesTable = await queryRunner.hasTable('activities');
    if (hasActivitiesTable) {
      const hasProjectId = await queryRunner.hasColumn('activities', 'projectId');
      if (!hasProjectId) {
        await queryRunner.addColumn(
          'activities',
          new TableColumn({
            name: 'projectId',
            type: isPostgres ? 'uuid' : 'varchar',
            isNullable: true,
          }),
        );
      } else if (isPostgres) {
        // If column exists but is varchar, convert to uuid for correct joins
        const rows = (await queryRunner.query(
          `SELECT data_type FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'projectId' LIMIT 1`,
        )) as Array<{ data_type?: string }>;
        const dataType = (rows?.[0]?.data_type || '').toLowerCase();
        if (dataType && dataType !== 'uuid') {
          await queryRunner.query(
            `ALTER TABLE "activities" ALTER COLUMN "projectId" TYPE uuid USING NULLIF("projectId", '')::uuid`,
          );
        }
      }

      if (isPostgres) {
        // Add FK if not already present
        try {
          const table = await queryRunner.getTable('activities');
          const hasFk = (table?.foreignKeys || []).some((fk) => fk.columnNames.includes('projectId'));
          if (!hasFk) {
            await queryRunner.createForeignKey(
              'activities',
              new TableForeignKey({
                columnNames: ['projectId'],
                referencedTableName: 'projects',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
              }),
            );
          }
        } catch {
          // If projects table doesn't exist yet, or FK already exists, ignore
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best-effort rollback; do not drop projects table to avoid data loss.
    const hasJoin = await queryRunner.hasTable('project_categories');
    if (hasJoin) {
      await queryRunner.dropTable('project_categories', true);
    }

    const hasActivitiesTable = await queryRunner.hasTable('activities');
    if (hasActivitiesTable) {
      const hasProjectId = await queryRunner.hasColumn('activities', 'projectId');
      if (hasProjectId) {
        // Drop FK first if present
        try {
          const table = await queryRunner.getTable('activities');
          const fks = (table?.foreignKeys || []).filter((fk) => fk.columnNames.includes('projectId'));
          for (const fk of fks) await queryRunner.dropForeignKey('activities', fk);
        } catch {
          // noop
        }
        await queryRunner.dropColumn('activities', 'projectId');
      }
    }
  }
}
