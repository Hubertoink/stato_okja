import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrgsService } from './orgs.service';
import { Organization } from './entities/organization.entity';
import { Location } from '../locations/entities/location.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { Tag } from '../taxonomy/entities/tag.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { Activity } from '../activities/entities/activity.entity';
import { Project } from '../projects/entities/project.entity';

type RepoMock<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('OrgsService taxonomy access', () => {
  let service: OrgsService;
  let orgRepo: RepoMock<Organization>;
  let categoryRepo: RepoMock<Category>;
  let tagRepo: RepoMock<Tag>;
  let cohortRepo: RepoMock<Cohort>;

  beforeEach(async () => {
    orgRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    };
    categoryRepo = { find: jest.fn().mockResolvedValue([]) };
    tagRepo = { find: jest.fn().mockResolvedValue([]) };
    cohortRepo = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgsService,
        { provide: getRepositoryToken(Organization), useValue: orgRepo },
        { provide: getRepositoryToken(Location), useValue: {} },
        { provide: getRepositoryToken(Category), useValue: categoryRepo },
        { provide: getRepositoryToken(Tag), useValue: tagRepo },
        { provide: getRepositoryToken(Cohort), useValue: cohortRepo },
        { provide: getRepositoryToken(Activity), useValue: {} },
        { provide: getRepositoryToken(Project), useValue: {} },
      ],
    }).compile();

    service = module.get(OrgsService);
  });

  it('respects explicit local create lock for root organizations', async () => {
    (orgRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 'root-org',
        name: 'Bobibo',
        parentId: null,
        taxonomySettings: {
          categories: { allowOwn: false, inheritAll: false, inheritedIds: [] },
        },
      },
    ]);

    await expect(service.canCreateOwnTaxonomy('root-org', 'categories')).resolves.toBe(false);
  });

  it('keeps root organizations open by default without explicit settings', async () => {
    (orgRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 'root-org',
        name: 'Bobibo',
        parentId: null,
        taxonomySettings: null,
        childTaxonomyDefaults: null,
      },
    ]);

    await expect(service.canCreateOwnTaxonomy('root-org', 'categories')).resolves.toBe(true);
  });

  it('returns read-only permissions for locked child org admins', async () => {
    (orgRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 'parent-org',
        name: 'Jugendhaus Bobibo',
        parentId: null,
        taxonomySettings: null,
        childTaxonomyDefaults: { allowChildAdminOverrides: false },
      },
      {
        id: 'child-org',
        name: 'Bubu',
        parentId: 'parent-org',
        taxonomySettings: null,
        childTaxonomyDefaults: null,
      },
    ]);

    const snapshot = await service.getChildTaxonomySettingsScoped('child-org', {
      role: 'org_admin',
      orgId: 'child-org',
    });

    expect(snapshot.ownAdminPolicy.allowChildAdminOverrides).toBe(false);
    expect(snapshot.permissions.canEditSelf).toBe(false);
    expect(snapshot.permissions.canEditChildDefaults).toBe(false);
  });

  it('blocks locked child org admins from updating their own taxonomy settings', async () => {
    (orgRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 'parent-org',
        name: 'Jugendhaus Bobibo',
        parentId: null,
        taxonomySettings: null,
        childTaxonomyDefaults: { allowChildAdminOverrides: false },
      },
      {
        id: 'child-org',
        name: 'Bubu',
        parentId: 'parent-org',
        taxonomySettings: null,
        childTaxonomyDefaults: null,
      },
    ]);

    await expect(
      service.updateOrgTaxonomySettingsScoped(
        'child-org',
        {
          settings: {
            categories: { allowOwn: false, inheritAll: false, inheritedIds: [] },
          },
        },
        { role: 'org_admin', orgId: 'child-org' },
      ),
    ).rejects.toThrow('gesperrt');
  });

  it('still allows parent org admins to update a direct child lock state', async () => {
    const parentOrg = {
      id: 'parent-org',
      name: 'Jugendhaus Bobibo',
      parentId: null,
      taxonomySettings: null,
      childTaxonomyDefaults: { allowChildAdminOverrides: false },
    };
    const childOrg = {
      id: 'child-org',
      name: 'Bubu',
      parentId: 'parent-org',
      taxonomySettings: null,
      childTaxonomyDefaults: null,
    };
    (orgRepo.find as jest.Mock).mockResolvedValue([parentOrg, childOrg]);
    (orgRepo.save as jest.Mock).mockImplementation(async (value: unknown) => value);

    const snapshot = await service.updateOrgTaxonomySettingsScoped(
      'child-org',
      {
        settings: {
          categories: { allowOwn: false, inheritAll: false, inheritedIds: [] },
        },
      },
      { role: 'org_admin', orgId: 'parent-org' },
    );

    expect(snapshot.permissions.canEditSelf).toBe(true);
    expect(snapshot.settings.categories.allowOwn).toBe(false);
  });

  it('reports both direct children and full descendant cascade in the snapshot', async () => {
    (orgRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 'parent-org',
        name: 'Jugendhaus Bobibo',
        parentId: null,
        path: 'parent-org',
        taxonomySettings: null,
        childTaxonomyDefaults: null,
      },
      {
        id: 'child-org',
        name: 'Bubu',
        parentId: 'parent-org',
        path: 'parent-org/child-org',
        taxonomySettings: null,
        childTaxonomyDefaults: null,
      },
      {
        id: 'grandchild-org',
        name: 'Ugu',
        parentId: 'child-org',
        path: 'parent-org/child-org/grandchild-org',
        taxonomySettings: null,
        childTaxonomyDefaults: null,
      },
    ]);

    const snapshot = await service.getChildTaxonomySettingsScoped('parent-org', {
      role: 'superadmin',
      orgId: null,
    });

    expect(snapshot.directChildCount).toBe(1);
    expect(snapshot.descendantCount).toBe(2);
    expect(snapshot.childCount).toBe(2);
  });
});