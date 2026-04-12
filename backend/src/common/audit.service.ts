import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { join, basename } from 'path';
import { statSync } from 'fs';
import { AuditLog } from './entities/audit-log.entity';
import { AuditAction } from './enums';
import { User } from '../users/entities/user.entity';
import { Organization } from '../orgs/entities/organization.entity';
import { Activity } from '../activities/entities/activity.entity';
import { Project } from '../projects/entities/project.entity';
import { Attachment } from '../activities/entities/attachment.entity';
import { normalizeUploadPath } from './upload-paths';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Attachment) private readonly attachments: Repository<Attachment>,
  ) {}

  async log(entry: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    entityTitle?: string | null;
    user?: { id?: string; name?: string | null; orgId?: string | null };
    diff?: Record<string, unknown> | null;
    details?: Record<string, unknown> | null;
    orgId?: string | null;
  }) {
    const e = this.repo.create({
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityTitle: entry.entityTitle ?? null,
      userId: entry.user?.id ?? null,
      userName: entry.user?.name ?? null,
      orgId: typeof entry.orgId !== 'undefined' ? entry.orgId ?? null : (entry.user?.orgId ?? null),
      diff: entry.diff ?? null,
      details: entry.details ?? null,
    });
    await this.repo.save(e);
    return e;
  }

  async list(params: { orgId?: string | null; orgIds?: string[]; limit?: number }) {
    // Join organizations to fetch org name for UI without extra calls
    const qb = this.repo.createQueryBuilder('a')
      .leftJoin('organizations', 'o', 'o.id = a.orgId')
      .leftJoin('users', 'u', 'u.id = a.userId')
      .addSelect('o.name', 'orgName')
      .addSelect('u.name', 'userNameJoin')
      .orderBy('a.createdAt', 'DESC')
      .take(Math.min(Math.max(params.limit || 50, 1), 100));

    if (Array.isArray(params.orgIds) && params.orgIds.length > 0) {
      qb.where('a.orgId IN (:...orgIds)', { orgIds: params.orgIds });
    } else if (typeof params.orgId !== 'undefined') {
      if (params.orgId === null) {
        qb.where('a.orgId IS NULL');
      } else {
        qb.where('a.orgId = :orgId', { orgId: params.orgId });
      }
    }

    const rows = await qb.getRawAndEntities();
    // Merge orgName into entities as extra property (not persisted)
    return rows.entities.map((e, idx) => ({
      ...e,
      orgName: (rows.raw[idx] as { orgName?: string }).orgName || null,
      userName: e.userName || (rows.raw[idx] as { userNameJoin?: string | null }).userNameJoin || e.userName || null,
    }));
  }

  async metrics(params?: { orgLimit?: number }) {
    const orgLimit = Math.min(Math.max(params?.orgLimit ?? 200, 1), 500);
    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const from7 = daysAgo(7);
    const from30 = daysAgo(30);

    const [totalUsers, totalOrgs, totalActivities, totalProjects] = await Promise.all([
      this.users.count(),
      this.orgs.count(),
      this.activities.count(),
      this.projects.count(),
    ]);

    const loginsLast7Days = await this.repo
      .createQueryBuilder('a')
      .where('a.action = :action', { action: AuditAction.LOGIN })
      .andWhere('a.createdAt >= :from', { from: from7 })
      .getCount();

    const activeUsersLast30DaysRaw = await this.repo
      .createQueryBuilder('a')
      .select('COUNT(DISTINCT a.userId)', 'cnt')
      .where('a.action = :action', { action: AuditAction.LOGIN })
      .andWhere('a.userId IS NOT NULL')
      .andWhere('a.createdAt >= :from', { from: from30 })
      .getRawOne<{ cnt: string }>();

    const activeUsersLast30Days = parseInt(activeUsersLast30DaysRaw?.cnt || '0', 10) || 0;

    // Per-org aggregates
    const orgs = await this.orgs
      .createQueryBuilder('o')
      .select(['o.id AS id', 'o.name AS name'])
      .orderBy('o.name', 'ASC')
      .take(orgLimit)
      .getRawMany<{ id: string; name: string }>();

    const userCounts = await this.users
      .createQueryBuilder('u')
      .select('u.orgId', 'orgId')
      .addSelect('COUNT(*)', 'cnt')
      .where('u.orgId IS NOT NULL')
      .groupBy('u.orgId')
      .getRawMany<{ orgId: string; cnt: string }>();

    const activityCounts = await this.activities
      .createQueryBuilder('a')
      .select('a.orgId', 'orgId')
      .addSelect('COUNT(*)', 'cnt')
      .where('a.orgId IS NOT NULL')
      .groupBy('a.orgId')
      .getRawMany<{ orgId: string; cnt: string }>();

    const projectCounts = await this.projects
      .createQueryBuilder('p')
      .select('p.orgId', 'orgId')
      .addSelect('COUNT(*)', 'cnt')
      .where('p.orgId IS NOT NULL')
      .groupBy('p.orgId')
      .getRawMany<{ orgId: string; cnt: string }>();

    const attachmentAgg = await this.attachments
      .createQueryBuilder('att')
      .innerJoin('activities', 'act', 'act.id = att.activityId')
      .select('act.orgId', 'orgId')
      .addSelect('COUNT(*)', 'cnt')
      .addSelect('COALESCE(SUM(att.size), 0)', 'bytes')
      .where('act.orgId IS NOT NULL')
      .groupBy('act.orgId')
      .getRawMany<{ orgId: string; cnt: string; bytes: string }>();

    // Project images storage (imageSize column)
    const projectImageAgg = await this.projects
      .createQueryBuilder('p')
      .select('p.orgId', 'orgId')
      .addSelect('COUNT(CASE WHEN p.imageUrl IS NOT NULL AND p.imageUrl != \'\' THEN 1 END)', 'cnt')
      .addSelect('COALESCE(SUM(p.imageSize), 0)', 'bytes')
      .where('p.orgId IS NOT NULL')
      .groupBy('p.orgId')
      .getRawMany<{ orgId: string; cnt: string; bytes: string }>();

    // Backfill-at-read-time: older projects may have imageUrl but NULL imageSize.
    // We derive file sizes from the local uploads directory for those rows.
    const projectImagesNeedingSize = await this.projects
      .createQueryBuilder('p')
      .select('p.orgId', 'orgId')
      .addSelect('p.imageUrl', 'imageUrl')
      .where('p.orgId IS NOT NULL')
      .andWhere('p.imageUrl IS NOT NULL')
      .andWhere("p.imageUrl != ''")
      .andWhere('p.imageSize IS NULL')
      .getRawMany<{ orgId: string; imageUrl: string }>();

    const uploadsPrefix = '/uploads/images/';
    const uploadsDir = join(process.cwd(), 'uploads', 'images');
    const projectImageFsBytesByOrg = new Map<string, number>();
    for (const r of projectImagesNeedingSize) {
      const normalizedUrl = normalizeUploadPath(r.imageUrl);
      if (!normalizedUrl || !normalizedUrl.startsWith(uploadsPrefix)) continue;
      const filename = basename(normalizedUrl);
      try {
        const size = statSync(join(uploadsDir, filename)).size;
        projectImageFsBytesByOrg.set(r.orgId, (projectImageFsBytesByOrg.get(r.orgId) ?? 0) + size);
      } catch {
        // ignore missing/invalid files
      }
    }

    const toNumMap = <T extends { orgId: string; cnt?: string; bytes?: string }>(rows: T[], field: 'cnt' | 'bytes') => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(r.orgId, parseInt((r as any)[field] || '0', 10) || 0);
      return m;
    };

    const usersByOrg = toNumMap(userCounts, 'cnt');
    const activitiesByOrg = toNumMap(activityCounts, 'cnt');
    const projectsByOrg = toNumMap(projectCounts, 'cnt');
    const attachmentsByOrg = toNumMap(attachmentAgg, 'cnt');
    const attachmentBytesByOrg = toNumMap(attachmentAgg, 'bytes');
    const projectImagesByOrg = toNumMap(projectImageAgg, 'cnt');
    const projectImageBytesByOrg = toNumMap(projectImageAgg, 'bytes');

    // Top users by logins (30 days)
    const topUsersRaw = await this.repo
      .createQueryBuilder('a')
      .innerJoin('users', 'u', 'u.id = a.userId')
      .select('u.id', 'id')
      .addSelect('u.name', 'name')
      .addSelect('u.email', 'email')
      .addSelect('u.role', 'role')
      .addSelect('u.orgId', 'orgId')
      .addSelect('MAX(a.createdAt)', 'lastLoginAt')
      .addSelect('COUNT(*)', 'loginCount30d')
      .where('a.action = :action', { action: AuditAction.LOGIN })
      .andWhere('a.createdAt >= :from', { from: from30 })
      .groupBy('u.id')
      .addGroupBy('u.name')
      .addGroupBy('u.email')
      .addGroupBy('u.role')
      .addGroupBy('u.orgId')
      .orderBy('COUNT(*)', 'DESC')
      .take(20)
      .getRawMany<{
        id: string;
        name: string | null;
        email: string;
        role: string;
        orgId: string | null;
        lastLoginAt: string;
        loginCount30d: string;
      }>();

    const orgMetrics = orgs.map((o) => {
      const attBytes = attachmentBytesByOrg.get(o.id) ?? 0;
      const imgBytes = (projectImageBytesByOrg.get(o.id) ?? 0) + (projectImageFsBytesByOrg.get(o.id) ?? 0);
      const attCount = attachmentsByOrg.get(o.id) ?? 0;
      const imgCount = projectImagesByOrg.get(o.id) ?? 0;
      return {
        id: o.id,
        name: o.name,
        users: usersByOrg.get(o.id) ?? 0,
        activities: activitiesByOrg.get(o.id) ?? 0,
        projects: projectsByOrg.get(o.id) ?? 0,
        attachmentCount: attCount + imgCount,
        attachmentBytes: attBytes + imgBytes,
      };
    });

    // Sort by storage descending for quick “heavy orgs” view
    orgMetrics.sort((a, b) => (b.attachmentBytes - a.attachmentBytes) || (b.activities - a.activities));

    return {
      global: {
        totalUsers,
        totalOrgs,
        totalActivities,
        totalProjects,
        loginsLast7Days,
        activeUsersLast30Days,
      },
      orgs: orgMetrics,
      topUsers30d: topUsersRaw.map((u) => ({
        ...u,
        loginCount30d: parseInt(u.loginCount30d || '0', 10) || 0,
      })),
    };
  }
}
