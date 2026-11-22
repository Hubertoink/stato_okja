import { writeMemberships } from './membership-write';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, In, IsNull, Repository } from 'typeorm';
import { User, type UserRole } from './entities/user.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';

export type CreateManagedUserInput = Pick<User, 'email' | 'name'> &
  Partial<Pick<User, 'role' | 'orgId'>>;
export type MembershipRole = Exclude<UserRole, 'superadmin'>;
export type ScopedUserRecord = Omit<User, 'role' | 'orgId' | 'org'> & {
  role: MembershipRole;
  isGlobalSuperadmin: boolean;
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

  findByMembershipOrg(orgId: string): Promise<ScopedUserRecord[]> {
    return this.findActiveMembershipUsersByOrgIds([orgId]);
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
      isGlobalSuperadmin: membership.user.role === 'superadmin',
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

  async addMembership(userId: string, orgId: string, role?: MembershipRole) {
    return writeMemberships(this.repo.manager, async write => {
      const user = await write.account(userId);
      return (await write.grant(user, orgId, role, true)).membership;
    });
  }

  disableMembership(userId: string, orgId: string) {
    return writeMemberships(this.repo.manager, write => write.revoke(userId, orgId));
  }

  async createOrAddMembership(data: CreateManagedUserInput) {
    const email = data.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException('E-Mail ist erforderlich');
    const orgId = data.orgId;
    if (!orgId) throw new BadRequestException('Organisation ist erforderlich');
    const role = data.role && data.role !== 'superadmin' ? data.role : 'user';
    return writeMemberships(this.repo.manager, async write => {
      const existing = await write.accountByEmail(email);
      const user = existing ?? await write.users.save(write.users.create({
        email, name: data.name, role, orgId, passwordHash: null,
      }));
      const { membership } = await write.grant(user, orgId, role);
      return { user, membership, created: !existing };
    });
  }
  removeAccount(id: string) {
    return writeMemberships(this.repo.manager, write => write.deleteAccount(id));
  }
  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  countAdmins(orgId: string | null) {
    if (orgId) return this.repo.count({ where: { role: 'org_admin', orgId: Equal(orgId) } });
    return this.repo.count({ where: { role: 'org_admin', orgId: IsNull() } });
  }
  countSuperadmins() { return this.repo.count({ where: { role: 'superadmin' } }); }
}
