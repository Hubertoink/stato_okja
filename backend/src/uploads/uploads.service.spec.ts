import { NotFoundException } from '@nestjs/common';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  const templates = { find: jest.fn() };
  const repository = {
    exists: jest.fn(),
    existsBy: jest.fn(),
    findOneByOrFail: jest.fn(),
    sum: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    delete: jest.fn(),
    manager: { dataSource: { options: { type: 'sqljs' } }, getRepository: () => templates },
  };
  const orgs = { listActiveMemberships: jest.fn(), getAncestorOrgIds: jest.fn() };
  const service = new UploadsService(repository as never, orgs as never);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.existsBy.mockResolvedValue(false);
    repository.sum.mockResolvedValue(0);
    templates.find.mockResolvedValue([]);
    orgs.getAncestorOrgIds.mockResolvedValue(['parent']);
  });

  it('allows an inherited template only when its owning scope has an upload grant', async () => {
    repository.exists.mockResolvedValue(false);
    templates.find.mockResolvedValue([{ archived: false, orgId: 'parent', imageUrl: '/uploads/images/template.jpg' }]);
    repository.existsBy.mockResolvedValue(true);
    await expect(service.assertCanRead('template.jpg', 'image', { id: 'user-1', role: 'user' }, 'org-1')).resolves.toBeUndefined();
    expect(repository.existsBy).toHaveBeenCalledWith({ filename: 'template.jpg', kind: 'image', scopeKey: 'org:parent' });
    repository.existsBy.mockResolvedValue(false);
    await expect(service.assertCanRead('template.jpg', 'image', { id: 'user-1', role: 'user' }, 'org-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not grant access to unrelated ancestor images', async () => {
    repository.exists.mockResolvedValue(false);
    await expect(service.assertCanRead('private.jpg', 'image', { id: 'user-1', role: 'user' }, 'org-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.existsBy).not.toHaveBeenCalled();
  });

  it('allows a referenced global template image', async () => {
    repository.exists.mockResolvedValue(false);
    templates.find.mockResolvedValue([{ archived: false, orgId: null, imageUrl: '/uploads/images/global.jpg' }]);
    repository.existsBy.mockResolvedValue(true);
    await expect(service.assertCanRead('global.jpg', 'image', { id: 'user-1', role: 'user' }, 'org-1')).resolves.toBeUndefined();
    expect(repository.existsBy).toHaveBeenCalledWith({ filename: 'global.jpg', kind: 'image', scopeKey: 'global' });
  });

  it('rejects a file without access in the effective organization', async () => {
    repository.exists.mockResolvedValue(false);

    await expect(service.assertCanRead(
      'private.pdf',
      'process-file',
      { id: 'user-1', role: 'user' },
      'org-1',
    )).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.exists).toHaveBeenCalled();
  });

  it('grants avatar uploads to all active memberships and the owner', async () => {
    orgs.listActiveMemberships.mockResolvedValue([{ orgId: 'org-1' }, { orgId: 'org-2' }]);

    await expect(service.getWriteScopes(
      { id: 'user-1', role: 'user' },
      'org-1',
      'avatar',
    )).resolves.toEqual(['user:user-1', 'org:org-1', 'org:org-2']);
  });

  it('retains an authorized template image and charges its size to the target scope', async () => {
    repository.exists.mockResolvedValue(false);
    templates.find.mockResolvedValue([{ orgId: 'parent', imageUrl: '/uploads/images/shared.jpg' }]);
    repository.existsBy.mockImplementation(async ({ scopeKey }) => scopeKey === 'org:parent');
    repository.findOneByOrFail.mockResolvedValue({ size: '1234' });
    await service.retainProjectImage('/uploads/images/shared.jpg', 'org-1');
    expect(repository.save).toHaveBeenCalledWith([
      { filename: 'shared.jpg', kind: 'image', size: 1234, scopeKey: 'org:org-1' },
    ]);
  });

  it('rejects adoption of a private image without creating a grant', async () => {
    repository.exists.mockResolvedValue(false);
    await expect(service.retainProjectImage('/uploads/images/private.jpg', 'org-1'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('does not charge for the same image twice', async () => {
    repository.existsBy.mockResolvedValue(true);
    await service.retainProjectImage('/uploads/images/shared.jpg', 'org-1');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects uploads that exceed the scope quota', async () => {
    repository.sum.mockResolvedValue(512 * 1024 * 1024);

    await expect(service.register('next.pdf', 'process-file', 1, ['org:org-1']))
      .rejects.toThrow('Upload-Speicherlimit');
    expect(repository.save).not.toHaveBeenCalled();
  });
});