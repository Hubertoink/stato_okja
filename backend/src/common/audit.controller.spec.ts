import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { OrgsService } from '../orgs/orgs.service';

describe('AuditController scoped listing', () => {
  let controller: AuditController;

  const auditService: Pick<AuditService, 'list'> = {
    list: jest.fn(async () => []),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        { provide: AuditService, useValue: auditService },
        { provide: OrgsService, useValue: { listActiveMemberships: jest.fn() } },
      ],
    }).compile();

    controller = module.get(AuditController);
    jest.clearAllMocks();
  });

  it('uses the exact scope for an org admin in their own org', async () => {
    await controller.list(
      { user: { id: 'u-1', role: 'org_admin', orgId: 'org-1' }, effectiveOrgId: 'org-1' },
      '25',
    );

    expect(auditService.list).toHaveBeenCalledWith({
      orgId: 'org-1',
      orgIds: undefined,
      limit: 25,
    });
  });

  it('uses exact superadmin scope when selected', async () => {
    await controller.list(
      { user: { id: 'u-2', role: 'superadmin', orgId: null }, effectiveOrgId: 'org-2' },
      undefined,
    );

    expect(auditService.list).toHaveBeenCalledWith({
      orgId: 'org-2',
      orgIds: undefined,
      limit: 50,
    });
  });

  it('falls back to null org scope when no org is selected', async () => {
    await controller.list(
      { user: { id: 'u-3', role: 'superadmin', orgId: null }, effectiveOrgId: undefined },
      '10',
    );

    expect(auditService.list).toHaveBeenCalledWith({
      orgId: null,
      orgIds: undefined,
      limit: 10,
    });
  });
});
