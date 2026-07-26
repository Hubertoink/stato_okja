import { DataSource } from 'typeorm';
import { Surveys20260725193000 } from '../migrations/20260725193000-surveys';
import { SurveySeries20260725210000 } from '../migrations/20260725210000-survey-series';
import { SurveyStartedAt20260726100000 } from '../migrations/20260726100000-survey-started-at';

describe('SurveySeries20260725210000', () => {
  it('adds a first round to existing survey records', async () => {
    const dataSource = new DataSource({ type: 'sqljs', autoSave: false });
    await dataSource.initialize();
    const runner = dataSource.createQueryRunner();
    try {
      await new Surveys20260725193000().up(runner);
      await runner.query(`INSERT INTO "surveys" ("id", "title", "status", "publicToken", "archived") VALUES ('survey-1', 'Feedback', 'closed', 'token-1', 0)`);
      await new SurveySeries20260725210000().up(runner);
      await new SurveyStartedAt20260726100000().up(runner);
      const table = await runner.getTable('surveys');
      expect(table?.columns.map((column) => column.name)).toEqual(expect.arrayContaining(['seriesId', 'roundNumber', 'startedAt']));
      const rows = await runner.query('SELECT "seriesId", "roundNumber" FROM "surveys" WHERE "id" = ?', ['survey-1']);
      expect(rows[0]).toEqual(expect.objectContaining({ seriesId: 'survey-1', roundNumber: 1 }));
    } finally {
      await runner.release();
      await dataSource.destroy();
    }
  });
});
