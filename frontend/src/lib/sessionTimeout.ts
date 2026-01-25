import { useEffect, useRef } from 'react';

const AUTH_TOKEN_KEY = 'auth_token';
const LAST_ACTIVITY_KEY = 'stato:lastActivityMs';

function parseNumberEnv(value: unknown, fallback: number) {
  const n = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

const IDLE_TIMEOUT_MINUTES = parseNumberEnv(
  (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env?.VITE_IDLE_LOGOUT_MINUTES) as unknown,
  30,
);

const IDLE_TIMEOUT_MS = Math.max(1, IDLE_TIMEOUT_MINUTES) * 60_000;
const EXPIRY_SKEW_MS = 10_000;

function base64UrlDecodeToString(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
  return atob(padded);
}

function safeParseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = base64UrlDecodeToString(parts[1]);
    const payload = JSON.parse(json) as Record<string, unknown>;
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

function getJwtExpMs(token: string): number | null {
  const payload = safeParseJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== 'number') return null;
  return exp * 1000;
}

export function getStoredAuthToken(): string {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function readLastActivityMs(now: number): number {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : now;
  } catch {
    return now;
  }
}

function writeLastActivityMs(ts: number) {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(ts));
  } catch {
    // ignore
  }
}

export function useSessionTimeout(opts: {
  enabled: boolean;
  onLogout: (reason: 'idle' | 'expired' | 'remote') => void;
  onNotify?: (msg: string) => void;
}) {
  const { enabled, onLogout, onNotify } = opts;

  const idleTimerId = useRef<number | null>(null);
  const expTimerId = useRef<number | null>(null);
  const lastWriteMs = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const clearTimers = () => {
      if (idleTimerId.current) window.clearTimeout(idleTimerId.current);
      if (expTimerId.current) window.clearTimeout(expTimerId.current);
      idleTimerId.current = null;
      expTimerId.current = null;
    };

    const scheduleIdleLogout = () => {
      if (!enabled) return;
      if (idleTimerId.current) window.clearTimeout(idleTimerId.current);

      const now = Date.now();
      const last = readLastActivityMs(now);
      const remaining = IDLE_TIMEOUT_MS - (now - last);

      if (remaining <= 0) {
        onNotify?.('Aus Sicherheitsgründen abgemeldet (Inaktivität).');
        onLogout('idle');
        return;
      }

      idleTimerId.current = window.setTimeout(() => {
        onNotify?.('Aus Sicherheitsgründen abgemeldet (Inaktivität).');
        onLogout('idle');
      }, remaining);
    };

    const scheduleExpiryLogout = () => {
      if (!enabled) return;
      if (expTimerId.current) window.clearTimeout(expTimerId.current);

      const token = getStoredAuthToken();
      if (!token) return;

      const expMs = getJwtExpMs(token);
      if (!expMs) return;

      const now = Date.now();
      const remaining = expMs - now - EXPIRY_SKEW_MS;

      if (remaining <= 0) {
        onNotify?.('Session abgelaufen. Bitte erneut anmelden.');
        onLogout('expired');
        return;
      }

      expTimerId.current = window.setTimeout(() => {
        onNotify?.('Session abgelaufen. Bitte erneut anmelden.');
        onLogout('expired');
      }, remaining);
    };

    const bumpActivity = () => {
      const now = Date.now();
      if (now - lastWriteMs.current < 15_000) return;
      lastWriteMs.current = now;
      writeLastActivityMs(now);
      scheduleIdleLogout();
    };

    // Init
    writeLastActivityMs(Date.now());
    scheduleIdleLogout();
    scheduleExpiryLogout();

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'pointerdown',
    ];

    for (const e of activityEvents) {
      window.addEventListener(e, bumpActivity, { passive: true });
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Re-arm on return
        scheduleIdleLogout();
        scheduleExpiryLogout();
      }
    };
    document.addEventListener('visibilitychange', onVisibility, { passive: true } as AddEventListenerOptions);

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === AUTH_TOKEN_KEY && !ev.newValue) {
        onLogout('remote');
        return;
      }
      if (ev.key === LAST_ACTIVITY_KEY) {
        scheduleIdleLogout();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      clearTimers();
      for (const e of activityEvents) {
        window.removeEventListener(e, bumpActivity);
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, [enabled, onLogout, onNotify]);
}
