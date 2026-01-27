import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { OrgsService } from '../orgs/orgs.service';

/**
 * OrgScopeGuard inspects the X-Org-Scope header and computes request.effectiveOrgId
 * which is then used by controllers/services to filter data.
 *
 * Semantics:
 * - Superadmin:
 *   - Header absent -> effectiveOrgId = null (no-org)  (global scope intentionally disabled)
 *   - Header 'null' or empty -> effectiveOrgId = null
 *   - Header '<uuid>' -> effectiveOrgId = that uuid (no subtree validation here)
 * - org_admin / user:
 *   - If user.orgId is null:
 *       - Header must be absent, empty or 'null' -> effectiveOrgId = null
 *       - Otherwise -> 403
 *   - If user.orgId is set:
 *       - Header absent -> effectiveOrgId = user.orgId (default to own org)
 *       - Header 'null' or empty -> 403 (cannot scope outside subtree)
 *       - Header '<uuid>' -> must be within subtree of user's org -> effectiveOrgId = uuid else 403
 */
@Injectable()
export class OrgScopeGuard implements CanActivate {
  constructor(private readonly orgs: OrgsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as {
      headers: Record<string, unknown>;
      user?: { role?: string; orgId?: string | null };
      effectiveOrgId?: string | null | undefined;
    };

    const user = request.user;
    if (!user) return true; // let JWT guard handle auth; this guard is a no-op without user

    const raw = request.headers['x-org-scope'];
    const value = Array.isArray(raw) ? String(raw[0] ?? '').trim() : (typeof raw === 'string' ? raw.trim() : undefined);

    const parseHeader = (v: string | undefined): string | null | undefined => {
      if (typeof v === 'undefined') return undefined;
      if (v === '' || v.toLowerCase() === 'null') return null;
      return v;
    };

    const requested = parseHeader(value);

    if (user.role === 'superadmin') {
      // Superadmin can scope arbitrarily; but global (undefined) is intentionally disabled.
      // If no header is set, default to null (no-org) to avoid cross-tenant data aggregation.
      request.effectiveOrgId = (typeof requested === 'undefined') ? null : requested;
      return true;
    }

    const myOrgId = user.orgId ?? null;
    if (myOrgId === null) {
      // Only null scope allowed
      if (typeof requested === 'undefined' || requested === null) {
        request.effectiveOrgId = null;
        return true;
      }
      throw new ForbiddenException('Nicht erlaubt (Org-Scope)');
    }

    // User has an org; default to own org when header missing
    if (typeof requested === 'undefined') {
      request.effectiveOrgId = myOrgId;
      return true;
    }
    if (requested === null) {
      throw new ForbiddenException('Nicht erlaubt (Org-Scope)');
    }
    // Validate requested is within subtree of myOrgId
    const subtree = await this.orgs.getSubtreeOrgIds(myOrgId);
    if (subtree.includes(requested)) {
      request.effectiveOrgId = requested;
      return true;
    }
    throw new ForbiddenException('Nicht erlaubt (Org-Scope)');
  }
}
