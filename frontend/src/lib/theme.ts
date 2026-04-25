const DARK_THEMES = ['Midnight', 'Coastal Vibes'] as const;

export function isDarkThemeName(theme?: string | null): boolean {
  return !!theme && DARK_THEMES.includes(theme as (typeof DARK_THEMES)[number]);
}