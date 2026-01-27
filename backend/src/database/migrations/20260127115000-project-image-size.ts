import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ProjectImageSize20260127115000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('projects');
    if (!table) return;

    const hasColumn = table.columns.some((c) => c.name === 'imageSize');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'projects',
        new TableColumn({
          name: 'imageSize',
          type: 'bigint',
          isNullable: true,
          default: null,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('projects');
    if (!table) return;

    const hasColumn = table.columns.some((c) => c.name === 'imageSize');
    if (hasColumn) {
      await queryRunner.dropColumn('projects', 'imageSize');
    }
  }
}
