import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AnnualTargetPeriod20261008180000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    for (const name of ['dateFrom', 'dateTo']) {
      if (!(await queryRunner.hasColumn('annual_targets', name))) {
        await queryRunner.addColumn(
          'annual_targets',
          new TableColumn({ name, type: 'date', isNullable: true }),
        );
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of ['dateTo', 'dateFrom']) {
      if (await queryRunner.hasColumn('annual_targets', name)) {
        await queryRunner.dropColumn('annual_targets', name);
      }
    }
  }
}
