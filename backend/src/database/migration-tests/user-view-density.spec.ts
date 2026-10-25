import { DataSource } from 'typeorm';
import { AddUserViewDensity20261025120000 } from '../migrations/20261025120000-add-user-view-density';

describe('User view density migration', () => {
  it('preserves existing users and their choices on repeated migration, and can roll back', async () => {
    const db = await new DataSource({ type: 'sqljs', entities: [] }).initialize();
    const runner = db.createQueryRunner();
    try {
      await runner.query('CREATE TABLE users (id varchar PRIMARY KEY, name varchar)');
      await runner.query("INSERT INTO users VALUES ('existing', 'Existing user')");
      const migration = new AddUserViewDensity20261025120000();
      await migration.up(runner);
      expect(await runner.query('SELECT "viewDensity" FROM users')).toEqual([{ viewDensity: 'compact' }]);
      await runner.query("UPDATE users SET \"viewDensity\" = 'normal'");
      await migration.up(runner);
      await runner.query("INSERT INTO users (id, name) VALUES ('new', 'New user')");
      expect(await runner.query('SELECT "viewDensity" FROM users ORDER BY id')).toEqual([{ viewDensity: 'normal' }, { viewDensity: 'compact' }]);
      await migration.down(runner);
      expect(await runner.hasColumn('users', 'viewDensity')).toBe(false);
      expect(await runner.query('SELECT name FROM users')).toHaveLength(2);
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
