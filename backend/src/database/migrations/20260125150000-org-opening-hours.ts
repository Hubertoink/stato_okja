import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class OrgOpeningHours20260125150000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('organizations');
    if (!hasTable) return;

    const hasColumn = await queryRunner.hasColumn('organizations', 'openingHours');
    if (hasColumn) return;

    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'openingHours',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('organizations');
    if (!hasTable) return;

    const hasColumn = await queryRunner.hasColumn('organizations', 'openingHours');
    if (!hasColumn) return;

    await queryRunner.dropColumn('organizations', 'openingHours');
  }
}
