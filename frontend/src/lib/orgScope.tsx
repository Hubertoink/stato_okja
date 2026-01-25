import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

type OrgScopeValue = string | null | undefined;
interface OrgScopeState {
  scope: OrgScopeValue; // undefined=global (superadmin only), null=root, string=orgId
  switching: boolean;
  setScope: (v: OrgScopeValue) => void;
  clear: () => void;
}

const OrgScopeCtx = createContext<OrgScopeState | undefined>(undefined);

const LEGACY_KEY = 'x_org_scope';
const storageKeyFor = (userId?: string | null) => userId ? `x_org_scope:${userId}` : LEGACY_KEY;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = (token || '').split('.');
    if (parts.length < 2) return null;
    // base64url decode
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function userIdFromStoredToken(): string | null {
  try {
    const token = localStorage.getItem('auth_token') || '';
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    const sub = payload?.sub;
    return typeof sub === 'string' && sub.length ? sub : null;
  } catch {
    return null;
  }
}

// Read persisted scope synchronously to avoid initial flash to global for superadmin
const initialStoredScope: OrgScopeValue = (() => {
  try {
    // Best effort: if we have a stored auth token, decode userId (sub) and read the per-user scope key.
    // This prevents a flash back to global on refresh for superadmins.
    const uid = userIdFromStoredToken();
    const primaryKey = uid ? storageKeyFor(uid) : LEGACY_KEY;
    let raw = localStorage.getItem(primaryKey);
    // Fallback to legacy key if per-user is missing (supports migration / older sessions)
    if (raw === null && primaryKey !== LEGACY_KEY) raw = localStorage.getItem(LEGACY_KEY);
    if (raw === null) return undefined; // no persisted choice
    if (raw === 'null') return null;
    return raw; // orgId string
  } catch {
    return undefined;
  }
})();

// Apply initial header immediately so first requests (before provider effects run) use the stored scope
try {
  if (typeof initialStoredScope === 'undefined') {
    delete (api.defaults.headers.common as Record<string, unknown>)['X-Org-Scope'];
  } else if (initialStoredScope === null) {
    api.defaults.headers.common['X-Org-Scope'] = 'null';
  } else {
    api.defaults.headers.common['X-Org-Scope'] = initialStoredScope;
  }
} catch { /* ignore */ }

export function OrgScopeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [scope, setScopeState] = useState<OrgScopeValue>(initialStoredScope);
  const [switching, setSwitching] = useState(false);
  const qc = useQueryClient();
  const scopeChangeSourceRef = useRef<'init' | 'user'>('init');
  const switchRunIdRef = useRef(0);

  // Load persisted scope on mount and whenever user changes
  useEffect(() => {
    // Reset when user logs out
    if (!user) {
      scopeChangeSourceRef.current = 'init';
      setScopeState(undefined);
      try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
      return;
    }

    // Any scope updates in this effect are hydration/init.
    scopeChangeSourceRef.current = 'init';
    const key = storageKeyFor(user.id);
    // Migrate legacy key -> user-specific key if needed
    try {
      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      const existingPerUser = localStorage.getItem(key);
      if (legacyRaw !== null && existingPerUser === null) {
        localStorage.setItem(key, legacyRaw);
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch { /* ignore */ }

    // Load user-specific stored selection
    let parsed: OrgScopeValue = undefined;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) parsed = undefined; else if (raw === 'null') parsed = null; else parsed = raw;
    } catch { parsed = undefined; }

    if (user.role === 'superadmin') {
      // Keep superadmin's stored selection; if none, leave current state as-is (could be legacy)
      if (typeof parsed !== 'undefined') setScopeState(parsed);
      return;
    }
    // org_admin/user: allow persisted selection within subtree; sanitize null/undefined to own orgId
    const next = (typeof parsed === 'string') ? parsed : (user.orgId ?? null);
    setScopeState(next);
    try { localStorage.setItem(key, next === null ? 'null' : String(next)); } catch { /* ignore */ }
  }, [user?.id, user?.role, user?.orgId]);

  // Apply header to axios
  useEffect(() => {
    if (typeof scope === 'undefined') {
      delete api.defaults.headers.common['X-Org-Scope'];
    } else if (scope === null) {
      api.defaults.headers.common['X-Org-Scope'] = 'null';
    } else {
      api.defaults.headers.common['X-Org-Scope'] = scope;
    }

    // Only reinitialize data when the user explicitly changes the org scope.
    // On initial load we must NOT clear/remove queries, otherwise PostLoginPrefetch can hang.
    if (scopeChangeSourceRef.current !== 'user') return;
    scopeChangeSourceRef.current = 'init';

    const runId = ++switchRunIdRef.current;
    setSwitching(true);
    void qc
      .cancelQueries({ predicate: () => true })
      .then(() => qc.resetQueries({ predicate: () => true }))
      .then(() => qc.refetchQueries({ predicate: () => true, type: 'active' }))
      .finally(() => {
        if (switchRunIdRef.current === runId) setSwitching(false);
      });
  }, [scope, qc]);

  const setScope = useCallback((v: OrgScopeValue) => {
    scopeChangeSourceRef.current = 'user';
    setScopeState(v);
    try {
      const key = storageKeyFor(user?.id);
      if (typeof v === 'undefined') localStorage.removeItem(key);
      else if (v === null) localStorage.setItem(key, 'null');
      else localStorage.setItem(key, v);
    } catch { /* ignore */ }
  }, [user?.id]);

  const value = useMemo<OrgScopeState>(() => ({
    scope,
    switching,
    setScope,
    clear: () => setScope(undefined),
  }), [scope, switching, setScope]);

  return <OrgScopeCtx.Provider value={value}>{children}</OrgScopeCtx.Provider>;
}

export function useOrgScope() {
  const ctx = useContext(OrgScopeCtx);
  if (!ctx) throw new Error('useOrgScope must be used within OrgScopeProvider');
  return ctx;
}
