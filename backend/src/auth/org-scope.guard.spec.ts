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
  it('rejects a stored scope that is not an active membership', async () => {
    const orgs = {
      listActiveMemberships: jest.fn().mockResolvedValue([
        { orgId: 'new-org', role: 'editor' },
      ]),
    } as unknown as OrgsService;
    const guard = new OrgScopeGuard(orgs);
    const request: {
      headers: { 'x-org-scope': string };
      user: { id: string; role: string; orgId: string };
      effectiveOrgId?: string | null;
    } = {
      headers: { 'x-org-scope': 'old-org' },
      user: { id: 'user-1', role: 'user', orgId: 'new-org' },
    };

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still rejects null scope for users that must stay inside their org', async () => {
    const orgs = {
      listActiveMemberships: jest.fn().mockResolvedValue([{ orgId: 'own-org', role: 'org_admin' }]),
    } as unknown as OrgsService;
    const guard = new OrgScopeGuard(orgs);
    const request: {
      headers: { 'x-org-scope': string };
      user: { id: string; role: string; orgId: string };
      effectiveOrgId?: string | null;
    } = {
      headers: { 'x-org-scope': 'null' },
      user: { id: 'user-1', role: 'org_admin', orgId: 'own-org' },
    };

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('switches role and scope only to an explicitly assigned organization', async () => {
    const orgs = {
      listActiveMemberships: jest.fn().mockResolvedValue([
        { orgId: 'house-a', role: 'editor' },
        { orgId: 'house-b', role: 'org_admin' },
      ]),
    } as unknown as OrgsService;
    const guard = new OrgScopeGuard(orgs);
    const request: {
      headers: { 'x-org-scope': string };
      user: { id: string; role: string; orgId: string };
      effectiveOrgId?: string | null;
    } = {
      headers: { 'x-org-scope': 'house-b' },
      user: { id: 'user-1', role: 'editor', orgId: 'house-a' },
    };

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect(request.effectiveOrgId).toBe('house-b');
    expect(request.user).toMatchObject({ orgId: 'house-b', role: 'org_admin' });
  });
});
