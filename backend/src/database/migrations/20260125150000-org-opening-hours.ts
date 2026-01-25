import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class OrgOpeningHours20260125150000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
    await queryRunner.dropColumn('organizations', 'openingHours');
  }
}
