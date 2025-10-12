import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

type OrgScopeValue = string | null | undefined;
interface OrgScopeState {
  scope: OrgScopeValue; // undefined=global (superadmin only), null=root, string=orgId
  setScope: (v: OrgScopeValue) => void;
  clear: () => void;
}

const OrgScopeCtx = createContext<OrgScopeState | undefined>(undefined);

const LEGACY_KEY = 'x_org_scope';
const storageKeyFor = (userId?: string | null) => userId ? `x_org_scope:${userId}` : LEGACY_KEY;

// Read persisted scope synchronously to avoid initial flash to global for superadmin
const initialStoredScope: OrgScopeValue = (() => {
  try {
    // Best effort: read legacy key before user context is ready
    const raw = localStorage.getItem(LEGACY_KEY);
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
  const qc = useQueryClient();

  // Load persisted scope on mount and whenever user changes
  useEffect(() => {
    // Reset when user logs out
    if (!user) {
      setScopeState(undefined);
      try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
      return;
    }
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
    // Invalidate all queries so pages refetch under the new org scope
    qc.invalidateQueries({ predicate: () => true });
  }, [scope]);

  const setScope = (v: OrgScopeValue) => {
    setScopeState(v);
    try {
      const key = storageKeyFor(user?.id);
      if (typeof v === 'undefined') localStorage.removeItem(key);
      else if (v === null) localStorage.setItem(key, 'null');
      else localStorage.setItem(key, v);
    } catch { /* ignore */ }
  };

  const value = useMemo<OrgScopeState>(() => ({
    scope,
    setScope,
    clear: () => setScope(undefined),
  }), [scope]);

  return <OrgScopeCtx.Provider value={value}>{children}</OrgScopeCtx.Provider>;
}

export function useOrgScope() {
  const ctx = useContext(OrgScopeCtx);
  if (!ctx) throw new Error('useOrgScope must be used within OrgScopeProvider');
  return ctx;
}
