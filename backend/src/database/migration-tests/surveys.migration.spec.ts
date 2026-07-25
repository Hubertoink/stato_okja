import { DataSource } from 'typeorm';
import { Surveys20260725193000 } from '../migrations/20260725193000-surveys';

describe('Surveys20260725193000', () => {
  it('creates and removes the survey tables on the SQL.js development database', async () => {
    const dataSource = new DataSource({ type: 'sqljs', autoSave: false });
    await dataSource.initialize();
    const runner = dataSource.createQueryRunner();
    const migration = new Surveys20260725193000();
    try {
      await migration.up(runner);
      expect(await runner.hasTable('surveys')).toBe(true);
      expect(await runner.hasTable('survey_responses')).toBe(true);
      expect((await runner.getTable('surveys'))?.columns.map((column) => column.name)).toContain('aggregateSnapshot');
      await migration.down(runner);
      expect(await runner.hasTable('surveys')).toBe(false);
      expect(await runner.hasTable('survey_responses')).toBe(false);
    } finally {
      await runner.release();
      await dataSource.destroy();
    }
  });
});
