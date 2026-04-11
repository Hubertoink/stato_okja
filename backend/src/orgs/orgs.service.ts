import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Organization,
  OpeningHours,
  OrganizationTaxonomySettings,
  OrganizationTaxonomyType,
  OrganizationTaxonomyTypeSetting,
} from './entities/organization.entity';
import { Location } from '../locations/entities/location.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { Tag } from '../taxonomy/entities/tag.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { Activity } from '../activities/entities/activity.entity';
import { Project } from '../projects/entities/project.entity';

const SUBTREE_CACHE_TTL_MS = 10_000;
type SubtreeCacheEntry = { expiresAt: number; ids: string[] };
type TaxonomyRecord = Category | Tag | Cohort;
type NormalizedTaxonomySetting = { allowOwn: boolean; inheritedIds: string[]; inheritAll: boolean };

export interface VisibleTaxonomyMeta {
  sourceOrgId: string | null;
  sourceOrgName: string | null;
  isInherited: boolean;
  canManage: boolean;
}

export interface TaxonomyAccessMap {
  categories: { canCreateOwn: boolean };
  tags: { canCreateOwn: boolean };
  cohorts: { canCreateOwn: boolean };
}

export interface OrgTaxonomySettingsSnapshot {
  childId: string;
  parentId: string | null;
  parentName: string | null;
  settings: {
    categories: NormalizedTaxonomySetting;
    tags: NormalizedTaxonomySetting;
    cohorts: NormalizedTaxonomySetting;
  };
  access: TaxonomyAccessMap;
  parentOptions: {
    categories: Array<Category & VisibleTaxonomyMeta>;
    tags: Array<Tag & VisibleTaxonomyMeta>;
    cohorts: Array<Cohort & VisibleTaxonomyMeta>;
  };
}

interface MoveImpactItem {
  id: string;
  name: string;
  sourceOrgId: string | null;
  sourceOrgName: string | null;
}

export interface OrgMovePreview {
  currentParentId: string | null;
  newParentId: string | null;
  affectedOrgs: number;
  requiresConfirmation: boolean;
  resetNotice: string;
  lost: {
    categories: MoveImpactItem[];
    tags: MoveImpactItem[];
    cohorts: MoveImpactItem[];
  };
  gained: {
    categories: MoveImpactItem[];
    tags: MoveImpactItem[];
    cohorts: MoveImpactItem[];
  };
  activityConflicts: {
    categories: { activities: number; items: MoveImpactItem[] };
    tags: { activities: number; items: MoveImpactItem[] };
    cohorts: { activities: number; items: MoveImpactItem[] };
  };
  projectConflicts: {
    categories: { projects: number; items: MoveImpactItem[] };
  };
}

@Injectable()
export class OrgsService {
  private readonly subtreeCache = new Map<string, SubtreeCacheEntry>();

