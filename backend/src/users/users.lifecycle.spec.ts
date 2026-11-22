import { randomUUID } from 'node:crypto';
import { DataSource, EntitySchema } from 'typeorm';
import { User } from './entities/user.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { Organization } from '../orgs/entities/organization.entity';
import { Location } from '../locations/entities/location.entity';
import { OrgsService } from '../orgs/orgs.service';

// Persist the account lifecycle against a real database, including unique email
// and cascading session/membership deletion, without unrelated application tables.
const userSchema = new EntitySchema<User>({
  name: 'User', target: User, tableName: 'users',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    email: { type: String, unique: true }, name: { type: String },
    role: { type: String }, orgId: { type: String, nullable: true },
    passwordHash: { type: String, nullable: true },
    inviteTokenVersion: { type: Number, default: 0 },
    passwordResetTokenVersion: { type: Number, default: 0 },
    mustChangePassword: { type: Boolean, default: false },
    termsAcceptedVersion: { type: String, nullable: true },
    termsAcceptedAt: { type: Date, nullable: true },
  },
});
const membershipSchema = new EntitySchema<OrganizationMembership>({
  name: 'OrganizationMembership', target: OrganizationMembership, tableName: 'organization_memberships',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    userId: { type: 'uuid' }, orgId: { type: String },
    role: { type: String }, status: { type: String },
  },
  uniques: [{ columns: ['userId', 'orgId'] }],
  relations: { user: { type: 'many-to-one', target: 'User', joinColumn: { name: 'userId' }, onDelete: 'CASCADE' } },
});
const sessionSchema = new EntitySchema<{ id: string; userId: string; user: User }>({
  name: 'SessionFixture', tableName: 'auth_refresh_sessions',
  columns: { id: { type: String, primary: true }, userId: { type: 'uuid' } },
  relations: { user: { type: 'many-to-one', target: 'User', joinColumn: { name: 'userId' }, onDelete: 'CASCADE' } },
});

const organizationSchema = new EntitySchema<Organization>({
  name: 'Organization', target: Organization, tableName: 'organizations',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' }, name: { type: String },
    path: { type: String, nullable: true }, parentId: { type: 'uuid', nullable: true },
  },
});
const locationSchema = new EntitySchema<Location>({
  name: 'Location', target: Location, tableName: 'locations',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' }, name: { type: String },
    active: { type: Boolean }, orgId: { type: 'uuid' },
  },
});

