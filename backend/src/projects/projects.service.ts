import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere, Equal, IsNull, In } from 'typeorm';
import { Project } from './entities/project.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { AuditService } from '../common/audit.service';
import { AuditAction } from '../common/enums';
import { normalizeUploadPath } from '../common/upload-paths';
import { OrgsService } from '../orgs/orgs.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  private normalizeProjectImage<T extends Pick<Project, 'imageUrl'>>(project: T): T {
    project.imageUrl = normalizeUploadPath(project.imageUrl);
    return project;
  }

  findAll(search?: string, archived?: boolean, orgId?: string|null, orgIds?: string[]): Promise<Project[]> {
    const where: FindOptionsWhere<Project> = {};
    if (typeof archived === 'boolean') where.archived = archived;
    // Use ILike for case-insensitive search (PostgreSQL)
    if (search) (where as unknown as Record<string, unknown>).title = ILike(`%${search}%`);
    if (Array.isArray(orgIds) && orgIds.length) {
      Object.assign(where, { orgId: In(orgIds) });
    } else if (typeof orgId !== 'undefined') {
      Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    }
    return this.projectRepository.find({ where, order: { title: 'ASC' } }).then((projects) =>
      projects.map((project) => this.normalizeProjectImage(project)),
    );
  }

  findOne(id: string): Promise<Project | null> {
    return this.projectRepository.findOne({ where: { id } }).then((project) =>
      project ? this.normalizeProjectImage(project) : null,
    );
  }

  async create(
    data: Partial<Project> & { categoryIds?: string[] },
    user?: { id?: string; name?: string | null; orgId?: string | null },
  ): Promise<Project> {
    const { categoryIds, ...rest } = data;
    const clientRequestId =
      typeof rest.clientRequestId === 'string' && rest.clientRequestId.trim().length > 0
        ? rest.clientRequestId.trim()
        : null;

    if (clientRequestId) {
      const existing = await this.projectRepository.findOne({ where: { clientRequestId } });
      if (existing) return this.normalizeProjectImage(existing);
    }

    const project = this.projectRepository.create({
      ...rest,
      clientRequestId,
      imageUrl: normalizeUploadPath(rest.imageUrl),
    });
    // Enforce single category: prefer explicit categoryId, else take the first from categoryIds for backward compatibility
    let singleCategoryId: string | undefined | null = (rest as Partial<Project> & { categoryId?: string | null }).categoryId ?? undefined;
    if (!singleCategoryId && Array.isArray(categoryIds) && categoryIds.length) {
      singleCategoryId = categoryIds[0];
    }
    if (singleCategoryId) {
      await this.orgs.assertTaxonomyIdsVisibleForOrg((project.orgId ?? null) as string | null, 'categories', [singleCategoryId]);
      const cat = await this.categoryRepository.findOne({ where: { id: singleCategoryId } });
      if (cat) {
        project.categories = [cat];
        // Ensure column is in sync
        (project as Partial<Project> & { categoryId?: string | null }).categoryId = cat.id;
      }
    } else if (Array.isArray(categoryIds) && categoryIds.length) {
      // If provided but invalid, clear relation
      project.categories = [];
      (project as Partial<Project> & { categoryId?: string | null }).categoryId = null;
    }
    let saved: Project;
    try {
      saved = await this.projectRepository.save(project);
    } catch (error) {
      const isClientRequestDuplicate =
        clientRequestId &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === '23505';

      if (isClientRequestDuplicate) {
        const existing = await this.projectRepository.findOne({ where: { clientRequestId } });
        if (existing) return this.normalizeProjectImage(existing);
      }

      throw error;
    }

    saved = this.normalizeProjectImage(saved);
    await this.audit.log({ action: AuditAction.CREATE, entityType: 'project', entityId: saved.id, entityTitle: saved.title || null, orgId: saved.orgId ?? null, user });
    return saved;
  }

  async update(id: string, data: Partial<Project> & { categoryIds?: string[] }): Promise<Project | null> {
    const { categoryIds, ...rest } = data as Partial<Project> & { categoryIds?: string[] };
    const normalizedRest = {
      ...rest,
      ...(Object.prototype.hasOwnProperty.call(rest, 'imageUrl')
        ? { imageUrl: normalizeUploadPath(rest.imageUrl) }
        : {}),
    };
    await this.projectRepository.update(id, normalizedRest);
    // Handle category mapping when either categoryId or legacy categoryIds are present
    if (Object.prototype.hasOwnProperty.call(data, 'categoryId') || Array.isArray(categoryIds)) {
      const proj = await this.projectRepository.findOne({ where: { id } });
      if (proj) {
        // Determine desired single category
        let desiredId: string | null | undefined = (data as Partial<Project> & { categoryId?: string | null }).categoryId;
        if ((desiredId === undefined || desiredId === null || desiredId === '') && Array.isArray(categoryIds) && categoryIds.length) {
          desiredId = categoryIds[0] || null;
        }
        if (typeof desiredId === 'string' && desiredId) {
          await this.orgs.assertTaxonomyIdsVisibleForOrg((proj.orgId ?? null) as string | null, 'categories', [desiredId]);
          const cat = await this.categoryRepository.findOne({ where: { id: desiredId } });
          if (cat) {
            proj.categories = [cat];
            proj.categoryId = cat.id;
          } else {
            proj.categories = [];
            proj.categoryId = null;
          }
        } else {
          // Clear category when null/empty
          proj.categories = [];
          proj.categoryId = null;
        }
        await this.projectRepository.save(proj);
      }
    }
    const updated = await this.findOne(id);
    if (updated) await this.audit.log({ action: AuditAction.UPDATE, entityType: 'project', entityId: updated.id, entityTitle: updated.title || null, orgId: updated.orgId ?? null });
    return updated ? this.normalizeProjectImage(updated) : null;
  }

  async remove(
    id: string,
    user?: { id?: string; name?: string | null; orgId?: string | null },
  ): Promise<void> {
    const existing = await this.projectRepository.findOne({ where: { id } });
    await this.projectRepository.delete(id);
    await this.audit.log({
      action: AuditAction.DELETE,
      entityType: 'project',
      entityId: id,
      entityTitle: existing?.title || null,
      user,
      orgId: existing?.orgId ?? null,
    });
  }

  async archive(id: string, archived: boolean = true): Promise<Project | null> {
    await this.projectRepository.update(id, { archived });
    const p = await this.findOne(id);
    if (p) await this.audit.log({ action: AuditAction.UPDATE, entityType: 'project', entityId: p.id, entityTitle: p.title || null, orgId: p.orgId ?? null, details: { archived } });
    return p ? this.normalizeProjectImage(p) : null;
  }

  async findOneScoped(id: string, user: { role: string; orgId?: string|null }) {
    const p = await this.findOne(id);
    if (!p) return null;
    if (user.role !== 'superadmin' && (p.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    return p;
  }

  async updateScoped(id: string, data: Partial<Project>, user: { id?: string; role: string; orgId?: string|null }) {
    const existing = await this.projectRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    // prevent moving orgId unless superadmin
    if (user.role !== 'superadmin') {
      const d = data as Partial<Project> & { orgId?: string | null };
      if ('orgId' in d) delete d.orgId;
    }
    const updated = await this.update(id, data);
    if (updated) await this.audit.log({ action: AuditAction.UPDATE, entityType: 'project', entityId: updated.id, entityTitle: updated.title || null, orgId: updated.orgId ?? null, details: { scoped: true }, user });
    return updated;
  }

  async removeScoped(id: string, user: { id?: string; role: string; orgId?: string|null }) {
    const existing = await this.projectRepository.findOne({ where: { id } });
    if (!existing) return;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    await this.remove(id, user);
  }

  async archiveScoped(id: string, archived: boolean, user: { id?: string; role: string; orgId?: string|null }) {
    const existing = await this.projectRepository.findOne({ where: { id } });
    if (!existing) return null;
    if (user.role !== 'superadmin' && (existing.orgId ?? null) !== (user.orgId ?? null)) throw new ForbiddenException('Not allowed');
    const p = await this.archive(id, archived);
    if (p) await this.audit.log({ action: AuditAction.UPDATE, entityType: 'project', entityId: p.id, entityTitle: p.title || null, orgId: p.orgId ?? null, details: { archived }, user });
    return p;
  }
}
