import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, Equal, IsNull, In } from 'typeorm';
import { Category } from './entities/category.entity';
import { Tag } from './entities/tag.entity';
import { Cohort } from './entities/cohort.entity';
import { AuditService } from '../common/audit.service';
import { AuditAction } from '../common/enums';

@Injectable()
export class TaxonomyService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @InjectRepository(Cohort)
    private cohortRepository: Repository<Cohort>,
    private readonly audit: AuditService,
  ) {}

  // Categories
  findAllCategories(active?: boolean, orgId?: string|null, orgIds?: string[]): Promise<Category[]> {
    const where: FindOptionsWhere<Category> = {};
    if (active !== undefined) Object.assign(where, { active });
    if (Array.isArray(orgIds) && orgIds.length) {
      Object.assign(where, { orgId: In(orgIds) });
    } else if (typeof orgId !== 'undefined') {
      Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    }
    return this.categoryRepository.find({ where, order: { name: 'ASC' } });
  }

  findOneCategory(id: string): Promise<Category | null> {
    return this.categoryRepository.findOne({ where: { id } });
  }

  async createCategory(data: Partial<Category>, user?: { id?: string; name?: string | null; orgId?: string | null }): Promise<Category> {
    const category = this.categoryRepository.create(data);
    const saved = await this.categoryRepository.save(category);
    await this.audit.log({ action: AuditAction.CREATE, entityType: 'category', entityId: saved.id, entityTitle: saved.name, orgId: saved.orgId ?? null, user });
    return saved;
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category | null> {
    await this.categoryRepository.update(id, data);
    const c = await this.findOneCategory(id);
    return c;
  }

  async removeCategory(id: string): Promise<void> {
    await this.categoryRepository.delete(id);
  }

  // Tags
  findAllTags(active?: boolean, search?: string, orgId?: string|null, orgIds?: string[]): Promise<Tag[]> {
    const where: FindOptionsWhere<Tag> = {};
    if (active !== undefined) where.active = active;
    if (search) where.name = Like(`%${search}%`);
    if (Array.isArray(orgIds) && orgIds.length) {
      Object.assign(where, { orgId: In(orgIds) });
    } else if (typeof orgId !== 'undefined') {
      Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    }
    return this.tagRepository.find({ where, order: { name: 'ASC' } });
  }

  findOneTag(id: string): Promise<Tag | null> {
    return this.tagRepository.findOne({ where: { id } });
  }

  async createTag(data: Partial<Tag>, user?: { id?: string; name?: string | null; orgId?: string | null }): Promise<Tag> {
    const tag = this.tagRepository.create(data);
    const saved = await this.tagRepository.save(tag);
    await this.audit.log({ action: AuditAction.CREATE, entityType: 'tag', entityId: saved.id, entityTitle: saved.name, orgId: saved.orgId ?? null, user });
    return saved;
  }

  async updateTag(id: string, data: Partial<Tag>): Promise<Tag | null> {
    await this.tagRepository.update(id, data);
    const t = await this.findOneTag(id);
    return t;
  }

  async removeTag(id: string): Promise<void> {
    await this.tagRepository.delete(id);
  }

  // Cohorts
  findAllCohorts(active?: boolean, orgId?: string|null, orgIds?: string[]): Promise<Cohort[]> {
    const where: FindOptionsWhere<Cohort> = {};
    if (active !== undefined) Object.assign(where, { active });
    if (Array.isArray(orgIds) && orgIds.length) {
      Object.assign(where, { orgId: In(orgIds) });
    } else if (typeof orgId !== 'undefined') {
      Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    }
    return this.cohortRepository.find({ where, order: { sortOrder: 'ASC', minAge: 'ASC' } });
  }

  findOneCohort(id: string): Promise<Cohort | null> {
    return this.cohortRepository.findOne({ where: { id } });
  }

  async createCohort(data: Partial<Cohort>, user?: { id?: string; name?: string | null; orgId?: string | null }): Promise<Cohort> {
    const cohort = this.cohortRepository.create(data);
    const saved = await this.cohortRepository.save(cohort);
    await this.audit.log({ action: AuditAction.CREATE, entityType: 'cohort', entityId: saved.id, entityTitle: saved.name, orgId: saved.orgId ?? null, user });
    return saved;
  }

  async updateCohort(id: string, data: Partial<Cohort>): Promise<Cohort | null> {
    await this.cohortRepository.update(id, data);
    const c = await this.findOneCohort(id);
    return c;
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

  async updateCategoryScoped(id: string, data: Partial<Category>, user: { id?: string; role: string; orgId?: string|null }) {
    const existing = await this.categoryRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    if (user.role !== 'superadmin') {
      const d = data as Partial<Category> & { orgId?: string | null };
      if ('orgId' in d) delete d.orgId;
    }
    const c = await this.updateCategory(id, data);
    if (c) {
      const diff: Record<string, { from: unknown; to: unknown }> = {};
      const keys: Array<keyof Category> = ['name', 'description', 'color', 'active', 'standardRef'];
      for (const k of keys) {
        const beforeVal = (existing as unknown as Record<string, unknown>)[k as string];
        const afterVal = (c as unknown as Record<string, unknown>)[k as string];
        if (beforeVal !== afterVal) diff[k as string] = { from: beforeVal, to: afterVal };
      }
      await this.audit.log({ action: AuditAction.UPDATE, entityType: 'category', entityId: c.id, entityTitle: c.name, orgId: c.orgId ?? null, user, diff: Object.keys(diff).length ? diff : null });
    }
    return c;
  }

  async removeCategoryScoped(id: string, user: { id?: string; role: string; orgId?: string|null }) {
    const existing = await this.categoryRepository.findOne({ where: { id } });
    if (!existing) return;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    await this.removeCategory(id);
    await this.audit.log({ action: AuditAction.DELETE, entityType: 'category', entityId: id, entityTitle: existing.name || null, orgId: user.orgId ?? null, user });
  }

  async findOneTagScoped(id: string, user: { role: string; orgId?: string|null }) {
    const t = await this.findOneTag(id);
    if (!t) return null;
    if (user.role !== 'superadmin' && (t.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    return t;
  }

  async updateTagScoped(id: string, data: Partial<Tag>, user: { id?: string; role: string; orgId?: string|null }) {
    const existing = await this.tagRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    if (user.role !== 'superadmin') {
      const d = data as Partial<Tag> & { orgId?: string | null };
      if ('orgId' in d) delete d.orgId;
    }
    const t = await this.updateTag(id, data);
    if (t) {
      const diff: Record<string, { from: unknown; to: unknown }> = {};
      const keys: Array<keyof Tag> = ['name', 'description', 'color', 'active', 'synonyms'];
      for (const k of keys) {
        const beforeVal = (existing as unknown as Record<string, unknown>)[k as string];
        const afterVal = (t as unknown as Record<string, unknown>)[k as string];
        const changed = Array.isArray(beforeVal) || Array.isArray(afterVal)
          ? JSON.stringify(beforeVal || []) !== JSON.stringify(afterVal || [])
          : beforeVal !== afterVal;
        if (changed) diff[k as string] = { from: beforeVal, to: afterVal };
      }
      await this.audit.log({ action: AuditAction.UPDATE, entityType: 'tag', entityId: t.id, entityTitle: t.name, orgId: t.orgId ?? null, user, diff: Object.keys(diff).length ? diff : null });
    }
    return t;
  }

  async removeTagScoped(id: string, user: { id?: string; role: string; orgId?: string|null }) {
    const existing = await this.tagRepository.findOne({ where: { id } });
    if (!existing) return;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    await this.removeTag(id);
    await this.audit.log({ action: AuditAction.DELETE, entityType: 'tag', entityId: id, entityTitle: existing.name || null, orgId: user.orgId ?? null, user });
  }

  async findOneCohortScoped(id: string, user: { role: string; orgId?: string|null }) {
    const c = await this.findOneCohort(id);
    if (!c) return null;
    if (user.role !== 'superadmin' && (c.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    return c;
  }

  async updateCohortScoped(id: string, data: Partial<Cohort>, user: { id?: string; role: string; orgId?: string|null }) {
    const existing = await this.cohortRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    if (user.role !== 'superadmin') {
      const d = data as Partial<Cohort> & { orgId?: string | null };
      if ('orgId' in d) delete d.orgId;
    }
    const c = await this.updateCohort(id, data);
    if (c) {
      const diff: Record<string, { from: unknown; to: unknown }> = {};
      const keys: Array<keyof Cohort> = ['name', 'minAge', 'maxAge', 'sortOrder', 'active'];
      for (const k of keys) {
        const beforeVal = (existing as unknown as Record<string, unknown>)[k as string];
        const afterVal = (c as unknown as Record<string, unknown>)[k as string];
        if (beforeVal !== afterVal) diff[k as string] = { from: beforeVal, to: afterVal };
      }
      await this.audit.log({ action: AuditAction.UPDATE, entityType: 'cohort', entityId: c.id, entityTitle: c.name, orgId: c.orgId ?? null, user, diff: Object.keys(diff).length ? diff : null });
    }
    return c;
  }

  async removeCohortScoped(id: string, user: { id?: string; role: string; orgId?: string|null }) {
    const existing = await this.cohortRepository.findOne({ where: { id } });
    if (!existing) return;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    await this.removeCohort(id);
    await this.audit.log({ action: AuditAction.DELETE, entityType: 'cohort', entityId: id, entityTitle: existing.name || null, orgId: user.orgId ?? null, user });
  }
}
