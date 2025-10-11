// Central color mapping for activity types
export const TYPE_COLORS: Record<string, string> = {
  open_door: '#2563eb',       // blue
  project_open: '#10b981',    // emerald/green
  project_closed: '#8b5cf6',  // violet
  event: '#f59e0b',           // amber
  outreach: '#ef4444',        // red
};

export function colorForActivityType(type?: string): string {
  if (!type) return '#6b9080'; // fallback viridian
  return TYPE_COLORS[type] || '#6b9080';
}

export function translucent(hexColor: string, alphaHex = '33'): string {
  // Append alpha to hex if in #RRGGBB format; otherwise return as-is
  if (/^#([0-9a-fA-F]{6})$/.test(hexColor)) return `${hexColor}${alphaHex}`;
  return hexColor;
}

// Shared palette used when hashing a string to a stable color
export const HASH_PALETTE = [
  '#2563eb', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#22c55e', '#eab308', '#0ea5e9', '#a855f7',
];

export function colorFromStringHash(input?: string): string {
  if (!input) return '#6b9080';
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return HASH_PALETTE[h % HASH_PALETTE.length];
}
