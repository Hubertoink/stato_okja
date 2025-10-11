import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { MockUser, ensureSeed, getCurrentUser, setCurrentUser, loadUsers } from './mockdb';

type LoginResult = { ok: true } | { ok: false; error: string };

interface AuthState {
  user: MockUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ensureSeed();
    const u = getCurrentUser();
    setUser(u);
    setLoading(false);
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    async login(email: string, password: string) {
      const list = loadUsers();
      const u = list.find((x) => x.email.toLowerCase() === email.toLowerCase());
      if (!u) return { ok: false, error: 'Unbekannte E-Mail' } as const;
      if (u.invited && !u.password) {
        // invited user must set password first in real flow
        return { ok: false, error: 'Einladung noch nicht angenommen' } as const;
      }
      if ((u.password || '') !== password) return { ok: false, error: 'Falsches Passwort' } as const;
      setCurrentUser(u);
      setUser(u);
      return { ok: true } as const;
    },
    logout() {
      setCurrentUser(null);
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
