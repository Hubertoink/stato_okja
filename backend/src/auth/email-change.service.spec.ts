import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { EmailChangeService, type EmailChangeAction } from './email-change.service';
import { EmailChange } from './entities/email-change.entity';
import { EmailChanges20261122120000 } from '../database/migrations/20261122120000-email-changes';
import { User } from '../users/entities/user.entity';

const postgres = process.env.MIGRATION_TEST_POSTGRES === 'true' ? describe : describe.skip;

postgres('confirmed email changes on PostgreSQL', () => {
  const schema = 'email_test_' + randomUUID().replaceAll('-', '');
  const originalSmtp = process.env.SMTP_HOST;
  const password = 'ChangeMail12!';
  const send = jest.fn(async (_to: string, _subject: string, _text: string) => {});
  let db: DataSource;
  let service: EmailChangeService;
  let user: User;

  beforeAll(async () => {
    process.env.SMTP_HOST = 'localhost';
    db = await new DataSource({
      type: 'postgres', schema, uuidExtension: 'pgcrypto', entities: [path.join(__dirname, '../**/*.entity.ts')],
      host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USERNAME || 'stato_migration_test', password: process.env.DB_PASSWORD || 'stato_migration_test',
      database: process.env.DB_DATABASE || 'stato_migration_test', extra: { options: '-c search_path=' + schema + ',public' },
    }).initialize();
    await db.query('CREATE SCHEMA ' + schema);
    await db.synchronize();
    service = new EmailChangeService(db.getRepository(EmailChange), { sendEmailChangeMessage: send } as never);
  }, 60_000);
  afterAll(async () => {
    if (originalSmtp === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = originalSmtp;
    if (db?.isInitialized) {
      try { await db.query('DROP SCHEMA ' + schema + ' CASCADE'); }
      finally { await db.destroy(); }
    }
  });
  beforeEach(async () => {
    send.mockClear();
    user = await db.getRepository(User).save({ email: randomUUID() + '@example.org', name: 'Profile', passwordHash: await bcrypt.hash(password, 4) });
  });

  async function request(target = randomUUID() + '@example.org', account = user) {
    const start = send.mock.calls.length;
    const { pending } = await service.request(account.id, target, password);
    const urls = send.mock.calls.slice(start).flatMap(([, , body]) => body.match(/https?:\/\/\S+/g) ?? []);
    const respond = (action: EmailChangeAction) => {
      const url = urls.map(link => new URLSearchParams(new URL(link).hash.slice(1))).find(link => link.get('action') === action)!;
      return service.respond(pending!.id, action, url.get('token')!);
    };
    return { respond, id: pending!.id, target };
  }

  it('upgrades an existing database without schema drift', async () => {
    const runner = db.createQueryRunner();
    const migration = new EmailChanges20261122120000();
    try {
      await migration.down(runner);
      await migration.up(runner);
      expect((await db.driver.createSchemaBuilder().log()).upQueries).toHaveLength(0);
      expect(await db.manager.findOneByOrFail(User, { id: user.id })).toMatchObject({ email: user.email });
    } finally { await runner.release(); }
  });

  it('cancels only the specified request belonging to the signed-in account', async () => {
    const first = await request();
    const second = await request();
    const other = await db.getRepository(User).save({ email: randomUUID() + '@example.org', name: 'Other', passwordHash: user.passwordHash });
    await service.cancel(other.id, second.id);
    expect((await service.cancel(user.id, first.id)).pending?.id).toBe(second.id);
    expect((await service.cancel(user.id, second.id)).pending).toBeNull();
    await expect(second.respond('verify')).rejects.toMatchObject({ status: 400 });
  });

  it('requires both independent proofs, consumes each once and preserves the account', async () => {
    const { respond, target } = await request();
    expect(await respond('verify')).toEqual({ state: 'waiting' });
    await expect(respond('verify')).rejects.toMatchObject({ status: 400 });
    expect((await db.manager.findOneByOrFail(User, { id: user.id })).email).toBe(user.email);
    expect(await respond('approve')).toEqual({ state: 'completed' });
    expect(await db.manager.findOneByOrFail(User, { id: user.id })).toMatchObject({
      email: target, passwordHash: user.passwordHash, passwordResetTokenVersion: 1, twoFactorTokenVersion: 1,
    });
    await expect(respond('cancel')).rejects.toMatchObject({ status: 400 });
    expect(send.mock.calls.map(([to]) => to)).toEqual([user.email, target, user.email, target]);
  });

  it('replaces, cancels, expires and invalidates requests after a password reset', async () => {
    const first = await request();
    const next = await request();
    await expect(first.respond('verify')).rejects.toMatchObject({ status: 400 });
    await next.respond('approve');
    await expect(next.respond('cancel')).resolves.toEqual({ state: 'cancelled' });
    await expect(next.respond('verify')).rejects.toMatchObject({ status: 400 });
    const expired = await request();
    await db.manager.update(EmailChange, user.id, { expiresAt: new Date(0) });
    await expect(expired.respond('approve')).rejects.toMatchObject({ status: 400 });
    const reset = await request();
    await db.manager.update(User, user.id, { passwordHash: await bcrypt.hash('ChangedPassword12!', 4), passwordResetTokenVersion: 1 });
    await expect(reset.respond('approve')).rejects.toMatchObject({ status: 400 });
    expect((await service.status(user.id)).pending).toBeNull();
  });

  it('rolls back an undelivered request and protects server-managed accounts', async () => {
    await expect(service.request(user.id, 'new@example.org', 'wrong')).rejects.toMatchObject({ status: 400 });
    expect(send).not.toHaveBeenCalled();
    send.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('SMTP unavailable'));
    await expect(request()).rejects.toMatchObject({ status: 503 });
    expect((await service.status(user.id)).pending).toBeNull();
    const force = process.env.SUPERADMIN_EMAIL_FORCE;
    const seed = process.env.SUPERADMIN_EMAIL;
    try {
      process.env.SUPERADMIN_EMAIL_FORCE = 'true';
      process.env.SUPERADMIN_EMAIL = user.email.toUpperCase();
      await db.manager.update(User, user.id, { role: 'superadmin' });
      expect((await service.status(user.id)).unavailable).toBe('managed');
      await expect(request()).rejects.toMatchObject({ status: 403 });
    } finally {
      if (seed === undefined) delete process.env.SUPERADMIN_EMAIL;
      else process.env.SUPERADMIN_EMAIL = seed;
      if (force === undefined) delete process.env.SUPERADMIN_EMAIL_FORCE;
      else process.env.SUPERADMIN_EMAIL_FORCE = force;
    }
  });

  it('allows only one account to claim a destination during concurrent confirmations', async () => {
    const second = await db.getRepository(User).save({ email: randomUUID() + '@example.org', name: 'Other', passwordHash: user.passwordHash });
    const a = await request();
    const b = await request(a.target.toUpperCase(), second);
    await Promise.all([a.respond('approve'), b.respond('verify')]);
    const outcomes = await Promise.allSettled([a.respond('verify'), b.respond('approve')]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes).toContainEqual(expect.objectContaining({ status: 'rejected', reason: expect.objectContaining({ status: 400 }) }));
    expect(await db.manager.countBy(User, { email: a.target })).toBe(1);
  });
});
