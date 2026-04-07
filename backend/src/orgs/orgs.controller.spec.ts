import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrgsController } from './orgs.controller';
import { OrgsService } from './orgs.service';
import { UsersService } from '../users/users.service';

describe('OrgsController create permissions', () => {
  let controller: OrgsController;
  const service = {
    create: jest.fn(async (name: string, parentId?: string | null) => ({ id: 'org-1', name, parentId })),
  };

  beforeEach(async () => {
    delete process.env.ENABLE_ORG_MOVE;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrgsController],
      providers: [
        { provide: OrgsService, useValue: service },
        { provide: UsersService, useValue: {} },
      ],
    }).compile();

    controller = module.get(OrgsController);
    jest.clearAllMocks();
  });

  it('lets superadmin create with any requested parent', async () => {
    await controller.create(
      { name: 'Kindorg', parentId: 'target-org' },
      { user: { role: 'superadmin', orgId: null } },
    );

    expect(service.create).toHaveBeenCalledWith('Kindorg', 'target-org');
  });

  it('forces org-admin creations under the admin org', async () => {
    await controller.create(
      { name: 'Kindorg' },
      { user: { role: 'org_admin', orgId: 'own-org' } },
    );

    expect(service.create).toHaveBeenCalledWith('Kindorg', 'own-org');
  });

  it('rejects org-admin attempts to override the parent org', async () => {
    await expect(
      controller.create(
        { name: 'Kindorg', parentId: 'other-org' },
        { user: { role: 'org_admin', orgId: 'own-org' } },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('blocks move preview when org move feature is disabled', async () => {
    expect(() => controller.previewMove('org-1', { parentId: 'other-org' })).toThrow(ForbiddenException);
  });
});