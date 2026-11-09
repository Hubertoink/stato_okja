import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserSidebarColoredIcons20261107120000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.getTable('users');
    if (!users || users.columns.some((column) => column.name === 'sidebarColoredIcons')) return;
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'sidebarColoredIcons',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'sidebarColoredIcons')) {
      await queryRunner.dropColumn('users', 'sidebarColoredIcons');
    }
  }
}
