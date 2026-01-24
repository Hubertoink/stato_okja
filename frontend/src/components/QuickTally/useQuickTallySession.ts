import { useState, useEffect, useCallback } from 'react';

type GenderKey = 'm' | 'w' | 'd';

export interface TallySession {
  projectId: string;
  locationId?: string;
  date: string;
  startTime: string;
  counts: Record<string, { m: number; w: number; d: number }>;
  startedAt: string; // ISO timestamp
}

const STORAGE_KEY = 'stato_quick_tally_session';
const SYNC_EVENT = 'stato:quick-tally-session-changed';

function readSessionFromStorage(): TallySession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as TallySession;
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date === today) return parsed;
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

function writeSessionToStorage(session: TallySession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } finally {
    // Ensure all hook instances in the same tab update immediately.
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SYNC_EVENT));
  }
}

export function useQuickTallySession() {
  const [session, setSession] = useState<TallySession | null>(() => {
    return readSessionFromStorage();
  });

  // Keep multiple hook instances in sync (same tab + other tabs)
  useEffect(() => {
    const sync = () => setSession(readSessionFromStorage());
    window.addEventListener(SYNC_EVENT, sync);
    // 'storage' fires in other tabs/windows when localStorage changes.
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const startSession = useCallback(
    (projectId: string, locationId?: string, startTime?: string) => {
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
      writeSessionToStorage(newSession);
      return newSession;
    },
    []
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
        writeSessionToStorage(updated);
        return updated;
      });
    },
    []
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
        writeSessionToStorage(updated);
        return updated;
      });
    },
    []
  );

  const clearSession = useCallback(() => {
    setSession(null);
    writeSessionToStorage(null);
  }, []);

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
