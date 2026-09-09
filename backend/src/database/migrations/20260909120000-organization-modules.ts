import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class OrganizationModules20260909120000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    for (const name of ['logbookEnabled', 'surveysEnabled']) {
      if (await queryRunner.hasColumn('organizations', name)) continue;
      await queryRunner.addColumn('organizations', new TableColumn({ name, type: 'boolean', isNullable: false, default: false }));
      // Preserve access for existing organizations; new organizations start disabled.
      await queryRunner.query(`UPDATE "organizations" SET "${name}" = true`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of ['surveysEnabled', 'logbookEnabled']) {
      if (await queryRunner.hasColumn('organizations', name)) await queryRunner.dropColumn('organizations', name);
    }
  }
}
