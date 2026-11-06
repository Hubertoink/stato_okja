import { ContributorColor20261106180000 } from '../migrations/20261106180000-contributor-color';
import { DataSource } from 'typeorm';
import { Contributions20261106170000 } from '../migrations/20261106170000-contributions';

describe('contribution migration', () => {
  it('preserves existing activities, supports bootstrap and repeated runs, and rolls back', async () => {
    const db = await new DataSource({ type: 'sqljs', entities: [] }).initialize();
    const runner = db.createQueryRunner();
    try {
      await runner.query('CREATE TABLE activities (id varchar PRIMARY KEY)');
      await runner.query("INSERT INTO activities (id) VALUES ('existing')");
      const migration = new Contributions20261106170000();
      await migration.up(runner);
      const entries = JSON.stringify([{ contributorId: 'lea', minutes: 60 }]);
      await runner.query('UPDATE activities SET contributions = ?', [entries]);
      await migration.up(runner);
      expect(await runner.query('SELECT * FROM activities')).toEqual([{ id: 'existing', contributions: entries }]);
      expect(await runner.hasTable('contributors')).toBe(true);
      const colors = new ContributorColor20261106180000();
      await runner.query("INSERT INTO contributors (id, name) VALUES ('lea', 'Lea')");
      await colors.up(runner);
      await colors.up(runner);
      expect(await runner.query('SELECT color FROM contributors')).toEqual([{ color: '#7aa39a' }]);
      await colors.down(runner);
      await migration.down(runner);
      expect(await runner.query('SELECT * FROM activities')).toEqual([{ id: 'existing' }]);
      expect(await runner.hasTable('contributors')).toBe(false);
    } finally { await runner.release(); await db.destroy(); }
  });
});
