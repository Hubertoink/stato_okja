import { Test, TestingModule } from '@nestjs/testing';
import { TaxonomyController } from './taxonomy.controller';
import { TaxonomyService } from './taxonomy.service';
import { OrgsService } from '../orgs/orgs.service';

describe('TaxonomyController org scoping', () => {
  let controller: TaxonomyController;
  const service: Partial<TaxonomyService> = {
    findAllCategories: jest.fn(async () => []),
    createCategory: jest.fn(async () => ({} as any)),
    updateCategoryScoped: jest.fn(async () => ({} as any)),
    findAllTags: jest.fn(async () => []),
    createTag: jest.fn(async () => ({} as any)),
    updateTagScoped: jest.fn(async () => ({} as any)),
    findAllCohorts: jest.fn(async () => []),
    createCohort: jest.fn(async () => ({} as any)),
    updateCohortScoped: jest.fn(async () => ({} as any)),
  };
  const orgs: Pick<OrgsService, 'getSubtreeOrgIds'> = {
    getSubtreeOrgIds: jest.fn(async (id: string) => [id, 'child-1']),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaxonomyController],
      providers: [
        { provide: TaxonomyService, useValue: service },
        { provide: OrgsService, useValue: orgs },
      ],
    }).compile();

    controller = module.get(TaxonomyController);
    jest.clearAllMocks();
  });

  it('categories: superadmin without scope lists only null org', async () => {
    await controller.findAllCategories({ user: { role: 'superadmin', orgId: null }, effectiveOrgId: undefined }, undefined);
    expect(service.findAllCategories).toHaveBeenCalledWith(undefined, null, undefined);
  });

  it('tags: superadmin scoped to org expands to subtree', async () => {
    await controller.findAllTags({ user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' }, undefined, undefined);
    expect(orgs.getSubtreeOrgIds).toHaveBeenCalledWith('org-1');
    expect(service.findAllTags).toHaveBeenCalledWith(undefined, undefined, undefined, ['org-1', 'child-1']);
  });

  it('cohorts: create sets orgId from scope and ignores body orgId', async () => {
    await controller.createCohort({ name: 'x', orgId: 'malicious' }, { user: { id: 'u', role: 'superadmin', orgId: null, name: 'S' }, effectiveOrgId: undefined });
    expect(service.createCohort).toHaveBeenCalledWith(expect.objectContaining({ orgId: null }), expect.any(Object));
  });

  it('categories: update strips orgId from payload', async () => {
    await controller.updateCategory('id-1', { name: 'y', orgId: 'malicious' }, { user: { role: 'admin', orgId: 'own' } });
    const [, passedData] = (service.updateCategoryScoped as jest.Mock).mock.calls[0];
    expect(passedData).not.toHaveProperty('orgId');
  });
});
