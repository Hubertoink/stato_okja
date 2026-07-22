function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getLoginLockoutConfig() {
  const maxAttempts = parsePositiveInt(process.env.LOGIN_MAX_FAILED_ATTEMPTS, 5);
  const lockoutMinutes = parsePositiveInt(process.env.LOGIN_LOCKOUT_MINUTES, 10);

  return {
    maxAttempts,
    lockoutMs: lockoutMinutes * 60 * 1000,
  };
}
