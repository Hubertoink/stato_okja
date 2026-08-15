import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, In, IsNull, Repository } from 'typeorm';
import { User, type UserRole } from './entities/user.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';

export type CreateManagedUserInput = Pick<User, 'email' | 'name'> &
  Partial<Pick<User, 'role' | 'orgId'>>;
export type UpdateManagedUserInput = Partial<Pick<User, 'role' | 'orgId'>>;
export type MembershipRole = Exclude<UserRole, 'superadmin'>;
export type ScopedUserRecord = Omit<User, 'role' | 'orgId' | 'org'> & {
  role: MembershipRole;
  orgId: string;
  org: { id: string; name: string };
  membershipId: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(OrganizationMembership)
    private readonly memberships: Repository<OrganizationMembership>,
  ) {}

  findAll() { return this.repo.find({ relations: { org: true } }); }
  findByOrg(orgId: string | null) {
    const where = orgId ? { orgId: Equal(orgId) } : { orgId: IsNull() };
    return this.repo.find({ where, relations: { org: true } });
  }
  findByOrgIds(orgIds: string[]) {
    if (!orgIds.length) return Promise.resolve([]);
    return this.repo.find({ where: { orgId: In(orgIds) }, relations: { org: true } });
  }

  async findByMembershipOrg(orgId: string): Promise<ScopedUserRecord[]> {
    const memberships = await this.memberships.find({
      where: { orgId, status: 'active' },
      relations: { user: true, organization: true },
      order: { createdAt: 'ASC' },
    });
    return memberships.map((membership) => ({
      ...membership.user,
      role: membership.role,
      orgId: membership.orgId,
      org: { id: membership.organization.id, name: membership.organization.name },
      membershipId: membership.id,
    }));
  }

  /** One record per active membership. This intentionally preserves users with multiple accesses. */
  async findActiveMembershipUsersByOrgIds(orgIds?: string[]): Promise<ScopedUserRecord[]> {
    if (orgIds && !orgIds.length) return [];
    const memberships = await this.memberships.find({
      where: orgIds ? { orgId: In(orgIds), status: 'active' } : { status: 'active' },
      relations: { user: true, organization: true },
      order: { createdAt: 'ASC' },
    });
    return memberships.map((membership) => ({
      ...membership.user,
      role: membership.role,
      orgId: membership.orgId,
      org: { id: membership.organization.id, name: membership.organization.name },
      membershipId: membership.id,
    }));
  }

  /** One record per active membership for the superadmin directory. */
  findAllActiveMembershipUsers(): Promise<ScopedUserRecord[]> {
    return this.findActiveMembershipUsersByOrgIds();
  }

  async findMembership(userId: string, orgId: string) {
    return this.memberships.findOne({ where: { userId, orgId } });
  }

  async listMemberships(userId: string) {
    return this.memberships.find({
      where: { userId },
      relations: { organization: true },
      order: { createdAt: 'ASC' },
    });
  }

  async addMembership(userId: string, orgId: string, role: MembershipRole) {
    const existing = await this.findMembership(userId, orgId);
    if (existing) {
      existing.role = role;
      existing.status = 'active';
      return this.memberships.save(existing);
    }
    return this.memberships.save(
      this.memberships.create({ userId, orgId, role, status: 'active' }),
    );
  }

  async disableMembership(userId: string, orgId: string) {
    const membership = await this.findMembership(userId, orgId);
    if (!membership) return false;
    membership.status = 'disabled';
    await this.memberships.save(membership);
    return true;
  }

  async countActiveMembershipAdmins(orgId: string) {
    return this.memberships.count({ where: { orgId, role: 'org_admin', status: 'active' } });
  }

  async createOrAddMembership(data: CreateManagedUserInput) {
    const email = (data.email || '').trim().toLowerCase();
    if (!email) throw new BadRequestException('E-Mail ist erforderlich');
    const orgId = data.orgId ?? null;
    if (!orgId) throw new BadRequestException('Organisation ist erforderlich');
    const role = (data.role === 'org_admin' || data.role === 'editor' || data.role === 'user'
      ? data.role
      : 'user') as MembershipRole;
    const existing = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
    if (existing) {
      const membership = await this.addMembership(existing.id, orgId, role);
      return { user: existing, membership, created: false };
    }
    const user = this.repo.create({
      email,
      name: data.name,
      role,
      orgId,
      passwordHash: null,
    });
    const saved = await this.repo.save(user);
    const membership = await this.addMembership(saved.id, orgId, role);
    return { user: saved, membership, created: true };
  }
  async create(data: CreateManagedUserInput) {
    // Normalize email to lowercase and ensure uniqueness among active users
    const email = (data.email || '').toLowerCase();
    if (!email) throw new BadRequestException('E-Mail ist erforderlich');
    const existing = await this.repo.createQueryBuilder('u').where('LOWER(u.email) = LOWER(:email)', { email }).getOne();
    if (existing) throw new BadRequestException('Diese E-Mail wird bereits verwendet');
    // Never accept passwordHash from the outside; account/password is managed via AuthService flows
    const u = this.repo.create({
      email,
      name: data.name,
      role: data.role ?? 'user',
      orgId: typeof data.orgId === 'undefined' ? null : data.orgId,
      passwordHash: null,
    });
    return this.repo.save(u);
  }
  update(id: string, patch: UpdateManagedUserInput) {
    const safePatch: UpdateManagedUserInput = {};
    if (typeof patch.role !== 'undefined') safePatch.role = patch.role;
    if (typeof patch.orgId !== 'undefined') safePatch.orgId = patch.orgId;
    return this.repo.update({ id }, safePatch);
  }
  async remove(id: string) { await this.repo.delete({ id }); return true; }
  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  countAdmins(orgId: string | null) {
    if (orgId) return this.repo.count({ where: { role: 'org_admin', orgId: Equal(orgId) } });
    return this.repo.count({ where: { role: 'org_admin', orgId: IsNull() } });
  }
  countSuperadmins() { return this.repo.count({ where: { role: 'superadmin' } }); }
}
