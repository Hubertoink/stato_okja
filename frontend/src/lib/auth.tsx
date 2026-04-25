import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAuthToken } from './api';
import {
  clearStoredAuthToken,
  clearStoredPendingTwoFactorChallenge,
  getStoredAuthToken,
  storeAuthToken,
  storePendingTwoFactorChallenge,
} from './authStorage';

export type Role = 'superadmin' | 'org_admin' | 'user';
interface AuthUser { id: string; email: string; name: string; role: Role; orgId?: string | null; orgName?: string | null; avatarUrl?: string | null; theme?: string; mustChangePassword?: boolean }

type TwoFactorChallenge = {
  requiresTwoFactor: true;
  challengeToken: string;
  emailHint: string;
  expiresInSeconds: number;
};

type LoginResult =
  | { status: 'authenticated' }
  | ({ status: 'two-factor-required' } & TwoFactorChallenge)
  | { status: 'error'; error: string };

type TwoFactorResult = { ok: true } | { ok: false; error: string };

function isTwoFactorChallenge(
  value: TwoFactorChallenge | { access_token: string; user: AuthUser },
): value is TwoFactorChallenge {
  return 'requiresTwoFactor' in value && value.requiresTwoFactor === true;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<TwoFactorResult>;
  resendTwoFactor: (challengeToken: string) => Promise<({ ok: true } & TwoFactorChallenge) | { ok: false; error: string }>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

function normalizeThemeName(theme?: string | null) {
  return theme === 'Light Steel' ? 'Default Theme' : (theme || 'Default Theme');
}

function applyTheme(theme?: string | null) {
  try {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const applyResolvedUser = useCallback((nextUser: AuthUser, options?: { resetCache?: boolean }) => {
    const normalizedTheme = normalizeThemeName(nextUser.theme);
    setUser({ ...nextUser, theme: normalizedTheme });
    applyTheme(normalizedTheme);
    if (options?.resetCache) {
      qc.clear();
    }
  }, [qc]);

  const clearSession = useCallback(() => {
    setAuthToken(undefined);
    clearStoredAuthToken();
    clearStoredPendingTwoFactorChallenge();
    setUser(null);
    applyTheme(null);
    qc.clear();
  }, [qc]);

  const applyAuthenticatedSession = useCallback((payload: { access_token: string; user: AuthUser }) => {
    const token = payload.access_token;
    storeAuthToken(token);
    clearStoredPendingTwoFactorChallenge();
    setAuthToken(token);
    applyResolvedUser(payload.user, { resetCache: true });
    qc.invalidateQueries({ predicate: () => true });
  }, [applyResolvedUser, qc]);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await api.get<AuthUser>('/auth/me');
      const nextUser = res.data;
      const mustResetCache = !!user && (
        user.id !== nextUser.id ||
        user.role !== nextUser.role ||
        (user.orgId ?? null) !== (nextUser.orgId ?? null)
      );
      applyResolvedUser(nextUser, { resetCache: mustResetCache });
    } catch {
      // ignore transient refresh failures
    }
  }, [applyResolvedUser, user]);

  useEffect(() => {
    // Rehydrate session from stored token and fetch /auth/me
    const token = getStoredAuthToken();
    if (token) {
      setAuthToken(token);
      api.get<AuthUser>('/auth/me').then(res => {
        applyResolvedUser(res.data);
        setLoading(false);
      }).catch(() => {
        clearSession();
        setLoading(false);
      });
    } else {
      qc.clear();
      setLoading(false);
    }
  }, [applyResolvedUser, clearSession, qc]);

  useEffect(() => {
    if (!user) return;

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'hidden') return;
      void refreshProfile();
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [refreshProfile, user]);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    async login(email: string, password: string) {
      try {
        const res = await api.post<{ access_token: string; user: AuthUser } | TwoFactorChallenge>('/auth/login', { email, password });
        const data = res.data;
        if (isTwoFactorChallenge(data)) {
          storePendingTwoFactorChallenge(data);
          return { status: 'two-factor-required', ...data } as const;
        }
        applyAuthenticatedSession(data);
        return { status: 'authenticated' } as const;
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Login fehlgeschlagen';
        return { status: 'error', error: Array.isArray(msg as []) ? (msg as string[]).join(', ') : String(msg) } as const;
      }
    },
    async verifyTwoFactor(challengeToken: string, code: string) {
      try {
        const res = await api.post<{ access_token: string; user: AuthUser }>('/auth/verify-two-factor', { challengeToken, code });
        applyAuthenticatedSession(res.data);
        return { ok: true } as const;
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Codeprüfung fehlgeschlagen';
        return { ok: false, error: Array.isArray(msg as []) ? (msg as string[]).join(', ') : String(msg) } as const;
      }
    },
    async resendTwoFactor(challengeToken: string) {
      try {
        const res = await api.post<TwoFactorChallenge>('/auth/resend-two-factor', { challengeToken });
        storePendingTwoFactorChallenge(res.data);
        return { ok: true, ...res.data } as const;
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Code konnte nicht erneut versendet werden';
        return { ok: false, error: Array.isArray(msg as []) ? (msg as string[]).join(', ') : String(msg) } as const;
      }
    },
    logout() {
      clearSession();
    },
    async refresh() {
      await refreshProfile();
    },
  }), [applyAuthenticatedSession, clearSession, loading, refreshProfile, user]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
