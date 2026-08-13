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
    removeCategoryScoped: jest.fn(async () => undefined),
    findAllTags: jest.fn(async () => []),
    createTag: jest.fn(async () => ({} as any)),
    updateTagScoped: jest.fn(async () => ({} as any)),
    removeTagScoped: jest.fn(async () => undefined),
    findAllCohorts: jest.fn(async () => []),
    createCohort: jest.fn(async () => ({} as any)),
    updateCohortScoped: jest.fn(async () => ({} as any)),
    removeCohortScoped: jest.fn(async () => undefined),
  };
  const orgs: Partial<OrgsService> = {
    getSubtreeOrgIds: jest.fn(async (id: string) => [id, 'child-1']),
    canCreateOwnTaxonomy: jest.fn(async () => true),
    getTaxonomyAccessForOrg: jest.fn(async () => ({
      categories: { canCreateOwn: true },
      tags: { canCreateOwn: true },
      cohorts: { canCreateOwn: true },
    })),
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
    expect(service.findAllCategories).toHaveBeenCalledWith(undefined, null);
  });

  it('tags: superadmin scoped to org resolves visible tags for that org scope', async () => {
    await controller.findAllTags({ user: { role: 'superadmin', orgId: null }, effectiveOrgId: 'org-1' }, undefined, undefined);
    expect(orgs.getSubtreeOrgIds).not.toHaveBeenCalled();
    expect(service.findAllTags).toHaveBeenCalledWith(undefined, undefined, 'org-1');
  });

  it('cohorts: create sets orgId from scope and ignores body orgId', async () => {
    await controller.createCohort({ name: 'x', minAge: 0, maxAge: 99 }, { user: { id: 'u', role: 'superadmin', orgId: null, name: 'S' }, effectiveOrgId: undefined });
    expect(service.createCohort).toHaveBeenCalledWith(expect.objectContaining({ orgId: null }), expect.any(Object));
  });

  it('cohorts: superadmin scoped to org still respects local creation lock', async () => {
    (orgs.canCreateOwnTaxonomy as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      controller.createCohort(
        { name: 'x', minAge: 0, maxAge: 99 },
        { user: { id: 'u', role: 'superadmin', orgId: null, name: 'S' }, effectiveOrgId: 'org-1' },
      ),
    ).rejects.toThrow('Für diese Organisation sind lokale Kohorten gesperrt');

    expect(service.createCohort).not.toHaveBeenCalled();
  });

  it('categories: update strips orgId from payload', async () => {
    await controller.updateCategory(
      'id-1',
      { name: 'y', orgId: 'malicious', sourceOrgName: 'Parent', isInherited: true, canManage: false } as any,
      { user: { role: 'admin', orgId: 'own' } },
    );
    const [, passedData] = (service.updateCategoryScoped as jest.Mock).mock.calls[0];
    expect(passedData).toEqual({ name: 'y' });
  });

  it('tags: update keeps only allowed tag fields', async () => {
    await controller.updateTag(
      'id-2',
      { name: 'ferien', color: '#fff', orgId: 'malicious', sourceOrgId: 'parent', sourceOrgName: 'Parent', isInherited: true } as any,
      { user: { role: 'admin', orgId: 'own' } },
    );
    const [, passedData] = (service.updateTagScoped as jest.Mock).mock.calls[0];
    expect(passedData).toEqual({ name: 'ferien', color: '#fff' });
  });

  it('cohorts: update keeps only allowed cohort fields', async () => {
    await controller.updateCohort(
      'id-3',
      { name: '12-14', minAge: 12, maxAge: 14, orgId: 'malicious', canManage: false, sourceOrgName: 'Parent' } as any,
      { user: { role: 'admin', orgId: 'own' } },
    );
    const [, passedData] = (service.updateCohortScoped as jest.Mock).mock.calls[0];
    expect(passedData).toEqual({ name: '12-14', minAge: 12, maxAge: 14 });
  });

  it('normal users cannot archive taxonomy records', async () => {
    expect(() => controller.updateTag('id-1', { active: false }, { user: { role: 'user', orgId: 'own' } }))
      .toThrow('Nur Editor oder Organisationsadministratoren');
    expect(service.updateTagScoped).not.toHaveBeenCalled();
  });

  it('normal users cannot permanently delete taxonomy records', async () => {
    expect(() => controller.removeCategory('id-1', { user: { role: 'user', orgId: 'own' } }))
      .toThrow('Nur Editor oder Organisationsadministratoren');
    expect(service.removeCategoryScoped).not.toHaveBeenCalled();
  });

  it('organisation administrators can permanently delete taxonomy records', async () => {
    await controller.removeCohort('id-1', { user: { role: 'org_admin', orgId: 'own' } });
    expect(service.removeCohortScoped).toHaveBeenCalledWith('id-1', expect.objectContaining({ role: 'org_admin' }));
  });

  it('editors can archive and permanently delete taxonomy records', async () => {
    await controller.updateTag('id-1', { active: false }, { user: { role: 'editor', orgId: 'own' } });
    await controller.removeCategory('id-1', { user: { role: 'editor', orgId: 'own' } });

    expect(service.updateTagScoped).toHaveBeenCalledWith('id-1', { active: false }, expect.objectContaining({ role: 'editor' }));
    expect(service.removeCategoryScoped).toHaveBeenCalledWith('id-1', expect.objectContaining({ role: 'editor' }));
  });
});
