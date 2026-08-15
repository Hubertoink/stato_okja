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
 * - Tenant users:
 *   - The selected organization must be an active membership of the user.
 *   - Header absent -> first/default active membership is selected.
 *   - Header empty, null or a foreign organization -> 403.
 *   - The role on request.user is replaced by the role of that membership.
 */
@Injectable()
export class OrgScopeGuard implements CanActivate {
  constructor(private readonly orgs: OrgsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as {
      headers: Record<string, unknown>;
      user?: { id?: string; role?: string; orgId?: string | null };
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

    if (!user.id) throw new ForbiddenException('Nicht erlaubt (Org-Scope)');

    const memberships = await this.orgs.listActiveMemberships(user.id);
    const selectedOrgId =
      typeof requested === 'undefined'
        ? memberships.find((membership) => membership.orgId === user.orgId)?.orgId ?? memberships[0]?.orgId
        : requested;
    if (!selectedOrgId) throw new ForbiddenException('Keine aktive Organisationsmitgliedschaft vorhanden');

    const membership = memberships.find((entry) => entry.orgId === selectedOrgId);
    if (!membership) throw new ForbiddenException('Nicht erlaubt (Org-Scope)');

    request.effectiveOrgId = membership.orgId;
    user.orgId = membership.orgId;
    user.role = membership.role;
    return true;
  }
}