describe('user account lifecycle', () => {
  let db: DataSource;
  let users: UsersService;
  beforeEach(async () => {
    db = await new DataSource({ type: 'sqljs', entities: [userSchema, membershipSchema, sessionSchema, organizationSchema, locationSchema], synchronize: true }).initialize();
    users = new UsersService(db.getRepository(User), db.getRepository(OrganizationMembership));
  });
  afterEach(async () => { await db.destroy(); });

  async function account(role = 'user', status = 'active') {
    const user = await db.getRepository(User).save({ email: 'person@example.org', name: 'Person', role: 'user', orgId: 'old-org', passwordHash: 'old-hash' });
    await db.getRepository(OrganizationMembership).save({ userId: user.id, orgId: 'old-org', role: role as 'user' | 'org_admin', status: status as 'active' | 'disabled' });
    return user;
  }

  function invitationAuth(userId: string, version: number, beforeActivation?: () => Promise<unknown>) {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: userId, purpose: 'invite', version }),
      signAsync: jest.fn().mockResolvedValue('fresh-token'),
    };
    const email = { sendInviteEmail: jest.fn().mockResolvedValue({ queued: true }) };
    const auth = new AuthService(
      db.getRepository(User), {} as never, db.getRepository(OrganizationMembership), {} as never,
      db.getRepository('SessionFixture') as never, jwt as never,
      email as never, {} as never,
      { getTermsOfUseVersion: async () => { await beforeActivation?.(); return 'current-terms'; } } as never,
    );
    const login = jest.spyOn(auth, 'login').mockResolvedValue({ access_token: 'new-session' } as never);
    return { auth, jwt, login, email };
  }

  describe('local provisioning', () => {
    const previous = process.env.USER_PROVISIONING_MODE;
    beforeEach(() => { process.env.USER_PROVISIONING_MODE = 'local'; });
    afterEach(() => {
      if (previous === undefined) delete process.env.USER_PROVISIONING_MODE;
      else process.env.USER_PROVISIONING_MODE = previous;
    });

    const payload = {
      email: ' Person@Example.org ', name: 'Person', orgId: 'old-org',
      role: 'user' as const, temporaryPassword: 'StrongPassword1!',
    };

    it('persists nothing on weak password and a retry creates exactly one account and membership', async () => {
      const { auth } = invitationAuth('', 1);
      await expect(auth.createLocalUser({ ...payload, temporaryPassword: 'weak' })).rejects.toMatchObject({ status: 400 });
      expect(await db.getRepository(User).count()).toBe(0);
      expect(await db.getRepository(OrganizationMembership).count()).toBe(0);
      const created = await auth.createLocalUser(payload);
      expect(created).toMatchObject({ email: 'person@example.org', mustChangePassword: true });
      expect(await auth.createLocalUser(payload)).toEqual(created);
      expect(await db.getRepository(User).count()).toBe(1);
      expect(await db.getRepository(OrganizationMembership).count()).toBe(1);
    });

    it('keeps the existing administrator role and password through all provisioning paths', async () => {
      const existing = await account('org_admin');
      const { auth } = invitationAuth(existing.id, 1);
      expect(await auth.createLocalUser(payload)).toMatchObject({ role: 'org_admin', id: existing.id });
      expect(await auth.inviteUser(payload)).toMatchObject({ outcome: 'already_member', user: { role: 'org_admin' } });
      expect(await users.createOrAddMembership(payload)).toMatchObject({ created: false, membership: { role: 'org_admin' } });
      expect((await db.getRepository(User).findOneByOrFail({ id: existing.id })).passwordHash).toBe('old-hash');
    });

    it('activates its own single-organization pending invitation and invalidates prior credentials', async () => {
      const { auth } = invitationAuth('', 1);
      const { user } = await auth.inviteUser(payload);
      await db.getRepository('SessionFixture').save({ id: 'prior-session', userId: user.id });
      expect(await auth.createLocalUser(payload)).toMatchObject({ id: user.id, mustChangePassword: true });
      expect(await db.getRepository(User).findOneByOrFail({ id: user.id })).toMatchObject({
        inviteTokenVersion: 2, passwordResetTokenVersion: 1, passwordHash: expect.any(String),
      });
      expect(await db.getRepository('SessionFixture').count()).toBe(0);
    });

    it('protects credentials of pending invitations with other active organization access', async () => {
      const { auth } = invitationAuth('', 1);
      const { user } = await auth.inviteUser(payload);
      await users.addMembership(user.id, 'other-org', 'editor');
      await expect(auth.createLocalUser(payload)).rejects.toMatchObject({ status: 409 });
      await expect(auth.createLocalUser({ ...payload, orgId: 'other-org' })).rejects.toMatchObject({ status: 409 });
      expect(await db.getRepository(User).findOneByOrFail({ id: user.id })).toMatchObject({ inviteTokenVersion: 1, passwordHash: null });
    });
  });

  it('creates the child organization, location and creator membership atomically', async () => {
    const orgs = new OrgsService(db.getRepository(Organization), db.getRepository(Location),
      {} as never, {} as never, {} as never, {} as never, {} as never, db.getRepository(User), db.getRepository(OrganizationMembership));
    const parent = await orgs.create('Parent');
    await expect(orgs.create('Child', parent.id, randomUUID())).rejects.toMatchObject({ status: 400 });
    expect(await db.getRepository(Organization).count()).toBe(1);
    expect(await db.getRepository(Location).count()).toBe(1);
    const user = await account();
    const child = await orgs.create('Child', parent.id, user.id);
    expect(child.path).toBe(parent.id + '/' + child.id);
    expect(await users.findMembership(user.id, child.id)).toMatchObject({ role: 'org_admin', status: 'active' });
    expect(await db.getRepository(Location).findOneByOrFail({ orgId: child.id })).toMatchObject({ name: 'Child', active: true });
  });

  it('rolls back account creation, token replacement and membership reactivation after failed delivery', async () => {
    const { auth, email } = invitationAuth('', 1);
    const payload = { email: 'invite@example.org', name: 'Invite', orgId: 'old-org', role: 'user' as const };
    email.sendInviteEmail.mockRejectedValueOnce(new Error('test SMTP unavailable'));
    await expect(auth.inviteUser(payload)).rejects.toMatchObject({ status: 503 });
    expect(await db.getRepository(User).count()).toBe(0);
    expect(await db.getRepository(OrganizationMembership).count()).toBe(0);
    const { user } = await auth.inviteUser(payload);
    email.sendInviteEmail.mockResolvedValue({ queued: false });
    await expect(auth.resendInvite(user.id, 'org_admin', 'old-org')).rejects.toMatchObject({ status: 503 });
    expect((await db.getRepository(User).findOneByOrFail({ id: user.id })).inviteTokenVersion).toBe(1);
    await users.disableMembership(user.id, 'old-org');
    await expect(auth.inviteUser(payload)).rejects.toMatchObject({ status: 503 });
    expect((await db.getRepository(User).findOneByOrFail({ id: user.id })).inviteTokenVersion).toBe(3);
    expect(await users.findMembership(user.id, 'old-org')).toMatchObject({ status: 'disabled' });
  });

  it.each(['invite', 'resend'])('keeps independent database writes when SMTP fails during %s', async mode => {
    const { auth, email } = invitationAuth('', 1);
    const payload = { email: 'pending@example.org', name: 'Pending', orgId: 'old-org', role: 'user' as const };
    const existing = mode === 'resend' ? (await auth.inviteUser(payload)).user : null;
    email.sendInviteEmail.mockImplementationOnce(async () => {
      // A separate request can use SQL.js's single connection while mail is in flight.
      await db.getRepository(User).save({ email: 'independent@example.org', name: 'Other request', role: 'user' });
      throw new Error('SMTP temporarily unavailable');
    });
    await expect(existing ? auth.resendInvite(existing.id, 'org_admin', 'old-org') : auth.inviteUser(payload))
      .rejects.toMatchObject({ status: 503 });
    expect(await db.getRepository(User).countBy({ email: 'independent@example.org' })).toBe(1);
    expect(await db.getRepository(User).countBy({ email: payload.email })).toBe(existing ? 1 : 0);
    if (existing) expect((await db.getRepository(User).findOneByOrFail({ id: existing.id })).inviteTokenVersion).toBe(1);
  });

  it('keeps in-flight delivery invalid when membership is revoked and later regranted', async () => {
    const { auth, email, jwt } = invitationAuth('', 1);
    const payload = { email: 'pending@example.org', name: 'Pending', orgId: 'old-org', role: 'user' as const };
    const { user } = await auth.inviteUser(payload);
    email.sendInviteEmail.mockImplementationOnce(async () => {
      await users.disableMembership(user.id, 'old-org');
      await users.addMembership(user.id, 'old-org', 'user');
      return { queued: true };
    });
    await expect(auth.resendInvite(user.id, 'org_admin', 'old-org')).rejects.toMatchObject({ status: 409 });
    jwt.verifyAsync.mockResolvedValue(jwt.signAsync.mock.calls[1][0]);
    await expect(auth.acceptInvite('in-flight-link', 'StrongPassword1!', true)).rejects.toMatchObject({ status: 400 });
    expect((await db.getRepository(User).findOneByOrFail({ id: user.id })).passwordHash).toBeNull();
  });

  it('revokes a pending link when access is removed and requires a fresh invitation after regranting access', async () => {
    const pending = await account();
    await db.getRepository(User).update(pending.id, { passwordHash: null, inviteTokenVersion: 1 });
    const { auth, jwt, login } = invitationAuth(pending.id, 1);
    await users.disableMembership(pending.id, 'old-org');
    await expect(auth.acceptInvite('old-token', 'StrongPassword1!', true)).rejects.toMatchObject({ status: 400 });
    expect((await db.getRepository(User).findOneByOrFail({ id: pending.id })).passwordHash).toBeNull();
    expect(login).not.toHaveBeenCalled();

    await users.addMembership(pending.id, 'old-org', 'user');
    await expect(auth.acceptInvite('old-token', 'StrongPassword1!', true)).rejects.toMatchObject({ status: 400 });
    await auth.resendInvite(pending.id, 'org_admin', 'old-org');
    const claim = jwt.signAsync.mock.calls[0][0];
    jwt.verifyAsync.mockResolvedValue(claim);
    await expect(auth.acceptInvite('fresh-token', 'StrongPassword1!', true)).resolves.toMatchObject({ access_token: 'new-session' });
  });

  it.each(['disabled', 'deleted'])('blocks legacy outstanding links with %s membership even without token revocation', async (status) => {
    const pending = await account();
    await db.getRepository(User).update(pending.id, { passwordHash: null, inviteTokenVersion: 1 });
    if (status === 'disabled') await db.getRepository(OrganizationMembership).update({ userId: pending.id }, { status: 'disabled' });
    else await db.getRepository(OrganizationMembership).delete({ userId: pending.id });
    const { auth, login } = invitationAuth(pending.id, 1);
    await expect(auth.acceptInvite('old-token', 'StrongPassword1!', true)).rejects.toMatchObject({ status: 400 });
    expect((await db.getRepository(User).findOneByOrFail({ id: pending.id })).passwordHash).toBeNull();
    expect(login).not.toHaveBeenCalled();
  });

  it.each(['revoke', 'delete'])('does not activate an account when %s occurs during acceptance', async (action) => {
    const pending = await account();
    await db.getRepository(User).update(pending.id, { passwordHash: null, inviteTokenVersion: 1 });
    const { auth, login } = invitationAuth(pending.id, 1, () => action === 'delete'
      ? users.removeAccount(pending.id) : users.disableMembership(pending.id, 'old-org'));
    await expect(auth.acceptInvite('old-token', 'StrongPassword1!', true)).rejects.toMatchObject({ status: 400 });
    const after = await db.getRepository(User).findOneBy({ id: pending.id });
    if (action === 'delete') expect(after).toBeNull();
    else expect(after?.passwordHash).toBeNull();
    expect(login).not.toHaveBeenCalled();
  });

  it('preserves established accounts and their other organization access', async () => {
    const active = await account();
    await users.addMembership(active.id, 'second-org', 'editor');
    await users.disableMembership(active.id, 'old-org');
    expect(await db.getRepository(User).findOneByOrFail({ id: active.id })).toMatchObject({ passwordHash: 'old-hash', inviteTokenVersion: 0 });
    expect(await users.findMembership(active.id, 'second-org')).toMatchObject({ status: 'active' });
  });

  it('deletes an unassigned account and sessions, then invites the same email as a new identity', async () => {
    const old = await account();
    await db.getRepository('SessionFixture').save({ id: 'old-session', userId: old.id });
    await users.disableMembership(old.id, 'old-org');
    await users.removeAccount(old.id);
    expect(await db.getRepository(User).count()).toBe(0);
    expect(await db.getRepository(OrganizationMembership).count()).toBe(0);
    expect(await db.getRepository('SessionFixture').count()).toBe(0);

    const jwt = { signAsync: jest.fn().mockResolvedValue('new-invite'), verifyAsync: jest.fn().mockResolvedValue({ sub: old.id, purpose: 'invite', version: 1 }) };
    const email = { sendInviteEmail: jest.fn().mockResolvedValue({ queued: true }) };
    const auth = new AuthService(db.getRepository(User), {} as never, db.getRepository(OrganizationMembership), {} as never, db.getRepository('SessionFixture') as never, jwt as never, email as never, {} as never, { getTermsOfUseVersion: async () => 'current-terms' } as never);
    const result = await auth.inviteUser({ email: ' Person@Example.org ', name: 'New Person', orgId: 'new-org', role: 'user' });
    expect(result.user.id).not.toBe(old.id);
    expect(result.user.email).toBe('person@example.org');
    expect(result.emailQueued).toBe(true);
    expect(await db.getRepository(OrganizationMembership).find()).toEqual([
      expect.objectContaining({ userId: result.user.id, orgId: 'new-org', status: 'active' }),
    ]);
    expect((await db.getRepository(User).findOneByOrFail({ id: result.user.id })).passwordHash).toBeNull();
    await expect(auth.acceptInvite('old-invite', 'StrongPassword1!', true)).rejects.toMatchObject({ status: 400 });
    // The new identity can accept its own fresh invitation, independently of
    // the deleted account. Keep actual password hashing and database writes.
    jwt.verifyAsync.mockResolvedValueOnce({ sub: result.user.id, purpose: 'invite', version: 1 });
    jest.spyOn(auth, 'login').mockResolvedValue({ access_token: 'new-session' } as never);
    await expect(auth.acceptInvite('new-invite', 'StrongPassword1!', true)).resolves.toMatchObject({ access_token: 'new-session' });
    const activated = await db.getRepository(User).findOneByOrFail({ id: result.user.id });
    expect(activated.passwordHash).toBeTruthy();
    expect(activated.termsAcceptedVersion).toBe('current-terms');
  });

  it('preserves an account that is the last active admin of any organization', async () => {
    const user = await account('org_admin');
    await expect(users.removeAccount(user.id)).rejects.toThrow('letzte Organisationsadmin');
    expect(await db.getRepository(User).count()).toBe(1);
    expect(await db.getRepository(OrganizationMembership).count()).toBe(1);
  });

  it('allows deletion of a former admin whose membership was already disabled', async () => {
    const user = await account('org_admin', 'disabled');
    await expect(users.removeAccount(user.id)).resolves.toBe(true);
    expect(await db.getRepository(User).count()).toBe(0);
  });

  it('protects superadmin accounts', async () => {
    const user = await account();
    await db.getRepository(User).update(user.id, { role: 'superadmin' });
    await expect(users.removeAccount(user.id)).rejects.toThrow('Superadmin-Konten');
    expect(await db.getRepository(User).count()).toBe(1);
  });

  it('deletes all accesses when another active organization admin remains', async () => {
    const user = await account('org_admin');
    const other = await db.getRepository(User).save({ email: 'admin@example.org', name: 'Admin', role: 'user', orgId: 'old-org' });
    await db.getRepository(OrganizationMembership).save({ userId: other.id, orgId: 'old-org', role: 'org_admin', status: 'active' });
    await db.getRepository(OrganizationMembership).save({ userId: user.id, orgId: 'second-org', role: 'editor', status: 'active' });
    await users.removeAccount(user.id);
    expect(await db.getRepository(User).find()).toEqual([expect.objectContaining({ id: other.id })]);
    expect(await db.getRepository(OrganizationMembership).find()).toEqual([expect.objectContaining({ userId: other.id })]);
  });
});

