import { ActivitiesService } from './activities.service';

describe('activity category mode on writes', () => {
  const original = process.env.ACTIVITY_CATEGORY_MODE;
  const existing = { id: 'a1', version: 1, categories: [{ id: 'c1' }, { id: 'c2' }] };
  const repo = {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(async (data) => data),
    findOne: jest.fn(async () => ({ ...existing })),
    update: jest.fn(async () => ({ affected: 1 })),
    manager: { transaction: jest.fn() },
  };
  const categories = { findBy: jest.fn(async () => [{ id: 'c1' }, { id: 'c2' }]) };
  const orgs = { assertTaxonomyIdsVisibleForOrg: jest.fn() };
  const service = new ActivitiesService(repo as never, {} as never, categories as never,
    {} as never, {} as never, {} as never, {} as never, orgs as never, { log: jest.fn() } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    categories.findBy.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    process.env.ACTIVITY_CATEGORY_MODE = 'single';
    repo.manager.transaction.mockImplementation(async (operation) => operation({ getRepository: () => repo }));
    jest.spyOn(service, 'findOne').mockResolvedValue(null);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (original === undefined) delete process.env.ACTIVITY_CATEGORY_MODE;
    else process.env.ACTIVITY_CATEGORY_MODE = original;
  });

  it('rejects multiple categories on create before saving', async () => {
    await expect(service.create({ categoryIds: ['c1', 'c2'] })).rejects.toThrow('nur eine Kategorie');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each([{ categoryIds: ['c1', 'c2'] }, { title: 'Keep existing categories' }])(
    'rejects updates leaving multiple categories, including omitted categoryIds (%j)', async (data) => {
      await expect(service.update('a1', data)).rejects.toThrow('nur eine Kategorie');
      expect(repo.manager.transaction).not.toHaveBeenCalled();
    },
  );

  it.each([{ ids: [] }, { ids: ['c1'] }])('allows reducing an existing selection to $ids', async ({ ids }) => {
    categories.findBy.mockResolvedValue(ids.map((id) => ({ id })));
    await expect(service.update('a1', { categoryIds: ids })).resolves.toBeNull();
    expect(repo.manager.transaction).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ categories: ids.map((id) => ({ id })) }));
  });

  it('preserves multiple mode for existing installations', async () => {
    delete process.env.ACTIVITY_CATEGORY_MODE;
    const saved = await service.create({ categoryIds: ['c1', 'c2'] });
    expect(saved.categories).toHaveLength(2);
  });
});
