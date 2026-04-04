export function normalizeUploadPath(path?: string | null): string | null {
  if (typeof path !== 'string') return path ?? null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/uploads/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;
  if (/^[^/\\]+\.(png|jpe?g|webp|gif)$/i.test(trimmed)) return `/uploads/images/${trimmed}`;
  return trimmed;
}