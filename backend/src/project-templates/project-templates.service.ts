import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ProjectTemplate } from './entities/project-template.entity';
import { CreateProjectTemplateDto } from './dto/create-project-template.dto';
import { UpdateProjectTemplateDto } from './dto/update-project-template.dto';
import { normalizeUploadPath } from '../common/upload-paths';

@Injectable()
export class ProjectTemplatesService {
  constructor(
    @InjectRepository(ProjectTemplate) private readonly repo: Repository<ProjectTemplate>,
  ) {}

  private normalizeTemplateImage<T extends Pick<ProjectTemplate, 'imageUrl'>>(template: T): T {
    template.imageUrl = normalizeUploadPath(template.imageUrl);
    return template;
  }

  async listAvailable(orgId: string | null, ancestorOrgIds?: string[]) {
    const qb = this.repo.createQueryBuilder('t');
    qb.where('t.archived = false');

    if (typeof orgId === 'string' && ancestorOrgIds && ancestorOrgIds.length) {
      qb.andWhere('(t.orgId IN (:...orgIds) OR t.orgId IS NULL)', { orgIds: ancestorOrgIds });
      // Prefer templates closer to the current org
      qb.addOrderBy("CASE WHEN t.orgId = :currentOrgId THEN 0 ELSE 1 END", 'ASC')
        .setParameter('currentOrgId', orgId);
    } else {
      // null scope only sees null templates
      qb.andWhere('t.orgId IS NULL');
    }

    qb.addOrderBy('t.updatedAt', 'DESC');
    return qb.getMany().then((templates) => templates.map((template) => this.normalizeTemplateImage(template)));
  }

  async listOwned(orgId: string | null) {
    const where = orgId === null ? ({ orgId: IsNull() } as const) : ({ orgId } as const);
    return this.repo.find({
      where,
      order: { updatedAt: 'DESC' },
    }).then((templates) => templates.map((template) => this.normalizeTemplateImage(template)));
  }

  async createScoped(dto: CreateProjectTemplateDto, orgId: string | null) {
    const entity = this.repo.create({
      ...dto,
      imageUrl: normalizeUploadPath(dto.imageUrl),
      orgId,
      archived: !!dto.archived,
    });
    return this.repo.save(entity).then((template) => this.normalizeTemplateImage(template));
  }

  async updateScoped(id: string, dto: UpdateProjectTemplateDto, orgId: string | null) {
    const where = orgId === null ? ({ id, orgId: IsNull() } as const) : ({ id, orgId } as const);
    const existing = await this.repo.findOne({ where });
    if (!existing) return null;
    Object.assign(existing, {
      ...dto,
      ...(Object.prototype.hasOwnProperty.call(dto, 'imageUrl')
        ? { imageUrl: normalizeUploadPath(dto.imageUrl) }
        : {}),
    });
    return this.repo.save(existing).then((template) => this.normalizeTemplateImage(template));
  }

  async removeScoped(id: string, orgId: string | null) {
    const where = orgId === null ? ({ id, orgId: IsNull() } as const) : ({ id, orgId } as const);
    const existing = await this.repo.findOne({ where });
    if (!existing) return false;
    await this.repo.delete({ id });
    return true;
  }
}
