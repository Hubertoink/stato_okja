import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class Surveys20260725193000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = String((queryRunner.connection.options as { type?: unknown }).type || '').toLowerCase();
    const uuidType = dbType === 'postgres' ? 'uuid' : 'varchar';
    const timestampType = dbType === 'postgres' ? 'timestamp' : 'datetime';
    if (!(await queryRunner.hasTable('surveys'))) {
      await queryRunner.createTable(new Table({
        name: 'surveys',
        columns: [
          { name: 'id', type: uuidType, isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'orgId', type: uuidType, isNullable: true },
          { name: 'projectId', type: uuidType, isNullable: true },
          { name: 'title', type: 'varchar', length: '180' },
          { name: 'introduction', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', length: '16', default: "'draft'" },
          { name: 'publicToken', type: 'varchar', length: '128' },
          { name: 'questions', type: 'text', isNullable: true },
          { name: 'allowMultiplePerDevice', type: 'boolean', default: false },
          { name: 'expectedParticipants', type: 'int', isNullable: true },
          { name: 'startsAt', type: timestampType, isNullable: true },
          { name: 'endsAt', type: timestampType, isNullable: true },
          { name: 'closedAt', type: timestampType, isNullable: true },
          { name: 'rawResponsesPurgeAt', type: timestampType, isNullable: true },
          { name: 'aggregateSnapshot', type: 'text', isNullable: true },
          { name: 'createdById', type: uuidType, isNullable: true },
          { name: 'archived', type: 'boolean', default: false },
          { name: 'createdAt', type: timestampType, default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: timestampType, default: 'CURRENT_TIMESTAMP' },
        ],
      }));
      await queryRunner.createIndices('surveys', [
        new TableIndex({ name: 'IDX_surveys_org_status', columnNames: ['orgId', 'status'] }),
        new TableIndex({ name: 'IDX_surveys_public_token', columnNames: ['publicToken'], isUnique: true }),
      ]);
    }
    if (!(await queryRunner.hasTable('survey_responses'))) {
      await queryRunner.createTable(new Table({
        name: 'survey_responses',
        columns: [
          { name: 'id', type: uuidType, isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'surveyId', type: uuidType },
          { name: 'deviceTokenHash', type: 'varchar', length: '128', isNullable: true },
          { name: 'answers', type: 'text' },
          { name: 'submittedAt', type: timestampType, default: 'CURRENT_TIMESTAMP' },
        ],
      }));
      await queryRunner.createIndices('survey_responses', [
        new TableIndex({ name: 'IDX_survey_responses_survey_submitted', columnNames: ['surveyId', 'submittedAt'] }),
        new TableIndex({ name: 'IDX_survey_responses_device_unique', columnNames: ['surveyId', 'deviceTokenHash'], isUnique: true }),
      ]);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('survey_responses')) await queryRunner.dropTable('survey_responses');
    if (await queryRunner.hasTable('surveys')) await queryRunner.dropTable('surveys');
  }
}
