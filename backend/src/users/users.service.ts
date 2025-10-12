import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, In, IsNull, Repository } from 'typeorm';
import { User } from './entities/user.entity';

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
  async create(data: Partial<User>) {
    // Normalize email to lowercase and ensure uniqueness among active users
    const email = (data.email || '').toLowerCase();
    if (!email) throw new BadRequestException('E-Mail ist erforderlich');
  const existing = await this.repo.createQueryBuilder('u').where('LOWER(u.email) = LOWER(:email)', { email }).getOne();
    if (existing) throw new BadRequestException('Diese E-Mail wird bereits verwendet');
    // Never accept passwordHash from the outside; account/password is managed via AuthService flows
    const u = this.repo.create({ ...(data as Partial<User>), email, passwordHash: null });
    return this.repo.save(u);
  }
  update(id: string, patch: Partial<User>) { return this.repo.update({ id }, patch); }
  async remove(id: string) { await this.repo.delete({ id }); return true; }
  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  countAdmins(orgId: string | null) {
    if (orgId) return this.repo.count({ where: { role: 'org_admin', orgId: Equal(orgId) } });
    return this.repo.count({ where: { role: 'org_admin', orgId: IsNull() } });
  }
  countSuperadmins() { return this.repo.count({ where: { role: 'superadmin' } }); }
}
