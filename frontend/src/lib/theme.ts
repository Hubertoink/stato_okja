import { autoT } from '@/i18n/auto';

export type ThemeDefinition = {
  name: string;
  colors: string[];
  isDark: boolean;
  description: string;
};

export const THEME_DEFINITIONS: readonly ThemeDefinition[] = [
  { name: 'Default Theme', colors: ['#5B6CFF', '#7C8FFF', '#16A34A', '#F59E0B', '#FAFBFF'], isDark: false, description: autoT('ui_e96d0b1a0023') },
  { name: 'Earthy Tones', colors: ['#6D6875', '#B5838D', '#E5989B', '#FFB4A2', '#F5F2F1'], isDark: false, description: autoT('ui_a782f53f9730') },
  { name: 'Peachy Delight', colors: ['#D8E2DC', '#FFE5D9', '#FFCAD4', '#F4ACB7', '#9D8189'], isDark: false, description: autoT('ui_67dc0bdacd3c') },
  { name: 'Ocean Pearl', colors: ['#006D77', '#83C5BE', '#EDF6F9', '#FFDDD2', '#F3F4F6'], isDark: false, description: autoT('ui_70f9e375ed89') },
  { name: 'Gruvbox Material · Light', colors: ['#F9F5D7', '#6F8352', '#45707A', '#C18F41', '#3C3836'], isDark: false, description: autoT('ui_f3b8cfbe8b6a') },
  { name: 'Catppuccin Latte', colors: ['#EFF1F5', '#8839EF', '#1E66F5', '#DF8E1D', '#4C4F69'], isDark: false, description: autoT('ui_b2459128b6ce') },
  { name: 'Gruvbox Material · Hard', colors: ['#1D2021', '#A9B665', '#7DAEA3', '#D8A657', '#D4BE98'], isDark: true, description: autoT('ui_c96cda56d52e') },
  { name: 'Gruvbox Material · Medium', colors: ['#282828', '#A9B665', '#7DAEA3', '#D8A657', '#D4BE98'], isDark: true, description: autoT('ui_adccdb927f8f') },
  { name: 'Gruvbox Material · Soft', colors: ['#32302F', '#A9B665', '#7DAEA3', '#D8A657', '#D4BE98'], isDark: true, description: autoT('ui_02ef77cd0583') },
  { name: 'Catppuccin Mocha', colors: ['#1E1E2E', '#CBA6F7', '#89B4FA', '#F9E2AF', '#CDD6F4'], isDark: true, description: autoT('ui_db2c1e4fc2da') },
  { name: 'Nord', colors: ['#2E3440', '#88C0D0', '#81A1C1', '#EBCB8B', '#ECEFF4'], isDark: true, description: autoT('ui_e7d5dc1b29e9') },
  { name: 'Tokyo Night', colors: ['#1A1B26', '#7AA2F7', '#7DCFFF', '#E0AF68', '#C0CAF5'], isDark: true, description: autoT('ui_6e055a280529') },
  { name: 'Midnight', colors: ['#08101D', '#6EA8FF', '#66D9D1', '#1A2333', '#ECF3FF'], isDark: true, description: autoT('ui_52efb3564d5f') },
  { name: 'Coastal Vibes', colors: ['#2B2D42', '#EF233C', '#8D99AE', '#EDF2F4', '#D90429'], isDark: true, description: autoT('ui_c8965fb492bc') },
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
