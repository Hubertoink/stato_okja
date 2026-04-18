const AUTH_TOKEN_KEY = 'auth_token';

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
}

export function subscribeToAuthEvents(_onLogout: () => void) {
  return () => {
    // Auth is intentionally isolated per tab via sessionStorage.
  };
}