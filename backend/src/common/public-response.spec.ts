import { toPublicActivity, toPublicStaff, toPublicUser } from './public-response';

describe('public response mappers', () => {
  it('never serializes sensitive user fields', () => {
    const result = toPublicUser({
      id: 'user-1',
      email: 'user@example.test',
      name: 'User',
      role: 'user',
      passwordHash: 'bcrypt-hash',
      twoFactorCodeHash: '2fa-hash',
      refreshTokenHash: 'refresh-hash',
      failedLoginAttempts: 4,
    } as never);

    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('twoFactorCodeHash');
    expect(result).not.toHaveProperty('refreshTokenHash');
    expect(result).not.toHaveProperty('failedLoginAttempts');
  });

  it('removes staff passwords, including nested activity relations', () => {
    const staff = {
      id: 'staff-1',
      name: 'Teammitglied',
      email: 'team@example.test',
      password: 'bcrypt-hash',
    };

    expect(toPublicStaff(staff)).not.toHaveProperty('password');
    expect(toPublicActivity({ id: 'activity-1', staff: [staff], createdBy: staff })).not.toEqual(
      expect.objectContaining({ staff: [expect.objectContaining({ password: expect.anything() })] }),
    );
    expect(toPublicActivity({ id: 'activity-1', staff: [staff], createdBy: staff })).not.toHaveProperty(
      'staff.0.password',
    );
  });
});
