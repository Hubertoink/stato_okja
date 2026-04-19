import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useOrgScopeKey } from '@/lib/orgScope';

type GenderKey = 'm' | 'w' | 'd';

export interface TallySession {
  projectId: string;
  locationId?: string;
  date: string;
  startTime: string;
  counts: Record<string, { m: number; w: number; d: number }>;
  startedAt: string; // ISO timestamp
}

const LEGACY_STORAGE_KEY = 'stato_quick_tally_session';
const SYNC_EVENT = 'stato:quick-tally-session-changed';

function buildStorageKey(userId: string | null | undefined, scopeKey: string): string | null {
  if (!userId) return null;
  return `${LEGACY_STORAGE_KEY}:${userId}:${scopeKey}`;
}

function readSessionFromStorage(storageKey: string | null): TallySession | null {
  if (!storageKey) return null;
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as TallySession;
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date === today) return parsed;
    localStorage.removeItem(storageKey);
    return null;
  } catch {
    return null;
  }
}

function writeSessionToStorage(storageKey: string | null, session: TallySession | null) {
  if (!storageKey) return;
  try {
    if (session) localStorage.setItem(storageKey, JSON.stringify(session));
    else localStorage.removeItem(storageKey);
  } finally {
    // Ensure all hook instances in the same tab update immediately.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { storageKey } }));
    }
  }
}

export function useQuickTallySession() {
  const { user } = useAuth();
  const scopeKey = useOrgScopeKey();
  const storageKey = useMemo(() => buildStorageKey(user?.id ?? null, scopeKey), [user?.id, scopeKey]);
  const [session, setSession] = useState<TallySession | null>(() => {
    return null;
  });

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore storage cleanup failures
    }
  }, []);

  useEffect(() => {
    setSession(readSessionFromStorage(storageKey));
  }, [storageKey]);

  // Keep multiple hook instances in sync (same tab + other tabs)
  useEffect(() => {
    const sync = (event?: Event) => {
      if (event instanceof CustomEvent) {
        const eventStorageKey = (event.detail as { storageKey?: string | null } | undefined)?.storageKey;
        if (eventStorageKey && eventStorageKey !== storageKey) return;
      }
      setSession(readSessionFromStorage(storageKey));
    };
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key && event.key !== storageKey && event.key !== LEGACY_STORAGE_KEY) return;
      setSession(readSessionFromStorage(storageKey));
    };
    window.addEventListener(SYNC_EVENT, sync as EventListener);
    // 'storage' fires in other tabs/windows when localStorage changes.
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync as EventListener);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, [storageKey]);

  const startSession = useCallback(
    (projectId: string, locationId?: string, startTime?: string) => {
      if (!storageKey) return null;
      const now = new Date();
      const newSession: TallySession = {
        projectId,
        locationId,
        date: now.toISOString().slice(0, 10),
        startTime: startTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        counts: {},
        startedAt: now.toISOString(),
      };
      setSession(newSession);
      writeSessionToStorage(storageKey, newSession);
      return newSession;
    },
    [storageKey]
  );

  const updateCount = useCallback(
    (cohortId: string, gender: GenderKey, value: number) => {
      setSession((prev) => {
        if (!prev) return prev;
        const updated: TallySession = {
          ...prev,
          counts: {
            ...prev.counts,
            [cohortId]: {
              ...(prev.counts[cohortId] || { m: 0, w: 0, d: 0 }),
              [gender]: Math.max(0, value),
            },
          },
        };
        writeSessionToStorage(storageKey, updated);
        return updated;
      });
    },
    [storageKey]
  );

  const incrementCount = useCallback(
    (cohortId: string, gender: GenderKey) => {
      setSession((prev) => {
        if (!prev) return prev;
        const current = prev.counts[cohortId]?.[gender] || 0;
        const updated: TallySession = {
          ...prev,
          counts: {
            ...prev.counts,
            [cohortId]: {
              ...(prev.counts[cohortId] || { m: 0, w: 0, d: 0 }),
              [gender]: current + 1,
            },
          },
        };
        writeSessionToStorage(storageKey, updated);
        return updated;
      });
    },
    [storageKey]
  );

  const clearSession = useCallback(() => {
    setSession(null);
    writeSessionToStorage(storageKey, null);
  }, [storageKey]);

  const getTotals = useCallback(() => {
    if (!session) return { m: 0, w: 0, d: 0, total: 0 };
    let m = 0,
      w = 0,
      d = 0;
    Object.values(session.counts).forEach((c) => {
      m += c.m || 0;
      w += c.w || 0;
      d += c.d || 0;
    });
    return { m, w, d, total: m + w + d };
  }, [session]);

  const getCohortTotal = useCallback(
    (cohortId: string) => {
      if (!session) return 0;
      const c = session.counts[cohortId];
      if (!c) return 0;
      return (c.m || 0) + (c.w || 0) + (c.d || 0);
    },
    [session]
  );

  return {
    session,
    startSession,
    updateCount,
    incrementCount,
    clearSession,
    getTotals,
    getCohortTotal,
  };
}
