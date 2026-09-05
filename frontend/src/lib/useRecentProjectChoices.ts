import { useCallback, useMemo } from 'react';
import { useAuth } from './auth';
import { useOrgScopeKey } from './orgScope';

export function useRecentProjectChoices() {
  const { user } = useAuth();
  const scope = useOrgScopeKey();
  const key = `stato:recent-project-choices:${user?.id}:${scope}`;
  const recentIds = useMemo<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, 10) : [];
    } catch { return []; }
  }, [key]);
  const remember = useCallback((id: string) => {
    try { localStorage.setItem(key, JSON.stringify([id, ...recentIds.filter(value => value !== id)].slice(0, 10))); }
    catch { /* Selection must work even if browser storage is unavailable. */ }
  }, [key, recentIds]);
  return { recentIds, remember };
}
