import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, FindOptionsOrder, Equal, IsNull, In, DeepPartial } from 'typeorm';
import { Category } from './entities/category.entity';
import { Tag } from './entities/tag.entity';
import { Cohort } from './entities/cohort.entity';
import { AuditService } from '../common/audit.service';
import { AuditAction } from '../common/enums';
import { OrgsService, VisibleTaxonomyMeta } from '../orgs/orgs.service';

type TaxonomyKind = 'categories' | 'tags' | 'cohorts';
type TaxonomyEntityType = 'category' | 'tag' | 'cohort';
type ScopedTaxonomyUser = {
  id?: string;
  name?: string | null;
  role: string;
  orgId?: string | null;
  effectiveOrgId?: string | null | undefined;
};
type TaxonomyAuditUser = { id?: string; name?: string | null; orgId?: string | null };
type TaxonomyRecord = Category | Tag | Cohort;
type TaxonomyWriteData = Partial<TaxonomyRecord> & { orgId?: string | null };

const TAXONOMY_ENTITY_TYPES: Record<TaxonomyKind, TaxonomyEntityType> = {
  categories: 'category',
  tags: 'tag',
  cohorts: 'cohort',
};

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
    kind: TaxonomyKind,
    scopeOrgId: string | null,
  ) {
    if (scopeOrgId === null) return;
    if (!(await this.orgsService.canCreateOwnTaxonomy(scopeOrgId, kind))) {
      throw new ForbiddenException(this.getTaxonomyLockedMessage(kind));
    }
  }

  private withVisibleMeta<T extends { orgId?: string | null }>(record: T): T & VisibleTaxonomyMeta {
    return {
      ...record,
      sourceOrgId: record.orgId ?? null,
      sourceOrgName: null,
      isInherited: false,
      canManage: true,
    };
  }

  private filterByActive<T extends { active?: boolean }>(records: T[], active?: boolean) {
    return records.filter((record) => (typeof active === 'boolean' ? !!record.active === active : true));
  }

  private async findRawTaxonomyRecords<T extends TaxonomyRecord>(
    repository: Repository<T>,
    active: boolean | undefined,
    orgId: string | null | undefined,
    orgIds: string[] | undefined,
    order: FindOptionsOrder<T>,
  ): Promise<Array<T & VisibleTaxonomyMeta>> {
    const where: FindOptionsWhere<T> = {};
    if (active !== undefined) Object.assign(where, { active });
    this.applyOrgFilter(where, orgId, orgIds);
    const raw = await repository.find({ where, order });
    return raw.map((record) => this.withVisibleMeta(record));
  }

  private applyOrgFilter<T extends { orgId?: string | null }>(
    where: FindOptionsWhere<T>,
    orgId?: string | null,
    orgIds?: string[],
  ) {
    if (Array.isArray(orgIds) && orgIds.length) {
      Object.assign(where, { orgId: In(orgIds) });
    } else if (typeof orgId !== 'undefined') {
      Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    }
  }

  private async assertScopedTaxonomyVisible(
    kind: TaxonomyKind,
    record: Pick<TaxonomyRecord, 'id'>,
    user: ScopedTaxonomyUser,
  ) {
    if (user.role === 'superadmin') return;

    const scopeOrgId = this.getScopedOrgId(user);
    if (scopeOrgId === null) throw new ForbiddenException('Not allowed');

    const visibleIds = await this.orgsService.getVisibleTaxonomyIdsForOrg(scopeOrgId, kind);
    if (!visibleIds.includes(record.id)) throw new ForbiddenException('Not allowed');
  }

  private async prepareScopedMutation(
    kind: TaxonomyKind,
    existing: Pick<TaxonomyRecord, 'orgId'>,
    data: TaxonomyWriteData,
    user: ScopedTaxonomyUser,
  ) {
    const scopeOrgId = this.getScopedOrgId(user);
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== scopeOrgId) {
      throw new ForbiddenException('Not allowed');
    }
    if ((existing.orgId ?? null) === scopeOrgId) {
      await this.assertScopedTaxonomyManagementAllowed(kind, scopeOrgId);
    }
    if (user.role !== 'superadmin' && 'orgId' in data) delete data.orgId;
    return scopeOrgId;
  }

  private buildTaxonomyDiff<T extends object>(
    before: T,
    after: T,
    keys: Array<keyof T>,
  ): Record<string, { from: unknown; to: unknown }> {
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of keys) {
      const beforeVal = (before as Record<string, unknown>)[key as string];
      const afterVal = (after as Record<string, unknown>)[key as string];
      const changed = Array.isArray(beforeVal) || Array.isArray(afterVal)
        ? JSON.stringify(beforeVal || []) !== JSON.stringify(afterVal || [])
        : beforeVal !== afterVal;
      if (changed) diff[key as string] = { from: beforeVal, to: afterVal };
    }
    return diff;
  }

  private async logTaxonomyUpdate<T extends TaxonomyRecord>(
    kind: TaxonomyKind,
    existing: T,
    updated: T,
    keys: Array<keyof T>,
    user: ScopedTaxonomyUser,
  ) {
    const diff = this.buildTaxonomyDiff(existing, updated, keys);
    await this.audit.log({
      action: AuditAction.UPDATE,
      entityType: TAXONOMY_ENTITY_TYPES[kind],
      entityId: updated.id,
      entityTitle: updated.name,
      orgId: updated.orgId ?? null,
      user,
      diff: Object.keys(diff).length ? diff : null,
    });
  }

  private async logTaxonomyDelete(
    kind: TaxonomyKind,
    id: string,
    existing: TaxonomyRecord,
    scopeOrgId: string | null,
    user: ScopedTaxonomyUser,
  ) {
    await this.audit.log({
      action: AuditAction.DELETE,
      entityType: TAXONOMY_ENTITY_TYPES[kind],
      entityId: id,
      entityTitle: existing.name || null,
      orgId: scopeOrgId ?? null,
      user,
    });
  }

  private async logTaxonomyCreate(
    kind: TaxonomyKind,
    saved: TaxonomyRecord,
    user?: TaxonomyAuditUser,
  ) {
    await this.audit.log({
      action: AuditAction.CREATE,
      entityType: TAXONOMY_ENTITY_TYPES[kind],
      entityId: saved.id,
      entityTitle: saved.name,
      orgId: saved.orgId ?? null,
      user,
    });
  }

  private async createTaxonomyRecord<T extends TaxonomyRecord>(
    kind: TaxonomyKind,
    repository: Repository<T>,
    data: DeepPartial<T>,
    user?: TaxonomyAuditUser,
  ): Promise<T> {
    const record = repository.create(data);
    const saved = await repository.save(record);
    await this.logTaxonomyCreate(kind, saved, user);
    return saved;
  }

  // Categories
  async findAllCategories(active?: boolean, orgId?: string | null, orgIds?: string[]): Promise<Array<Category & VisibleTaxonomyMeta>> {
    if (typeof orgId !== 'undefined') {
      const visible = await this.orgsService.listVisibleCategoriesForOrg(orgId);
      return this.filterByActive(visible, active);
    }

    return this.findRawTaxonomyRecords(this.categoryRepository, active, orgId, orgIds, { name: 'ASC' });
  }

  findOneCategory(id: string): Promise<Category | null> {
    return this.categoryRepository.findOne({ where: { id } });
  }

  async createCategory(data: Partial<Category>, user?: { id?: string; name?: string | null; orgId?: string | null }): Promise<Category> {
    return this.createTaxonomyRecord<Category>('categories', this.categoryRepository, data, user);
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
    this.applyOrgFilter(where, orgId, orgIds);
    const raw = await this.tagRepository.find({ where, order: { name: 'ASC' } });
    return raw.map((tag) => this.withVisibleMeta(tag));
  }

  findOneTag(id: string): Promise<Tag | null> {
    return this.tagRepository.findOne({ where: { id } });
  }

  async createTag(data: Partial<Tag>, user?: { id?: string; name?: string | null; orgId?: string | null }): Promise<Tag> {
    return this.createTaxonomyRecord<Tag>('tags', this.tagRepository, data, user);
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
      return this.filterByActive(visible, active);
    }

    return this.findRawTaxonomyRecords(this.cohortRepository, active, orgId, orgIds, { sortOrder: 'ASC', minAge: 'ASC' });
  }

  findOneCohort(id: string): Promise<Cohort | null> {
    return this.cohortRepository.findOne({ where: { id } });
  }

  async createCohort(data: Partial<Cohort>, user?: { id?: string; name?: string | null; orgId?: string | null }): Promise<Cohort> {
    return this.createTaxonomyRecord<Cohort>('cohorts', this.cohortRepository, data, user);
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
  async findOneCategoryScoped(id: string, user: ScopedTaxonomyUser) {
    const c = await this.findOneCategory(id);
    if (!c) return null;
    await this.assertScopedTaxonomyVisible('categories', c, user);
    return c;
  }

  async updateCategoryScoped(id: string, data: Partial<Category>, user: ScopedTaxonomyUser) {
    const existing = await this.categoryRepository.findOne({ where: { id } });
    if (!existing) return null;
    await this.prepareScopedMutation('categories', existing, data, user);
    const c = await this.updateCategory(id, data);
    if (c) {
      await this.logTaxonomyUpdate('categories', existing, c, ['name', 'description', 'color', 'active', 'standardRef'], user);
    }
    return c;
  }

  async removeCategoryScoped(id: string, user: ScopedTaxonomyUser) {
    const existing = await this.categoryRepository.findOne({ where: { id } });
    if (!existing) return;
    const scopeOrgId = await this.prepareScopedMutation('categories', existing, {}, user);
    await this.removeCategory(id);
    await this.logTaxonomyDelete('categories', id, existing, scopeOrgId, user);
  }

  async findOneTagScoped(id: string, user: ScopedTaxonomyUser) {
    const t = await this.findOneTag(id);
    if (!t) return null;
    await this.assertScopedTaxonomyVisible('tags', t, user);
    return t;
  }

  async updateTagScoped(id: string, data: Partial<Tag>, user: ScopedTaxonomyUser) {
    const existing = await this.tagRepository.findOne({ where: { id } });
    if (!existing) return null;
    await this.prepareScopedMutation('tags', existing, data, user);
    const t = await this.updateTag(id, data);
    if (t) {
      await this.logTaxonomyUpdate('tags', existing, t, ['name', 'description', 'color', 'active', 'synonyms'], user);
    }
    return t;
  }

  async removeTagScoped(id: string, user: ScopedTaxonomyUser) {
    const existing = await this.tagRepository.findOne({ where: { id } });
    if (!existing) return;
    const scopeOrgId = await this.prepareScopedMutation('tags', existing, {}, user);
    await this.removeTag(id);
    await this.logTaxonomyDelete('tags', id, existing, scopeOrgId, user);
  }

  async findOneCohortScoped(id: string, user: ScopedTaxonomyUser) {
    const c = await this.findOneCohort(id);
    if (!c) return null;
    await this.assertScopedTaxonomyVisible('cohorts', c, user);
    return c;
  }

  async updateCohortScoped(id: string, data: Partial<Cohort>, user: ScopedTaxonomyUser) {
    const existing = await this.cohortRepository.findOne({ where: { id } });
    if (!existing) return null;
    await this.prepareScopedMutation('cohorts', existing, data, user);
    const c = await this.updateCohort(id, data);
    if (c) {
      await this.logTaxonomyUpdate('cohorts', existing, c, ['name', 'minAge', 'maxAge', 'sortOrder', 'active', 'inheritToChildren'], user);
    }
    return c;
  }

  async removeCohortScoped(id: string, user: ScopedTaxonomyUser) {
    const existing = await this.cohortRepository.findOne({ where: { id } });
    if (!existing) return;
    const scopeOrgId = await this.prepareScopedMutation('cohorts', existing, {}, user);
    await this.removeCohort(id);
    await this.logTaxonomyDelete('cohorts', id, existing, scopeOrgId, user);
  }
}
