import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLocales20260729110000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.getTable('users');
    if (users && !users.columns.some((column) => column.name === 'locale')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({ name: 'locale', type: 'varchar', length: '8', isNullable: true }),
      );
    }

    const organizations = await queryRunner.getTable('organizations');
    if (organizations && !organizations.columns.some((column) => column.name === 'defaultLocale')) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({ name: 'defaultLocale', type: 'varchar', length: '8', default: "'de'" }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.getTable('users');
    if (users?.columns.some((column) => column.name === 'locale')) {
      await queryRunner.dropColumn('users', 'locale');
    }

    const organizations = await queryRunner.getTable('organizations');
    if (organizations?.columns.some((column) => column.name === 'defaultLocale')) {
      await queryRunner.dropColumn('organizations', 'defaultLocale');
    }
  }
}
