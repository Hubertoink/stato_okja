import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, Equal, IsNull } from 'typeorm';
import { Category } from './entities/category.entity';
import { Tag } from './entities/tag.entity';
import { Cohort } from './entities/cohort.entity';

@Injectable()
export class TaxonomyService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @InjectRepository(Cohort)
    private cohortRepository: Repository<Cohort>,
  ) {}

  // Categories
  findAllCategories(active?: boolean, orgId?: string|null): Promise<Category[]> {
    const where: FindOptionsWhere<Category> = {};
    if (active !== undefined) Object.assign(where, { active });
    if (typeof orgId !== 'undefined') Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    return this.categoryRepository.find({ where, order: { name: 'ASC' } });
  }

  findOneCategory(id: string): Promise<Category | null> {
    return this.categoryRepository.findOne({ where: { id } });
  }

  createCategory(data: Partial<Category>): Promise<Category> {
    const category = this.categoryRepository.create(data);
    return this.categoryRepository.save(category);
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category | null> {
    await this.categoryRepository.update(id, data);
    return this.findOneCategory(id);
  }

  async removeCategory(id: string): Promise<void> {
    await this.categoryRepository.delete(id);
  }

  // Tags
  findAllTags(active?: boolean, search?: string, orgId?: string|null): Promise<Tag[]> {
    const where: FindOptionsWhere<Tag> = {};
    if (active !== undefined) where.active = active;
    if (search) where.name = Like(`%${search}%`);
    if (typeof orgId !== 'undefined') Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    return this.tagRepository.find({ where, order: { name: 'ASC' } });
  }

  findOneTag(id: string): Promise<Tag | null> {
    return this.tagRepository.findOne({ where: { id } });
  }

  createTag(data: Partial<Tag>): Promise<Tag> {
    const tag = this.tagRepository.create(data);
    return this.tagRepository.save(tag);
  }

  async updateTag(id: string, data: Partial<Tag>): Promise<Tag | null> {
    await this.tagRepository.update(id, data);
    return this.findOneTag(id);
  }

  async removeTag(id: string): Promise<void> {
    await this.tagRepository.delete(id);
  }

  // Cohorts
  findAllCohorts(active?: boolean, orgId?: string|null): Promise<Cohort[]> {
    const where: FindOptionsWhere<Cohort> = {};
    if (active !== undefined) Object.assign(where, { active });
    if (typeof orgId !== 'undefined') Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    return this.cohortRepository.find({ where, order: { sortOrder: 'ASC', minAge: 'ASC' } });
  }

  findOneCohort(id: string): Promise<Cohort | null> {
    return this.cohortRepository.findOne({ where: { id } });
  }

  createCohort(data: Partial<Cohort>): Promise<Cohort> {
    const cohort = this.cohortRepository.create(data);
    return this.cohortRepository.save(cohort);
  }

  async updateCohort(id: string, data: Partial<Cohort>): Promise<Cohort | null> {
    await this.cohortRepository.update(id, data);
    return this.findOneCohort(id);
  }

  async removeCohort(id: string): Promise<void> {
    await this.cohortRepository.delete(id);
  }

  // Scoped helpers to enforce org boundaries
  async findOneCategoryScoped(id: string, user: { role: string; orgId?: string|null }) {
    const c = await this.findOneCategory(id);
    if (!c) return null;
    if (user.role !== 'superadmin' && (c.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    return c;
  }

  async updateCategoryScoped(id: string, data: Partial<Category>, user: { role: string; orgId?: string|null }) {
    const existing = await this.categoryRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    if (user.role !== 'superadmin') {
      const d = data as Partial<Category> & { orgId?: string | null };
      if ('orgId' in d) delete d.orgId;
    }
    return this.updateCategory(id, data);
  }

  async removeCategoryScoped(id: string, user: { role: string; orgId?: string|null }) {
    const existing = await this.categoryRepository.findOne({ where: { id } });
    if (!existing) return;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    await this.removeCategory(id);
  }

  async findOneTagScoped(id: string, user: { role: string; orgId?: string|null }) {
    const t = await this.findOneTag(id);
    if (!t) return null;
    if (user.role !== 'superadmin' && (t.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    return t;
  }

  async updateTagScoped(id: string, data: Partial<Tag>, user: { role: string; orgId?: string|null }) {
    const existing = await this.tagRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    if (user.role !== 'superadmin') {
      const d = data as Partial<Tag> & { orgId?: string | null };
      if ('orgId' in d) delete d.orgId;
    }
    return this.updateTag(id, data);
  }

  async removeTagScoped(id: string, user: { role: string; orgId?: string|null }) {
    const existing = await this.tagRepository.findOne({ where: { id } });
    if (!existing) return;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    await this.removeTag(id);
  }

  async findOneCohortScoped(id: string, user: { role: string; orgId?: string|null }) {
    const c = await this.findOneCohort(id);
    if (!c) return null;
    if (user.role !== 'superadmin' && (c.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    return c;
  }

  async updateCohortScoped(id: string, data: Partial<Cohort>, user: { role: string; orgId?: string|null }) {
    const existing = await this.cohortRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    if (user.role !== 'superadmin') {
      const d = data as Partial<Cohort> & { orgId?: string | null };
      if ('orgId' in d) delete d.orgId;
    }
    return this.updateCohort(id, data);
  }

  async removeCohortScoped(id: string, user: { role: string; orgId?: string|null }) {
    const existing = await this.cohortRepository.findOne({ where: { id } });
    if (!existing) return;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    await this.removeCohort(id);
  }
}
