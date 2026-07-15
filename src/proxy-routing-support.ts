import { NextResponse } from 'next/server';

import { APP_REQUEST_PATH_HEADER } from '@/lib/url/app-request-path';
import { requireOpsAuth } from '@/server/auth/ops-guard';
import {
  QA_OPS_AUTH_COOKIE_NAME,
  QA_OPS_USER_ID,
  isQaOpsAuthFixtureAllowed,
} from '@/server/auth/qa-ops-session';

import type { NextRequest } from 'next/server';

const OPS_API_SERVICES = new Set([
  'bookings',
  'customers',
  'dashboard',
  'occasions',
  'operations-hub',
  'restaurants',
  'settings',
  'strategies',
  'tables',
  'team',
  'zones',
]);

const PUBLIC_OPS_API_PATHS = new Set(['/api/ops/google-business-profile/callback']);
const TRUSTED_OPS_USER_HEADER = 'x-ops-user-id';

export function getRootDomain(): string {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
}

export function parseHost(req: NextRequest): { host: string; hostname: string; port?: string } {
  const host = (req.headers.get('host') || req.nextUrl.host || '').toLowerCase();
  const [hostname = '', port] = host.split(':');
  return { host, hostname, port };
}

function getLocalAppHosts(): Set<string> {
  const raw = process.env.NEXT_PUBLIC_LOCAL_APP_HOSTS ?? '';
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSingleHostMode(hostname: string, host: string): boolean {
  const localHosts = getLocalAppHosts();
  return localHosts.has(host) || localHosts.has(hostname);
}

export function isAppHost(hostname: string, rootDomain: string): boolean {
  if (!hostname) return false;
  return rootDomain === 'localhost'
    ? hostname.startsWith('app.localhost')
    : hostname === `app.${rootDomain}`;
}

export function isStaticOrFramework(pathname: string): boolean {
  if (['/favicon.ico', '/robots.txt', '/sitemap.xml'].includes(pathname)) return true;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_static') ||
    pathname.startsWith('/_vercel')
  ) {
    return true;
  }
  return /\.[a-zA-Z0-9]+$/u.test(pathname);
}

export function applySecurityHeaders(response: NextResponse): void {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set(
    'Content-Security-Policy',
    "base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'",
  );
}

export function buildHostWithPort(hostname: string, port?: string): string {
  return port ? `${hostname}:${port}` : hostname;
}

function normalizeProxyRedirectPath(pathname: string): string {
  if (!pathname || /\\|%5c/iu.test(pathname)) return '/';
  const normalized = pathname.startsWith('/') ? pathname.replace(/^\/+/, '/') : `/${pathname}`;
  return normalized || '/';
}

export function buildRedirect(
  req: NextRequest,
  targetHost: string,
  pathname: string,
  searchParams: string,
  status = 308,
): NextResponse {
  const base = `${req.nextUrl.protocol}//${targetHost}`;
  const suffix = searchParams ? `?${searchParams}` : '';
  const destination = new URL(`${normalizeProxyRedirectPath(pathname)}${suffix}`, base).toString();
  return new NextResponse(null, { status, headers: { Location: destination } });
}

export function stripLeadingAppPrefix(pathname: string): string {
  return normalizeProxyRedirectPath(pathname.replace(/^\/app(\/|$)/u, '/'));
}

function isPublicRestaurantSchedulePath(pathname: string): boolean {
  return /^\/api\/restaurants\/[^/]+\/(schedule|calendar-mask)(\/|$)/u.test(pathname);
}

export function getOpsRewritePath(pathname: string): string | null {
  if (!pathname.startsWith('/api/') || pathname.startsWith('/api/ops/')) return null;
  if (isPublicRestaurantSchedulePath(pathname)) return null;
  const [service, ...rest] = pathname.slice('/api/'.length).split('/').filter(Boolean);
  if (!service || !OPS_API_SERVICES.has(service)) return null;
  return `/api/ops/${service}${rest.length ? `/${rest.join('/')}` : ''}`;
}

export function isPublicOpsApiPath(pathname: string): boolean {
  return (
    PUBLIC_OPS_API_PATHS.has(pathname) ||
    /^\/api\/ops\/restaurants\/[^/]+\/google-business\/callback$/u.test(pathname)
  );
}

function buildTrustedRequestHeaders(req: NextRequest): Headers {
  const headers = new Headers(req.headers);
  headers.delete(TRUSTED_OPS_USER_HEADER);
  return headers;
}

export function buildRequestHeadersWithAppPath(req: NextRequest, requestPath: string): Headers {
  const headers = buildTrustedRequestHeaders(req);
  headers.set(APP_REQUEST_PATH_HEADER, requestPath);
  return headers;
}

export function forwardRequest(req: NextRequest): NextResponse {
  return NextResponse.next({ request: { headers: buildTrustedRequestHeaders(req) } });
}

export function rewriteRequest(req: NextRequest, destination: URL): NextResponse {
  return NextResponse.rewrite(destination, {
    request: { headers: buildTrustedRequestHeaders(req) },
  });
}

function copyCookies(from: NextResponse, to: NextResponse): void {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
}

export async function runOpsAuthWithTrustedHeader(
  req: NextRequest,
  buildResponse: (init: { request: { headers: Headers } }) => NextResponse,
): Promise<NextResponse> {
  const headers = buildTrustedRequestHeaders(req);
  if (
    isQaOpsAuthFixtureAllowed({
      cookieValue: req.cookies.get(QA_OPS_AUTH_COOKIE_NAME)?.value,
      host: req.headers.get('host') ?? req.nextUrl.host,
    })
  ) {
    headers.set(TRUSTED_OPS_USER_HEADER, QA_OPS_USER_ID);
    return buildResponse({ request: { headers } });
  }

  const workingResponse = buildResponse({ request: { headers } });
  const guardResult = await requireOpsAuth(req, workingResponse);
  if (guardResult instanceof NextResponse) return guardResult;

  headers.set(TRUSTED_OPS_USER_HEADER, guardResult.userId);
  const finalResponse = buildResponse({ request: { headers } });
  copyCookies(workingResponse, finalResponse);
  return finalResponse;
}
