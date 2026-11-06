import { DataSource, EntitySchema } from 'typeorm';
import { User } from './entities/user.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';

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
    mustChangePassword: { type: Boolean, default: false },
    termsAcceptedVersion: { type: String, nullable: true },
    termsAcceptedAt: { type: Date, nullable: true },
  },
});
const membershipSchema = new EntitySchema<OrganizationMembership>({
  name: 'OrganizationMembership', target: OrganizationMembership, tableName: 'organization_memberships',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    userId: { type: String }, orgId: { type: String },
    role: { type: String }, status: { type: String },
  },
  uniques: [{ columns: ['userId', 'orgId'] }],
  relations: { user: { type: 'many-to-one', target: 'User', joinColumn: { name: 'userId' }, onDelete: 'CASCADE' } },
});
const sessionSchema = new EntitySchema<{ id: string; userId: string; user: User }>({
  name: 'SessionFixture', tableName: 'auth_refresh_sessions',
  columns: { id: { type: String, primary: true }, userId: { type: String } },
  relations: { user: { type: 'many-to-one', target: 'User', joinColumn: { name: 'userId' }, onDelete: 'CASCADE' } },
});

describe('user account lifecycle', () => {
  let db: DataSource;
  let users: UsersService;
  beforeEach(async () => {
    db = await new DataSource({ type: 'sqljs', entities: [userSchema, membershipSchema, sessionSchema], synchronize: true }).initialize();
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
    const auth = new AuthService(
      db.getRepository(User), {} as never, db.getRepository(OrganizationMembership), {} as never,
      db.getRepository('SessionFixture') as never, jwt as never,
      { sendInviteEmail: jest.fn().mockResolvedValue({ queued: true }) } as never, {} as never,
      { getTermsOfUseVersion: async () => { await beforeActivation?.(); return 'current-terms'; } } as never,
    );
    const login = jest.spyOn(auth, 'login').mockResolvedValue({ access_token: 'new-session' } as never);
    return { auth, jwt, login };
  }

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
