import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateContributorDto, UpdateContributorDto } from './contributors.dto';

describe('contributor input', () => {
  it('trims display names and rejects blank names', async () => {
    const valid = plainToInstance(CreateContributorDto, { name: ' Lea M. ' });
    expect(valid.name).toBe('Lea M.');
    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(plainToInstance(CreateContributorDto, { name: '  ' }))).not.toHaveLength(0);
  });

  it.each([{ name: null }, { active: null }, { active: 'false' }])('rejects malformed updates: %p', async data => {
    expect(await validate(plainToInstance(UpdateContributorDto, data))).not.toHaveLength(0);
  });

  it('allows archiving without a name update', async () => {
    expect(await validate(plainToInstance(UpdateContributorDto, { active: false }))).toHaveLength(0);
  });
});
