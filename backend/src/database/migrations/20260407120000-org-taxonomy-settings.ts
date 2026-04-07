import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class OrgTaxonomySettings20260407120000 implements MigrationInterface {
  name = 'OrgTaxonomySettings20260407120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('organizations');
    if (!hasTable) return;

    const table = await queryRunner.getTable('organizations');
    const hasColumn = table?.columns.find((column) => column.name === 'taxonomySettings');
    if (hasColumn) return;

    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'taxonomySettings',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('organizations');
    if (!hasTable) return;

    const table = await queryRunner.getTable('organizations');
    const hasColumn = table?.columns.find((column) => column.name === 'taxonomySettings');
    if (!hasColumn) return;

    await queryRunner.dropColumn('organizations', 'taxonomySettings');
  }
}