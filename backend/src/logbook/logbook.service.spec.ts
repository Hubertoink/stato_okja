import { ForbiddenException } from '@nestjs/common';
import { LogbookEntryStatus, LogbookVisibility } from '../common/enums';
import { LogbookService } from './logbook.service';

describe('logbook author permissions', () => {
  const setup = () => {
    const entry = { id: 'entry', orgId: 'org', createdByUserId: 'author', title: 'Titel', body: 'Text', status: LogbookEntryStatus.OPEN, visibility: LogbookVisibility.TEAM };
    const query = { leftJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(entry) };
    const entries = { createQueryBuilder: jest.fn(() => query), save: jest.fn(async (value) => value) };
    const comments = { findOne: jest.fn().mockResolvedValue({ id: 'comment', entryId: 'entry', createdByUserId: 'author' }), remove: jest.fn(), create: jest.fn((value) => value), save: jest.fn(async (value) => ({ id: 'comment', ...value })) };
    const service = new LogbookService(entries as never, comments as never, {} as never, {} as never, {} as never, { log: jest.fn() } as never);
    jest.spyOn(service, 'findOne').mockImplementation(async () => entry as never);
    return { service, entry, entries, comments };
  };

  it.each(['user', 'org_admin', 'superadmin'])('rejects all entry mutations by a different %s', async (role) => {
    const { service, entries } = setup();
    const user = { id: 'other', role };
    for (const mutate of [
      () => service.update('entry', { body: 'Changed' }, 'org', user),
      () => service.setStatus('entry', LogbookEntryStatus.DISCUSSED, 'org', user),
      () => service.archive('entry', 'org', user),
      () => service.restore('entry', 'org', user),
    ]) await expect(mutate()).rejects.toBeInstanceOf(ForbiddenException);
    expect(entries.save).not.toHaveBeenCalled();
  });

  it('allows the author to edit, change status, archive and restore', async () => {
    const { service, entries } = setup();
    const user = { id: 'author', role: 'user' };
    await service.update('entry', { body: 'Changed' }, 'org', user);
    await service.setStatus('entry', LogbookEntryStatus.DISCUSSED, 'org', user);
    await service.archive('entry', 'org', user);
    await service.restore('entry', 'org', user);
    expect(entries.save).toHaveBeenCalledTimes(4);
  });

  it.each(['author', 'other'])('allows %s to comment on a visible team entry', async (id) => {
    const { service, comments } = setup();
    await service.createComment('entry', ' Rückmeldung ', 'org', { id, role: 'user' });
    expect(comments.save).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'entry', orgId: 'org', body: 'Rückmeldung', createdByUserId: id }));
  });

  it.each(['user', 'org_admin', 'superadmin'])('only permits deletion of own comments for %s', async (role) => {
    const { service, comments } = setup();
    await expect(service.removeComment('entry', 'comment', 'org', { id: 'other', role })).rejects.toBeInstanceOf(ForbiddenException);
    expect(comments.remove).not.toHaveBeenCalled();
    await expect(service.removeComment('entry', 'comment', 'org', { id: 'author', role })).resolves.toEqual({ id: 'comment', deleted: true });
    expect(comments.remove).toHaveBeenCalledTimes(1);
  });
});
