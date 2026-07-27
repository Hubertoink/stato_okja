import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class TermsOfUseAcceptance20260715110000 implements MigrationInterface {
  name = 'TermsOfUseAcceptance20260715110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (!table) return;
    const timestampType = String((queryRunner.dataSource.options as { type?: unknown }).type || '').toLowerCase() === 'postgres'
      ? 'timestamp'
      : 'datetime';

    if (!table.columns.some((column) => column.name === 'termsAcceptedVersion')) {
      await queryRunner.addColumn('users', new TableColumn({ name: 'termsAcceptedVersion', type: 'varchar', length: '40', isNullable: true }));
    }
    if (!table.columns.some((column) => column.name === 'termsAcceptedAt')) {
      await queryRunner.addColumn('users', new TableColumn({ name: 'termsAcceptedAt', type: timestampType, isNullable: true }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (!table) return;
    if (table.columns.some((column) => column.name === 'termsAcceptedAt')) await queryRunner.dropColumn('users', 'termsAcceptedAt');
    if (table.columns.some((column) => column.name === 'termsAcceptedVersion')) await queryRunner.dropColumn('users', 'termsAcceptedVersion');
  }
}
