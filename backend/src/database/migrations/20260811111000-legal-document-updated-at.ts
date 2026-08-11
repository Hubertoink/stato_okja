import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class LegalDocumentUpdatedAt20260811111000 implements MigrationInterface {
  name = 'LegalDocumentUpdatedAt20260811111000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('legal_content_overrides');
    if (!table) return;
    const dbType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase();
    const timestampType = dbType === 'postgres' ? 'timestamptz' : 'datetime';
    for (const name of ['imprintUpdatedAt', 'privacyUpdatedAt', 'termsUpdatedAt']) {
      if (!table.columns.some((column) => column.name === name)) {
        await queryRunner.addColumn('legal_content_overrides', new TableColumn({ name, type: timestampType, isNullable: true }));
      }
    }
    await queryRunner.query(
      'UPDATE "legal_content_overrides" SET "imprintUpdatedAt" = "updatedAt", "privacyUpdatedAt" = "updatedAt", "termsUpdatedAt" = "updatedAt" WHERE "imprintUpdatedAt" IS NULL OR "privacyUpdatedAt" IS NULL OR "termsUpdatedAt" IS NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('legal_content_overrides');
    if (!table) return;
    for (const name of ['termsUpdatedAt', 'privacyUpdatedAt', 'imprintUpdatedAt']) {
      if (table.columns.some((column) => column.name === name)) await queryRunner.dropColumn('legal_content_overrides', name);
    }
  }
}
