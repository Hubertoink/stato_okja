import { getLoginLockoutConfig } from './login-lockout.config';

describe('getLoginLockoutConfig', () => {
  const originalMaxAttempts = process.env.LOGIN_MAX_FAILED_ATTEMPTS;
  const originalLockoutMinutes = process.env.LOGIN_LOCKOUT_MINUTES;

  afterEach(() => {
    if (originalMaxAttempts === undefined) delete process.env.LOGIN_MAX_FAILED_ATTEMPTS;
    else process.env.LOGIN_MAX_FAILED_ATTEMPTS = originalMaxAttempts;

    if (originalLockoutMinutes === undefined) delete process.env.LOGIN_LOCKOUT_MINUTES;
    else process.env.LOGIN_LOCKOUT_MINUTES = originalLockoutMinutes;
  });

  it('uses safe defaults when values are missing or invalid', () => {
    delete process.env.LOGIN_MAX_FAILED_ATTEMPTS;
    process.env.LOGIN_LOCKOUT_MINUTES = '0';

    expect(getLoginLockoutConfig()).toEqual({ maxAttempts: 5, lockoutMs: 10 * 60 * 1000 });
  });

  it('reads the account lockout values from the environment', () => {
    process.env.LOGIN_MAX_FAILED_ATTEMPTS = '3';
    process.env.LOGIN_LOCKOUT_MINUTES = '15';

    expect(getLoginLockoutConfig()).toEqual({ maxAttempts: 3, lockoutMs: 15 * 60 * 1000 });
  });
});
