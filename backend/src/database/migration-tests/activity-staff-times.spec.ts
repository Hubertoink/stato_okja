import { DataSource } from 'typeorm';
import { ActivityStaffTimes20261102100000 } from '../migrations/20261102100000-activity-staff-times';

describe('staff times migration', () => {
  it('preserves a bootstrapped column and its data on repeated runs', async () => {
    const db = await new DataSource({ type: 'sqljs', entities: [] }).initialize();
    const runner = db.createQueryRunner();
    try {
      await runner.query('CREATE TABLE activities (id varchar PRIMARY KEY, staffTimes text NULL)');
      const times = JSON.stringify([{ staffId: 'anna', minutes: 45 }]);
      await runner.query('INSERT INTO activities (id, staffTimes) VALUES (?, ?)', ['existing', times]);
      const migration = new ActivityStaffTimes20261102100000();
      await migration.up(runner);
      await migration.up(runner);
      expect(await runner.query('SELECT * FROM activities')).toEqual([
        { id: 'existing', staffTimes: times },
      ]);
    } finally {
      await runner.release();
      await db.destroy();
    }
  });

  it('preserves existing records and rolls back', async () => {
    const db = await new DataSource({ type: 'sqljs', entities: [] }).initialize();
    const runner = db.createQueryRunner();
    try {
      await runner.query('CREATE TABLE activities (id varchar PRIMARY KEY)');
      await runner.query("INSERT INTO activities (id) VALUES ('existing')");
      const migration = new ActivityStaffTimes20261102100000();
      await migration.up(runner);
      expect(await runner.query('SELECT * FROM activities')).toEqual([
        { id: 'existing', staffTimes: null },
      ]);
      await migration.down(runner);
      expect(await runner.query('SELECT * FROM activities')).toEqual([{ id: 'existing' }]);
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
