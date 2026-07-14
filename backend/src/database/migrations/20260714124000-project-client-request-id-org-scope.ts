import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class ProjectClientRequestIdOrgScope20260714124000 implements MigrationInterface {
  private readonly legacyIndex = 'IDX_projects_clientRequestId_unique';
  private readonly scopedIndex = 'IDX_projects_orgId_clientRequestId_unique';

  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('projects');
    if (!table || !table.columns.some((column) => column.name === 'clientRequestId')) return;

    const legacyIndex = table.indices.find((index) =>
      index.name === this.legacyIndex ||
      (index.isUnique && index.columnNames.length === 1 && index.columnNames[0] === 'clientRequestId'),
    );
    if (legacyIndex) await queryRunner.dropIndex(table, legacyIndex);

    const refreshedTable = await queryRunner.getTable('projects');
    if (!refreshedTable?.indices.some((index) => index.name === this.scopedIndex)) {
      await queryRunner.createIndex(
        'projects',
        new TableIndex({
          name: this.scopedIndex,
          columnNames: ['orgId', 'clientRequestId'],
          isUnique: true,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('projects');
    const scopedIndex = table?.indices.find((index) => index.name === this.scopedIndex);
    if (scopedIndex) await queryRunner.dropIndex('projects', scopedIndex);

    const refreshedTable = await queryRunner.getTable('projects');
    if (refreshedTable && !refreshedTable.indices.some((index) => index.name === this.legacyIndex)) {
      await queryRunner.createIndex(
        'projects',
        new TableIndex({
          name: this.legacyIndex,
          columnNames: ['clientRequestId'],
          isUnique: true,
        }),
      );
    }
  }
}
