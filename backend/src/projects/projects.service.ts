import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere, Equal, IsNull } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectDocument } from './entities/project-document.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { AuditService } from '../common/audit.service';
import { AuditAction } from '../common/enums';
import { normalizeUploadPath } from '../common/upload-paths';
import { OrgsService } from '../orgs/orgs.service';
import { assertExactOrgScopedEntityAccess, removeOrgIdForNonSuperadmin, type OrgScopedUser } from '../auth/org-scope-access';

type ProjectWriteData = Partial<Project> & { categoryIds?: string[]; categoryId?: string | null };
type ProjectAuditUser = { id?: string; name?: string | null; orgId?: string | null };

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(ProjectDocument)
    private projectDocumentRepository: Repository<ProjectDocument>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  private withDocumentUrl(document: ProjectDocument): ProjectDocument {
    document.downloadUrl = `/projects/${document.projectId}/documents/${document.id}/download`;
    return document;
  }

  private normalizeProjectDocuments<T extends Pick<Project, 'documents'>>(project: T): T {
    if (Array.isArray(project.documents)) {
      project.documents = [...project.documents]
        .sort((left, right) => {
          const leftTime = new Date(left.createdAt).getTime();
          const rightTime = new Date(right.createdAt).getTime();
          return rightTime - leftTime;
        })
        .map((document) => this.withDocumentUrl(document));
    }
    return project;
  }

  private normalizeProjectImage<T extends Pick<Project, 'imageUrl'>>(project: T): T {
    project.imageUrl = normalizeUploadPath(project.imageUrl);
    return project;
  }

  private hydrateProject<T extends Project>(project: T): T {
    this.normalizeProjectImage(project);
    this.normalizeProjectDocuments(project);
    return project;
  }

  private normalizeClientRequestId(clientRequestId: unknown): string | null {
    return typeof clientRequestId === 'string' && clientRequestId.trim().length > 0
      ? clientRequestId.trim()
      : null;
  }

  private resolveSingleCategoryId(
    data: Partial<Project> & { categoryId?: string | null },
    categoryIds?: string[],
  ): string | null | undefined {
    let categoryId: string | null | undefined = data.categoryId ?? undefined;
    if (!categoryId && Array.isArray(categoryIds) && categoryIds.length) {
      categoryId = categoryIds[0] || null;
    }
    return categoryId;
  }

  private normalizeProjectWriteData(data: ProjectWriteData): ProjectWriteData {
    return {
      ...data,
      ...(Object.prototype.hasOwnProperty.call(data, 'imageUrl')
        ? { imageUrl: normalizeUploadPath(data.imageUrl) }
        : {}),
    };
  }

  private clearProjectCategory(project: Project) {
    project.categories = [];
    project.categoryId = null;
  }

  private async applyProjectCategory(
    project: Project,
    categoryId: string | null | undefined,
    options: { clearWhenEmpty?: boolean; clearWhenMissing?: boolean } = {},
  ) {
    if (typeof categoryId === 'string' && categoryId) {
      await this.orgs.assertTaxonomyIdsVisibleForOrg((project.orgId ?? null) as string | null, 'categories', [categoryId]);
      const category = await this.categoryRepository.findOne({ where: { id: categoryId } });
      if (category) {
        project.categories = [category];
        project.categoryId = category.id;
      } else if (options.clearWhenMissing) {
        this.clearProjectCategory(project);
      }
      return;
    }

    if (options.clearWhenEmpty) {
      this.clearProjectCategory(project);
    }
  }

  private isDuplicateClientRequestError(error: unknown, clientRequestId: string | null): boolean {
    return Boolean(
      clientRequestId &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === '23505',
    );
  }

  private async findByClientRequestId(clientRequestId: string, orgId: string | null): Promise<Project | null> {
    const existing = await this.projectRepository.findOne({
      where: {
        clientRequestId,
        orgId: orgId === null ? IsNull() : Equal(orgId),
      },
      relations: { documents: true },
    });
    return existing ? this.hydrateProject(existing) : null;
  }

  private async saveProjectIdempotently(
    project: Project,
    clientRequestId: string | null,
  ): Promise<{ project: Project; reusedExisting: boolean }> {
    try {
      return {
        project: await this.projectRepository.save(project),
        reusedExisting: false,
      };
    } catch (error) {
      if (clientRequestId && this.isDuplicateClientRequestError(error, clientRequestId)) {
        const existing = await this.findByClientRequestId(clientRequestId, project.orgId ?? null);
        if (existing) return { project: existing, reusedExisting: true };
      }

      throw error;
    }
  }

  findAll(search?: string, archived?: boolean, orgId?: string|null): Promise<Project[]> {
    const where: FindOptionsWhere<Project> = {};
    if (typeof archived === 'boolean') where.archived = archived;
    // Use ILike for case-insensitive search (PostgreSQL)
    if (search) (where as unknown as Record<string, unknown>).title = ILike(`%${search}%`);
    if (typeof orgId !== 'undefined') {
      Object.assign(where, { orgId: orgId === null ? IsNull() : Equal(orgId) });
    }
    return this.projectRepository
      .find({ where, order: { title: 'ASC' }, relations: { documents: true } })
      .then((projects) => projects.map((project) => this.hydrateProject(project)));
  }

  findOne(id: string): Promise<Project | null> {
    return this.projectRepository
      .findOne({ where: { id }, relations: { documents: true } })
      .then((project) => (project ? this.hydrateProject(project) : null));
  }

  async create(
    data: Partial<Project> & { categoryIds?: string[] },
    user?: ProjectAuditUser,
  ): Promise<Project> {
    const { categoryIds, ...rest } = data;
    const clientRequestId = this.normalizeClientRequestId(rest.clientRequestId);

    if (clientRequestId) {
      const existing = await this.findByClientRequestId(clientRequestId, rest.orgId ?? null);
      if (existing) return existing;
    }

    const project = this.projectRepository.create({
      ...rest,
      clientRequestId,
      imageUrl: normalizeUploadPath(rest.imageUrl),
    });

    const categoryId = this.resolveSingleCategoryId(rest, categoryIds);
    await this.applyProjectCategory(project, categoryId, {
      clearWhenEmpty: !categoryId && Array.isArray(categoryIds) && categoryIds.length > 0,
    });

    const saveResult = await this.saveProjectIdempotently(project, clientRequestId);
    let saved = saveResult.project;

    saved = this.hydrateProject(saved);
    if (!saveResult.reusedExisting) {
      await this.audit.log({ action: AuditAction.CREATE, entityType: 'project', entityId: saved.id, entityTitle: saved.title || null, orgId: saved.orgId ?? null, user });
    }
    return saved;
  }

  async update(id: string, data: Partial<Project> & { categoryIds?: string[] }): Promise<Project | null> {
    const { categoryIds, ...rest } = data as ProjectWriteData;
    const normalizedRest = this.normalizeProjectWriteData(rest);
    await this.projectRepository.update(id, normalizedRest);

    if (Object.prototype.hasOwnProperty.call(data, 'categoryId') || Array.isArray(categoryIds)) {
      const proj = await this.projectRepository.findOne({ where: { id } });
      if (proj) {
        const desiredId = this.resolveSingleCategoryId(data, categoryIds);
        await this.applyProjectCategory(proj, desiredId, {
          clearWhenEmpty: true,
          clearWhenMissing: true,
        });
        await this.projectRepository.save(proj);
      }
    }
    const updated = await this.findOne(id);
    if (updated) await this.audit.log({ action: AuditAction.UPDATE, entityType: 'project', entityId: updated.id, entityTitle: updated.title || null, orgId: updated.orgId ?? null });
    return updated ? this.hydrateProject(updated) : null;
  }

  async remove(
    id: string,
    user?: { id?: string; name?: string | null; orgId?: string | null },
  ): Promise<void> {
    const existing = await this.projectRepository.findOne({
      where: { id },
      relations: { documents: true },
    });
    await this.projectRepository.delete(id);
    await this.audit.log({
      action: AuditAction.DELETE,
      entityType: 'project',
      entityId: id,
      entityTitle: existing?.title || null,
      user,
      orgId: existing?.orgId ?? null,
    });

    if (existing?.documents?.length) {
      await Promise.all(
        existing.documents.map((document) => this.removeStoredDocument(document.storageRef)),
      );
    }
  }

  async archive(id: string, archived: boolean = true): Promise<Project | null> {
    await this.projectRepository.update(id, { archived });
    const p = await this.findOne(id);
    if (p) await this.audit.log({ action: AuditAction.UPDATE, entityType: 'project', entityId: p.id, entityTitle: p.title || null, orgId: p.orgId ?? null, details: { archived } });
    return p ? this.hydrateProject(p) : null;
  }

  async findOneScoped(id: string, user: OrgScopedUser) {
    const p = await this.findOne(id);
    if (!p) return null;
    assertExactOrgScopedEntityAccess(p, user);
    return p;
  }

  private async getProjectForDocumentScope(projectId: string, user: OrgScopedUser) {
    const project = await this.findOneScoped(projectId, user);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async removeStoredDocument(storageRef?: string | null) {
    if (!storageRef) return;
    const normalized = String(storageRef).replace(/\\/g, '/').trim();
    if (!normalized || normalized.includes('..')) return;

    const { unlink } = await import('fs/promises');
    const { join } = await import('path');
    const absolutePath = join(process.cwd(), 'uploads', normalized);
    try {
      await unlink(absolutePath);
    } catch {
      // File may already be gone; removing the DB reference is still the important part.
    }
  }

  async addDocument(
    projectId: string,
    document: Pick<ProjectDocument, 'filename' | 'mimeType' | 'size' | 'storageRef'>,
    user: OrgScopedUser & { id?: string; name?: string | null },
  ): Promise<ProjectDocument> {
    const project = await this.getProjectForDocumentScope(projectId, user);
    const created = await this.projectDocumentRepository.save(
      this.projectDocumentRepository.create({
        projectId: project.id,
        filename: document.filename,
        mimeType: document.mimeType,
        size: document.size,
        storageRef: document.storageRef,
      }),
    );

    await this.audit.log({
      action: AuditAction.UPDATE,
      entityType: 'project',
      entityId: project.id,
      entityTitle: project.title || null,
      orgId: project.orgId ?? null,
      user,
      details: {
        documentAdded: {
          id: created.id,
          filename: created.filename,
          size: created.size,
        },
      },
    });

    return this.withDocumentUrl(created);
  }

  async removeDocument(
    projectId: string,
    documentId: string,
    user: OrgScopedUser & { id?: string; name?: string | null },
  ): Promise<void> {
    const project = await this.getProjectForDocumentScope(projectId, user);
    const existing = await this.projectDocumentRepository.findOne({
      where: { id: documentId, projectId: project.id },
    });
    if (!existing) throw new NotFoundException('Document not found');

    await this.projectDocumentRepository.delete({ id: existing.id, projectId: project.id });
    await this.removeStoredDocument(existing.storageRef);

    await this.audit.log({
      action: AuditAction.UPDATE,
      entityType: 'project',
      entityId: project.id,
      entityTitle: project.title || null,
      orgId: project.orgId ?? null,
      user,
      details: {
        documentRemoved: {
          id: existing.id,
          filename: existing.filename,
        },
      },
    });
  }

  async getDocumentScoped(
    projectId: string,
    documentId: string,
    user: OrgScopedUser,
  ): Promise<ProjectDocument> {
    const project = await this.getProjectForDocumentScope(projectId, user);
    const document = await this.projectDocumentRepository.findOne({
      where: { id: documentId, projectId: project.id },
    });
    if (!document) throw new NotFoundException('Document not found');
    return this.withDocumentUrl(document);
  }

  async updateScoped(id: string, data: Partial<Project>, user: OrgScopedUser & { id?: string }) {
    const existing = await this.projectRepository.findOne({ where: { id } });
    if (!existing) return null;
    assertExactOrgScopedEntityAccess(existing, user);
    const sanitized = removeOrgIdForNonSuperadmin(data, user);
    const updated = await this.update(id, sanitized);
    if (updated) await this.audit.log({ action: AuditAction.UPDATE, entityType: 'project', entityId: updated.id, entityTitle: updated.title || null, orgId: updated.orgId ?? null, details: { scoped: true }, user });
    return updated;
  }

  async removeScoped(id: string, user: OrgScopedUser & { id?: string }) {
    const existing = await this.projectRepository.findOne({ where: { id } });
    if (!existing) return;
    assertExactOrgScopedEntityAccess(existing, user);
    await this.remove(id, user);
  }

  async archiveScoped(id: string, archived: boolean, user: OrgScopedUser & { id?: string }) {
    const existing = await this.projectRepository.findOne({ where: { id } });
    if (!existing) return null;
    assertExactOrgScopedEntityAccess(existing, user);
    const p = await this.archive(id, archived);
    if (p) await this.audit.log({ action: AuditAction.UPDATE, entityType: 'project', entityId: p.id, entityTitle: p.title || null, orgId: p.orgId ?? null, details: { archived }, user });
    return p;
  }
}
