import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { OrgsService } from '../orgs/orgs.service';

describe('ProjectsController org scoping', () => {
  let controller: ProjectsController;
  const service: Pick<ProjectsService, 'findAll'|'create'|'updateScoped'> = {
    findAll: jest.fn(async () => []),
    create: jest.fn(async () => ({} as unknown as import('./entities/project.entity').Project)),
    updateScoped: jest.fn(async () => ({} as unknown as import('./entities/project.entity').Project)),
  };
  const orgs: Pick<OrgsService, 'getSubtreeOrgIds'> = {
    getSubtreeOrgIds: jest.fn(async (id: string) => [id, 'child-1']),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: service },
        { provide: OrgsService, useValue: orgs },
      ],
    }).compile();

    controller = module.get(ProjectsController);
    jest.clearAllMocks();
  });

  it('superadmin without scope lists only null org', async () => {
    await controller.findAll({ user: { role: 'superadmin', orgId: null }, effectiveOrgId: undefined }, undefined, undefined);
    expect(service.findAll).toHaveBeenCalledWith(undefined, undefined, null, undefined);
  });

  it('superadmin scoped to org expands to subtree', async () => {
    await controller.findAll({ user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' }, undefined, undefined);
    expect(orgs.getSubtreeOrgIds).toHaveBeenCalledWith('org-1');
    expect(service.findAll).toHaveBeenCalledWith(undefined, undefined, undefined, ['org-1', 'child-1']);
  });

  it('create sets orgId from scope and ignores body orgId', async () => {
    await controller.create({ title: 'x', type: 'group', orgId: 'malicious' } as unknown as import('./dto/create-project.dto').CreateProjectDto, { user: { id: 'u', role: 'superadmin', orgId: null, name: 'S' }, effectiveOrgId: undefined });
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ orgId: null }), expect.any(Object));
  });

  it('update strips orgId from payload', async () => {
    await controller.update('id-1', { title: 'y', orgId: 'malicious' } as { title: string; orgId?: string|null }, { user: { role: 'admin', orgId: 'own' } });
    const [, passedData] = (service.updateScoped as jest.Mock).mock.calls[0];
    expect(passedData).not.toHaveProperty('orgId');
  });
});
