import { assertInitialSetupToken } from './initial-setup-token';

describe('initial setup possession proof', () => {
  const previous = process.env.INITIAL_SETUP_TOKEN;
  afterEach(() => {
    if (previous === undefined) delete process.env.INITIAL_SETUP_TOKEN;
    else process.env.INITIAL_SETUP_TOKEN = previous;
  });
  it('rejects an unconfigured or placeholder token', () => {
    delete process.env.INITIAL_SETUP_TOKEN;
    expect(() => assertInitialSetupToken('a'.repeat(64))).toThrow();
    process.env.INITIAL_SETUP_TOKEN = 'GENERATED_BY_INSTALLER';
    expect(() => assertInitialSetupToken('GENERATED_BY_INSTALLER')).toThrow();
    process.env.INITIAL_SETUP_TOKEN = 'CHANGE_TO_A_RANDOM_SETUP_CODE_WITH_AT_LEAST_32_CHARACTERS';
    expect(() => assertInitialSetupToken(process.env.INITIAL_SETUP_TOKEN)).toThrow();
  });
  it('rejects missing, incorrect and different-length tokens', () => {
    process.env.INITIAL_SETUP_TOKEN = 'a'.repeat(64);
    for (const input of [undefined, '', 'a', 'b'.repeat(64)]) {
      expect(() => assertInitialSetupToken(input)).toThrow();
    }
  });
  it('accepts the configured token', () => {
    process.env.INITIAL_SETUP_TOKEN = 'a'.repeat(64);
    expect(() => assertInitialSetupToken('a'.repeat(64))).not.toThrow();
  });
});
