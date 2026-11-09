// Workbox matches pathname + search, so token query strings must be included.
export const networkOnlyNavigationPatterns = [
  // The animation has its own HTML document; never replace it with the SPA shell.
  /^\/login-fluid\//,
  /^\/survey\//,
  /^\/(?:accept-invite|reset-password|reset-password-request)(?:[/?]|$)/,
];