  constructor(
    @InjectRepository(Organization) private readonly repo: Repository<Organization>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Tag) private readonly tags: Repository<Tag>,
    @InjectRepository(Cohort) private readonly cohorts: Repository<Cohort>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
  ) {}

  private clearSubtreeCache() {
    this.subtreeCache.clear();
  }

  private dedupeIds(ids?: string[] | null): string[] {
    return Array.from(new Set((ids || []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));
  }

  private normalizeTaxonomySetting(setting?: OrganizationTaxonomyTypeSetting | null): NormalizedTaxonomySetting {
    return {
      allowOwn: typeof setting?.allowOwn === 'boolean' ? setting.allowOwn : true,
      inheritedIds: this.dedupeIds(setting?.inheritedIds),
      inheritAll: setting?.inheritAll === true,
    };
  }

  private normalizeTaxonomySettings(settings?: OrganizationTaxonomySettings | null) {
    return {
      categories: this.normalizeTaxonomySetting(settings?.categories),
      tags: this.normalizeTaxonomySetting(settings?.tags),
      cohorts: this.normalizeTaxonomySetting(settings?.cohorts),
    };
  }

  private sortTaxonomies<T extends TaxonomyRecord>(kind: OrganizationTaxonomyType, items: T[]): T[] {
    const copy = [...items];
    copy.sort((left, right) => {
      if (kind === 'cohorts') {
        const a = left as Cohort;
        const b = right as Cohort;
        if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        if (a.minAge !== b.minAge) return a.minAge - b.minAge;
      }
      return (left.name || '').localeCompare(right.name || '', 'de');
    });
    return copy;
  }

  private toOrgMap(orgs: Organization[]): Map<string, Organization> {
    return new Map(orgs.map((org) => [org.id, org]));
  }

  private getSourceOrgName(orgMap: Map<string, Organization>, sourceOrgId: string | null): string | null {
    if (!sourceOrgId) return null;
    return orgMap.get(sourceOrgId)?.name || null;
  }

  private groupTaxonomiesByOrg<T extends { orgId: string | null }>(items: T[]): Map<string | null, T[]> {
    const grouped = new Map<string | null, T[]>();
    for (const item of items) {
      const key = item.orgId ?? null;
      const bucket = grouped.get(key) || [];
      bucket.push(item);
      grouped.set(key, bucket);
    }
    return grouped;
  }

  private getLegacyInheritedIds(kind: OrganizationTaxonomyType, parentVisible: TaxonomyRecord[]): string[] {
    if (kind !== 'cohorts') return [];
    return parentVisible
      .filter((item): item is Cohort => item instanceof Cohort || 'inheritToChildren' in item)
      .filter((item) => item.inheritToChildren)
      .map((item) => item.id);
  }

  private resolveVisibleTaxonomiesFromData<T extends TaxonomyRecord>(
    kind: OrganizationTaxonomyType,
    orgId: string,
    orgMap: Map<string, Organization>,
    grouped: Map<string | null, T[]>,
    cache: Map<string, T[]>,
  ): T[] {
    const cached = cache.get(orgId);
    if (cached) return cached;

    const org = orgMap.get(orgId);
    if (!org) return [];

    const own = grouped.get(orgId) || [];
    if (!org.parentId) {
      const sorted = this.sortTaxonomies(kind, own);
      cache.set(orgId, sorted);
      return sorted;
    }

    const parentVisible = this.resolveVisibleTaxonomiesFromData(kind, org.parentId, orgMap, grouped, cache);
    const rawSetting = org.taxonomySettings?.[kind];
    const inheritAll = rawSetting?.inheritAll === true;
    const selectedIds = inheritAll
      ? null
      : Array.isArray(rawSetting?.inheritedIds)
        ? new Set(this.dedupeIds(rawSetting.inheritedIds))
        : new Set(this.getLegacyInheritedIds(kind, parentVisible));

    const inherited = inheritAll
      ? parentVisible
      : parentVisible.filter((item) => selectedIds?.has(item.id));
    const visible = new Map<string, T>();
    for (const item of inherited) visible.set(item.id, item);
    for (const item of own) visible.set(item.id, item);

    const sorted = this.sortTaxonomies(kind, Array.from(visible.values()));
    cache.set(orgId, sorted);
    return sorted;
  }

  private async loadTaxonomies(kind: OrganizationTaxonomyType): Promise<TaxonomyRecord[]> {
    if (kind === 'categories') return this.categories.find({ order: { name: 'ASC' } });
    if (kind === 'tags') return this.tags.find({ order: { name: 'ASC' } });
    return this.cohorts.find({ order: { sortOrder: 'ASC', minAge: 'ASC' } });
  }

  private decorateVisibleTaxonomies<T extends TaxonomyRecord>(
    items: T[],
    currentOrgId: string | null,
    orgMap: Map<string, Organization>,
  ): Array<T & VisibleTaxonomyMeta> {
    return items.map((item) => ({
      ...item,
      sourceOrgId: item.orgId ?? null,
      sourceOrgName: this.getSourceOrgName(orgMap, item.orgId ?? null),
      isInherited: (item.orgId ?? null) !== currentOrgId,
      canManage: (item.orgId ?? null) === currentOrgId,
    }));
  }

  private async listVisibleTaxonomiesForOrg(kind: OrganizationTaxonomyType, orgId?: string | null): Promise<Array<TaxonomyRecord & VisibleTaxonomyMeta>> {
    const items = await this.loadTaxonomies(kind);
    if (typeof orgId === 'undefined') {
      const orgMap = this.toOrgMap(await this.repo.find());
      return this.decorateVisibleTaxonomies(items, null, orgMap);
    }

    if (orgId === null) {
      const globalItems = items.filter((item) => (item.orgId ?? null) === null);
      const orgMap = this.toOrgMap(await this.repo.find());
      return this.decorateVisibleTaxonomies(this.sortTaxonomies(kind, globalItems), null, orgMap);
    }

    const orgs = await this.repo.find();
    const orgMap = this.toOrgMap(orgs);
    const grouped = this.groupTaxonomiesByOrg(items);
    const resolved = this.resolveVisibleTaxonomiesFromData(kind, orgId, orgMap, grouped, new Map());
    return this.decorateVisibleTaxonomies(resolved, orgId, orgMap);
  }

  async listVisibleCategoriesForOrg(orgId?: string | null) {
    return this.listVisibleTaxonomiesForOrg('categories', orgId) as Promise<Array<Category & VisibleTaxonomyMeta>>;
  }

  async listVisibleTagsForOrg(orgId?: string | null) {
    return this.listVisibleTaxonomiesForOrg('tags', orgId) as Promise<Array<Tag & VisibleTaxonomyMeta>>;
  }

  async listVisibleCohortsForOrg(orgId?: string | null) {
    return this.listVisibleTaxonomiesForOrg('cohorts', orgId) as Promise<Array<Cohort & VisibleTaxonomyMeta>>;
  }

  async getVisibleTaxonomyIdsForOrg(orgId: string | null, kind: OrganizationTaxonomyType): Promise<string[]> {
    const visible = await this.listVisibleTaxonomiesForOrg(kind, orgId);
    return visible.map((item) => item.id);
  }

  async canCreateOwnTaxonomy(orgId: string | null, kind: OrganizationTaxonomyType): Promise<boolean> {
    if (orgId === null) return true;
    const org = await this.repo.findOne({ where: { id: orgId } });
    if (!org) return false;
    if (!org.parentId) return true;
    const entry = org.taxonomySettings?.[kind];
    return typeof entry?.allowOwn === 'boolean' ? entry.allowOwn : true;
  }

  async getTaxonomyAccessForOrg(orgId: string | null): Promise<TaxonomyAccessMap> {
    return {
      categories: { canCreateOwn: await this.canCreateOwnTaxonomy(orgId, 'categories') },
      tags: { canCreateOwn: await this.canCreateOwnTaxonomy(orgId, 'tags') },
      cohorts: { canCreateOwn: await this.canCreateOwnTaxonomy(orgId, 'cohorts') },
    };
  }

  async assertTaxonomyIdsVisibleForOrg(orgId: string | null, kind: OrganizationTaxonomyType, ids: string[]) {
    const uniqueIds = this.dedupeIds(ids);
    if (!uniqueIds.length) return;
    const visibleIds = new Set(await this.getVisibleTaxonomyIdsForOrg(orgId, kind));
    const invalidIds = uniqueIds.filter((id) => !visibleIds.has(id));
    if (!invalidIds.length) return;

    const visibleItems = await this.listVisibleTaxonomiesForOrg(kind, orgId);
    const visibleSet = new Set(visibleItems.map((item) => item.id));
    const allItems = await this.loadTaxonomies(kind);
    const invalidNames = allItems
      .filter((item) => invalidIds.includes(item.id) && !visibleSet.has(item.id))
      .map((item) => item.name)
      .filter(Boolean);

    throw new BadRequestException(
      invalidNames.length
        ? `Nicht erlaubte ${kind}: ${invalidNames.join(', ')}`
        : `Nicht erlaubte ${kind} für diese Organisation.`,
    );
  }

  private getCurrentSubtreeIdsFromOrgs(root: Organization, orgs: Organization[]): string[] {
    const path = root.path || root.id;
    return orgs
      .filter((org) => org.id === root.id || (org.path || org.id).startsWith(`${path}/`))
      .map((org) => org.id);
  }

  private buildChildrenMap(orgs: Map<string, Organization>): Map<string | null, Organization[]> {
    const children = new Map<string | null, Organization[]>();
    for (const org of orgs.values()) {
      const key = org.parentId ?? null;
      const bucket = children.get(key) || [];
      bucket.push(org);
      children.set(key, bucket);
    }
    return children;
  }

  private getSubtreeIdsFromMap(rootId: string, orgs: Map<string, Organization>): string[] {
    const childrenMap = this.buildChildrenMap(orgs);
    const result: string[] = [];
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      result.push(current);
      for (const child of childrenMap.get(current) || []) stack.push(child.id);
    }
    return result;
  }

  private toMoveImpactItems(items: TaxonomyRecord[], orgMap: Map<string, Organization>): MoveImpactItem[] {
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      sourceOrgId: item.orgId ?? null,
      sourceOrgName: this.getSourceOrgName(orgMap, item.orgId ?? null),
    }));
  }

  private async assertCanManageChildSettings(child: Organization, actor: { role: string; orgId?: string | null }) {
    if (actor.role === 'superadmin') return;
    const actorOrgId = actor.orgId ?? null;
    if (!actorOrgId || child.parentId !== actorOrgId) {
      throw new ForbiddenException('Org-Admins können nur direkte Unterorganisationen konfigurieren');
    }
  }

  findAll() { return this.repo.find(); }

  async create(name: string, parentId?: string | null) {
    const parent = parentId ? await this.repo.findOne({ where: { id: parentId } }) : null;
    const o = this.repo.create({ name, parentId: parent?.id ?? null, taxonomySettings: null });
    const saved = await this.repo.save(o);
    // compute materialized path: parent.path + '/' + id or id for root
    const path = parent?.path ? `${parent.path}/${saved.id}` : saved.id;
    await this.repo.update({ id: saved.id }, { path });
    // Create default Location with same name, scoped to org
    const loc = this.locations.create({ name, active: true, orgId: saved.id });
    await this.locations.save(loc);
    this.clearSubtreeCache();
    return { ...saved, path } as Organization;
  }

  async getSubtreeOrgIds(rootId: string) {
    const cached = this.subtreeCache.get(rootId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.ids;
    }

    const root = await this.repo.findOne({ where: { id: rootId } });
    if (!root) return [] as string[];
    const pathPrefix = root.path || root.id;
    const rows = await this.repo
      .createQueryBuilder('org')
      .select('org.id', 'id')
      .where('org.id = :rootId', { rootId })
      .orWhere('org.path LIKE :pathPrefix', { pathPrefix: `${pathPrefix}/%` })
      .getRawMany<{ id: string }>();
    const ids = rows.map((row) => row.id);
    this.subtreeCache.set(rootId, { ids, expiresAt: Date.now() + SUBTREE_CACHE_TTL_MS });
    return ids;
  }

  async getAncestorOrgIds(id: string) {
    const org = await this.repo.findOne({ where: { id } });
    if (!org) return [] as string[];
    const path = org.path || org.id;
    return path.split('/').filter(Boolean);
  }

  async getChildTaxonomySettingsScoped(
    childId: string,
    actor: { role: string; orgId?: string | null },
  ): Promise<OrgTaxonomySettingsSnapshot> {
    const child = await this.repo.findOne({ where: { id: childId } });
    if (!child) throw new BadRequestException('Organisation nicht gefunden');
    if (!child.parentId) throw new BadRequestException('Oberste Organisationen haben keine Vererbungsregeln');

    await this.assertCanManageChildSettings(child, actor);

    const parent = await this.repo.findOne({ where: { id: child.parentId } });
    const settings = this.normalizeTaxonomySettings(child.taxonomySettings);
    const access = await this.getTaxonomyAccessForOrg(child.id);

    return {
      childId: child.id,
      parentId: child.parentId,
      parentName: parent?.name || null,
      settings,
      access,
      parentOptions: {
        categories: child.parentId ? await this.listVisibleCategoriesForOrg(child.parentId) : [],
        tags: child.parentId ? await this.listVisibleTagsForOrg(child.parentId) : [],
        cohorts: child.parentId ? await this.listVisibleCohortsForOrg(child.parentId) : [],
      },
    };
  }

  async updateChildTaxonomySettingsScoped(
    childId: string,
    settings: OrganizationTaxonomySettings,
    actor: { role: string; orgId?: string | null },
  ): Promise<OrgTaxonomySettingsSnapshot> {
    const child = await this.repo.findOne({ where: { id: childId } });
    if (!child) throw new BadRequestException('Organisation nicht gefunden');
    if (!child.parentId) throw new BadRequestException('Oberste Organisationen haben keine Vererbungsregeln');

    await this.assertCanManageChildSettings(child, actor);

    const normalized = this.normalizeTaxonomySettings(settings);
    const parentVisible = {
      categories: new Set((await this.listVisibleCategoriesForOrg(child.parentId)).map((item) => item.id)),
      tags: new Set((await this.listVisibleTagsForOrg(child.parentId)).map((item) => item.id)),
      cohorts: new Set((await this.listVisibleCohortsForOrg(child.parentId)).map((item) => item.id)),
    };

    if (!normalized.categories.inheritAll) {
      for (const id of normalized.categories.inheritedIds) {
        if (!parentVisible.categories.has(id)) throw new BadRequestException('Ungültige Kategorien-Vererbung');
      }
    }
    if (!normalized.tags.inheritAll) {
      for (const id of normalized.tags.inheritedIds) {
        if (!parentVisible.tags.has(id)) throw new BadRequestException('Ungültige Tags-Vererbung');
      }
    }
    if (!normalized.cohorts.inheritAll) {
      for (const id of normalized.cohorts.inheritedIds) {
        if (!parentVisible.cohorts.has(id)) throw new BadRequestException('Ungültige Kohorten-Vererbung');
      }
    }

    child.taxonomySettings = normalized;
    await this.repo.save(child);
    return this.getChildTaxonomySettingsScoped(childId, actor);
  }

  async previewMoveOrg(id: string, newParentId: string | null): Promise<OrgMovePreview> {
    const orgs = await this.repo.find();
    const current = orgs.find((org) => org.id === id);
    if (!current) throw new BadRequestException('Organisation nicht gefunden');
    if (newParentId === null) throw new BadRequestException('Verschieben auf die oberste Ebene ist nicht erlaubt');
    if (newParentId === id) throw new BadRequestException('Organisation kann nicht auf sich selbst verschoben werden');
    if ((current.parentId ?? null) === newParentId) throw new BadRequestException('Organisation ist bereits dieser Organisation zugeordnet');

    const currentMap = this.toOrgMap(orgs);
    const subtreeIds = this.getCurrentSubtreeIdsFromOrgs(current, orgs);
    if (newParentId && subtreeIds.includes(newParentId)) {
      throw new BadRequestException('Organisation kann nicht in die eigene Unterstruktur verschoben werden');
    }

    const newParent = newParentId ? currentMap.get(newParentId) : null;
    if (newParentId && !newParent) throw new BadRequestException('Ziel-Organisation nicht gefunden');

    const categoryItems = await this.categories.find({ order: { name: 'ASC' } });
    const tagItems = await this.tags.find({ order: { name: 'ASC' } });
    const cohortItems = await this.cohorts.find({ order: { sortOrder: 'ASC', minAge: 'ASC' } });

    const currentCategoriesByOrg = new Map<string, Category[]>();
    const currentTagsByOrg = new Map<string, Tag[]>();
    const currentCohortsByOrg = new Map<string, Cohort[]>();
    for (const orgId of subtreeIds) {
      currentCategoriesByOrg.set(orgId, await this.listVisibleCategoriesForOrg(orgId));
      currentTagsByOrg.set(orgId, await this.listVisibleTagsForOrg(orgId));
      currentCohortsByOrg.set(orgId, await this.listVisibleCohortsForOrg(orgId));
    }

    const simulatedMap = new Map<string, Organization>(
      Array.from(currentMap.entries()).map(([orgId, org]) => [orgId, { ...org } as Organization]),
    );
    const moving = simulatedMap.get(id)!;
    moving.parentId = newParentId;
    moving.taxonomySettings = null;

    const categoryGrouped = this.groupTaxonomiesByOrg(categoryItems);
    const tagGrouped = this.groupTaxonomiesByOrg(tagItems);
    const cohortGrouped = this.groupTaxonomiesByOrg(cohortItems);
    const afterCategoriesByOrg = new Map<string, Category[]>();
    const afterTagsByOrg = new Map<string, Tag[]>();
    const afterCohortsByOrg = new Map<string, Cohort[]>();
    const categoryCache = new Map<string, Category[]>();
    const tagCache = new Map<string, Tag[]>();
    const cohortCache = new Map<string, Cohort[]>();
    for (const orgId of subtreeIds) {
      afterCategoriesByOrg.set(orgId, this.resolveVisibleTaxonomiesFromData('categories', orgId, simulatedMap, categoryGrouped, categoryCache));
      afterTagsByOrg.set(orgId, this.resolveVisibleTaxonomiesFromData('tags', orgId, simulatedMap, tagGrouped, tagCache));
      afterCohortsByOrg.set(orgId, this.resolveVisibleTaxonomiesFromData('cohorts', orgId, simulatedMap, cohortGrouped, cohortCache));
    }

    const lostCategoryIds = new Set<string>();
    const gainedCategoryIds = new Set<string>();
    const lostTagIds = new Set<string>();
    const gainedTagIds = new Set<string>();
    const lostCohortIds = new Set<string>();
    const gainedCohortIds = new Set<string>();

    for (const orgId of subtreeIds) {
      const beforeCategoryIds = new Set((currentCategoriesByOrg.get(orgId) || []).map((item) => item.id));
      const afterCategoryIds = new Set((afterCategoriesByOrg.get(orgId) || []).map((item) => item.id));
      const beforeTagIds = new Set((currentTagsByOrg.get(orgId) || []).map((item) => item.id));
      const afterTagIds = new Set((afterTagsByOrg.get(orgId) || []).map((item) => item.id));
      const beforeCohortIds = new Set((currentCohortsByOrg.get(orgId) || []).map((item) => item.id));
      const afterCohortIds = new Set((afterCohortsByOrg.get(orgId) || []).map((item) => item.id));

      for (const itemId of beforeCategoryIds) if (!afterCategoryIds.has(itemId)) lostCategoryIds.add(itemId);
      for (const itemId of afterCategoryIds) if (!beforeCategoryIds.has(itemId)) gainedCategoryIds.add(itemId);
      for (const itemId of beforeTagIds) if (!afterTagIds.has(itemId)) lostTagIds.add(itemId);
      for (const itemId of afterTagIds) if (!beforeTagIds.has(itemId)) gainedTagIds.add(itemId);
      for (const itemId of beforeCohortIds) if (!afterCohortIds.has(itemId)) lostCohortIds.add(itemId);
      for (const itemId of afterCohortIds) if (!beforeCohortIds.has(itemId)) gainedCohortIds.add(itemId);
    }

    const subtreeSet = new Set(subtreeIds);
    const activities = subtreeIds.length
      ? await this.activities.find({ where: { orgId: In(subtreeIds) } })
      : [];
    const projects = subtreeIds.length
      ? await this.projects.find({ where: { orgId: In(subtreeIds) } })
      : [];

    const activityConflictActivities = {
      categories: new Set<string>(),
      tags: new Set<string>(),
      cohorts: new Set<string>(),
    };
    const activityConflictItems = {
      categories: new Set<string>(),
      tags: new Set<string>(),
      cohorts: new Set<string>(),
    };

    for (const activity of activities) {
      const orgId = activity.orgId ?? null;
      if (!orgId || !subtreeSet.has(orgId)) continue;

      const allowedCategories = new Set((afterCategoriesByOrg.get(orgId) || []).map((item) => item.id));
      const allowedTags = new Set((afterTagsByOrg.get(orgId) || []).map((item) => item.id));
      const allowedCohorts = new Set((afterCohortsByOrg.get(orgId) || []).map((item) => item.id));

      for (const category of activity.categories || []) {
        if (!allowedCategories.has(category.id)) {
          activityConflictActivities.categories.add(activity.id);
          activityConflictItems.categories.add(category.id);
        }
      }
      for (const tag of activity.tags || []) {
        if (!allowedTags.has(tag.id)) {
          activityConflictActivities.tags.add(activity.id);
          activityConflictItems.tags.add(tag.id);
        }
      }
      for (const cohort of activity.cohorts || []) {
        if (!allowedCohorts.has(cohort.cohortId)) {
          activityConflictActivities.cohorts.add(activity.id);
          activityConflictItems.cohorts.add(cohort.cohortId);
        }
      }
    }

    const projectConflictProjects = new Set<string>();
    const projectConflictItems = new Set<string>();
    for (const project of projects) {
      const orgId = project.orgId ?? null;
      if (!orgId || !subtreeSet.has(orgId)) continue;
      const allowedCategories = new Set((afterCategoriesByOrg.get(orgId) || []).map((item) => item.id));
      for (const category of project.categories || []) {
        if (!allowedCategories.has(category.id)) {
          projectConflictProjects.add(project.id);
          projectConflictItems.add(category.id);
        }
      }
    }

    return {
      currentParentId: current.parentId ?? null,
      newParentId,
      affectedOrgs: subtreeIds.length,
      requiresConfirmation:
        lostCategoryIds.size > 0 ||
        gainedCategoryIds.size > 0 ||
        lostTagIds.size > 0 ||
        gainedTagIds.size > 0 ||
        lostCohortIds.size > 0 ||
        gainedCohortIds.size > 0 ||
        activityConflictActivities.categories.size > 0 ||
        activityConflictActivities.tags.size > 0 ||
        activityConflictActivities.cohorts.size > 0 ||
        projectConflictProjects.size > 0,
      resetNotice: 'Die Vererbungsregeln der verschobenen Organisation werden auf Standard zurückgesetzt.',
      lost: {
        categories: this.toMoveImpactItems(categoryItems.filter((item) => lostCategoryIds.has(item.id)), currentMap),
        tags: this.toMoveImpactItems(tagItems.filter((item) => lostTagIds.has(item.id)), currentMap),
        cohorts: this.toMoveImpactItems(cohortItems.filter((item) => lostCohortIds.has(item.id)), currentMap),
      },
      gained: {
        categories: this.toMoveImpactItems(categoryItems.filter((item) => gainedCategoryIds.has(item.id)), currentMap),
        tags: this.toMoveImpactItems(tagItems.filter((item) => gainedTagIds.has(item.id)), currentMap),
        cohorts: this.toMoveImpactItems(cohortItems.filter((item) => gainedCohortIds.has(item.id)), currentMap),
      },
      activityConflicts: {
        categories: {
          activities: activityConflictActivities.categories.size,
          items: this.toMoveImpactItems(categoryItems.filter((item) => activityConflictItems.categories.has(item.id)), currentMap),
        },
        tags: {
          activities: activityConflictActivities.tags.size,
          items: this.toMoveImpactItems(tagItems.filter((item) => activityConflictItems.tags.has(item.id)), currentMap),
        },
        cohorts: {
          activities: activityConflictActivities.cohorts.size,
          items: this.toMoveImpactItems(cohortItems.filter((item) => activityConflictItems.cohorts.has(item.id)), currentMap),
        },
      },
      projectConflicts: {
        categories: {
          projects: projectConflictProjects.size,
          items: this.toMoveImpactItems(categoryItems.filter((item) => projectConflictItems.has(item.id)), currentMap),
        },
      },
    };
  }

  async moveOrg(id: string, newParentId: string | null, force: boolean = false) {
    const preview = await this.previewMoveOrg(id, newParentId);
    if (preview.requiresConfirmation && !force) {
      throw new BadRequestException({
        message: 'Verschieben erfordert Bestätigung',
        code: 'ORG_MOVE_REQUIRES_CONFIRMATION',
        preview,
      });
    }

    const org = await this.repo.findOne({ where: { id } });
    if (!org) return null;
    const parent = newParentId ? await this.repo.findOne({ where: { id: newParentId } }) : null;
    const oldPath = org.path || org.id;
    org.parentId = parent?.id ?? null;
    org.taxonomySettings = null;
    await this.repo.save(org);

    const newPath = parent?.path ? `${parent.path}/${org.id}` : org.id;
    await this.repo.update({ id: org.id }, { path: newPath, taxonomySettings: null });
    for (const child of await this.repo.find()) {
      if (child.id === org.id) continue;
      const path = child.path || child.id;
      if (path.startsWith(`${oldPath}/`)) {
        const suffix = path.substring(oldPath.length + 1);
        await this.repo.update({ id: child.id }, { path: `${newPath}/${suffix}` });
      }
    }
    this.clearSubtreeCache();
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Remove an organization if it has no child organizations.
   * Returns true if removed, false if blocked (e.g., has children or not found).
   */
  async removeOrg(id: string): Promise<boolean> {
    const org = await this.repo.findOne({ where: { id } });
    if (!org) return false;
    const all = await this.repo.find();
    const path = org.path || org.id;
    const hasChildren = all.some(o => (o.path || o.id).startsWith(path + '/') );
    if (hasChildren) return false;
    await this.repo.delete({ id });
    this.clearSubtreeCache();
    return true;
  }

  async getOpeningHours(id: string): Promise<OpeningHours | null> {
    const org = await this.repo.findOne({ where: { id } });
    return org?.openingHours || null;
  }

  async updateOpeningHours(id: string, openingHours: OpeningHours): Promise<OpeningHours | null> {
    await this.repo.update({ id }, { openingHours });
    const org = await this.repo.findOne({ where: { id } });
    return org?.openingHours || null;
  }
}
