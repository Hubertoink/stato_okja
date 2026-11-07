import { DataSource } from 'typeorm';
import { AddUserSidebarColoredIcons20261107120000 } from '../migrations/20261107120000-add-user-sidebar-colored-icons';

describe('User sidebar colored icons migration', () => {
  it('preserves existing users and their choices on repeated migration, and can roll back', async () => {
    const db = await new DataSource({ type: 'sqljs', entities: [] }).initialize();
    const runner = db.createQueryRunner();
    try {
      await runner.query('CREATE TABLE users (id varchar PRIMARY KEY, name varchar)');
      await runner.query("INSERT INTO users VALUES ('existing', 'Existing user')");
      const migration = new AddUserSidebarColoredIcons20261107120000();
      await migration.up(runner);
      expect(await runner.query('SELECT "sidebarColoredIcons" FROM users')).toEqual([
        { sidebarColoredIcons: 0 },
      ]);
      await runner.query('UPDATE users SET "sidebarColoredIcons" = 1');
      await migration.up(runner);
      await runner.query("INSERT INTO users (id, name) VALUES ('new', 'New user')");
      expect(await runner.query('SELECT "sidebarColoredIcons" FROM users ORDER BY id')).toEqual([
        { sidebarColoredIcons: 1 },
        { sidebarColoredIcons: 0 },
      ]);
      await migration.down(runner);
      expect(await runner.hasColumn('users', 'sidebarColoredIcons')).toBe(false);
      expect(await runner.query('SELECT name FROM users')).toHaveLength(2);
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
