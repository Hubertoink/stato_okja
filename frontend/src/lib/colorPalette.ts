// Fixed 12-color UI palette for tags/categories (accessible, distinct)
// Using Tailwind-inspired mid/600 tones for good contrast on light backgrounds.
// Category palette (kept as the original fixed palette)
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
const HEX_TO_TW_BG: Record<string, string> = {
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

// Tag palette (visually distinct from categories – slightly deeper tones)
export const TAG_PALETTE: string[] = [
  '#1d4ed8', // blue-700
  '#b91c1c', // red-700
  '#b45309', // amber-700
  '#059669', // emerald-600
  '#7c3aed', // violet-600
  '#be185d', // pink-700
  '#c2410c', // orange-700
  '#0f766e', // teal-700
  '#16a34a', // green-600
  '#0284c7', // sky-600
  '#9333ea', // purple-600
  '#475569', // slate-600
];

const HEX_TO_TW_BG_TAG: Record<string, string> = {
  '#1d4ed8': 'bg-blue-700',
  '#b91c1c': 'bg-red-700',
  '#b45309': 'bg-amber-700',
  '#059669': 'bg-emerald-600',
  '#7c3aed': 'bg-violet-600',
  '#be185d': 'bg-pink-700',
  '#c2410c': 'bg-orange-700',
  '#0f766e': 'bg-teal-700',
  '#16a34a': 'bg-green-600',
  '#0284c7': 'bg-sky-600',
  '#9333ea': 'bg-purple-600',
  '#475569': 'bg-slate-600',
};

export function isInTagPalette(color?: string | null): boolean {
  if (!color) return false;
  const norm = color.trim().toLowerCase();
  return TAG_PALETTE.includes(norm);
}

export function getBgClass(color?: string | null, fallback: string = 'bg-slate-400'): string {
  if (!color) return fallback;
  const norm = color.trim().toLowerCase();
  return HEX_TO_TW_BG[norm] || HEX_TO_TW_BG_TAG[norm] || fallback;
}
