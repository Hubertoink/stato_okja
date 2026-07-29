import { describe, expect, it } from 'vitest';
import { getIntlLocale, normalizeAppLocale } from './locales';

describe('locale helpers', () => {
  it('maps browser variants to supported StatO languages', () => {
    expect(normalizeAppLocale('en-US')).toBe('en');
    expect(normalizeAppLocale('de-CH')).toBe('de');
  });

  it('falls back to German for languages that are not enabled yet', () => {
    expect(normalizeAppLocale('sv-SE')).toBe('de');
    expect(getIntlLocale('en')).toBe('en-GB');
  });
});
