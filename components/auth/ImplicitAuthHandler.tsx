'use client';

import { useEffect } from 'react';

const SENSITIVE_AUTH_FRAGMENT_KEYS = new Set([
  'access_token',
  'refresh_token',
  'provider_token',
  'provider_refresh_token',
]);

function hashContainsAuthTokens(hash: string): boolean {
  if (!hash) {
    return false;
  }

  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  for (const key of SENSITIVE_AUTH_FRAGMENT_KEYS) {
    if (params.has(key)) {
      return true;
    }
  }

  return false;
}

/**
 * Clears legacy implicit auth fragments without installing a browser session.
 *
 * Nabatable magic links now use the server `/api/auth/callback?token_hash=...`
 * flow, so accepting arbitrary global `#access_token` fragments would re-open
 * login CSRF/session-fixation risk.
 */
export function ImplicitAuthHandler(_props: { defaultRedirect?: string } = {}) {
  useEffect(() => {
    if (typeof window === 'undefined' || !hashContainsAuthTokens(window.location.hash)) return;

    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  return null;
}
