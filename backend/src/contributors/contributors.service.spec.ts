import { DataSource, EntitySchema } from 'typeorm';
import { Contributor } from './contributor.entity';
import { Activity } from '../activities/entities/activity.entity';
import { ContributorsService } from './contributors.service';

// Exercise the real simple-json storage and transaction rollback without loading
// unrelated activity relations into this focused persistence test.
const activitySchema = new EntitySchema<Activity>({
  name: 'Activity', target: Activity, tableName: 'activities',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    orgId: { type: 'uuid', nullable: true },
    contributions: { type: 'simple-json', nullable: true },
  },
});

describe('contributor removal', () => {
  let db: DataSource;
  let service: ContributorsService;
  let person: Contributor;
  beforeEach(async () => {
    db = await new DataSource({ type: 'sqljs', entities: [Contributor, activitySchema], synchronize: true }).initialize();
    service = new ContributorsService(db.getRepository(Contributor), db.getRepository(Activity));
    person = await service.create({ name: 'Lea' }, 'org-a');
  });
  afterEach(async () => { await db.destroy(); });

  it('counts affected activities and deletes only this person’s contributions', async () => {
    const other = await service.create({ name: 'Sam' }, 'org-a');
    const activity = await db.getRepository(Activity).save({ orgId: 'org-a', contributions: [
      { contributorId: person.id, minutes: 60 }, { contributorId: other.id, minutes: 30 },
    ] });
    const unrelated = await db.getRepository(Activity).save({ orgId: 'org-b', contributions: [{ contributorId: 'foreign', minutes: 40 }] });
    expect(await service.usage(person.id, 'org-a')).toEqual({ count: 1 });
    await service.remove(person.id, 'org-a');
    expect(await db.getRepository(Contributor).findOneBy({ id: person.id })).toBeNull();
    expect((await db.getRepository(Activity).findOneByOrFail({ id: activity.id })).contributions).toEqual([{ contributorId: other.id, minutes: 30 }]);
    expect(await db.getRepository(Activity).findOneBy({ id: unrelated.id })).toEqual(unrelated);
  });

  it('keeps historic assignments when archiving and allows reactivation', async () => {
    const activity = await db.getRepository(Activity).save({ orgId: 'org-a', contributions: [{ contributorId: person.id, minutes: 60 }] });
    await service.update(person.id, { active: false }, 'org-a');
    expect((await service.list('org-a'))[0].active).toBe(false);
    expect(await db.getRepository(Activity).findOneBy({ id: activity.id })).toEqual(activity);
    await service.update(person.id, { active: true }, 'org-a');
    expect((await service.list('org-a'))[0].active).toBe(true);
  });

  it('rejects inspection and deletion across organization scopes', async () => {
    await expect(service.usage(person.id, 'org-b')).rejects.toThrow('nicht gefunden');
    await expect(service.remove(person.id, null)).rejects.toThrow('nicht gefunden');
    expect(await db.getRepository(Contributor).count()).toBe(1);
  });

  it('supports deleting an unused person in the unassigned scope', async () => {
    const unassigned = await service.create({ name: 'Global' }, null);
    expect(await service.usage(unassigned.id, null)).toEqual({ count: 0 });
    await service.remove(unassigned.id, null);
    expect((await service.list('org-a'))[0].id).toBe(person.id);
  });

  it('rolls back removed assignments if deleting the person fails', async () => {
    const activity = await db.getRepository(Activity).save({ orgId: 'org-a', contributions: [{ contributorId: person.id, minutes: 60 }] });
    await db.query(`CREATE TRIGGER prevent_removal BEFORE DELETE ON contributors BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
    await expect(service.remove(person.id, 'org-a')).rejects.toThrow('test failure');
    expect(await db.getRepository(Activity).findOneBy({ id: activity.id })).toEqual(activity);
    expect(await db.getRepository(Contributor).findOneBy({ id: person.id })).not.toBeNull();
  });
});
