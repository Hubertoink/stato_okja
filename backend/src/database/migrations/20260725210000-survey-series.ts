import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class SurveySeries20260725210000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('surveys'))) return;
    const table = await queryRunner.getTable('surveys');
    const dbType = String((queryRunner.connection.options as { type?: unknown }).type || '').toLowerCase();
    const uuidType = dbType === 'postgres' ? 'uuid' : 'varchar';
    if (!table?.columns.some((column) => column.name === 'seriesId')) {
      await queryRunner.addColumn('surveys', new TableColumn({ name: 'seriesId', type: uuidType, isNullable: true }));
    }
    if (!table?.columns.some((column) => column.name === 'roundNumber')) {
      await queryRunner.addColumn('surveys', new TableColumn({ name: 'roundNumber', type: 'int', default: '1' }));
    }
    await queryRunner.query('UPDATE "surveys" SET "seriesId" = "id" WHERE "seriesId" IS NULL');
    await queryRunner.query('UPDATE "surveys" SET "roundNumber" = 1 WHERE "roundNumber" IS NULL');
    const refreshed = await queryRunner.getTable('surveys');
    if (!refreshed?.indices.some((index) => index.name === 'IDX_surveys_series_round')) {
      await queryRunner.createIndex('surveys', new TableIndex({ name: 'IDX_surveys_series_round', columnNames: ['seriesId', 'roundNumber'], isUnique: true }));
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('surveys'))) return;
    const table = await queryRunner.getTable('surveys');
    const index = table?.indices.find((entry) => entry.name === 'IDX_surveys_series_round');
    if (index) await queryRunner.dropIndex('surveys', index);
    if (table?.columns.some((column) => column.name === 'roundNumber')) await queryRunner.dropColumn('surveys', 'roundNumber');
    if (table?.columns.some((column) => column.name === 'seriesId')) await queryRunner.dropColumn('surveys', 'seriesId');
  }
}
