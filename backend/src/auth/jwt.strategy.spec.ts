import { UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../users/entities/user.entity';

type UserRepoMock = Pick<Repository<User>, 'findOne'>;

describe('JwtStrategy', () => {
  let repo: jest.Mocked<UserRepoMock>;
  let strategy: JwtStrategy;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
    };
    strategy = new JwtStrategy(repo as unknown as Repository<User>);
  });

  it('loads the current role and org from the database', async () => {
    repo.findOne.mockResolvedValue({
      id: 'user-1',
      role: 'user',
      orgId: 'new-org',
      name: 'Moved User',
    } as User);

    await expect(strategy.validate({ sub: 'user-1' })).resolves.toEqual({
      id: 'user-1',
      role: 'user',
      orgId: 'new-org',
      name: 'Moved User',
    });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('rejects tokens for users that no longer exist', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'missing-user' })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});