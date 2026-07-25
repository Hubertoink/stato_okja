import { UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../users/entities/user.entity';
import { RefreshSession } from './entities/refresh-session.entity';

type UserRepoMock = Pick<Repository<User>, 'findOne'>;
type RefreshSessionRepoMock = Pick<Repository<RefreshSession>, 'findOne'>;

describe('JwtStrategy', () => {
  let repo: jest.Mocked<UserRepoMock>;
  let refreshSessions: jest.Mocked<RefreshSessionRepoMock>;
  let strategy: JwtStrategy;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
    };
    refreshSessions = { findOne: jest.fn() };
    strategy = new JwtStrategy(
      repo as unknown as Repository<User>,
      refreshSessions as unknown as Repository<RefreshSession>,
    );
  });

  it('loads the current role and org from the database', async () => {
    repo.findOne.mockResolvedValue({
      id: 'user-1',
      role: 'user',
      orgId: 'new-org',
      name: 'Moved User',
    } as User);
    refreshSessions.findOne.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
    } as RefreshSession);

    await expect(strategy.validate({ sub: 'user-1', sid: 'session-1' })).resolves.toEqual({
      id: 'user-1',
      role: 'user',
      orgId: 'new-org',
      name: 'Moved User',
    });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(refreshSessions.findOne).toHaveBeenCalledWith({ where: { id: 'session-1', userId: 'user-1' } });
  });

  it('rejects tokens for users that no longer exist', async () => {
    repo.findOne.mockResolvedValue(null);

    refreshSessions.findOne.mockResolvedValue({
      id: 'session-1',
      userId: 'missing-user',
      expiresAt: new Date(Date.now() + 60_000),
    } as RefreshSession);

    await expect(strategy.validate({ sub: 'missing-user', sid: 'session-1' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an access token after its browser session was revoked', async () => {
    refreshSessions.findOne.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'user-1', sid: 'revoked-session' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.findOne).not.toHaveBeenCalled();
  });
});
