import { NextRequest, NextResponse } from 'next/server';

import { applyHttpTraceHeaders, createHttpTraceContext } from '@/lib/observability/http-trace';
import { buildCsrfCookieOptions, CSRF_COOKIE_NAME } from '@/lib/security/csrf';
import { buildAppRequestPath } from '@/lib/url/app-request-path';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { QA_OPS_AUTH_COOKIE_NAME, isQaOpsAuthFixtureAllowed } from '@/server/auth/qa-ops-session';
import { getMiddlewareSupabaseClient } from '@/server/supabase';
import {
  applySecurityHeaders,
  buildHostWithPort,
  buildRedirect,
  buildRequestHeadersWithAppPath,
  forwardRequest,
  getOpsRewritePath,
  getRootDomain,
  isAppHost,
  isPublicOpsApiPath,
  isSingleHostMode,
  isStaticOrFramework,
  parseHost,
  rewriteRequest,
  runOpsAuthWithTrustedHeader,
  stripLeadingAppPrefix,
} from '@/src/proxy-routing-support';

export const config = {
  matcher: ['/((?!_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)'],
};

export async function handleRouting(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl;
  const searchParams = url.searchParams.toString();
  const rootDomain = getRootDomain().toLowerCase();
  const { host, hostname, port } = parseHost(req);
  const isApp = isAppHost(hostname, rootDomain);
  const isSingleHost = isSingleHostMode(hostname, host);

  if (isStaticOrFramework(url.pathname)) {
    return forwardRequest(req);
  }

  const rootHost = buildHostWithPort(rootDomain, port);
  const appHost = buildHostWithPort(`app.${rootDomain}`, port);

  if (isApp) {
    // ─────────────────────────────────────────────────────────────────────
    // RESTAURANT-FACING SUBDOMAIN (app.localhost / app.domain.com)
    // ─────────────────────────────────────────────────────────────────────

    // 1. Guest routes live outside /app/* — rewrite in dev/proxy (redirect loops when
    // Next relativizes cross-host Location headers onto app.localhost).
    if (url.pathname.startsWith('/guest')) {
      if (rootDomain === 'localhost') {
        const rewriteUrl = new URL(
          `${url.pathname}${searchParams ? `?${searchParams}` : ''}`,
          req.url,
        );
        return rewriteRequest(req, rewriteUrl);
      }
      return buildRedirect(req, rootHost, url.pathname, searchParams);
    }

    // 2. Strip /app prefix if someone navigates to /app/* on app subdomain
    if (url.pathname.startsWith('/app')) {
      const stripped = stripLeadingAppPrefix(url.pathname);
      if (stripped === '/guest' || stripped.startsWith('/guest/')) {
        if (rootDomain === 'localhost') {
          const rewriteUrl = new URL(
            `${stripped}${searchParams ? `?${searchParams}` : ''}`,
            req.url,
          );
          return rewriteRequest(req, rewriteUrl);
        }
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
        const rewriteUrl = new URL(
          `${opsRewritePath}${searchParams ? `?${searchParams}` : ''}`,
          req.url,
        );
        return runOpsAuthWithTrustedHeader(req, (init) => NextResponse.rewrite(rewriteUrl, init));
      }

      // 3b. Direct /api/ops/* calls require auth guard
      if (url.pathname.startsWith('/api/ops/')) {
        if (isPublicOpsApiPath(url.pathname)) {
          return forwardRequest(req);
        }
        return runOpsAuthWithTrustedHeader(req, (init) => NextResponse.next(init));
      }

      // 3c. All other APIs (auth, profile, restaurants, v1, etc.) pass through directly
      // These are shared APIs accessible from both guest and restaurant contexts
      return forwardRequest(req);
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
      return rewriteRequest(req, new URL(internalPath, req.url));
    }

    // 6. All other page routes are restaurant pages - rewrite to /app/* and require auth
    const requestPath = buildAppRequestPath(url.pathname, searchParams);
    const requestHeaders = buildRequestHeadersWithAppPath(req, requestPath);
    const rewriteResponse = NextResponse.rewrite(new URL(requestPath, req.url), {
      request: { headers: requestHeaders },
    });

    if (
      isQaOpsAuthFixtureAllowed({
        cookieValue: req.cookies.get(QA_OPS_AUTH_COOKIE_NAME)?.value,
        host,
      })
    ) {
      return rewriteResponse;
    }

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
    if (isPublicOpsApiPath(url.pathname)) {
      return forwardRequest(req);
    }
    return runOpsAuthWithTrustedHeader(req, (init) => NextResponse.next(init));
  }

  // 2. Handle /app/* routes on root domain (single-host mode or redirect to app subdomain)
  if (url.pathname.startsWith('/app')) {
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
    const requestHeaders = buildRequestHeadersWithAppPath(
      req,
      buildAppRequestPath(url.pathname, searchParams),
    );
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 3. All other routes pass through (guest pages, public APIs, etc.)
  return forwardRequest(req);
}

export default async function proxy(req: NextRequest) {
  const startedAt = performance.now();
  const traceContext = createHttpTraceContext(req);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-request-id', traceContext.requestId);
  requestHeaders.set('traceparent', traceContext.traceparent);
  const tracedRequest = new NextRequest(req, { headers: requestHeaders });
  const response = await handleRouting(tracedRequest);
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

  applyHttpTraceHeaders(
    response.headers,
    traceContext,
    Number((performance.now() - startedAt).toFixed(3)),
    'proxy',
  );
  applySecurityHeaders(response);
  return response;
}
