import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class OrganizationMemberships20260814233000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String(queryRunner.connection.options.type || '').toLowerCase();
    if (dbType === 'postgres') {
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    }
    if (!(await queryRunner.hasTable('organization_memberships'))) {
      await queryRunner.createTable(
        new Table({
          name: 'organization_memberships',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
            { name: 'userId', type: 'uuid', isNullable: false },
            { name: 'orgId', type: 'uuid', isNullable: false },
            { name: 'role', type: 'varchar', length: '50', default: "'user'" },
            { name: 'status', type: 'varchar', length: '16', default: "'active'" },
            { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );
      await queryRunner.createForeignKeys('organization_memberships', [
        new TableForeignKey({ columnNames: ['userId'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
        new TableForeignKey({ columnNames: ['orgId'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
      ]);
      await queryRunner.createIndices('organization_memberships', [
        new TableIndex({ name: 'UQ_organization_memberships_user_org', columnNames: ['userId', 'orgId'], isUnique: true }),
        new TableIndex({ name: 'IDX_organization_memberships_org_status', columnNames: ['orgId', 'status'] }),
      ]);
    }

    // Preserve all existing tenant assignments. Superadmins remain platform-wide
    // and deliberately receive no implicit tenant membership.
    if (dbType === 'postgres') {
      await queryRunner.query(`
        INSERT INTO "organization_memberships" ("id", "userId", "orgId", "role", "status", "createdAt", "updatedAt")
        SELECT uuid_generate_v4(), u."id", u."orgId", u."role", 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM "users" u
        WHERE u."orgId" IS NOT NULL AND u."role" <> 'superadmin'
        ON CONFLICT ("userId", "orgId") DO NOTHING
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('organization_memberships')) {
      await queryRunner.dropTable('organization_memberships', true);
    }
  }
}
