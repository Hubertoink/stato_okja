import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class LogbookDocumentationUpdatedAt20260721120000 implements MigrationInterface {
  name = 'LogbookDocumentationUpdatedAt20260721120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('logbook_entries'))) return;

    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const uuidType = dbType === 'postgres' ? 'uuid' : 'varchar';
    const timestampType = dbType === 'postgres' ? 'timestamp' : 'datetime';
    const table = await queryRunner.getTable('logbook_entries');
    const hasColumn = (name: string) => table?.columns.some((column) => column.name === name);

    if (!hasColumn('documentationUpdatedByUserId')) {
      await queryRunner.addColumn(
        'logbook_entries',
        new TableColumn({ name: 'documentationUpdatedByUserId', type: uuidType, isNullable: true }),
      );
    }
    if (!hasColumn('documentationUpdatedByName')) {
      await queryRunner.addColumn(
        'logbook_entries',
        new TableColumn({
          name: 'documentationUpdatedByName',
          type: 'varchar',
          length: '200',
          isNullable: true,
        }),
      );
    }
    if (!hasColumn('documentationUpdatedAt')) {
      await queryRunner.addColumn(
        'logbook_entries',
        new TableColumn({ name: 'documentationUpdatedAt', type: timestampType, isNullable: true }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('logbook_entries'))) return;
    const table = await queryRunner.getTable('logbook_entries');
    for (const name of [
      'documentationUpdatedAt',
      'documentationUpdatedByName',
      'documentationUpdatedByUserId',
    ]) {
      if (table?.columns.some((column) => column.name === name)) {
        await queryRunner.dropColumn('logbook_entries', name);
      }
    }
  }
}
