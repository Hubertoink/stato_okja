import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, Raw, Repository } from 'typeorm';
import { OrganizationMembership } from './entities/organization-membership.entity';
import { User } from './entities/user.entity';

type Role = OrganizationMembership['role'];
const sqliteWrites = new WeakMap<DataSource, Promise<void>>();

/** PostgreSQL workers share row/transaction locks. SQL.js has one connection per database. */
export function writeMemberships<T>(manager: EntityManager, work: (write: MembershipWrite) => Promise<T>): Promise<T> {
  const execute = (tx: EntityManager) => work(new MembershipWrite(tx));
  if (manager.connection.options.type === 'postgres') return manager.transaction('READ COMMITTED', execute);
  const run = () => manager.transaction(execute);
  if (manager.connection.options.type !== 'sqljs') return run();
  const previous = sqliteWrites.get(manager.connection) ?? Promise.resolve();
  const next = previous.then(run);
  sqliteWrites.set(manager.connection, next.then(() => undefined, () => undefined));
  return next;
}

export class MembershipWrite {
  readonly users: Repository<User>;
  readonly memberships: Repository<OrganizationMembership>;
  constructor(readonly manager: EntityManager) {
    this.users = manager.getRepository(User);
    this.memberships = manager.getRepository(OrganizationMembership);
  }

  private lock(key: string) {
    if (this.manager.connection.options.type === 'postgres') {
      return this.manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    }
  }

  private get rowLock() {
    return this.manager.connection.options.type === 'postgres' ? { mode: 'pessimistic_write' as const } : undefined;
  }

  async accountByEmail(email: string) {
    // There is no account row to lock on first provisioning.
    await this.lock('stato:provision:' + email);
    return this.users.findOne({ where: { email: Raw(column => `LOWER(${column}) = :email`, { email }) }, lock: this.rowLock });
  }

  findAccount(id: string) {
    return this.users.findOne({ where: { id }, lock: this.rowLock });
  }

  async account(id: string) {
    const user = await this.findAccount(id);
    if (!user) throw new BadRequestException('Benutzerkonto nicht gefunden');
    return user;
  }

  private async protectLastAdmin(orgId: string) {
    await this.lock('stato:org-admin:' + orgId);
    if (await this.memberships.count({ where: { orgId, status: 'active', role: 'org_admin' } }) <= 1) {
      throw new BadRequestException('Der letzte Organisationsadmin muss erhalten bleiben. Bitte zuerst einen weiteren Admin zuweisen.');
    }
  }

  /** Caller holds the account row. Provisioning preserves active roles. Only explicit edits replace them. */
  async grant(user: User, orgId: string, role?: Role, changeActiveRole = false) {
    const current = await this.memberships.findOne({ where: { userId: user.id, orgId } });
    if (current?.status === 'active') {
      if (!changeActiveRole || !role || current.role === role) return { membership: current, alreadyActive: true };
      if (current.role === 'org_admin') await this.protectLastAdmin(orgId);
    }
    const nextRole = role ?? current?.role ?? (user.role === 'superadmin' ? 'user' : user.role);
    const membership = current ?? this.memberships.create({ userId: user.id, orgId, role: nextRole, status: 'active' });
    membership.role = nextRole;
    membership.status = 'active';
    return { membership: await this.memberships.save(membership), alreadyActive: false };
  }

  async revoke(id: string, orgId: string) {
    await this.account(id);
    const membership = await this.memberships.findOne({ where: { userId: id, orgId } });
    if (!membership) throw new BadRequestException('Mitgliedschaft nicht gefunden');
    if (membership.status === 'disabled') return;
    if (membership.role === 'org_admin') await this.protectLastAdmin(orgId);
    membership.status = 'disabled';
    await this.memberships.save(membership);
    // A delivery in progress signs current + 1 before committing its new version.
    // Skip both the current link and that in-flight version, even after a regrant.
    await this.users.increment({ id, passwordHash: IsNull() }, 'inviteTokenVersion', 2);
  }

  async deleteAccount(id: string) {
    const user = await this.account(id);
    if (user.role === 'superadmin') throw new BadRequestException('Superadmin-Konten können hier nicht gelöscht werden');
    const admins = await this.memberships.find({ where: { userId: id, status: 'active', role: 'org_admin' }, order: { orgId: 'ASC' } });
    for (const { orgId } of admins) await this.protectLastAdmin(orgId);
    await this.users.delete({ id });
    return true;
  }
}
