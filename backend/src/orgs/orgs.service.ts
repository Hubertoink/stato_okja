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

  async create(name: string, parentId?: string | null) {
    const parent = parentId ? await this.repo.findOne({ where: { id: parentId } }) : null;
    const o = this.repo.create({ name, parentId: parent?.id ?? null });
    const saved = await this.repo.save(o);
    // compute materialized path: parent.path + '/' + id or id for root
    const path = parent?.path ? `${parent.path}/${saved.id}` : saved.id;
    await this.repo.update({ id: saved.id }, { path });
    // Create default Location with same name, scoped to org
    const loc = this.locations.create({ name, active: true, orgId: saved.id });
    await this.locations.save(loc);
    return { ...saved, path } as Organization;
  }

  async getSubtreeOrgIds(rootId: string) {
    const root = await this.repo.findOne({ where: { id: rootId } });
    if (!root) return [] as string[];
    const pathPrefix = root.path || root.id;
    const all = await this.repo.find();
    return all.filter(o => (o.path || o.id).startsWith(pathPrefix)).map(o => o.id);
  }

  async moveOrg(id: string, newParentId: string | null) {
    const org = await this.repo.findOne({ where: { id } });
    if (!org) return null;
    const parent = newParentId ? await this.repo.findOne({ where: { id: newParentId } }) : null;
    org.parentId = parent?.id ?? null;
    await this.repo.save(org);
    // recompute path for org and all descendants
    const oldPath = org.path || org.id;
    const newPath = parent?.path ? `${parent.path}/${org.id}` : org.id;
    await this.repo.update({ id: org.id }, { path: newPath });
    for (const child of await this.repo.find()) {
      if (child.id === org.id) continue;
      const p = child.path || child.id;
      if (p.startsWith(`${oldPath}/`)) {
        const suffix = p.substring(oldPath.length + 1);
        await this.repo.update({ id: child.id }, { path: `${newPath}/${suffix}` });
      }
    }
    return org;
  }
}
