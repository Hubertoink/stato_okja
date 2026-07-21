import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class Logbook20260714110000 implements MigrationInterface {
  name = 'Logbook20260714110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.connection.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';
    const uuidType = isPostgres ? 'uuid' : 'varchar';
    const timestampType = isPostgres ? 'timestamp' : 'datetime';
    const nowDefault = isPostgres ? 'now()' : 'CURRENT_TIMESTAMP';
    if (isPostgres) await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    if (!(await queryRunner.hasTable('logbook_entries'))) {
      await queryRunner.createTable(new Table({
        name: 'logbook_entries',
        columns: [
          { name: 'id', type: uuidType, isPrimary: true, isGenerated: isPostgres, generationStrategy: isPostgres ? 'uuid' : undefined },
          { name: 'orgId', type: uuidType, isNullable: true },
          { name: 'occurredAt', type: timestampType, isNullable: false },
          { name: 'type', type: 'varchar', length: '32', isNullable: false, default: "'observation'" },
          { name: 'title', type: 'varchar', length: '180', isNullable: false },
          { name: 'body', type: 'text', isNullable: false },
          { name: 'highlights', type: 'text', isNullable: true },
          { name: 'challenges', type: 'text', isNullable: true },
          { name: 'nextSteps', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', isNullable: false, default: "'open'" },
          { name: 'visibility', type: 'varchar', length: '16', isNullable: false, default: "'team'" },
          { name: 'activityId', type: uuidType, isNullable: true },
          { name: 'projectId', type: uuidType, isNullable: true },
          { name: 'createdByUserId', type: uuidType, isNullable: true },
          { name: 'createdByName', type: 'varchar', length: '200', isNullable: false },
          { name: 'updatedByUserId', type: uuidType, isNullable: true },
          { name: 'updatedByName', type: 'varchar', length: '200', isNullable: true },
          { name: 'documentationUpdatedByUserId', type: uuidType, isNullable: true },
          { name: 'documentationUpdatedByName', type: 'varchar', length: '200', isNullable: true },
          { name: 'documentationUpdatedAt', type: timestampType, isNullable: true },
          { name: 'discussedByUserId', type: uuidType, isNullable: true },
          { name: 'discussedByName', type: 'varchar', length: '200', isNullable: true },
          { name: 'discussedAt', type: timestampType, isNullable: true },
          { name: 'archivedAt', type: timestampType, isNullable: true },
          { name: 'archivedByUserId', type: uuidType, isNullable: true },
          { name: 'createdAt', type: timestampType, isNullable: false, default: nowDefault },
          { name: 'updatedAt', type: timestampType, isNullable: false, default: nowDefault },
        ],
      }), true);
    }

    if (!(await queryRunner.hasTable('logbook_comments'))) {
      await queryRunner.createTable(new Table({
        name: 'logbook_comments',
        columns: [
          { name: 'id', type: uuidType, isPrimary: true, isGenerated: isPostgres, generationStrategy: isPostgres ? 'uuid' : undefined },
          { name: 'entryId', type: uuidType, isNullable: false },
          { name: 'orgId', type: uuidType, isNullable: true },
          { name: 'body', type: 'text', isNullable: false },
          { name: 'createdByUserId', type: uuidType, isNullable: true },
          { name: 'createdByName', type: 'varchar', length: '200', isNullable: false },
          { name: 'createdAt', type: timestampType, isNullable: false, default: nowDefault },
        ],
      }), true);
    }

    const createIndex = async (table: string, name: string, columns: string[]) => {
      try { await queryRunner.createIndex(table, new TableIndex({ name, columnNames: columns })); } catch { /* exists */ }
    };
    await createIndex('logbook_entries', 'IDX_logbook_entries_org_occurredAt', ['orgId', 'occurredAt']);
    await createIndex('logbook_entries', 'IDX_logbook_entries_org_status', ['orgId', 'status']);
    await createIndex('logbook_entries', 'IDX_logbook_entries_activityId', ['activityId']);
    await createIndex('logbook_entries', 'IDX_logbook_entries_projectId', ['projectId']);
    await createIndex('logbook_comments', 'IDX_logbook_comments_entry_createdAt', ['entryId', 'createdAt']);

    const addFk = async (tableName: string, name: string, columnNames: string[], referencedTableName: string, onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT') => {
      const table = await queryRunner.getTable(tableName);
      if ((table?.foreignKeys || []).some((key) => key.name === name || key.columnNames.join(',') === columnNames.join(','))) return;
      await queryRunner.createForeignKey(tableName, new TableForeignKey({ name, columnNames, referencedTableName, referencedColumnNames: ['id'], onDelete }));
    };
    await addFk('logbook_entries', 'FK_logbook_entries_activity', ['activityId'], 'activities', 'SET NULL');
    await addFk('logbook_entries', 'FK_logbook_entries_project', ['projectId'], 'projects', 'SET NULL');
    await addFk('logbook_entries', 'FK_logbook_entries_created_by_user', ['createdByUserId'], 'users', 'SET NULL');
    await addFk('logbook_comments', 'FK_logbook_comments_entry', ['entryId'], 'logbook_entries', 'CASCADE');
    await addFk('logbook_comments', 'FK_logbook_comments_created_by_user', ['createdByUserId'], 'users', 'SET NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of ['logbook_comments', 'logbook_entries']) {
      if (!(await queryRunner.hasTable(name))) continue;
      const table = await queryRunner.getTable(name);
      for (const foreignKey of table?.foreignKeys || []) await queryRunner.dropForeignKey(name, foreignKey);
      await queryRunner.dropTable(name, true);
    }
  }
}