const postgres = process.env.MIGRATION_TEST_POSTGRES === 'true' ? describe : describe.skip;

postgres('membership transaction concurrency on PostgreSQL', () => {
  const schema = 'membership_test_' + randomUUID().replaceAll('-', '');
  let db: DataSource;
  let users: UsersService;

  beforeAll(async () => {
    db = await new DataSource({
      type: 'postgres', schema, entities: [userSchema, membershipSchema, sessionSchema], uuidExtension: 'pgcrypto',
      host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USERNAME || 'stato_migration_test', password: process.env.DB_PASSWORD || 'stato_migration_test',
      database: process.env.DB_DATABASE || 'stato_migration_test',
      extra: { options: '-c search_path=' + schema + ',public' },
    }).initialize();
    await db.query('CREATE SCHEMA ' + schema);
    await db.synchronize();
    users = new UsersService(db.getRepository(User), db.getRepository(OrganizationMembership));
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      try { await db.query('DROP SCHEMA ' + schema + ' CASCADE'); }
      finally { await db.destroy(); }
    }
  });

  it.each(['demote', 'delete'])('preserves one active admin when disable races with %s', async (operation) => {
    const orgId = randomUUID();
    const [a, b] = await Promise.all(['A', 'B'].map(name => users.createOrAddMembership({
      email: randomUUID() + '@example.org', name, role: 'org_admin', orgId,
    })));
    const outcomes = await Promise.allSettled([
      users.disableMembership(a.user.id, orgId),
      operation === 'delete' ? users.removeAccount(b.user.id) : users.addMembership(b.user.id, orgId, 'editor'),
    ]);
    expect(outcomes.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'rejected', reason: expect.objectContaining({ status: 400 }) })]));
    expect(await db.getRepository(OrganizationMembership).countBy({ orgId, role: 'org_admin', status: 'active' })).toBe(1);
  });

  it('creates one account when two organizations assign the same email concurrently', async () => {
    const email = randomUUID() + '@example.org';
    const orgs = [randomUUID(), randomUUID()];
    const [first, second] = await Promise.all(orgs.map((orgId, i) => users.createOrAddMembership({
      orgId, name: 'Person', role: 'user', email: i ? email.toUpperCase() : email,
    })));
    expect(first.user.id).toBe(second.user.id);
    expect(await db.getRepository(User).countBy({ email })).toBe(1);
    expect(await db.getRepository(OrganizationMembership).countBy({ userId: first.user.id, status: 'active' })).toBe(2);
  });
});
