import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserViewDensity20261025120000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.getTable('users');
    if (!users || users.columns.some((column) => column.name === 'viewDensity')) return;
    await queryRunner.addColumn('users', new TableColumn({
      name: 'viewDensity',
      type: 'varchar',
      length: '16',
      default: "'compact'",
      isNullable: false,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'viewDensity')) {
      await queryRunner.dropColumn('users', 'viewDensity');
    }
  }
}
