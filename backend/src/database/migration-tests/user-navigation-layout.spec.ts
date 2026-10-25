import { DataSource } from 'typeorm';
import { AddUserNavigationLayout20261025130000 } from '../migrations/20261025130000-add-user-navigation-layout';

describe('User navigation layout migration', () => {
  it('preserves existing users and their choices on repeated migration, and can roll back', async () => {
    const db = await new DataSource({ type: 'sqljs', entities: [] }).initialize();
    const runner = db.createQueryRunner();
    try {
      await runner.query('CREATE TABLE users (id varchar PRIMARY KEY, name varchar)');
      await runner.query("INSERT INTO users VALUES ('existing', 'Existing user')");
      const migration = new AddUserNavigationLayout20261025130000();
      await migration.up(runner);
      expect(await runner.query('SELECT "navigationLayout" FROM users')).toEqual([
        { navigationLayout: 'sidebar' },
      ]);
      await runner.query('UPDATE users SET "navigationLayout" = \'top\'');
      await migration.up(runner);
      await runner.query("INSERT INTO users (id, name) VALUES ('new', 'New user')");
      expect(await runner.query('SELECT "navigationLayout" FROM users ORDER BY id')).toEqual([
        { navigationLayout: 'top' },
        { navigationLayout: 'sidebar' },
      ]);
      await migration.down(runner);
      expect(await runner.hasColumn('users', 'navigationLayout')).toBe(false);
      expect(await runner.query('SELECT name FROM users')).toHaveLength(2);
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
