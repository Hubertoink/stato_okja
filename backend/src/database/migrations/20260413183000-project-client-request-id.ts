import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class ProjectClientRequestId20260413183000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('projects');
    if (!table) return;

    const hasColumn = table.columns.some((column) => column.name === 'clientRequestId');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'projects',
        new TableColumn({
          name: 'clientRequestId',
          type: 'varchar',
          length: '64',
          isNullable: true,
          default: null,
        }),
      );
    }

    const refreshedTable = await queryRunner.getTable('projects');
    if (!refreshedTable) return;

    const hasIndex = refreshedTable.indices.some(
      (index) => index.name === 'IDX_projects_clientRequestId_unique',
    );
    if (!hasIndex) {
      await queryRunner.createIndex(
        'projects',
        new TableIndex({
          name: 'IDX_projects_clientRequestId_unique',
          columnNames: ['clientRequestId'],
          isUnique: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('projects');
    if (!table) return;

    const hasIndex = table.indices.some((index) => index.name === 'IDX_projects_clientRequestId_unique');
    if (hasIndex) {
      await queryRunner.dropIndex('projects', 'IDX_projects_clientRequestId_unique');
    }

    const hasColumn = table.columns.some((column) => column.name === 'clientRequestId');
    if (hasColumn) {
      await queryRunner.dropColumn('projects', 'clientRequestId');
    }
  }
}