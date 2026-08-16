import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

export class Processes20260816120000 implements MigrationInterface {
  name = 'Processes20260816120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('organizations', 'processesEnabled'))) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({ name: 'processesEnabled', type: 'boolean', isNullable: false, default: 'false' }),
      );
    }

    if (!(await queryRunner.hasTable('processes'))) {
      await queryRunner.createTable(
        new Table({
          name: 'processes',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
            { name: 'orgId', type: 'uuid', isNullable: false },
            { name: 'title', type: 'varchar', length: '180', isNullable: false },
            { name: 'purpose', type: 'text', isNullable: true },
            { name: 'definition', type: 'text', isNullable: false },
            { name: 'createdByUserId', type: 'uuid', isNullable: true },
            { name: 'createdAt', type: 'timestamp', isNullable: false, default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'timestamp', isNullable: false, default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );
      await queryRunner.createForeignKey(
        'processes',
        new TableForeignKey({
          name: 'FK_processes_organization',
          columnNames: ['orgId'],
          referencedTableName: 'organizations',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('processes')) await queryRunner.dropTable('processes');
    if (await queryRunner.hasColumn('organizations', 'processesEnabled')) {
      await queryRunner.dropColumn('organizations', 'processesEnabled');
    }
  }
}
