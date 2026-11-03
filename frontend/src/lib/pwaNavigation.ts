// Workbox matches pathname + search, so token query strings must be included.
export const networkOnlyNavigationPatterns = [
  /^\/survey\//,
  /^\/(?:accept-invite|reset-password|reset-password-request)(?:[/?]|$)/,
];
