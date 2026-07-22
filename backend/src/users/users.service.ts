import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, In, IsNull, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../auth/password-policy';

export type CreateManagedUserInput = Pick<User, 'email' | 'name'> &
  Partial<Pick<User, 'role' | 'orgId' | 'mustChangePassword'>> & { password?: string };
export type UpdateManagedUserInput = Partial<Pick<User, 'role' | 'orgId'>>;

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findAll() { return this.repo.find({ relations: { org: true } }); }
  findByOrg(orgId: string | null) {
    const where = orgId ? { orgId: Equal(orgId) } : { orgId: IsNull() };
    return this.repo.find({ where, relations: { org: true } });
  }
  findByOrgIds(orgIds: string[]) {
    if (!orgIds.length) return Promise.resolve([]);
    return this.repo.find({ where: { orgId: In(orgIds) }, relations: { org: true } });
  }
  async create(data: CreateManagedUserInput) {
    // Normalize email to lowercase and ensure uniqueness among active users
    const email = (data.email || '').toLowerCase();
    if (!email) throw new BadRequestException('E-Mail ist erforderlich');
  const existing = await this.repo.createQueryBuilder('u').where('LOWER(u.email) = LOWER(:email)', { email }).getOne();
    if (existing) throw new BadRequestException('Diese E-Mail wird bereits verwendet');
    const password = typeof data.password === 'string' ? data.password : null;
    if (password && !isStrongPassword(password)) throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
    const u = this.repo.create({
      email,
      name: data.name,
      role: data.role ?? 'user',
      orgId: typeof data.orgId === 'undefined' ? null : data.orgId,
      passwordHash: password ? await bcrypt.hash(password, 10) : null,
      mustChangePassword: password ? data.mustChangePassword !== false : false,
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
