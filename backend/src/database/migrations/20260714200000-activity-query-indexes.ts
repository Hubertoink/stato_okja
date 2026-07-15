import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

const activityIndexes = [
  new TableIndex({
    name: 'IDX_activities_orgId_date_startTime',
    columnNames: ['orgId', 'date', 'startTime'],
  }),
  new TableIndex({
    name: 'IDX_activities_orgId_executionStatus_date',
    columnNames: ['orgId', 'executionStatus', 'date'],
  }),
  new TableIndex({
    name: 'IDX_activities_orgId_projectId_date',
    columnNames: ['orgId', 'projectId', 'date'],
  }),
];

export class ActivityQueryIndexes20260714200000 implements MigrationInterface {
  name = 'ActivityQueryIndexes20260714200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('activities'))) return;

    const table = await queryRunner.getTable('activities');
    const existingIndexNames = new Set(table?.indices.map((index) => index.name));

    for (const index of activityIndexes) {
      if (!existingIndexNames.has(index.name)) {
        await queryRunner.createIndex('activities', index);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('activities'))) return;

    const table = await queryRunner.getTable('activities');
    const indexesByName = new Map(table?.indices.map((index) => [index.name, index]));

    for (const { name } of [...activityIndexes].reverse()) {
      const index = indexesByName.get(name);
      if (index) {
        await queryRunner.dropIndex('activities', index);
      }
    }
  }
}
