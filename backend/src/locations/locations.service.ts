import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Equal, IsNull, FindOptionsWhere, In } from 'typeorm';
import { Location } from './entities/location.entity';
import {
  assertOrgScopedEntityAccessForUser,
  removeOrgIdForNonSuperadmin,
  type OrgScopedUser,
} from '../auth/org-scope-access';
import { OrgsService } from '../orgs/orgs.service';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    private readonly orgs: OrgsService,
  ) {}

  private async assertUserCanAccessLocation(location: Pick<Location, 'orgId'>, user: OrgScopedUser) {
    await assertOrgScopedEntityAccessForUser(location, user, this.orgs);
  }

  findAll(active?: boolean, orgId?: string|null, orgIds?: string[]): Promise<Location[]> {
    const where: FindOptionsWhere<Location> = {};
    if (active !== undefined) Object.assign(where, { active });
    if (Array.isArray(orgIds) && orgIds.length) {
      Object.assign(where, { orgId: In(orgIds) });
    } else if (typeof orgId !== 'undefined') {
      Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    }
    return this.locationRepository.find({ where });
  }

  findOne(id: string): Promise<Location | null> {
    return this.locationRepository.findOne({ where: { id } });
  }

  create(data: Partial<Location>): Promise<Location> {
    const location = this.locationRepository.create({ ...data, active: true });
    return this.locationRepository.save(location);
  }

  async update(id: string, data: Partial<Location>): Promise<Location | null> {
    await this.locationRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.locationRepository.delete(id);
  }

  async findOneScoped(id: string, user: OrgScopedUser) {
    const loc = await this.findOne(id);
    if (!loc) return null;
    await this.assertUserCanAccessLocation(loc, user);
    return loc;
  }

  async updateScoped(id: string, data: Partial<Location>, user: OrgScopedUser) {
    const existing = await this.locationRepository.findOne({ where: { id } });
    if (!existing) return null;
    await this.assertUserCanAccessLocation(existing, user);
    let sanitized = removeOrgIdForNonSuperadmin(data, user);
    if (user.role !== 'superadmin') {
      const d = sanitized as Partial<Location> & { active?: boolean };
      if ('active' in d) delete d.active;
      sanitized = d;
    }
    return this.update(id, sanitized);
  }

  async removeScoped(id: string, user: OrgScopedUser) {
    const existing = await this.locationRepository.findOne({ where: { id } });
    if (!existing) return;
    await this.assertUserCanAccessLocation(existing, user);
    await this.remove(id);
  }
}
