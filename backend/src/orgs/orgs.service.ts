import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';

@Injectable()
export class OrgsService {
  constructor(@InjectRepository(Organization) private readonly repo: Repository<Organization>) {}

  findAll() { return this.repo.find(); }
  create(name: string) { const o = this.repo.create({ name }); return this.repo.save(o); }
}
