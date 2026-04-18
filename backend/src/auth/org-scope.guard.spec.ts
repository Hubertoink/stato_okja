import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { OrgScopeGuard } from './org-scope.guard';
import { OrgsService } from '../orgs/orgs.service';

function createExecutionContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
  } as ExecutionContext;
}

describe('OrgScopeGuard', () => {
  it('falls back to the current org when a stored scope becomes stale', async () => {
    const orgs = {
      getSubtreeOrgIds: jest.fn().mockResolvedValue(['new-org', 'child-org']),
    } as unknown as OrgsService;
    const guard = new OrgScopeGuard(orgs);
    const request: {
      headers: { 'x-org-scope': string };
      user: { role: string; orgId: string };
      effectiveOrgId?: string | null;
    } = {
      headers: { 'x-org-scope': 'old-org' },
      user: { role: 'user', orgId: 'new-org' },
    };

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect(request.effectiveOrgId).toBe('new-org');
  });

  it('still rejects null scope for users that must stay inside their org', async () => {
    const orgs = {
      getSubtreeOrgIds: jest.fn(),
    } as unknown as OrgsService;
    const guard = new OrgScopeGuard(orgs);
    const request: {
      headers: { 'x-org-scope': string };
      user: { role: string; orgId: string };
      effectiveOrgId?: string | null;
    } = {
      headers: { 'x-org-scope': 'null' },
      user: { role: 'org_admin', orgId: 'own-org' },
    };

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(ForbiddenException);
  });
});