import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class Contributions20261106170000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('contributors'))) {
      const postgres = runner.connection.options.type === 'postgres';
      await runner.createTable(new Table({ name: 'contributors', columns: [
        { name: 'id', type: postgres ? 'uuid' : 'varchar', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
        { name: 'name', type: 'varchar', length: '120' },
        { name: 'active', type: 'boolean', default: true },
        { name: 'orgId', type: postgres ? 'uuid' : 'varchar', isNullable: true },
      ] }));
      await runner.createIndex('contributors', new TableIndex({ name: 'IDX_contributors_orgId', columnNames: ['orgId'] }));
    }
    if (!(await runner.hasColumn('activities', 'contributions'))) {
      await runner.addColumn('activities', new TableColumn({ name: 'contributions', type: 'text', isNullable: true }));
    }
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.dropColumn('activities', 'contributions');
    await runner.dropTable('contributors');
  }
}
