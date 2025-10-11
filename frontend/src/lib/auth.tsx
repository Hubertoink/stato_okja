import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from './api';

export type Role = 'superadmin' | 'org_admin' | 'user';
export interface AuthUser { id: string; email: string; name: string; role: Role; orgId?: string | null }

type LoginResult = { ok: true } | { ok: false; error: string };

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Rehydrate session from stored token and fetch /auth/me
    const token = localStorage.getItem('auth_token') || '';
    if (token) {
      setAuthToken(token);
      api.get<AuthUser>('/auth/me').then(res => {
        setUser(res.data);
        setLoading(false);
      }).catch(() => {
        setAuthToken(undefined);
        localStorage.removeItem('auth_token');
        setUser(null);
        setLoading(false);
      });
    } else {
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
        setUser(res.data.user);
        return { ok: true } as const;
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Login fehlgeschlagen';
        return { ok: false, error: Array.isArray(msg) ? msg.join(', ') : String(msg) } as const;
      }
    },
    logout() {
      localStorage.removeItem('auth_token');
      setAuthToken(undefined);
      setUser(null);
    },
  }), [user, loading]);

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
