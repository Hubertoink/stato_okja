import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class LogbookEntryViews20260809150000 implements MigrationInterface {
  name = 'LogbookEntryViews20260809150000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('logbook_entry_views')) return;
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';
    const uuidType = isPostgres ? 'uuid' : 'varchar';
    const timestampType = isPostgres ? 'timestamp' : 'datetime';
    const nowDefault = isPostgres ? 'now()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(new Table({
      name: 'logbook_entry_views',
      columns: [
        { name: 'id', type: uuidType, isPrimary: true, isGenerated: isPostgres, generationStrategy: isPostgres ? 'uuid' : undefined },
        { name: 'entryId', type: uuidType },
        { name: 'userId', type: uuidType },
        { name: 'readAt', type: timestampType, default: nowDefault },
      ],
    }));
    await queryRunner.createIndices('logbook_entry_views', [
      new TableIndex({ name: 'UQ_logbook_entry_views_entry_user', columnNames: ['entryId', 'userId'], isUnique: true }),
      new TableIndex({ name: 'IDX_logbook_entry_views_user_entry', columnNames: ['userId', 'entryId'] }),
    ]);
    await queryRunner.createForeignKeys('logbook_entry_views', [
      new TableForeignKey({ name: 'FK_logbook_entry_views_entry', columnNames: ['entryId'], referencedTableName: 'logbook_entries', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
      new TableForeignKey({ name: 'FK_logbook_entry_views_user', columnNames: ['userId'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('logbook_entry_views')) await queryRunner.dropTable('logbook_entry_views', true);
  }
}
