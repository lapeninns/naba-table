import { NextResponse } from 'next/server';

import { buildCsrfCookieOptions, CSRF_COOKIE_NAME } from '@/lib/security/csrf';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { requireOpsAuth } from '@/server/auth/ops-guard';
import { getMiddlewareSupabaseClient } from '@/server/supabase';

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

export const config = {
  matcher: ['/((?!_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)'],
};

function getRootDomain() {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
}

function parseHost(req: NextRequest) {
  const host = (req.headers.get('host') || req.nextUrl.host || '').toLowerCase();
  const [hostname, port] = host.split(':');
  return { host, hostname, port };
}

function getLocalAppHosts() {
  const raw = process.env.NEXT_PUBLIC_LOCAL_APP_HOSTS ?? '';
  const entries = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set(entries);
}

function isSingleHostMode(hostname: string, host: string) {
  // Allow multi-host in development/preview if we want to test subdomains
  // if (vercelEnv === "preview" || vercelEnv === "development") return true;

  // if (rootDomain === "localhost") return true;

  const localHosts = getLocalAppHosts();
  return localHosts.has(host) || localHosts.has(hostname);
}

function isAppHost(hostname: string, rootDomain: string) {
  if (!hostname) return false;
  if (rootDomain === 'localhost') {
    return hostname.startsWith('app.localhost');
  }
  return hostname === `app.${rootDomain}`;
}

function isStaticOrFramework(pathname: string) {
  if (['/favicon.ico', '/robots.txt', '/sitemap.xml'].includes(pathname)) return true;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_static') ||
    pathname.startsWith('/_vercel')
  )
    return true;
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;
  return false;
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set(
    'Content-Security-Policy',
    "base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'",
  );
}

function buildHostWithPort(hostname: string, port?: string) {
  if (!port) return hostname;
  return `${hostname}:${port}`;
}

function buildRedirect(
  req: NextRequest,
  targetHost: string,
  pathname: string,
  searchParams: string,
  status = 308,
) {
  const base = `${req.nextUrl.protocol}//${targetHost}`;
  const suffix = searchParams ? `?${searchParams}` : '';
  const url = new URL(`${pathname}${suffix}`, base);
  const response = NextResponse.redirect(url, status);
  // Ensure cross-host redirects are absolute for clarity and correctness.
  response.headers.set('location', url.toString());
  return response;
}

function stripLeadingAppPrefix(pathname: string) {
  let next = pathname;
  while (next === '/app' || next.startsWith('/app/')) {
    next = next.replace(/^\/app(\/|$)/, '/');
    if (next === '/') break;
  }
  return next === '' ? '/' : next;
}

function isPublicRestaurantSchedulePath(pathname: string) {
  return /^\/api\/restaurants\/[^/]+\/(schedule|calendar-mask)(\/|$)/.test(pathname);
}

function isGoogleBusinessProfileCallbackPath(pathname: string) {
  return pathname === '/api/ops/google-business-profile/callback';
}

function getOpsRewritePath(pathname: string) {
  if (!pathname.startsWith('/api/')) return null;
  if (pathname.startsWith('/api/ops/')) return null;
  if (isPublicRestaurantSchedulePath(pathname)) return null;

  const segments = pathname.slice('/api/'.length).split('/').filter(Boolean);
  const [service, ...rest] = segments;
  if (!service || !OPS_API_SERVICES.has(service)) return null;
  return `/api/ops/${service}${rest.length ? `/${rest.join('/')}` : ''}`;
}

