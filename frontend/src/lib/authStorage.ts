const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_EVENT_KEY = 'stato:auth:event';

type AuthEventType = 'login' | 'logout';

function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function broadcastAuthEvent(type: AuthEventType) {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(AUTH_EVENT_KEY, JSON.stringify({ type, at: Date.now() }));
  } catch {
    // ignore
  }
}

export function getStoredAuthToken(): string {
  const sessionStorage = getSessionStorage();
  const localStorage = getLocalStorage();

  try {
    const current = sessionStorage?.getItem(AUTH_TOKEN_KEY) || '';
    if (current) return current;

    const legacy = localStorage?.getItem(AUTH_TOKEN_KEY) || '';
    if (!legacy) return '';

    sessionStorage?.setItem(AUTH_TOKEN_KEY, legacy);
    localStorage?.removeItem(AUTH_TOKEN_KEY);
    return legacy;
  } catch {
    return '';
  }
}

export function storeAuthToken(token: string) {
  const sessionStorage = getSessionStorage();
  const localStorage = getLocalStorage();
  try {
    sessionStorage?.setItem(AUTH_TOKEN_KEY, token);
    localStorage?.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
  broadcastAuthEvent('login');
}

export function clearStoredAuthToken() {
  const sessionStorage = getSessionStorage();
  const localStorage = getLocalStorage();
  try {
    sessionStorage?.removeItem(AUTH_TOKEN_KEY);
    localStorage?.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
  broadcastAuthEvent('logout');
}

export function subscribeToAuthEvents(onLogout: () => void) {
  const handler = (event: StorageEvent) => {
    if (event.key === AUTH_EVENT_KEY && event.newValue) {
      try {
        const payload = JSON.parse(event.newValue) as { type?: AuthEventType };
        if (payload.type === 'logout') onLogout();
      } catch {
        // ignore malformed events
      }
      return;
    }

    if (event.key === AUTH_TOKEN_KEY && !event.newValue) {
      onLogout();
    }
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}