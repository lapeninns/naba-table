import { sanitizeLocalRedirectPath } from '@/lib/url/safe-local-path';

import type { NextRequest } from 'next/server';

const OPS_REDIRECT_PREFIXES = [
  '/app',
  '/dashboard',
  '/bookings',
  '/customers',
  '/new-bookings',
  '/settings',
  '/management',
  '/seating',
] as const;

const GUEST_REDIRECT_PREFIXES = ['/guest', '/bookings', '/restaurants'] as const;

function isAllowedPath(path: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function allowedHosts(rootDomain: string): Set<string> {
  const base = normalizeRootDomain(rootDomain);
  const hosts = new Set<string>([base, `www.${base}`, `app.${base}`]);

  if (base === 'localhost') {
    hosts.add('localhost');
    hosts.add('127.0.0.1');
    hosts.add('app.localhost');
    hosts.add('www.localhost');
  }

  return hosts;
}

function isLocalLikeHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized.endsWith('.localhost') ||
    normalized.startsWith('app.localhost')
  );
}

function isAppHost(hostname: string, rootDomain: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  const appHost = buildAppHost(rootDomain);
  if (isLocalLikeHost(normalizedHost)) {
    return normalizedHost.startsWith('app.');
  }
  return normalizedHost === appHost;
}

function allowedRedirectPrefixes(
  hostname: string | undefined,
  rootDomain: string,
): readonly string[] {
  if (!hostname) {
    return [...OPS_REDIRECT_PREFIXES, ...GUEST_REDIRECT_PREFIXES];
  }
  return isAppHost(hostname, rootDomain) ? OPS_REDIRECT_PREFIXES : GUEST_REDIRECT_PREFIXES;
}

function normalizeRootDomain(rootDomain: string): string {
  return rootDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

function buildAppHost(rootDomain: string): string {
  return `app.${normalizeRootDomain(rootDomain)}`;
}

function buildWwwHost(rootDomain: string): string {
  const normalized = normalizeRootDomain(rootDomain);
  return rootDomain.toLowerCase().startsWith('www.')
    ? rootDomain.toLowerCase()
    : `www.${normalized}`;
}

function isAllowedAuthHost(hostname: string, rootDomain: string): boolean {
  return allowedHosts(rootDomain).has(hostname.toLowerCase().replace(/:\d+$/, ''));
}

function toAbsoluteRedirect(target: string, rootDomain: string): string {
  if (/^https?:\/\//i.test(target)) return target;
  if (rootDomain === 'localhost') return target;

  const normalizedRoot = rootDomain.startsWith('www.') ? rootDomain : `www.${rootDomain}`;
  const normalizedPath = target.startsWith('/') ? target : `/${target}`;
  return `https://${normalizedRoot}${normalizedPath}`;
}

function extractHostname(value: string | null): string | null {
  if (!value) return null;

  const [first] = value.split(',');
  const trimmed = first?.trim();
  if (!trimmed) return null;

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed).hostname.toLowerCase();
    }
  } catch {
    return null;
  }

  return trimmed.toLowerCase().replace(/:\d+$/, '');
}

export function parseHostname(req: NextRequest): string {
  // Prefer the inbound Host header over Next's parsed URL. In local multi-host dev
  // (`app.localhost` vs `localhost`), req.nextUrl can still reflect the internal
  // origin while the browser is on the ops subdomain — wrong host → guest redirects.
  const candidates = [
    req.headers.get('host'),
    req.nextUrl?.hostname,
    (() => {
      try {
        return new URL(req.url).hostname;
      } catch {
        return null;
      }
    })(),
  ];

  for (const candidate of candidates) {
    const hostname = extractHostname(candidate);
    if (hostname) return hostname;
  }

  const urlHost = req.nextUrl?.hostname?.toLowerCase?.() ?? '';
  return urlHost.replace(/:\d+$/, '');
}

export function resolveTrustedAuthHostname(
  hostname: string | null | undefined,
  rootDomain: string,
): string {
  const normalizedHost = hostname ? extractHostname(hostname) : null;

  if (normalizedHost && isAllowedAuthHost(normalizedHost, rootDomain)) {
    return normalizedHost;
  }

  const normalizedRoot = normalizeRootDomain(rootDomain);
  if (normalizedRoot === 'localhost') {
    return 'localhost';
  }

  return buildWwwHost(normalizedRoot);
}

export function buildAuthCallbackUrl(params: {
  hostname: string;
  rootDomain: string;
  redirectedFrom: string | undefined;
  rememberMe: boolean;
  pathname?: string;
}): string {
  const trustedHostname = resolveTrustedAuthHostname(params.hostname, params.rootDomain);
  const local = isLocalLikeHost(trustedHostname);
  const protocol = local ? 'http' : 'https';
  const callbackHost =
    local && !trustedHostname.includes(':') ? `${trustedHostname}:3000` : trustedHostname;
  const url = new URL(params.pathname ?? '/api/auth/callback', `${protocol}://${callbackHost}`);

  if (params.redirectedFrom) {
    url.searchParams.set('redirectedFrom', params.redirectedFrom);
  }
  url.searchParams.set('rememberMe', params.rememberMe ? '1' : '0');
  return url.toString();
}

export function normalizeTrustedMagicLinkRedirect(
  emailRedirectTo: string,
  rootDomain: string,
): string | null {
  try {
    const url = new URL(emailRedirectTo);
    const hostname = url.hostname.toLowerCase();
    const local = normalizeRootDomain(rootDomain) === 'localhost' && isLocalLikeHost(hostname);

    if (!isAllowedAuthHost(hostname, rootDomain)) {
      return null;
    }

    if (url.pathname !== '/api/auth/callback') {
      return null;
    }

    if (local) {
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }
    } else if (url.protocol !== 'https:') {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function defaultRedirectForHost(hostname: string, rootDomain: string): string {
  const normalizedHost = hostname.toLowerCase();
  const appHost = buildAppHost(rootDomain);
  const isAppHost = isLocalLikeHost(normalizedHost)
    ? normalizedHost.startsWith('app.')
    : normalizedHost === appHost;

  if (isAppHost) {
    // On app subdomain, return /dashboard directly - proxy rewrites to /app/dashboard
    if (isLocalLikeHost(normalizedHost)) return '/dashboard';
    return `https://${appHost}/dashboard`;
  }

  // On root domain, return /guest/dashboard for guest-facing flows
  if (isLocalLikeHost(normalizedHost)) return '/guest/dashboard';
  return `https://${buildWwwHost(rootDomain)}/guest/dashboard`;
}

export function sanitizeRedirect(
  target: string | undefined | null,
  rootDomain: string,
  hostname?: string,
): string | undefined {
  if (!target) return undefined;
  if (/\\|%5c/i.test(target)) return undefined;

  if (/^https?:\/\//i.test(target)) {
    try {
      const url = new URL(target);
      const normalizedHost = url.hostname.toLowerCase();
      if (!allowedHosts(rootDomain).has(normalizedHost)) return undefined;
      const prefixes = allowedRedirectPrefixes(normalizedHost, rootDomain);
      return isAllowedPath(url.pathname, prefixes) ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  const prefixes = allowedRedirectPrefixes(hostname, rootDomain);
  const sanitized = sanitizeLocalRedirectPath(target, {
    fallback: '',
    allowedPrefixes: prefixes,
  });
  if (!sanitized) return undefined;
  return sanitized;
}

export function toAbsoluteRedirectTarget(target: string, rootDomain: string): string {
  return toAbsoluteRedirect(target, rootDomain);
}
