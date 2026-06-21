import { getTrustedAppOrigin } from '@/lib/site-url';
import { sanitizeLocalRedirectPath } from '@/lib/url/safe-local-path';

import type { NextRequest } from 'next/server';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'app.localhost', 'www.localhost']);
const GBP_RETURN_PATH_PREFIXES = ['/app/settings/restaurant/google-business-profile'] as const;

function isLocalDevelopmentHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return LOCAL_HOSTS.has(normalized) || normalized.endsWith('.localhost');
}

export function getRequestOrigin(request: NextRequest): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  if (rootDomain === 'localhost' && isLocalDevelopmentHost(request.nextUrl.hostname)) {
    return request.nextUrl.origin;
  }

  return getTrustedAppOrigin();
}

export function sanitizeGoogleBusinessProfileReturnPath(raw: string | null | undefined): string {
  return sanitizeLocalRedirectPath(raw, {
    fallback: '/app/settings/restaurant/google-business-profile',
    allowedPrefixes: GBP_RETURN_PATH_PREFIXES,
    allowAbsolute: true,
  });
}