export async function handleRouting(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl;
  const searchParams = url.searchParams.toString();
  const rootDomain = getRootDomain().toLowerCase();
  const { host, hostname, port } = parseHost(req);
  const isApp = isAppHost(hostname, rootDomain);
  const isSingleHost = isSingleHostMode(hostname, host);

  if (isStaticOrFramework(url.pathname)) {
    return NextResponse.next();
  }

  console.log(`[Proxy] Host: ${host}, Path: ${url.pathname}, isApp: ${isApp}`);

  const rootHost = buildHostWithPort(rootDomain, port);
  const appHost = buildHostWithPort(`app.${rootDomain}`, port);

  if (isApp) {
    // ─────────────────────────────────────────────────────────────────────
    // RESTAURANT-FACING SUBDOMAIN (app.localhost / app.domain.com)
    // ─────────────────────────────────────────────────────────────────────

    // 1. Redirect guest routes to root domain - guests shouldn't be on app subdomain
    if (url.pathname.startsWith('/guest')) {
      return buildRedirect(req, rootHost, url.pathname, searchParams);
    }

    // 2. Strip /app prefix if someone navigates to /app/* on app subdomain
    if (url.pathname.startsWith('/app')) {
      const stripped = stripLeadingAppPrefix(url.pathname);
      if (stripped === '/guest' || stripped.startsWith('/guest/')) {
        return buildRedirect(req, rootHost, stripped, searchParams);
      }
      return buildRedirect(req, host, stripped, searchParams);
    }

    // ─────────────────────────────────────────────────────────────────────
    // API ROUTING (on app subdomain)
    // ─────────────────────────────────────────────────────────────────────

    // 3. Handle all /api/* routes - these should NOT be rewritten to /app/api/*
    if (url.pathname.startsWith('/api/')) {
      // 3a. Rewrite ops-service APIs (e.g., /api/bookings → /api/ops/bookings on app subdomain)
      const opsRewritePath = getOpsRewritePath(url.pathname);
      if (opsRewritePath) {
        const rewriteResponse = NextResponse.rewrite(
          new URL(`${opsRewritePath}${searchParams ? `?${searchParams}` : ''}`, req.url),
        );
        const guardResult = await requireOpsAuth(req, rewriteResponse);
        if (guardResult instanceof NextResponse) return guardResult;
        return rewriteResponse;
      }

      // 3b. Direct /api/ops/* calls require auth guard
      if (url.pathname.startsWith('/api/ops/')) {
        if (isGoogleBusinessProfileCallbackPath(url.pathname)) {
          return NextResponse.next();
        }
        const nextResponse = NextResponse.next();
        const guardResult = await requireOpsAuth(req, nextResponse);
        if (guardResult instanceof NextResponse) return guardResult;
        return nextResponse;
      }

      // 3c. All other APIs (auth, profile, restaurants, v1, etc.) pass through directly
      // These are shared APIs accessible from both guest and restaurant contexts
      return NextResponse.next();
    }

    // ─────────────────────────────────────────────────────────────────────
    // PAGE ROUTING (on app subdomain)
    // ─────────────────────────────────────────────────────────────────────

    // 4. Root path redirects to dashboard
    if (url.pathname === '/') {
      return NextResponse.redirect(
        new URL(`/dashboard${searchParams ? `?${searchParams}` : ''}`, req.url),
        308,
      );
    }

    // 5. Auth pages pass through without rewrite (they exist at /app/auth/*)
    if (url.pathname.startsWith('/auth')) {
      const internalPath = `/app${url.pathname}${searchParams ? `?${searchParams}` : ''}`;
      return NextResponse.rewrite(new URL(internalPath, req.url));
    }

    // 6. All other page routes are restaurant pages - rewrite to /app/* and require auth
    const internalPath = `/app${url.pathname}${searchParams ? `?${searchParams}` : ''}`;
    const rewriteResponse = NextResponse.rewrite(new URL(internalPath, req.url));

    // Check authentication for protected restaurant pages
    const supabase = getMiddlewareSupabaseClient(req, rewriteResponse);
    const { data } = await supabase.auth.getUser();

    if (!data?.user) {
      const redirectedFrom = `${url.pathname}${searchParams ? `?${searchParams}` : ''}`;
      return NextResponse.redirect(
        new URL(withRedirectedFrom('/auth/signin', redirectedFrom), req.url),
        307,
      );
    }

    return rewriteResponse;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GUEST-FACING ROOT DOMAIN (localhost / domain.com)
  // ─────────────────────────────────────────────────────────────────────────

  // 1. Ops API calls from root domain still need auth guard
  if (url.pathname.startsWith('/api/ops')) {
    if (isGoogleBusinessProfileCallbackPath(url.pathname)) {
      return NextResponse.next();
    }
    const nextResponse = NextResponse.next();
    const guardResult = await requireOpsAuth(req, nextResponse);
    if (guardResult instanceof NextResponse) return guardResult;
    return nextResponse;
  }

  // 2. Handle /app/* routes on root domain (single-host mode or redirect to app subdomain)
  if (url.pathname.startsWith('/app')) {
    // Fix double /app/app prefix
    if (url.pathname.startsWith('/app/app')) {
      const normalized = url.pathname.replace(/^\/app\/app/, '/app');
      return NextResponse.redirect(
        new URL(`${normalized}${searchParams ? `?${searchParams}` : ''}`, req.url),
        308,
      );
    }

    // In multi-host mode, redirect to app subdomain
    if (!isSingleHost) {
      // Strip /app prefix before redirecting to avoid double redirect
      // localhost/app/dashboard -> app.localhost/dashboard
      const stripped = stripLeadingAppPrefix(url.pathname);
      return buildRedirect(req, appHost, stripped, searchParams);
    }

    // In single-host mode, redirect /app to /app/dashboard
    if (url.pathname === '/app' || url.pathname === '/app/') {
      return NextResponse.redirect(
        new URL(`/app/dashboard${searchParams ? `?${searchParams}` : ''}`, req.url),
        308,
      );
    }

    // Otherwise, let the request through (single-host mode)
    return NextResponse.next();
  }

  // 3. Legacy /ops route redirect
  if (!isSingleHost && url.pathname.startsWith('/ops')) {
    return buildRedirect(req, appHost, '/app/management', searchParams);
  }

  // 4. All other routes pass through (guest pages, public APIs, etc.)
  return NextResponse.next();
}

export default async function proxy(req: NextRequest) {
  const response = await handleRouting(req);
  const rootDomain = getRootDomain();

  const csrfToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!csrfToken) {
    const newCsrfToken = crypto.randomUUID().replace(/-/g, '');
    const cookieOptions = buildCsrfCookieOptions({
      rootDomain,
      secure: process.env.NODE_ENV !== 'development',
    });
    response.cookies.set({
      name: CSRF_COOKIE_NAME,
      value: newCsrfToken,
      ...cookieOptions,
    });
  }

  applySecurityHeaders(response);
  return response;
}
