import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';
import { getStoredAuthToken } from './authStorage';

type OrgScopeValue = string | null | undefined;
interface OrgScopeState {
  scope: OrgScopeValue; // undefined=legacy/none (treated as null for superadmin), null=no-org, string=orgId
  ready: boolean;
  switching: boolean;
  setScope: (v: OrgScopeValue) => void;
  clear: () => void;
}

const OrgScopeCtx = createContext<OrgScopeState | undefined>(undefined);

const LEGACY_KEY = 'x_org_scope';
const ORG_NAME_CACHE_KEY = 'org_name_cache';
const storageKeyFor = (userId?: string | null) => userId ? `x_org_scope:${userId}` : LEGACY_KEY;

function removeCachedOrgName(orgId: string) {
  try {
    const cached = JSON.parse(localStorage.getItem(ORG_NAME_CACHE_KEY) || '{}') as Record<string, string>;
    if (!(orgId in cached)) return;
    delete cached[orgId];
    localStorage.setItem(ORG_NAME_CACHE_KEY, JSON.stringify(cached));
  } catch {
    /* ignore unavailable or malformed storage */
  }
}

function applyOrgScopeHeader(nextScope: OrgScopeValue) {
  if (typeof nextScope === 'undefined') {
    delete api.defaults.headers.common['X-Org-Scope'];
  } else if (nextScope === null) {
    api.defaults.headers.common['X-Org-Scope'] = 'null';
  } else {
    api.defaults.headers.common['X-Org-Scope'] = nextScope;
  }
}

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
    const token = getStoredAuthToken();
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
  applyOrgScopeHeader(initialStoredScope);
} catch { /* ignore */ }

export function OrgScopeProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, updateSessionUser } = useAuth();
  const [scope, setScopeState] = useState<OrgScopeValue>(initialStoredScope);
  const [switching, setSwitching] = useState(false);
  const qc = useQueryClient();
  const scopeChangeSourceRef = useRef<'init' | 'user'>('init');
  const switchRunIdRef = useRef(0);
  const previousUserRef = useRef<{ id: string; orgId: string | null; role: string } | null>(null);

  // Load persisted scope on mount and whenever user changes
  useEffect(() => {
    // During initial auth hydration, `user` can be null even though a valid token exists.
    // Do NOT clear scope in that case; otherwise early queries (e.g. Calendar) will run as GLOBAL.
    if (!user) {
      if (loading) return;
      scopeChangeSourceRef.current = 'init';
      setScopeState(undefined);
      try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
      previousUserRef.current = null;
      return;
    }

    // Do not overwrite an explicit scope switch. `setScope` also updates the
    // session user (active role/org), which reruns this effect before the
    // scope effect can start its refresh. Resetting the marker here stranded
    // the transition overlay in its loading state.
    if (scopeChangeSourceRef.current !== 'user') {
      scopeChangeSourceRef.current = 'init';
    }
    const previousUser = previousUserRef.current;
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
      // Superadmin: do NOT allow implicit "global" scope.
      // If nothing is stored, default to null (superadmin area without tenant data).
      const next = (typeof parsed === 'undefined') ? null : parsed;
      setScopeState(next);
      try { localStorage.setItem(key, next === null ? 'null' : String(next)); } catch { /* ignore */ }
      previousUserRef.current = { id: user.id, orgId: user.orgId ?? null, role: user.role };
      return;
    }

    const roleOrOrgChangedForSameUser = !!previousUser && previousUser.id === user.id && (
      previousUser.role !== user.role ||
      previousUser.orgId !== (user.orgId ?? null)
    );

    // A non-superadmin can only select an explicitly assigned membership. This
    // deliberately does not inherit a parent or child organization scope.
    const memberships = user.memberships || [];
    const ownScope = user.orgId ?? memberships[0]?.orgId ?? null;
    const requestedScope = !roleOrOrgChangedForSameUser && typeof parsed === 'string'
      ? parsed
      : null;
    const selectedScope = requestedScope && memberships.some((membership) => membership.orgId === requestedScope)
      ? requestedScope
      : ownScope;
    setScopeState(selectedScope);
    previousUserRef.current = { id: user.id, orgId: user.orgId ?? null, role: user.role };

    if (requestedScope && selectedScope !== requestedScope) removeCachedOrgName(requestedScope);
    try { localStorage.setItem(key, selectedScope === null ? 'null' : selectedScope); } catch { /* ignore */ }
  }, [user?.id, user?.role, user?.orgId, user?.memberships, loading]);

  // Apply the org scope header before regular query effects run.
  useLayoutEffect(() => {
    applyOrgScopeHeader(scope);
  }, [scope]);

  useEffect(() => {
    // Only reinitialize data when the user explicitly changes the org scope.
    // On initial load we must NOT clear/remove queries, otherwise PostLoginPrefetch can hang.
    if (scopeChangeSourceRef.current !== 'user') return;
    scopeChangeSourceRef.current = 'init';

    const runId = ++switchRunIdRef.current;
    setSwitching(true);
    // Queries use the scope as part of their key, so changing the scope starts
    // fresh requests. Refreshing background queries must not keep the whole UI
    // blocked: an unrelated request can retry indefinitely. Fire it in the
    // background and end the transition after React applied the new scope.
    void qc.invalidateQueries({ predicate: () => true, refetchType: 'active' });
    requestAnimationFrame(() => {
      if (switchRunIdRef.current === runId) setSwitching(false);
    });
  }, [scope, qc]);

  const setScope = useCallback((v: OrgScopeValue) => {
    // Prevent switching to the same scope (causes infinite loading)
    if (v === scope) return;

    scopeChangeSourceRef.current = 'user';
    // Make UI react immediately on confirm (e.g. show initializer overlay).
    setSwitching(true);
    applyOrgScopeHeader(v);
    setScopeState(v);
    if (user && typeof v === 'string' && user.role !== 'superadmin') {
      const membership = user.memberships?.find((item) => item.orgId === v);
      if (membership) {
        updateSessionUser({
          ...user,
          orgId: membership.orgId,
          orgName: membership.orgName,
          role: membership.role,
        });
      }
    }
    try {
      const key = storageKeyFor(user?.id);
      if (typeof v === 'undefined') localStorage.removeItem(key);
      else if (v === null) localStorage.setItem(key, 'null');
      else localStorage.setItem(key, v);
    } catch { /* ignore */ }
  }, [user, scope, updateSessionUser]);

  const value = useMemo<OrgScopeState>(() => ({
    scope,
    ready: typeof scope !== 'undefined',
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

/**
 * Returns a stable string representation of the current org scope for use in query keys.
 * This ensures each org scope has its own cache entries.
 */
export function useOrgScopeKey(): string {
  const { scope } = useOrgScope();
  return typeof scope === 'undefined' ? '__GLOBAL__' : scope === null ? '__NULL__' : scope;
}

export function useOrgScopeReady(): boolean {
  const { ready } = useOrgScope();
  return ready;
}

export function useOrgScopedQueryState() {
  const { scope, ready, switching } = useOrgScope();
  const scopeKey = useOrgScopeKey();
  return { scope, scopeKey, ready, switching };
}
