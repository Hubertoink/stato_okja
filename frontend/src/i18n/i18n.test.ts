import { describe, expect, it } from 'vitest';
import { autoResources } from './autoResources';
import { resources } from './resources';
import { normalizeAppLocale } from './locales';

function leafKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix];
  return Object.entries(value)
    .flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key));
}

describe('i18n resources', () => {
  it('keeps German and English resource keys in sync', () => {
    expect(leafKeys(resources.en).sort()).toEqual(leafKeys(resources.de).sort());
  });

  it('contains a complete generated UI catalog for both languages', () => {
    const deKeys = (Object.keys(autoResources.de) as Array<keyof typeof autoResources.de>).sort();
    const enKeys = Object.keys(autoResources.en).sort();
    expect(deKeys.length).toBeGreaterThan(1500);
    expect(enKeys).toEqual(deKeys);
    expect(Object.values(autoResources.en).every((value) => value.trim().length > 0)).toBe(true);
    for (const key of deKeys) {
      const placeholders = (value: string) =>
        [...value.matchAll(/{{\s*([^}]+)\s*}}/g)].map((match) => match[1].trim()).sort();
      expect(placeholders(autoResources.en[key])).toEqual(placeholders(autoResources.de[key]));
    }
  });

  it('normalizes regional locale variants and unsupported locales', () => {
    expect(normalizeAppLocale('de-AT')).toBe('de');
    expect(normalizeAppLocale('en-US')).toBe('en');
    expect(normalizeAppLocale('fr')).toBe('de');
  });

  it('keeps the selected calendar date separated from its heading', () => {
    expect(autoResources.de.ui_892ed2e65fe7).toBe('Aktivitäten am {{value0}}');
    expect(autoResources.en.ui_892ed2e65fe7).toBe('Activities on {{value0}}');
  });
});
