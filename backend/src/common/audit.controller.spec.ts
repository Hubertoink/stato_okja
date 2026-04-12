import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { OrgsService } from '../orgs/orgs.service';

describe('AuditController scoped listing', () => {
  let controller: AuditController;

  const auditService: Pick<AuditService, 'list'> = {
    list: jest.fn(async () => []),
  };

  const orgsService: Pick<OrgsService, 'getSubtreeOrgIds'> = {
    getSubtreeOrgIds: jest.fn(async (id: string) => [id, 'child-org']),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        { provide: AuditService, useValue: auditService },
        { provide: OrgsService, useValue: orgsService },
      ],
    }).compile();

    controller = module.get(AuditController);
    jest.clearAllMocks();
  });

  it('uses subtree scope for an org admin in their own org', async () => {
    await controller.list(
      { user: { id: 'u-1', role: 'org_admin', orgId: 'org-1' }, effectiveOrgId: undefined },
      '25',
    );

    expect(orgsService.getSubtreeOrgIds).toHaveBeenCalledWith('org-1');
    expect(auditService.list).toHaveBeenCalledWith({
      orgId: undefined,
      orgIds: ['org-1', 'child-org'],
      limit: 25,
    });
  });

  it('uses explicit superadmin scope subtree when selected', async () => {
    await controller.list(
      { user: { id: 'u-2', role: 'superadmin', orgId: null }, effectiveOrgId: 'org-2' },
      undefined,
    );

    expect(orgsService.getSubtreeOrgIds).toHaveBeenCalledWith('org-2');
    expect(auditService.list).toHaveBeenCalledWith({
      orgId: undefined,
      orgIds: ['org-2', 'child-org'],
      limit: 50,
    });
  });

  it('falls back to null org scope when no org is selected', async () => {
    await controller.list(
      { user: { id: 'u-3', role: 'superadmin', orgId: null }, effectiveOrgId: undefined },
      '10',
    );

    expect(orgsService.getSubtreeOrgIds).not.toHaveBeenCalled();
    expect(auditService.list).toHaveBeenCalledWith({
      orgId: null,
      orgIds: undefined,
      limit: 10,
    });
  });
});