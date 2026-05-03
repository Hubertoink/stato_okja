const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_CSRF_TOKEN_KEY = 'refresh_csrf_token';
const PENDING_TWO_FACTOR_KEY = 'pending_two_factor_challenge';

type PendingTwoFactorChallenge = {
  challengeToken: string;
  emailHint: string;
  expiresAt: number;
};

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

export function getStoredRefreshCsrfToken(): string {
  const sessionStorage = getSessionStorage();
  try {
    return sessionStorage?.getItem(REFRESH_CSRF_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function storeRefreshCsrfToken(token: string) {
  const sessionStorage = getSessionStorage();
  try {
    if (token) sessionStorage?.setItem(REFRESH_CSRF_TOKEN_KEY, token);
    else sessionStorage?.removeItem(REFRESH_CSRF_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function clearStoredRefreshCsrfToken() {
  const sessionStorage = getSessionStorage();
  try {
    sessionStorage?.removeItem(REFRESH_CSRF_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function getStoredPendingTwoFactorChallenge(): PendingTwoFactorChallenge | null {
  const localStorage = getLocalStorage();
  try {
    const raw = localStorage?.getItem(PENDING_TWO_FACTOR_KEY) || '';
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PendingTwoFactorChallenge>;
    if (
      typeof parsed.challengeToken !== 'string' ||
      typeof parsed.emailHint !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      localStorage?.removeItem(PENDING_TWO_FACTOR_KEY);
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      localStorage?.removeItem(PENDING_TWO_FACTOR_KEY);
      return null;
    }

    return {
      challengeToken: parsed.challengeToken,
      emailHint: parsed.emailHint,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    localStorage?.removeItem(PENDING_TWO_FACTOR_KEY);
    return null;
  }
}

export function storePendingTwoFactorChallenge(challenge: {
  challengeToken: string;
  emailHint: string;
  expiresInSeconds: number;
}) {
  const localStorage = getLocalStorage();
  try {
    localStorage?.setItem(
      PENDING_TWO_FACTOR_KEY,
      JSON.stringify({
        challengeToken: challenge.challengeToken,
        emailHint: challenge.emailHint,
        expiresAt: Date.now() + challenge.expiresInSeconds * 1000,
      } satisfies PendingTwoFactorChallenge),
    );
  } catch {
    // ignore
  }
}

export function clearStoredPendingTwoFactorChallenge() {
  const localStorage = getLocalStorage();
  try {
    localStorage?.removeItem(PENDING_TWO_FACTOR_KEY);
  } catch {
    // ignore
  }
}

export function subscribeToAuthEvents(_onLogout: () => void) {
  return () => {
    // Auth is intentionally isolated per tab via sessionStorage.
  };
}