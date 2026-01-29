import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class AddActivityAckdoneAndAcks20260125120000 implements MigrationInterface {
  name = 'AddActivityAckdoneAndAcks20260125120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.connection.options as { type?: unknown }).type || '').toLowerCase();
    const isPostgres = dbType === 'postgres';

    if (isPostgres) {
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    }

    // Prüfe ob die activities Tabelle existiert (bei frischer DB mit synchronize=true möglicherweise nicht)
    const hasActivitiesTable = await queryRunner.hasTable('activities');
    if (hasActivitiesTable) {
      const hasAckDone = await queryRunner.hasColumn('activities', 'ackDone');
      if (!hasAckDone) {
        await queryRunner.addColumn(
          'activities',
          new TableColumn({
            name: 'ackDone',
            type: 'boolean',
            isNullable: false,
            default: 'false',
          }),
        );
      }
    }

    const hasAcksTable = await queryRunner.hasTable('activity_acks');
    if (!hasAcksTable) {
      const uuidType = isPostgres ? 'uuid' : 'varchar';
      const timestampType = isPostgres ? 'timestamptz' : 'datetime';
      const nowDefault = isPostgres ? 'now()' : 'CURRENT_TIMESTAMP';

      await queryRunner.createTable(
        new Table({
          name: 'activity_acks',
          columns: [
            {
              name: 'id',
              type: uuidType,
              isPrimary: true,
              isGenerated: isPostgres,
              generationStrategy: isPostgres ? 'uuid' : undefined,
            },
            { name: 'userId', type: uuidType, isNullable: false },
            { name: 'activityId', type: uuidType, isNullable: false },
            { name: 'orgId', type: uuidType, isNullable: true },
            { name: 'done', type: 'boolean', isNullable: false, default: 'true' },
            { name: 'createdAt', type: timestampType, isNullable: false, default: nowDefault },
            { name: 'updatedAt', type: timestampType, isNullable: false, default: nowDefault },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'activity_acks',
        new TableIndex({
          name: 'IDX_activity_acks_user_activity_org_unique',
          columnNames: ['userId', 'activityId', 'orgId'],
          isUnique: true,
        }),
      );

      await queryRunner.createIndex(
        'activity_acks',
        new TableIndex({
          name: 'IDX_activity_acks_activityId',
          columnNames: ['activityId'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasAcksTable = await queryRunner.hasTable('activity_acks');
    if (hasAcksTable) {
      await queryRunner.dropTable('activity_acks', true);
    }

    const hasActivitiesTable = await queryRunner.hasTable('activities');
    if (hasActivitiesTable) {
      const hasAckDone = await queryRunner.hasColumn('activities', 'ackDone');
      if (hasAckDone) {
        await queryRunner.dropColumn('activities', 'ackDone');
      }
    }
  }
}
