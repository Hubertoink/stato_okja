import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesController } from '../src/activities/activities.controller';
import { ActivitiesService } from '../src/activities/activities.service';
import { Activity } from '../src/activities/entities/activity.entity';
import { CreateActivityDto, UpdateActivityDto } from '../src/activities/dto/activity.dto';
import { OrgsService } from '../src/orgs/orgs.service';

describe('ActivitiesController org scoping', () => {
  let controller: ActivitiesController;
  const service: Pick<ActivitiesService, 'findAllPaged'|'create'|'updateScoped'> = {
    findAllPaged: jest.fn(async () => ({ data: [], total: 0, page: 1, pageSize: 50 })),
    create: jest.fn(),
    updateScoped: jest.fn(),
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
    expect(service.findAllPaged).toHaveBeenCalledWith(expect.objectContaining({ orgId: null }));
  });

  it('superadmin scoped to an organization lists only that organization', async () => {
    await controller.findAll(
      { user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' },
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, 'desc', undefined, undefined, undefined
    );
    expect(service.findAllPaged).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1' }));
  });

  it('non-superadmin without explicit scope uses only their organization', async () => {
    await controller.findAll(
      { user: { role: 'admin', orgId: 'own-org' }, effectiveOrgId: undefined },
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, 'desc', undefined, undefined, undefined
    );
    expect(service.findAllPaged).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'own-org' }));
  });

  it('create sets orgId from scope and ignores body orgId', async () => {
    (service.create as jest.MockedFunction<ActivitiesService['create']>) = jest.fn(
      async (data: Partial<Activity>) => data as Activity,
    );
    const result = await controller.create(
      { title: 'x', orgId: 'malicious' } as unknown as CreateActivityDto,
      { user: { id: 'u', role: 'superadmin', orgId: null, name: 'S' }, effectiveOrgId: undefined }
    );
    expect(result).toEqual(expect.objectContaining({ orgId: null }));
  });

  it('update strips orgId from payload', async () => {
    (service.updateScoped as jest.MockedFunction<ActivitiesService['updateScoped']>) = jest.fn(
      async (
        _id: string,
        data: Partial<Activity>,
        _user: Parameters<ActivitiesService['updateScoped']>[2],
      ) => data as Activity,
    );
    const result = await controller.update(
      'id-1',
      { title: 'y', orgId: 'malicious' } as unknown as UpdateActivityDto,
      { user: { id: 'u', role: 'admin', orgId: 'own', name: 'A' }, effectiveOrgId: 'own' }
    );
    expect(result).toEqual(expect.not.objectContaining({ orgId: expect.anything() }));
  });
});
