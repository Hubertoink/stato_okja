const KEY = 'starredProjects';

export function getStarredProjectIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const val = JSON.parse(raw);
    return Array.isArray(val) ? (val.filter((v) => typeof v === 'string') as string[]) : [];
  } catch {
    return [];
  }
}

export function setStarredProjectIds(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    // ignore
  }
}

export function toggleStarredProject(id: string): string[] {
  const current = new Set(getStarredProjectIds());
  if (current.has(id)) current.delete(id);
  else current.add(id);
  const result = Array.from(current);
  setStarredProjectIds(result);
  return result;
}

export function isProjectStarred(id?: string | null): boolean {
  if (!id) return false;
  const set = new Set(getStarredProjectIds());
  return set.has(id);
}
