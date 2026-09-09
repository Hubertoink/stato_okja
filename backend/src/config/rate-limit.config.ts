function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseBooleanish(value: string | undefined | null) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return undefined;
}

export function getRateLimitOptions(rateLimitTtlRaw?: string, rateLimitMaxRaw?: string) {
  const ttlSeconds = parsePositiveInt(rateLimitTtlRaw, 60);
  const limit = parsePositiveInt(rateLimitMaxRaw, 100);

  return [
    {
      name: 'default',
      ttl: ttlSeconds * 1000,
      limit,
    },
  ];
}

export function getAuthRateLimitOverride(authRateLimitTtlRaw?: string, authRateLimitMaxRaw?: string) {
  const ttlSeconds = parsePositiveInt(authRateLimitTtlRaw, 60);
  const limit = parsePositiveInt(authRateLimitMaxRaw, 10);

  return {
    limit,
    ttl: ttlSeconds * 1000,
  };
}

/** Explicit hop count or proxy CIDRs; no implicit trust based on NODE_ENV. */
export function getTrustProxySetting(trustProxyRaw?: string | null): false | number | string {
  const value = String(trustProxyRaw || '').trim();
  const explicit = parseBooleanish(value);
  if (!value || explicit === false) return false;
  // Compatibility for existing installations: true means exactly one proxy hop.
  if (explicit === true) return 1;
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (!Number.isSafeInteger(hops) || hops < 1) throw new Error('Invalid TRUST_PROXY hop count');
    return hops;
  }
  return value;
}
