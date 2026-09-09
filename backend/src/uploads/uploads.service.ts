import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Repository } from 'typeorm';
import { ProjectTemplate } from '../project-templates/entities/project-template.entity';
import { normalizeUploadPath } from '../common/upload-paths';
import { OrgsService } from '../orgs/orgs.service';
import { StoredUpload } from './stored-upload.entity';
import { User } from '../users/entities/user.entity';
import { LogbookEntry } from '../logbook/entities/logbook-entry.entity';
import { LogbookVisibility } from '../common/enums';

type UploadUser = { id: string; role: string };
type UploadKind = StoredUpload['kind'];

const DEFAULT_SCOPE_QUOTA_BYTES = 512 * 1024 * 1024;

function getScopeQuotaBytes() {
  const parsed = Number.parseInt(String(process.env.UPLOAD_SCOPE_QUOTA_BYTES || ''), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_SCOPE_QUOTA_BYTES;
}

@Injectable()
export class UploadsService {
  constructor(
    @InjectRepository(StoredUpload)
    private readonly uploads: Repository<StoredUpload>,
    private readonly orgs: OrgsService,
  ) {}

  async getWriteScopes(
    user: UploadUser,
    effectiveOrgId: string | null | undefined,
    variant?: string,
  ) {
    if (variant === 'avatar') {
      if (user.role === 'superadmin') return ['global'];
      const memberships = await this.orgs.listActiveMemberships(user.id);
      return Array.from(new Set([
        `user:${user.id}`,
        ...memberships.map((membership) => `org:${membership.orgId}`),
      ]));
    }
    if (typeof effectiveOrgId === 'string' && effectiveOrgId) {
      return [`org:${effectiveOrgId}`];
    }
    if (user.role === 'superadmin') return ['global'];
    throw new BadRequestException('Kein Organisationskontext für den Upload vorhanden.');
  }

  async assertCanRead(
    filename: string,
    kind: UploadKind,
    user: UploadUser,
    effectiveOrgId: string | null | undefined,
  ) {
    if (user.role === 'superadmin') {
      const exists = await this.uploads.existsBy({ filename, kind });
      if (exists) return;
      throw new NotFoundException();
    }

    const scopeKeys = [`user:${user.id}`];
    if (typeof effectiveOrgId === 'string' && effectiveOrgId) {
      scopeKeys.push(`org:${effectiveOrgId}`);
    }
    const exists = await this.uploads.exists({
      where: { filename, kind, scopeKey: In(scopeKeys) },
    });
    if (exists) return;
    if (kind === 'image') {
      if (effectiveOrgId && await this.canReadLogbookAvatar(filename, user, effectiveOrgId)) return;
      const ancestors = effectiveOrgId ? await this.orgs.getAncestorOrgIds(effectiveOrgId) : [];
      const templates = await this.uploads.manager.getRepository(ProjectTemplate).find({
        where: [
          { archived: false, orgId: IsNull() },
          ...(ancestors.length ? [{ archived: false, orgId: In(ancestors) }] : []),
        ],
      });
      for (const template of templates) {
        if (normalizeUploadPath(template.imageUrl) !== `/uploads/images/${filename}`) continue;
        if (await this.uploads.existsBy({
          filename, kind, scopeKey: template.orgId ? `org:${template.orgId}` : 'global',
        })) return;
      }
    }
    throw new NotFoundException();
  }

  private async canReadLogbookAvatar(filename: string, user: UploadUser, orgId: string): Promise<boolean> {
    // A global upload alone does not grant access. It must be a current
    // superadmin avatar referenced by an entry this reader is allowed to see.
    const authors = await this.uploads.manager.getRepository(User).find({
      where: { role: 'superadmin' },
      select: { id: true, avatarUrl: true },
    });
    const authorIds = authors
      .filter((author) => normalizeUploadPath(author.avatarUrl) === `/uploads/images/${filename}`)
      .map((author) => author.id);
    if (!authorIds.length) return false;
    if (!await this.uploads.existsBy({ filename, kind: 'image', scopeKey: 'global' })) return false;

    const entries = this.uploads.manager.getRepository(LogbookEntry)
      .createQueryBuilder('entry')
      .leftJoin('entry.comments', 'comment')
      .where('entry.orgId = :orgId', { orgId })
      .andWhere(new Brackets((reference) => {
        reference.where('entry.createdByUserId IN (:...authorIds)', { authorIds })
          .orWhere('comment.createdByUserId IN (:...authorIds)', { authorIds });
      }));
    // Match LogbookService's visibility rules, including author access.
    if (user.role !== 'org_admin') {
      entries.andWhere(new Brackets((visibility) => {
        visibility.where('entry.visibility = :teamVisibility', { teamVisibility: LogbookVisibility.TEAM })
          .orWhere('entry.createdByUserId = :readerId', { readerId: user.id });
      }));
    }
    return entries.getExists();
  }

  async retainProjectImage(imageUrl: string | null | undefined, orgId: string | null) {
    const normalized = normalizeUploadPath(imageUrl);
    const match = /^\/uploads\/images\/([a-z0-9][a-z0-9_.-]*)$/i.exec(normalized || '');
    if (!match) return;
    const filename = match[1];
    const scopeKey = orgId ? `org:${orgId}` : 'global';
    if (await this.uploads.existsBy({ filename, kind: 'image', scopeKey })) return;
    // Only an image already visible through an available template may be adopted.
    // A project URL supplied by the caller must never itself authorize the file.
    await this.assertCanRead(filename, 'image', { id: '', role: 'user' }, orgId);
    const source = await this.uploads.findOneByOrFail({ filename, kind: 'image' });
    await this.register(filename, 'image', Number(source.size), [scopeKey]);
  }

  async register(filename: string, kind: UploadKind, size: number, scopeKeys: string[]) {
    const reserve = async (repository: Repository<StoredUpload>) => {
      const missingScopes: string[] = [];
      for (const scopeKey of scopeKeys) {
        if (await repository.existsBy({ filename, kind, scopeKey })) continue;
        const usedBytes = Number(await repository.sum('size', { scopeKey }) || 0);
        if (usedBytes + size > getScopeQuotaBytes()) {
          throw new BadRequestException('Upload-Speicherlimit für diesen Bereich erreicht.');
        }
        missingScopes.push(scopeKey);
      }
      await repository.save(
        missingScopes.map((scopeKey) => repository.create({ filename, kind, size, scopeKey })),
      );
    };

    const databaseType = String(this.uploads.manager.dataSource.options.type).toLowerCase();
    if (databaseType !== 'postgres') {
      await reserve(this.uploads);
      return;
    }
    await this.uploads.manager.transaction(async (manager) => {
      for (const scopeKey of [...scopeKeys].sort()) {
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [`upload-quota:${scopeKey}`],
        );
      }
      await reserve(manager.getRepository(StoredUpload));
    });
  }

  async unregister(filename: string, kind: UploadKind) {
    await this.uploads.delete({ filename, kind });
  }
}
