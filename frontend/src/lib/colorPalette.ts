// Fixed 12-color UI palette for tags/categories (accessible, distinct)
// Using Tailwind-inspired mid/600 tones for good contrast on light backgrounds.
export const FIXED_PALETTE: string[] = [
  '#2563eb', // blue-600
  '#ef4444', // red-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
  '#14b8a6', // teal-500
  '#22c55e', // green-500
  '#0ea5e9', // sky-500
  '#a855f7', // purple-500
  '#64748b', // slate-500
];

export function isInFixedPalette(color?: string | null): boolean {
  if (!color) return false;
  const norm = color.trim().toLowerCase();
  return FIXED_PALETTE.includes(norm);
}

// Tailwind bg- class mapping for fixed palette
export const HEX_TO_TW_BG: Record<string, string> = {
  '#2563eb': 'bg-blue-600',
  '#ef4444': 'bg-red-500',
  '#f59e0b': 'bg-amber-500',
  '#10b981': 'bg-emerald-500',
  '#8b5cf6': 'bg-violet-500',
  '#ec4899': 'bg-pink-500',
  '#f97316': 'bg-orange-500',
  '#14b8a6': 'bg-teal-500',
  '#22c55e': 'bg-green-500',
  '#0ea5e9': 'bg-sky-500',
  '#a855f7': 'bg-purple-500',
  '#64748b': 'bg-slate-500',
};

export function getBgClass(color?: string | null, fallback: string = 'bg-slate-400'): string {
  if (!color) return fallback;
  const norm = color.trim().toLowerCase();
  return HEX_TO_TW_BG[norm] || fallback;
}
