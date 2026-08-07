import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** Stores whether the user's selected theme follows the OS or an explicit mode. */
export class AddUserThemeMode20260807100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.getTable('users');
    if (!users || users.columns.some((column) => column.name === 'themeMode')) return;

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'themeMode',
        type: 'varchar',
        length: '16',
        default: "'system'",
        isNullable: false,
      }),
    );

    // Preserve existing explicit theme choices while new/default users follow the OS.
    await queryRunner.query(
      `UPDATE "users" SET "themeMode" = 'custom' WHERE "theme" IS NOT NULL AND "theme" NOT IN ('Default Theme', 'light', 'Light Steel')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.getTable('users');
    if (users?.columns.some((column) => column.name === 'themeMode')) {
      await queryRunner.dropColumn('users', 'themeMode');
    }
  }
}
