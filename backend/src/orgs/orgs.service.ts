import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { Location } from '../locations/entities/location.entity';

@Injectable()
export class OrgsService {
  constructor(
    @InjectRepository(Organization) private readonly repo: Repository<Organization>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
  ) {}

  findAll() { return this.repo.find(); }
  async create(name: string) {
    const o = this.repo.create({ name });
    const saved = await this.repo.save(o);
    // Create default Location with same name, scoped to org
    const loc = this.locations.create({ name, active: true, orgId: saved.id });
    await this.locations.save(loc);
    return saved;
  }
}
