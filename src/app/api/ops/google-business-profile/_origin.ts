
import { getTrustedAppOrigin } from '@/lib/site-url';
import { sanitizeLocalRedirectPath } from '@/lib/url/safe-local-path';

import type { NextRequest } from 'next/server';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'app.localhost', 'www.localhost']);
const GBP_RETURN_PATH_PREFIXES = ['/app/settings/restaurant/google-business-profile'] as const;

function isLocalDevelopmentHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return LOCAL_HOSTS.has(normalized) || normalized.endsWith('.localhost');
}

function normalizeForwardedHost(value: string | null): string | null {
  const host = value?.split(',')[0]?.trim();
  if (!host || host.includes('/') || host.includes('\\') || host.includes('@')) {
    return null;
  }
  return host;
}

function normalizeForwardedProto(value: string | null): 'http' | 'https' | null {
  const proto = value?.split(',')[0]?.trim().toLowerCase();
  return proto === 'http' || proto === 'https' ? proto : null;
}

export function getRequestOrigin(request: NextRequest): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  if (rootDomain === 'localhost' && isLocalDevelopmentHost(request.nextUrl.hostname)) {
    return request.nextUrl.origin;
  }

  const forwardedHost = normalizeForwardedHost(request.headers.get('x-forwarded-host'));
  const requestHost = normalizeForwardedHost(request.headers.get('host')) ?? request.nextUrl.host;
  const host = forwardedHost ?? requestHost;
  const requestProto = request.nextUrl.protocol.replace(':', '') === 'http' ? 'http' : 'https';
  const proto = normalizeForwardedProto(request.headers.get('x-forwarded-proto')) ?? requestProto;

  if (host) {
    return `${proto}://${host}`;
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
