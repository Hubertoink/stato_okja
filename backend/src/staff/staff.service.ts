import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Equal, IsNull, In } from 'typeorm';
import { Staff } from './entities/staff.entity';
import * as bcrypt from 'bcryptjs';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../auth/password-policy';
import {
  assertExactOrgScopedEntityAccess,
  removeOrgIdForNonSuperadmin,
  type OrgScopedUser,
} from '../auth/org-scope-access';
import { OrgsService } from '../orgs/orgs.service';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    private readonly orgs: OrgsService,
  ) {}

  async findAll(active?: boolean, orgId?: string | null, orgIds?: string[]): Promise<Staff[]> {
    const where: FindOptionsWhere<Staff> = {};
    if (active !== undefined) Object.assign(where, { active });
    if (Array.isArray(orgIds) && orgIds.length) {
      Object.assign(where, { orgId: In(orgIds) });
    } else if (typeof orgId !== 'undefined') {
      Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    }
    return this.staffRepository.find({ where });
  }

  private assertUserCanAccessStaff(staff: Pick<Staff, 'orgId'>, user: OrgScopedUser) {
    assertExactOrgScopedEntityAccess(staff, user);
  }

  async findOne(id: string): Promise<Staff | null> {
    return this.staffRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<Staff | null> {
    return this.staffRepository.findOne({ where: { email } });
  }

  async create(data: Partial<Staff>): Promise<Staff> {
    if (data.password) {
      if (!isStrongPassword(String(data.password))) {
        throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
      }
      data.password = await bcrypt.hash(data.password, 10);
    } else if (data.password === '') {
      data.password = null;
    }
    const staff = this.staffRepository.create(data);
    return this.staffRepository.save(staff);
  }

  async update(id: string, data: Partial<Staff>): Promise<Staff | null> {
    if (data.password) {
      if (!isStrongPassword(String(data.password))) {
        throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
      }
      data.password = await bcrypt.hash(data.password, 10);
    }
    await this.staffRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.staffRepository.delete(id);
  }

  async findOneScoped(id: string, user: OrgScopedUser) {
    const s = await this.findOne(id);
    if (!s) return null;
    await this.assertUserCanAccessStaff(s, user);
    return s;
  }

  async updateScoped(
    id: string,
    data: Partial<Staff>,
    user: OrgScopedUser,
  ) {
    const existing = await this.staffRepository.findOne({ where: { id } });
    if (!existing) return null;
    await this.assertUserCanAccessStaff(existing, user);
    return this.update(id, removeOrgIdForNonSuperadmin(data, user));
  }

  async removeScoped(id: string, user: OrgScopedUser) {
    const existing = await this.staffRepository.findOne({ where: { id } });
    if (!existing) return;
    await this.assertUserCanAccessStaff(existing, user);
    await this.remove(id);
  }
}
