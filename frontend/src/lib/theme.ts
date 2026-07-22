export type ThemeDefinition = {
  name: string;
  colors: string[];
  isDark: boolean;
  description: string;
};

export const THEME_DEFINITIONS: readonly ThemeDefinition[] = [
  { name: 'Default Theme', colors: ['#5B6CFF', '#7C8FFF', '#16A34A', '#F59E0B', '#FAFBFF'], isDark: false, description: 'Stato Blau' },
  { name: 'Earthy Tones', colors: ['#6D6875', '#B5838D', '#E5989B', '#FFB4A2', '#F5F2F1'], isDark: false, description: 'Warme, sanfte Töne' },
  { name: 'Peachy Delight', colors: ['#D8E2DC', '#FFE5D9', '#FFCAD4', '#F4ACB7', '#9D8189'], isDark: false, description: 'Helle Pastellfarben' },
  { name: 'Ocean Pearl', colors: ['#006D77', '#83C5BE', '#EDF6F9', '#FFDDD2', '#F3F4F6'], isDark: false, description: 'Kühl und klar' },
  { name: 'Gruvbox Material · Light', colors: ['#F9F5D7', '#6F8352', '#45707A', '#C18F41', '#3C3836'], isDark: false, description: 'Warm und kontrastreich' },
  { name: 'Catppuccin Latte', colors: ['#EFF1F5', '#8839EF', '#1E66F5', '#DF8E1D', '#4C4F69'], isDark: false, description: 'Helles Pastell' },
  { name: 'Gruvbox Material · Hard', colors: ['#1D2021', '#A9B665', '#7DAEA3', '#D8A657', '#D4BE98'], isDark: true, description: 'Dunkel, kontrastreich' },
  { name: 'Gruvbox Material · Medium', colors: ['#282828', '#A9B665', '#7DAEA3', '#D8A657', '#D4BE98'], isDark: true, description: 'Dunkel, ausgewogen' },
  { name: 'Gruvbox Material · Soft', colors: ['#32302F', '#A9B665', '#7DAEA3', '#D8A657', '#D4BE98'], isDark: true, description: 'Dunkel, weich' },
  { name: 'Catppuccin Mocha', colors: ['#1E1E2E', '#CBA6F7', '#89B4FA', '#F9E2AF', '#CDD6F4'], isDark: true, description: 'Pastell auf dunklem Grund' },
  { name: 'Nord', colors: ['#2E3440', '#88C0D0', '#81A1C1', '#EBCB8B', '#ECEFF4'], isDark: true, description: 'Nordisch und zurückhaltend' },
  { name: 'Tokyo Night', colors: ['#1A1B26', '#7AA2F7', '#7DCFFF', '#E0AF68', '#C0CAF5'], isDark: true, description: 'Leuchtende Nachtfarben' },
  { name: 'Midnight', colors: ['#08101D', '#6EA8FF', '#66D9D1', '#1A2333', '#ECF3FF'], isDark: true, description: 'Stato Nachtblau' },
  { name: 'Coastal Vibes', colors: ['#2B2D42', '#EF233C', '#8D99AE', '#EDF2F4', '#D90429'], isDark: true, description: 'Kontrastreiches Anthrazit' },
] as const;

const DARK_THEMES = new Set(THEME_DEFINITIONS.filter((theme) => theme.isDark).map((theme) => theme.name));

export function isDarkThemeName(theme?: string | null): boolean {
  return !!theme && DARK_THEMES.has(theme);
}

export function applyTheme(theme?: string | null) {
  try {
    const root = document.documentElement;
    if (theme) root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
    root.setAttribute('data-color-mode', isDarkThemeName(theme) ? 'dark' : 'light');
  } catch {
    // Rendering without a document (for example during a test) needs no theme update.
  }
}
