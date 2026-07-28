import { describe, expect, it } from 'vitest';
import { getEmailValidationMessage } from './emailValidation';

describe('getEmailValidationMessage', () => {
  it('accepts a conventional ASCII email address', () => {
    expect(getEmailValidationMessage('anna.mueller@example.org')).toBeNull();
  });

  it('rejects umlauts in the local part before a user is created', () => {
    expect(getEmailValidationMessage('annamüller@example.org')).toMatch(/Umlaute/);
  });

  it('rejects malformed addresses', () => {
    expect(getEmailValidationMessage('anna@example')).toMatch(/gültige/);
  });
});
