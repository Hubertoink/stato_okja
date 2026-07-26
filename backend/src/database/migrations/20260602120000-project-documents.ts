import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class ProjectDocuments20260602120000 implements MigrationInterface {
  name = 'ProjectDocuments20260602120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.connection.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';
    const uuidType = isPostgres ? 'uuid' : 'varchar';
    const timestampType = isPostgres ? 'timestamptz' : 'datetime';
    const nowDefault = isPostgres ? 'now()' : 'CURRENT_TIMESTAMP';

    if (isPostgres) {
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    }

    const hasTable = await queryRunner.hasTable('project_documents');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'project_documents',
          columns: [
            {
              name: 'id',
              type: uuidType,
              isPrimary: true,
              isGenerated: isPostgres,
              generationStrategy: isPostgres ? 'uuid' : undefined,
            },
            { name: 'projectId', type: uuidType, isNullable: false },
            { name: 'filename', type: 'varchar', length: '255', isNullable: false },
            { name: 'mimeType', type: 'varchar', length: '120', isNullable: false },
            { name: 'size', type: 'int', isNullable: false },
            { name: 'storageRef', type: 'varchar', length: '255', isNullable: false },
            { name: 'createdAt', type: timestampType, isNullable: false, default: nowDefault },
          ],
        }),
        true,
      );
    }

    const table = await queryRunner.getTable('project_documents');
    if (!table?.indices.some((index) => index.name === 'IDX_project_documents_projectId')) {
      await queryRunner.createIndex(
        'project_documents',
        new TableIndex({ name: 'IDX_project_documents_projectId', columnNames: ['projectId'] }),
      );
    }

    if (!table?.indices.some((index) => index.name === 'IDX_project_documents_storageRef')) {
      await queryRunner.createIndex(
        'project_documents',
        new TableIndex({ name: 'IDX_project_documents_storageRef', columnNames: ['storageRef'] }),
      );
    }

    const hasProjectFk = (table?.foreignKeys || []).some((foreignKey) =>
      foreignKey.columnNames.includes('projectId'),
    );
    if (!hasProjectFk) {
      await queryRunner.createForeignKey(
        'project_documents',
        new TableForeignKey({
          name: 'FK_project_documents_projectId_projects_id',
          columnNames: ['projectId'],
          referencedTableName: 'projects',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('project_documents');
    if (!hasTable) return;

    const table = await queryRunner.getTable('project_documents');
    const foreignKeys = (table?.foreignKeys || []).filter((foreignKey) =>
      foreignKey.columnNames.includes('projectId'),
    );
    for (const foreignKey of foreignKeys) {
      await queryRunner.dropForeignKey('project_documents', foreignKey);
    }

    try {
      await queryRunner.dropIndex('project_documents', 'IDX_project_documents_projectId');
    } catch {
      // ignore when the index does not exist
    }

    try {
      await queryRunner.dropIndex('project_documents', 'IDX_project_documents_storageRef');
    } catch {
      // ignore when the index does not exist
    }

    await queryRunner.dropTable('project_documents', true);
  }
}
