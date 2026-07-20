import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { OrgsService } from '../orgs/orgs.service';
import { Activity } from './entities/activity.entity';

describe('ActivitiesController org scoping', () => {
  let controller: ActivitiesController;
  const service: Pick<ActivitiesService, 'findAllPaged'|'create'|'updateScoped'> = {
    findAllPaged: jest.fn(async () => ({ data: [] as Activity[], total: 0, page: 1, pageSize: 50 })),
    create: jest.fn(async () => ({} as unknown as Activity)),
    updateScoped: jest.fn(async () => ({} as unknown as Activity | null)),
  };
  const orgs: Pick<OrgsService, 'getSubtreeOrgIds'> = {
    getSubtreeOrgIds: jest.fn(async (id: string) => [id, 'child-1']),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        { provide: ActivitiesService, useValue: service },
        { provide: OrgsService, useValue: orgs },
      ],
    }).compile();

    controller = module.get(ActivitiesController);
    jest.clearAllMocks();
  });

  it('superadmin without scope lists only null org', async () => {
    await controller.findAll(
      { user: { role: 'superadmin', orgId: null }, effectiveOrgId: undefined },
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, 'desc', undefined, undefined, undefined
    );
    expect(service.findAllPaged).toHaveBeenCalledWith(expect.objectContaining({ orgId: null, page: 1, limit: 50 }));
  });

  it('superadmin scoped to org expands to subtree', async () => {
    await controller.findAll(
      { user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' },
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, 'desc', undefined, undefined, undefined
    );
    expect(orgs.getSubtreeOrgIds).toHaveBeenCalledWith('org-1');
    expect(service.findAllPaged).toHaveBeenCalledWith(expect.objectContaining({ orgIds: ['org-1', 'child-1'], orgId: undefined, page: 1, limit: 50 }));
  });

  it('non-superadmin without explicit scope uses own org subtree', async () => {
    await controller.findAll(
      { user: { role: 'admin', orgId: 'own-org' }, effectiveOrgId: undefined },
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, 'desc', undefined, undefined, undefined
    );
    expect(service.findAllPaged).toHaveBeenCalledWith(expect.objectContaining({ orgIds: ['own-org', 'child-1'], orgId: undefined, page: 1, limit: 50 }));
  });

  it('uses the requested bounded page', async () => {
    const args = [
      { user: { role: 'user', orgId: 'own-org' }, effectiveOrgId: undefined },
      ...Array.from({ length: 23 }, () => undefined),
      '3',
      '999',
    ] as unknown as Parameters<typeof controller.findAll>;
    await controller.findAll(...args);

    expect(service.findAllPaged).toHaveBeenCalledWith(expect.objectContaining({ page: 3, limit: 50 }));
  });

  it('create sets orgId from scope and ignores body orgId', async () => {
    await controller.create(
      { title: 'x', orgId: 'malicious' } as Partial<Activity>,
      { user: { id: 'u', role: 'superadmin', orgId: null, name: 'S' }, effectiveOrgId: undefined }
    );
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ orgId: null }), expect.any(Object));
  });

  it('update strips orgId from payload', async () => {
    await controller.update(
      'id-1',
      { title: 'y', orgId: 'malicious' } as Partial<Activity>,
      { user: { id: 'u', role: 'admin', orgId: 'own', name: 'A' }, effectiveOrgId: 'own' }
    );
    expect(service.updateScoped).toHaveBeenCalled();
    const [, passedData] = (service.updateScoped as jest.Mock).mock.calls[0];
    expect(passedData).not.toHaveProperty('orgId');
  });
});
