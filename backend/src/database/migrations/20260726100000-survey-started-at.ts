import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class SurveyStartedAt20260726100000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('surveys'))) return;
    const table = await queryRunner.getTable('surveys');
    if (table?.columns.some((column) => column.name === 'startedAt')) return;
    const dbType = String(
      (queryRunner.connection.options as { type?: unknown }).type || '',
    ).toLowerCase();
    await queryRunner.addColumn(
      'surveys',
      new TableColumn({
        name: 'startedAt',
        type: dbType === 'postgres' ? 'timestamp' : 'datetime',
        isNullable: true,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('surveys'))) return;
    const table = await queryRunner.getTable('surveys');
    if (table?.columns.some((column) => column.name === 'startedAt')) {
      await queryRunner.dropColumn('surveys', 'startedAt');
    }
  }
}
