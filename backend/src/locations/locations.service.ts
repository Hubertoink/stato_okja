import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Equal, IsNull, FindOptionsWhere } from 'typeorm';
import { Location } from './entities/location.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
  ) {}

  findAll(active?: boolean, orgId?: string|null): Promise<Location[]> {
    const where: FindOptionsWhere<Location> = {};
    if (active !== undefined) Object.assign(where, { active });
    if (typeof orgId !== 'undefined') Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    return this.locationRepository.find({ where });
  }

  findOne(id: string): Promise<Location | null> {
    return this.locationRepository.findOne({ where: { id } });
  }

  create(data: Partial<Location>): Promise<Location> {
    const location = this.locationRepository.create(data);
    return this.locationRepository.save(location);
  }

  async update(id: string, data: Partial<Location>): Promise<Location | null> {
    await this.locationRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.locationRepository.delete(id);
  }

  async findOneScoped(id: string, user: { role: string; orgId?: string|null }) {
    const loc = await this.findOne(id);
    if (!loc) return null;
    if (user.role !== 'superadmin' && (loc.orgId ?? null) !== (user.orgId ?? null)) {
      throw new ForbiddenException('Not allowed');
    }
    return loc;
  }

  async updateScoped(id: string, data: Partial<Location>, user: { role: string; orgId?: string|null }) {
    const existing = await this.locationRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) {
      throw new ForbiddenException('Not allowed');
    }
    // prevent moving to another org unless superadmin
    if (user.role !== 'superadmin') {
      const d = data as Partial<Location> & { orgId?: string | null };
      if ('orgId' in d) delete d.orgId;
    }
    return this.update(id, data);
  }

  async removeScoped(id: string, user: { role: string; orgId?: string|null }) {
    const existing = await this.locationRepository.findOne({ where: { id } });
    if (!existing) return;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) {
      throw new ForbiddenException('Not allowed');
    }
    await this.remove(id);
  }
}
