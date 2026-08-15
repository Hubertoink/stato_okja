import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class OrganizationBranding20260815130000 implements MigrationInterface {
  name = 'OrganizationBranding20260815130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('organizations', 'bannerUrl'))) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({ name: 'bannerUrl', type: 'varchar', length: '500', isNullable: true }),
      );
    }
    if (!(await queryRunner.hasColumn('organizations', 'brandColor'))) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({ name: 'brandColor', type: 'varchar', length: '7', isNullable: true }),
      );
    }
    if (!(await queryRunner.hasColumn('organizations', 'bannerPosition'))) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({ name: 'bannerPosition', type: 'smallint', isNullable: true }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['bannerPosition', 'brandColor', 'bannerUrl']) {
      if (await queryRunner.hasColumn('organizations', column)) {
        await queryRunner.dropColumn('organizations', column);
      }
    }
  }
}
