import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { OrgsService } from '../orgs/orgs.service';

describe('UsersController global directory', () => {
  let controller: UsersController;
  const service = {
    findAllActiveMembershipUsers: jest.fn(async () => [
      {
        id: 'user-1',
        email: 'user@example.org',
        name: 'Example User',
        role: 'editor',
        orgId: 'org-1',
        org: { id: 'org-1', name: 'Example Organisation' },
        membershipId: 'membership-1',
        passwordHash: 'must-not-leak',
      },
    ]),
    findAll: jest.fn(async () => [
      {
        id: 'user-1',
        email: 'user@example.org',
        name: 'Example User',
        role: 'user',
        orgId: 'org-1',
        org: { id: 'org-1', name: 'Example Organisation' },
        passwordHash: 'must-not-leak',
      },
    ]),
    findById: jest.fn(),
    findMembership: jest.fn(),
    countActiveMembershipAdmins: jest.fn(),
    addMembership: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: service },
        { provide: OrgsService, useValue: {} },
      ],
    }).compile();

    controller = module.get(UsersController);
    jest.clearAllMocks();
  });

  it('lists all users only in the explicit superadmin area', async () => {
    const result = await controller.directory({
      user: { role: 'superadmin' },
      effectiveOrgId: null,
    });

    expect(service.findAllActiveMembershipUsers).toHaveBeenCalledTimes(1);
    expect(service.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({
        id: 'user-1',
        orgId: 'org-1',
        org: { id: 'org-1', name: 'Example Organisation' },
      }),
    ]);
    expect(result[0]).not.toHaveProperty('passwordHash');
  });

  it('rejects the global directory outside the superadmin area', async () => {
    await expect(
      controller.directory({
        user: { role: 'superadmin' },
        effectiveOrgId: 'org-1',
      }),
    ).rejects.toThrow('Globale Benutzerliste');

    await expect(
      controller.directory({
        user: { role: 'org_admin' },
        effectiveOrgId: null,
      }),
    ).rejects.toThrow('Globale Benutzerliste');
  });

  it('does not allow the last active organisation admin to be demoted', async () => {
    service.findById.mockResolvedValue({ id: 'admin-1', role: 'org_admin' });
    service.findMembership.mockResolvedValue({
      userId: 'admin-1',
      orgId: 'org-1',
      role: 'org_admin',
      status: 'active',
    });
    service.countActiveMembershipAdmins.mockResolvedValue(1);

    await expect(
      controller.update(
        'admin-1',
        { role: 'editor' },
        { user: { role: 'org_admin', orgId: 'org-1' }, effectiveOrgId: 'org-1' },
      ),
    ).rejects.toThrow('letzte Organisationsadmin');

    expect(service.addMembership).not.toHaveBeenCalled();
  });
});
