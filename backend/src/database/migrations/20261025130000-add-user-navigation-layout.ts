import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserNavigationLayout20261025130000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.getTable('users');
    if (!users || users.columns.some((column) => column.name === 'navigationLayout')) return;
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'navigationLayout',
        type: 'varchar',
        length: '16',
        default: "'sidebar'",
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'navigationLayout')) {
      await queryRunner.dropColumn('users', 'navigationLayout');
    }
  }
}
