import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AnnualTargets20261008120000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('annual_targets')) return;
    const postgres = queryRunner.connection.options.type === 'postgres';
    if (postgres) await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.createTable(
      new Table({
        name: 'annual_targets',
        columns: [
          {
            name: 'id',
            type: postgres ? 'uuid' : 'varchar',
            isPrimary: true,
            ...(postgres
              ? {
                  isGenerated: true,
                  generationStrategy: 'uuid' as const,
                  default: 'uuid_generate_v4()',
                }
              : {}),
          },
          { name: 'orgId', type: postgres ? 'uuid' : 'varchar', isNullable: true },
          { name: 'year', type: 'integer' },
          { name: 'title', type: 'varchar', length: '120' },
          { name: 'metric', type: 'varchar', length: '40' },
          { name: 'scope', type: 'text' },
          { name: 'rule', type: 'varchar', length: '10' },
          { name: 'target', type: 'double precision' },
          { name: 'upperTarget', type: 'double precision', isNullable: true },
          { name: 'status', type: 'varchar', length: '10', default: "'draft'" },
          { name: 'description', type: 'text', default: "''" },
          { name: 'showOnDashboard', type: 'boolean', default: postgres ? 'true' : '1' },
          { name: 'review', type: 'text', default: "''" },
          { name: 'snapshot', type: 'text', isNullable: true },
          { name: 'history', type: 'text' },
          { name: 'version', type: 'integer', default: '1' },
          {
            name: 'createdAt',
            type: postgres ? 'timestamp' : 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: postgres ? 'timestamp' : 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'annual_targets',
      new TableIndex({ name: 'IDX_annual_targets_org_year', columnNames: ['orgId', 'year'] }),
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('annual_targets');
  }
}
