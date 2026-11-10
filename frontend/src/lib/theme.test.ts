import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, resolveThemeName, THEME_DEFINITIONS } from './theme';

afterEach(() => vi.unstubAllGlobals());

describe('supported themes and retired preferences', () => {
  it('offers the six selected themes', () => {
    expect(THEME_DEFINITIONS.map(theme => theme.name)).toEqual([
      'Default Theme', 'Ocean Pearl', 'Catppuccin Latte', 'Nord', 'Tokyo Night', 'Midnight',
    ]);
  });
  it('uses Nord for dark and dark system preferences', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    expect(resolveThemeName('Default Theme', 'dark')).toBe('Nord');
    expect(resolveThemeName('Default Theme', 'system')).toBe('Nord');
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    expect(resolveThemeName('Nord', 'system')).toBe('Default Theme');
  });
  it('migrates retired custom themes while preserving their brightness', () => {
    applyTheme('Catppuccin Mocha', 'custom', { persist: false });
    expect(document.documentElement.dataset.theme).toBe('Nord');
    expect(document.documentElement.dataset.colorMode).toBe('dark');
    expect(resolveThemeName('Gruvbox Material · Hard', 'custom')).toBe('Nord');
    expect(resolveThemeName('Earthy Tones', 'custom')).toBe('Default Theme');
    expect(resolveThemeName('unknown', 'custom')).toBe('Default Theme');
    expect(resolveThemeName('Midnight', 'custom')).toBe('Midnight');
  });
});
