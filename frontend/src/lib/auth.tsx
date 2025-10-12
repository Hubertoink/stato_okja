import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAuthToken } from './api';

export type Role = 'superadmin' | 'org_admin' | 'user';
export interface AuthUser { id: string; email: string; name: string; role: Role; orgId?: string | null; orgName?: string | null; avatarUrl?: string | null; theme?: string }

type LoginResult = { ok: true } | { ok: false; error: string };

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    // Rehydrate session from stored token and fetch /auth/me
    const token = localStorage.getItem('auth_token') || '';
    if (token) {
      setAuthToken(token);
  api.get<AuthUser>('/auth/me').then(res => {
    const t = (res.data.theme === 'Light Steel') ? 'Default Theme' : (res.data.theme || 'Default Theme');
    setUser({ ...res.data, theme: t });
  try { document.documentElement.setAttribute('data-theme', t); } catch (e) { /* noop */ }
        setLoading(false);
      }).catch(() => {
        setAuthToken(undefined);
        localStorage.removeItem('auth_token');
        setUser(null);
  try { document.documentElement.removeAttribute('data-theme'); } catch (e) { /* noop */ }
        qc.clear();
        setLoading(false);
      });
    } else {
      qc.clear();
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    async login(email: string, password: string) {
      try {
        const res = await api.post<{ access_token: string; user: AuthUser }>('/auth/login', { email, password });
        const token = res.data.access_token;
        localStorage.setItem('auth_token', token);
        setAuthToken(token);
        // Clear any cached data from a previous session so next queries refetch for this user/org
        qc.clear();
    const t = (res.data.user.theme === 'Light Steel') ? 'Default Theme' : (res.data.user.theme || 'Default Theme');
    setUser({ ...res.data.user, theme: t });
  try { document.documentElement.setAttribute('data-theme', t); } catch (e) { /* noop */ }
        // Also proactively invalidate any active queries
        qc.invalidateQueries({ predicate: () => true });
        return { ok: true } as const;
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Login fehlgeschlagen';
  return { ok: false, error: Array.isArray(msg as []) ? (msg as string[]).join(', ') : String(msg) } as const;
      }
    },
    logout() {
      localStorage.removeItem('auth_token');
      setAuthToken(undefined);
      setUser(null);
  try { document.documentElement.removeAttribute('data-theme'); } catch (e) { /* noop */ }
      // Remove all cached queries so the next login starts fresh
      qc.clear();
    },
    async refresh() {
      try {
        const res = await api.get<AuthUser>('/auth/me');
    const t = (res.data.theme === 'Light Steel') ? 'Default Theme' : (res.data.theme || 'Default Theme');
    setUser({ ...res.data, theme: t });
  try { document.documentElement.setAttribute('data-theme', t); } catch (e) { /* noop */ }
      } catch {
        // ignore
      }
    },
  }), [user, loading, qc]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useRequireRole(roles: Array<'superadmin' | 'org_admin' | 'user'>) {
  const { user } = useAuth();
  return !!user && roles.includes(user.role);
}
