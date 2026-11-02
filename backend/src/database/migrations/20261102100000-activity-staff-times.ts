import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ActivityStaffTimes20261102100000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'activities',
      new TableColumn({ name: 'staffTimes', type: 'text', isNullable: true }),
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('activities', 'staffTimes');
  }
}
