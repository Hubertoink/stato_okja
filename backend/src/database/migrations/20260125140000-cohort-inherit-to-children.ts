import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class CohortInheritToChildren20260125140000 implements MigrationInterface {
  name = 'CohortInheritToChildren20260125140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.connection.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    const hasTable = await queryRunner.hasTable('cohorts');
    if (!hasTable) return;

    const table = await queryRunner.getTable('cohorts');
    const hasColumn = table?.columns.find((c) => c.name === 'inheritToChildren');
    if (hasColumn) return;

    await queryRunner.addColumn(
      'cohorts',
      new TableColumn({
        name: 'inheritToChildren',
        type: isPostgres ? 'boolean' : 'boolean',
        isNullable: false,
        default: 'false',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('cohorts');
    if (!hasTable) return;

    const table = await queryRunner.getTable('cohorts');
    const hasColumn = table?.columns.find((c) => c.name === 'inheritToChildren');
    if (!hasColumn) return;

    await queryRunner.dropColumn('cohorts', 'inheritToChildren');
  }
}
