import { Test, TestingModule } from '@nestjs/testing';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { OrgsService } from '../orgs/orgs.service';

describe('LocationsController org scoping', () => {
  let controller: LocationsController;
  const service: Pick<LocationsService, 'findAll'|'create'|'updateScoped'> = {
    findAll: jest.fn(async () => []),
    create: jest.fn(async () => ({} as unknown as import('./entities/location.entity').Location)),
    updateScoped: jest.fn(async () => ({} as unknown as import('./entities/location.entity').Location)),
  };
  const orgs: Pick<OrgsService, 'getSubtreeOrgIds'> = {
    getSubtreeOrgIds: jest.fn(async (id: string) => [id, 'child-1']),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [
        { provide: LocationsService, useValue: service },
        { provide: OrgsService, useValue: orgs },
      ],
    }).compile();

    controller = module.get(LocationsController);
    jest.clearAllMocks();
  });

  it('superadmin without scope lists only null org', async () => {
    await controller.findAll({ user: { role: 'superadmin', orgId: null }, effectiveOrgId: undefined }, undefined);
    expect(service.findAll).toHaveBeenCalledWith(undefined, null, undefined);
  });

  it('superadmin scoped to org expands to subtree', async () => {
    await controller.findAll({ user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' }, undefined);
    expect(orgs.getSubtreeOrgIds).toHaveBeenCalledWith('org-1');
    expect(service.findAll).toHaveBeenCalledWith(undefined, undefined, ['org-1', 'child-1']);
  });

  it('create sets orgId from scope and ignores body orgId', async () => {
    await controller.create({ name: 'x', orgId: 'malicious' } as { name: string; orgId?: string|null }, { user: { role: 'superadmin', orgId: null }, effectiveOrgId: undefined });
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ orgId: null }));
  });

  it('update strips orgId from payload', async () => {
    await controller.update('id-1', { name: 'y', orgId: 'malicious' } as { name: string; orgId?: string|null }, { user: { role: 'admin', orgId: 'own' } });
    const [, passedData] = (service.updateScoped as jest.Mock).mock.calls[0];
    expect(passedData).not.toHaveProperty('orgId');
  });
});
