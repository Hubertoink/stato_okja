import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere, In, Equal, IsNull } from 'typeorm';
import { Project } from './entities/project.entity';
import { Category } from '../taxonomy/entities/category.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  findAll(search?: string, archived?: boolean, orgId?: string|null): Promise<Project[]> {
    const where: FindOptionsWhere<Project> = {};
    if (typeof archived === 'boolean') where.archived = archived;
    // Use ILike for case-insensitive search (PostgreSQL)
    if (search) (where as unknown as Record<string, unknown>).title = ILike(`%${search}%`);
    if (typeof orgId !== 'undefined') Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    return this.projectRepository.find({ where, order: { title: 'ASC' } });
  }

  findOne(id: string): Promise<Project | null> {
    return this.projectRepository.findOne({ where: { id } });
  }

  async create(data: Partial<Project> & { categoryIds?: string[] }): Promise<Project> {
    const { categoryIds, ...rest } = data;
    const project = this.projectRepository.create(rest);
    if (Array.isArray(categoryIds) && categoryIds.length) {
      project.categories = await this.categoryRepository.find({ where: { id: In(categoryIds) } });
    }
    return this.projectRepository.save(project);
  }

  async update(id: string, data: Partial<Project> & { categoryIds?: string[] }): Promise<Project | null> {
    const { categoryIds, ...rest } = data;
    await this.projectRepository.update(id, rest);
    if (categoryIds) {
      const proj = await this.projectRepository.findOne({ where: { id } });
      if (proj) {
        proj.categories = await this.categoryRepository.find({ where: { id: In(categoryIds) } });
        await this.projectRepository.save(proj);
      }
    }
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.projectRepository.delete(id);
  }

  async archive(id: string, archived: boolean = true): Promise<Project | null> {
    await this.projectRepository.update(id, { archived });
    return this.findOne(id);
  }

  async findOneScoped(id: string, user: { role: string; orgId?: string|null }) {
    const p = await this.findOne(id);
    if (!p) return null;
    if (user.role !== 'superadmin' && (p.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    return p;
  }

  async updateScoped(id: string, data: Partial<Project>, user: { role: string; orgId?: string|null }) {
    const existing = await this.projectRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    // prevent moving orgId unless superadmin
    if (user.role !== 'superadmin') {
      const d = data as Partial<Project> & { orgId?: string | null };
      if ('orgId' in d) delete d.orgId;
    }
    return this.update(id, data);
  }

  async removeScoped(id: string, user: { role: string; orgId?: string|null }) {
    const existing = await this.projectRepository.findOne({ where: { id } });
    if (!existing) return;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    await this.remove(id);
  }

  async archiveScoped(id: string, archived: boolean, user: { role: string; orgId?: string|null }) {
    const existing = await this.projectRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    return this.archive(id, archived);
  }
}
