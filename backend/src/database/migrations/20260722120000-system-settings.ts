import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class SystemSettings20260722120000 implements MigrationInterface {
  name = 'SystemSettings20260722120000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('system_settings')) return;
    await queryRunner.createTable(new Table({
      name: 'system_settings',
      columns: [
        { name: 'id', type: 'varchar', length: '32', isPrimary: true },
        { name: 'orgName', type: 'varchar', length: '200', isNullable: true },
        { name: 'loginSubtitle', type: 'varchar', length: '300', isNullable: true },
        { name: 'accountProvisioningPolicy', type: 'varchar', length: '32', isNullable: true },
      ],
    }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('system_settings')) await queryRunner.dropTable('system_settings');
  }
}
