import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ContributorColor20261106180000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasColumn('contributors', 'color'))) {
      await runner.addColumn('contributors', new TableColumn({ name: 'color', type: 'varchar', length: '7', default: "'#7aa39a'" }));
    }
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.dropColumn('contributors', 'color');
  }
}
