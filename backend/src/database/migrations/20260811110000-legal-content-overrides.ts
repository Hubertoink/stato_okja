import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class LegalContentOverrides20260811110000 implements MigrationInterface {
  name = 'LegalContentOverrides20260811110000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('legal_content_overrides')) return;
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const uuidType = dbType === 'postgres' ? 'uuid' : 'varchar';
    const timestampType = dbType === 'postgres' ? 'timestamptz' : 'datetime';
    await queryRunner.createTable(new Table({
      name: 'legal_content_overrides',
      columns: [
        { name: 'id', type: uuidType, isPrimary: true, isGenerated: dbType === 'postgres', generationStrategy: dbType === 'postgres' ? 'uuid' : undefined },
        { name: 'imprint', type: 'text' },
        { name: 'privacy', type: 'text' },
        { name: 'terms', type: 'text' },
        { name: 'termsVersion', type: 'varchar', length: '40' },
        { name: 'imprintUpdatedAt', type: timestampType, isNullable: true },
        { name: 'privacyUpdatedAt', type: timestampType, isNullable: true },
        { name: 'termsUpdatedAt', type: timestampType, isNullable: true },
        { name: 'updatedByUserId', type: uuidType, isNullable: true },
        { name: 'updatedAt', type: timestampType, default: dbType === 'postgres' ? 'now()' : 'CURRENT_TIMESTAMP' },
      ],
    }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('legal_content_overrides')) {
      await queryRunner.dropTable('legal_content_overrides');
    }
  }
}
