import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class InviteTokenVersion20260714123000 implements MigrationInterface {
  name = 'InviteTokenVersion20260714123000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (!table || table.columns.some((column) => column.name === 'inviteTokenVersion')) return;

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'inviteTokenVersion',
        type: 'int',
        isNullable: false,
        default: '0',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (table?.columns.some((column) => column.name === 'inviteTokenVersion')) {
      await queryRunner.dropColumn('users', 'inviteTokenVersion');
    }
  }
}
