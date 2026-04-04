export function normalizeUploadPath(path?: string | null): string | undefined {
  if (!path) return undefined;
  const trimmed = path.trim();
  if (!trimmed) return undefined;
  if (/^(blob:|data:|https?:\/\/)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/uploads/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;
  return trimmed;
}

export function isProtectedUploadPath(path?: string | null): boolean {
  const normalized = normalizeUploadPath(path);
  return Boolean(normalized && normalized.startsWith('/uploads/'));
}