import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Equal, IsNull } from 'typeorm';
import { Staff } from './entities/staff.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
  ) {}

  async findAll(active?: boolean, orgId?: string | null): Promise<Staff[]> {
    const where: FindOptionsWhere<Staff> = {};
    if (active !== undefined) Object.assign(where, { active });
    if (typeof orgId !== 'undefined')
      Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    return this.staffRepository.find({ where });
  }

  async findOne(id: string): Promise<Staff | null> {
    return this.staffRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<Staff | null> {
    return this.staffRepository.findOne({ where: { email } });
  }

  async create(data: Partial<Staff>): Promise<Staff> {
    if (data.password) {
      // Enforce new password policy for newly created/updated staff passwords
      const strong = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/.test(String(data.password));
      if (!strong)
        throw new BadRequestException(
          'Passwort muss mind. 6 Zeichen, eine Zahl und ein Sonderzeichen enthalten',
        );
      data.password = await bcrypt.hash(data.password, 10);
    } else if (data.password === '') {
      data.password = null;
    }
    const staff = this.staffRepository.create(data);
    return this.staffRepository.save(staff);
  }

  async update(id: string, data: Partial<Staff>): Promise<Staff | null> {
    if (data.password) {
      const strong = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/.test(String(data.password));
      if (!strong)
        throw new BadRequestException(
          'Passwort muss mind. 6 Zeichen, eine Zahl und ein Sonderzeichen enthalten',
        );
      data.password = await bcrypt.hash(data.password, 10);
    }
    await this.staffRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.staffRepository.delete(id);
  }

  async findOneScoped(id: string, user: { role: string; orgId?: string | null }) {
    const s = await this.findOne(id);
    if (!s) return null;
    if (user.role !== 'superadmin' && (s.orgId ?? null) !== (user.orgId ?? null))
      throw new ForbiddenException('Not allowed');
    return s;
  }

  async updateScoped(
    id: string,
    data: Partial<Staff>,
    user: { role: string; orgId?: string | null },
  ) {
    const existing = await this.staffRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null))
      throw new ForbiddenException('Not allowed');
    if (user.role !== 'superadmin') {
      const d = data as Partial<Staff> & { orgId?: string | null };
      if ('orgId' in d) delete d.orgId;
      // Ensure sanitized object is used for update
      data = d;
    }
    return this.update(id, data);
  }

  async removeScoped(id: string, user: { role: string; orgId?: string | null }) {
    const existing = await this.staffRepository.findOne({ where: { id } });
    if (!existing) return;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null))
      throw new ForbiddenException('Not allowed');
    await this.remove(id);
  }
}
