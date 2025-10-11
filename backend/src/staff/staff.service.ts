import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from './entities/staff.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
  ) {}

  async findAll(active?: boolean): Promise<Staff[]> {
    const where = active !== undefined ? { active } : {};
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
      data.password = await bcrypt.hash(data.password, 10);
    } else if (data.password === '') {
      data.password = null;
    }
    const staff = this.staffRepository.create(data);
    return this.staffRepository.save(staff);
  }

  async update(id: string, data: Partial<Staff>): Promise<Staff | null> {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    await this.staffRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.staffRepository.delete(id);
  }
}
