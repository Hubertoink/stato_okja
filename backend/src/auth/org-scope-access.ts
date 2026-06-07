import { ForbiddenException } from '@nestjs/common';

export type OrgScopedUser = {
  role: string;
  orgId?: string | null;
  effectiveOrgId?: string | null | undefined;
};

export type OrgScopedEntity = {
  orgId?: string | null;
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
