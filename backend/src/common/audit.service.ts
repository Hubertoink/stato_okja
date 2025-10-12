import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditAction } from './enums';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

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

  async list(params: { orgId?: string | null; limit?: number }) {
    const where: Record<string, unknown> = {};
    if (typeof params.orgId !== 'undefined') Object.assign(where, { orgId: params.orgId });
    // Join organizations to fetch org name for UI without extra calls
    const qb = this.repo.createQueryBuilder('a')
      .leftJoin('organizations', 'o', 'o.id = a.orgId')
      .leftJoin('users', 'u', 'u.id = a.userId')
      .addSelect('o.name', 'orgName')
      .addSelect('u.name', 'userNameJoin')
      .where(where)
      .orderBy('a.createdAt', 'DESC')
      .take(Math.min(Math.max(params.limit || 50, 1), 100));
    const rows = await qb.getRawAndEntities();
    // Merge orgName into entities as extra property (not persisted)
    return rows.entities.map((e, idx) => ({
      ...e,
      orgName: (rows.raw[idx] as { orgName?: string }).orgName || null,
      userName: e.userName || (rows.raw[idx] as { userNameJoin?: string | null }).userNameJoin || e.userName || null,
    }));
  }
}
