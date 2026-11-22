import { ForbiddenException } from '@nestjs/common';
import {
  assertExactOrgScopedEntityAccess,
  preserveOrgIdForNonSuperadmin,
  removeOrgIdForNonSuperadmin,
  resolveOrgScope,
} from './org-scope-access';

describe('org-scope-access', () => {
  it('resolves superadmin undefined effective scope to null', () => {
    expect(resolveOrgScope({ role: 'superadmin', orgId: 'ignored' })).toBeNull();
  });

  it('resolves non-superadmin undefined effective scope to own org', () => {
    expect(resolveOrgScope({ role: 'admin', orgId: 'org-1' })).toBe('org-1');
  });

  it('uses effective scope when present', () => {
    expect(resolveOrgScope({ role: 'admin', orgId: 'org-1', effectiveOrgId: 'child-1' })).toBe('child-1');
    expect(resolveOrgScope({ role: 'superadmin', orgId: null, effectiveOrgId: 'org-2' })).toBe('org-2');
  });

  it('requires the selected organization for a member with multiple memberships', () => {
    const member = { role: 'editor', orgId: 'org-1', effectiveOrgId: 'org-2' };
    expect(() => assertExactOrgScopedEntityAccess({ orgId: 'org-2' }, member)).not.toThrow();
    expect(() =>
      assertExactOrgScopedEntityAccess({ orgId: 'org-1' }, member),
    ).toThrow(ForbiddenException);
  });

  it('requires exact effective org scope for a superadmin', () => {
    expect(() =>
      assertExactOrgScopedEntityAccess({ orgId: 'org-1' }, { role: 'superadmin', orgId: null, effectiveOrgId: 'org-1' }),
    ).not.toThrow();
    expect(() =>
      assertExactOrgScopedEntityAccess({ orgId: 'child-1' }, { role: 'superadmin', orgId: null, effectiveOrgId: 'org-1' }),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertExactOrgScopedEntityAccess({ orgId: 'org-1' }, { role: 'superadmin', orgId: null }),
    ).toThrow(ForbiddenException);
  });

  it('removes orgId from non-superadmin patches', () => {
    expect(removeOrgIdForNonSuperadmin({ name: 'A', orgId: 'org-2' }, { role: 'admin', orgId: 'org-1' })).toEqual({
      name: 'A',
    });
  });

  it('preserves existing orgId for non-superadmin activity patches', () => {
    expect(preserveOrgIdForNonSuperadmin({ title: 'A', orgId: 'org-2' }, { role: 'admin', orgId: 'org-1' }, 'org-1')).toEqual({
      title: 'A',
      orgId: 'org-1',
    });
  });
});
