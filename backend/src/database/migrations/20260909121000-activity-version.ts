import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ActivityVersion20260909121000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('activities', 'version'))) {
      await queryRunner.addColumn('activities', new TableColumn({
        name: 'version', type: 'integer', default: '0',
      }));
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('activities', 'version')) {
      await queryRunner.dropColumn('activities', 'version');
    }
  }
}