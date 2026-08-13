import { ForbiddenException } from '@nestjs/common';

export type OrgScopedUser = {
  role: string;
  orgId?: string | null;
  effectiveOrgId?: string | null | undefined;
};

export type OrgScopedEntity = {
  orgId?: string | null;
};

export type ResolvedOrgScope = {
  /**
   * The selected organization. `null` represents the deliberately isolated
   * global/no-organization scope.
   */
  orgId: string | null;
  /**
   * The selected organization plus its descendants. This is only set for an
   * organization scope; global records never belong to an organization tree.
   */
  orgIds?: readonly string[];
};

/**
 * Minimal interface so domain services can share scope enforcement without
 * depending on the concrete OrgsService implementation.
 */
export type OrgScopeResolver = {
  getResolvedOrgScope(orgId: string | null): Promise<ResolvedOrgScope>;
};

export function resolveOrgScope(user: OrgScopedUser): string | null {
  if (user.role === 'superadmin') {
    return typeof user.effectiveOrgId === 'undefined' ? null : user.effectiveOrgId;
  }
  return typeof user.effectiveOrgId === 'undefined' ? (user.orgId || null) : user.effectiveOrgId;
}

export function canAccessOrgScopedEntity(entity: OrgScopedEntity, user: OrgScopedUser): boolean {
  return user.role === 'superadmin' || (entity.orgId ?? null) === (user.orgId ?? null);
}

export function assertOrgScopedEntityAccess(entity: OrgScopedEntity, user: OrgScopedUser): void {
  if (!canAccessOrgScopedEntity(entity, user)) {
    throw new ForbiddenException('Not allowed');
  }
}

/**
 * Enforces the request's effective organization scope. List endpoints use a
 * selected organization as the root of a subtree, so detail and mutation
 * endpoints must use the same rule instead of falling back to `user.orgId`.
 */
export function assertOrgScopedEntityAccessInScope(
  entity: OrgScopedEntity,
  scope: ResolvedOrgScope,
): void {
  const entityOrgId = entity.orgId ?? null;
  const allowed =
    scope.orgId === null
      ? entityOrgId === null
      : entityOrgId !== null && Array.isArray(scope.orgIds) && scope.orgIds.includes(entityOrgId);

  if (!allowed) {
    throw new ForbiddenException('Not allowed');
  }
}

/** Resolve and enforce the request scope in one place for detail/mutation APIs. */
export async function resolveOrgScopeForUser(
  resolver: OrgScopeResolver,
  user: OrgScopedUser,
): Promise<ResolvedOrgScope> {
  return resolver.getResolvedOrgScope(resolveOrgScope(user));
}

export async function assertOrgScopedEntityAccessForUser(
  entity: OrgScopedEntity,
  user: OrgScopedUser,
  resolver: OrgScopeResolver,
): Promise<void> {
  assertOrgScopedEntityAccessInScope(entity, await resolveOrgScopeForUser(resolver, user));
}

export function canAccessExactOrgScopedEntity(entity: OrgScopedEntity, user: OrgScopedUser): boolean {
  return (entity.orgId ?? null) === resolveOrgScope(user);
}

export function assertExactOrgScopedEntityAccess(entity: OrgScopedEntity, user: OrgScopedUser): void {
  if (!canAccessExactOrgScopedEntity(entity, user)) {
    throw new ForbiddenException('Not allowed');
  }
}

export function removeOrgIdForNonSuperadmin<T extends object>(data: T, user: OrgScopedUser): T {
  if (user.role === 'superadmin') return data;
  const sanitized = { ...data } as T & { orgId?: string | null };
  if ('orgId' in sanitized) delete sanitized.orgId;
  return sanitized;
}

export function preserveOrgIdForNonSuperadmin<T extends object>(
  data: T,
  user: OrgScopedUser,
  orgId: string | null,
): T & { orgId?: string | null } {
  if (user.role === 'superadmin') return data;
  return { ...data, orgId };
}
