import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { sanitizeLocalRedirectPath } from '@/lib/url/safe-local-path';
import { validateSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';

import type { NextRequest } from 'next/server';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';

const normalizeRootDomain = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  const withoutScheme = trimmed.replace(/^https?:\/\//, '');
  const withoutPath = withoutScheme.split('/')[0] ?? '';
  const withoutPort = withoutPath.replace(/:\d+$/, '');
  return withoutPort.replace(/^\.+/, '').replace(/^www\./, '');
};

const shouldSetCookieDomain = (hostname: string, rootDomain: string): boolean => {
  if (rootDomain === 'localhost') return false;
  const normalizedHost = hostname.toLowerCase();
  return normalizedHost === rootDomain || normalizedHost.endsWith(`.${rootDomain}`);
};

function sanitizeNextPath(value: string | null): string {
  return sanitizeLocalRedirectPath(value, { fallback: '/' });
}

/**
 * GET /bookings/recover?access_token=...&next=/bookings/<id>
 *
 * Captures a session recovery access token into an httpOnly cookie and redirects
 * to the requested destination, enabling token-authenticated booking management
 * without leaking the token in subsequent navigations.
 */
export async function GET(req: NextRequest) {
  const accessToken =
    req.nextUrl.searchParams.get('access_token') ??
    req.nextUrl.searchParams.get('accessToken') ??
    null;
  const legacyToken = req.nextUrl.searchParams.get('token');

  const nextPath = sanitizeNextPath(req.nextUrl.searchParams.get('next'));
  const redirectTarget = new URL(nextPath, req.nextUrl.origin);

  if (!accessToken && legacyToken) {
    const errorUrl = new URL('/bookings/recover/error', req.nextUrl.origin);
    errorUrl.searchParams.set('code', 'LEGACY_TOKEN_DEPRECATED');
    return NextResponse.redirect(errorUrl, { status: 302 });
  }

  if (!accessToken) {
    const errorUrl = new URL('/bookings/recover/error', req.nextUrl.origin);
    errorUrl.searchParams.set('code', 'MISSING_ACCESS_TOKEN');
    return NextResponse.redirect(errorUrl, { status: 302 });
  }

  const secret = env.security.sessionRecoveryAccessTokenSecret;
  if (!secret) {
    const errorUrl = new URL('/bookings/recover/error', req.nextUrl.origin);
    errorUrl.searchParams.set('code', 'ACCESS_TOKEN_NOT_CONFIGURED');
    return NextResponse.redirect(errorUrl, { status: 302 });
  }

  const result = validateSessionRecoveryAccessToken(accessToken, { secret });
  if (!result.ok) {
    const errorUrl = new URL('/bookings/recover/error', req.nextUrl.origin);
    errorUrl.searchParams.set('code', 'INVALID_ACCESS_TOKEN');
    errorUrl.searchParams.set('reason', result.reason);
    return NextResponse.redirect(errorUrl, { status: 302 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const maxAge = Math.max(0, result.payload.exp - nowSeconds);
  if (maxAge <= 0) {
    const errorUrl = new URL('/bookings/recover/error', req.nextUrl.origin);
    errorUrl.searchParams.set('code', 'ACCESS_TOKEN_EXPIRED');
    return NextResponse.redirect(errorUrl, { status: 302 });
  }

  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? null;
  const resolvedProto = forwardedProto ?? req.nextUrl.protocol;
  const isHttps = resolvedProto.replace(':', '') === 'https';

  const res = NextResponse.redirect(redirectTarget, { status: 302 });
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  const normalizedRootDomain = normalizeRootDomain(ROOT_DOMAIN);
  const cookieDomain = shouldSetCookieDomain(req.nextUrl.hostname, normalizedRootDomain)
    ? `.${normalizedRootDomain}`
    : undefined;

  res.cookies.set('sr_access', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
  return res;
}
