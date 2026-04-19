import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, Equal, IsNull, In } from 'typeorm';
import { Category } from './entities/category.entity';
import { Tag } from './entities/tag.entity';
import { Cohort } from './entities/cohort.entity';
import { AuditService } from '../common/audit.service';
import { AuditAction } from '../common/enums';
import { OrgsService, VisibleTaxonomyMeta } from '../orgs/orgs.service';

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
    private readonly orgsService: OrgsService,
  ) {}

  private getScopedOrgId(user: { role: string; orgId?: string | null; effectiveOrgId?: string | null | undefined }) {
    if (user.role === 'superadmin') {
      return typeof user.effectiveOrgId === 'undefined' ? null : user.effectiveOrgId;
    }
    return typeof user.effectiveOrgId === 'undefined' ? (user.orgId || null) : user.effectiveOrgId;
  }

  private getTaxonomyLockedMessage(kind: 'categories' | 'tags' | 'cohorts') {
    if (kind === 'categories') return 'Für diese Organisation sind lokale Kategorien gesperrt';
    if (kind === 'tags') return 'Für diese Organisation sind lokale Tags gesperrt';
    return 'Für diese Organisation sind lokale Kohorten gesperrt';
  }

  private async assertScopedTaxonomyManagementAllowed(
    kind: 'categories' | 'tags' | 'cohorts',
    scopeOrgId: string | null,
  ) {
    if (scopeOrgId === null) return;
    if (!(await this.orgsService.canCreateOwnTaxonomy(scopeOrgId, kind))) {
      throw new ForbiddenException(this.getTaxonomyLockedMessage(kind));
    }
  }

  // Categories
  async findAllCategories(active?: boolean, orgId?: string | null, orgIds?: string[]): Promise<Array<Category & VisibleTaxonomyMeta>> {
    if (typeof orgId !== 'undefined') {
      const visible = await this.orgsService.listVisibleCategoriesForOrg(orgId);
      return visible.filter((category) => (typeof active === 'boolean' ? !!category.active === active : true));
    }

    const where: FindOptionsWhere<Category> = {};
    if (active !== undefined) Object.assign(where, { active });
    if (Array.isArray(orgIds) && orgIds.length) {
      Object.assign(where, { orgId: In(orgIds) });
    } else if (typeof orgId !== 'undefined') {
      Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    }
    const raw = await this.categoryRepository.find({ where, order: { name: 'ASC' } });
    return raw.map((category) => ({
      ...category,
      sourceOrgId: category.orgId ?? null,
      sourceOrgName: null,
      isInherited: false,
      canManage: true,
    }));
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
  async findAllTags(active?: boolean, search?: string, orgId?: string | null, orgIds?: string[]): Promise<Array<Tag & VisibleTaxonomyMeta>> {
    if (typeof orgId !== 'undefined') {
      const visible = await this.orgsService.listVisibleTagsForOrg(orgId);
      return visible.filter((tag) => {
        if (typeof active === 'boolean' && !!tag.active !== active) return false;
        if (search && !(tag.name || '').toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });
    }

    const where: FindOptionsWhere<Tag> = {};
    if (active !== undefined) where.active = active;
    if (search) where.name = Like(`%${search}%`);
    if (Array.isArray(orgIds) && orgIds.length) {
      Object.assign(where, { orgId: In(orgIds) });
    } else if (typeof orgId !== 'undefined') {
      Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    }
    const raw = await this.tagRepository.find({ where, order: { name: 'ASC' } });
    return raw.map((tag) => ({
      ...tag,
      sourceOrgId: tag.orgId ?? null,
      sourceOrgName: null,
      isInherited: false,
      canManage: true,
    }));
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
  async findAllCohorts(active?: boolean, orgId?: string | null, orgIds?: string[]): Promise<Array<Cohort & VisibleTaxonomyMeta>> {
    if (typeof orgId !== 'undefined') {
      const visible = await this.orgsService.listVisibleCohortsForOrg(orgId);
      return visible.filter((cohort) => (typeof active === 'boolean' ? !!cohort.active === active : true));
    }

    const where: FindOptionsWhere<Cohort> = {};
    if (active !== undefined) Object.assign(where, { active });
    if (Array.isArray(orgIds) && orgIds.length) {
      Object.assign(where, { orgId: In(orgIds) });
    } else if (orgId === null) {
      Object.assign(where, { orgId: IsNull() });
    }
    const raw = await this.cohortRepository.find({ where, order: { sortOrder: 'ASC', minAge: 'ASC' } });
    return raw.map((cohort) => ({
      ...cohort,
      sourceOrgId: cohort.orgId ?? null,
      sourceOrgName: null,
      isInherited: false,
      canManage: true,
    }));
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
  async findOneCategoryScoped(id: string, user: { role: string; orgId?: string | null; effectiveOrgId?: string | null | undefined }) {
    const c = await this.findOneCategory(id);
    if (!c) return null;
    if (user.role !== 'superadmin') {
      const scopeOrgId = this.getScopedOrgId(user);
      if (scopeOrgId === null) throw new ForbiddenException('Not allowed');
      const visibleIds = await this.orgsService.getVisibleTaxonomyIdsForOrg(scopeOrgId, 'categories');
      if (!visibleIds.includes(c.id)) throw new ForbiddenException('Not allowed');
    }
    return c;
  }

  async updateCategoryScoped(id: string, data: Partial<Category>, user: { id?: string; role: string; orgId?: string | null; effectiveOrgId?: string | null | undefined }) {
    const existing = await this.categoryRepository.findOne({ where: { id } });
    if (!existing) return null;
    const scopeOrgId = this.getScopedOrgId(user);
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== scopeOrgId) throw new ForbiddenException('Not allowed');
    if ((existing.orgId ?? null) === scopeOrgId) {
      await this.assertScopedTaxonomyManagementAllowed('categories', scopeOrgId);
    }
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

  async removeCategoryScoped(id: string, user: { id?: string; role: string; orgId?: string | null; effectiveOrgId?: string | null | undefined }) {
    const existing = await this.categoryRepository.findOne({ where: { id } });
    if (!existing) return;
    const scopeOrgId = this.getScopedOrgId(user);
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== scopeOrgId) throw new ForbiddenException('Not allowed');
    if ((existing.orgId ?? null) === scopeOrgId) {
      await this.assertScopedTaxonomyManagementAllowed('categories', scopeOrgId);
    }
    await this.removeCategory(id);
    await this.audit.log({ action: AuditAction.DELETE, entityType: 'category', entityId: id, entityTitle: existing.name || null, orgId: scopeOrgId ?? null, user });
  }

  async findOneTagScoped(id: string, user: { role: string; orgId?: string | null; effectiveOrgId?: string | null | undefined }) {
    const t = await this.findOneTag(id);
    if (!t) return null;
    if (user.role !== 'superadmin') {
      const scopeOrgId = this.getScopedOrgId(user);
      if (scopeOrgId === null) throw new ForbiddenException('Not allowed');
      const visibleIds = await this.orgsService.getVisibleTaxonomyIdsForOrg(scopeOrgId, 'tags');
      if (!visibleIds.includes(t.id)) throw new ForbiddenException('Not allowed');
    }
    return t;
  }

  async updateTagScoped(id: string, data: Partial<Tag>, user: { id?: string; role: string; orgId?: string | null; effectiveOrgId?: string | null | undefined }) {
    const existing = await this.tagRepository.findOne({ where: { id } });
    if (!existing) return null;
    const scopeOrgId = this.getScopedOrgId(user);
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== scopeOrgId) throw new ForbiddenException('Not allowed');
    if ((existing.orgId ?? null) === scopeOrgId) {
      await this.assertScopedTaxonomyManagementAllowed('tags', scopeOrgId);
    }
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

  async removeTagScoped(id: string, user: { id?: string; role: string; orgId?: string | null; effectiveOrgId?: string | null | undefined }) {
    const existing = await this.tagRepository.findOne({ where: { id } });
    if (!existing) return;
    const scopeOrgId = this.getScopedOrgId(user);
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== scopeOrgId) throw new ForbiddenException('Not allowed');
    if ((existing.orgId ?? null) === scopeOrgId) {
      await this.assertScopedTaxonomyManagementAllowed('tags', scopeOrgId);
    }
    await this.removeTag(id);
    await this.audit.log({ action: AuditAction.DELETE, entityType: 'tag', entityId: id, entityTitle: existing.name || null, orgId: scopeOrgId ?? null, user });
  }

  async findOneCohortScoped(id: string, user: { role: string; orgId?: string | null; effectiveOrgId?: string | null | undefined }) {
    const c = await this.findOneCohort(id);
    if (!c) return null;
    if (user.role !== 'superadmin') {
      const scopeOrgId = this.getScopedOrgId(user);
      if (scopeOrgId === null) throw new ForbiddenException('Not allowed');
      const visibleIds = await this.orgsService.getVisibleTaxonomyIdsForOrg(scopeOrgId, 'cohorts');
      if (!visibleIds.includes(c.id)) throw new ForbiddenException('Not allowed');
    }
    return c;
  }

  async updateCohortScoped(id: string, data: Partial<Cohort>, user: { id?: string; role: string; orgId?: string | null; effectiveOrgId?: string | null | undefined }) {
    const existing = await this.cohortRepository.findOne({ where: { id } });
    if (!existing) return null;
    const scopeOrgId = this.getScopedOrgId(user);
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== scopeOrgId) throw new ForbiddenException('Not allowed');
    if ((existing.orgId ?? null) === scopeOrgId) {
      await this.assertScopedTaxonomyManagementAllowed('cohorts', scopeOrgId);
    }
    if (user.role !== 'superadmin') {
      const d = data as Partial<Cohort> & { orgId?: string | null };
      if ('orgId' in d) delete d.orgId;
    }
    const c = await this.updateCohort(id, data);
    if (c) {
      const diff: Record<string, { from: unknown; to: unknown }> = {};
      const keys: Array<keyof Cohort> = ['name', 'minAge', 'maxAge', 'sortOrder', 'active', 'inheritToChildren'];
      for (const k of keys) {
        const beforeVal = (existing as unknown as Record<string, unknown>)[k as string];
        const afterVal = (c as unknown as Record<string, unknown>)[k as string];
        if (beforeVal !== afterVal) diff[k as string] = { from: beforeVal, to: afterVal };
      }
      await this.audit.log({ action: AuditAction.UPDATE, entityType: 'cohort', entityId: c.id, entityTitle: c.name, orgId: c.orgId ?? null, user, diff: Object.keys(diff).length ? diff : null });
    }
    return c;
  }

  async removeCohortScoped(id: string, user: { id?: string; role: string; orgId?: string | null; effectiveOrgId?: string | null | undefined }) {
    const existing = await this.cohortRepository.findOne({ where: { id } });
    if (!existing) return;
    const scopeOrgId = this.getScopedOrgId(user);
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== scopeOrgId) throw new ForbiddenException('Not allowed');
    if ((existing.orgId ?? null) === scopeOrgId) {
      await this.assertScopedTaxonomyManagementAllowed('cohorts', scopeOrgId);
    }
    await this.removeCohort(id);
    await this.audit.log({ action: AuditAction.DELETE, entityType: 'cohort', entityId: id, entityTitle: existing.name || null, orgId: scopeOrgId ?? null, user });
  }
}
