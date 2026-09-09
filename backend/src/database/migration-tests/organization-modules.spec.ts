import { DataSource } from 'typeorm';
import { OrganizationModules20260909120000 } from '../migrations/20260909120000-organization-modules';

describe('Organization module migration', () => {
  it('preserves existing access and data, defaults new organizations to disabled, and does not inherit', async () => {
    const db = await new DataSource({ type: 'sqljs', entities: [] }).initialize();
    const runner = db.createQueryRunner();
    try {
      await runner.query('CREATE TABLE organizations (id varchar PRIMARY KEY, "parentId" varchar, "processesEnabled" boolean NOT NULL DEFAULT false)');
      await runner.query("INSERT INTO organizations (id, \"processesEnabled\") VALUES ('parent', true)");
      await runner.query('CREATE TABLE logbook_entries (id varchar PRIMARY KEY, "orgId" varchar, body varchar)');
      await runner.query("INSERT INTO logbook_entries VALUES ('entry', 'parent', 'Original documentation')");
      const migration = new OrganizationModules20260909120000();
      await migration.up(runner);
      expect(await runner.query('SELECT "processesEnabled", "logbookEnabled", "surveysEnabled" FROM organizations')).toEqual([{ processesEnabled: 1, logbookEnabled: 1, surveysEnabled: 1 }]);
      await runner.query("INSERT INTO organizations (id, \"parentId\") VALUES ('child', 'parent')");
      expect(await runner.query("SELECT \"processesEnabled\", \"logbookEnabled\", \"surveysEnabled\" FROM organizations WHERE id = 'child'")).toEqual([{ processesEnabled: 0, logbookEnabled: 0, surveysEnabled: 0 }]);
      await runner.query("UPDATE organizations SET \"logbookEnabled\" = false WHERE id = 'parent'");
      await migration.up(runner);
      expect(await runner.query("SELECT \"logbookEnabled\" FROM organizations WHERE id = 'parent'")).toEqual([{ logbookEnabled: 0 }]);
      await runner.query("UPDATE organizations SET \"logbookEnabled\" = true WHERE id = 'parent'");
      expect(await runner.query('SELECT body FROM logbook_entries')).toEqual([{ body: 'Original documentation' }]);
      await migration.down(runner);
      expect(await runner.hasColumn('organizations', 'logbookEnabled')).toBe(false);
      expect(await runner.query('SELECT body FROM logbook_entries')).toHaveLength(1);
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
