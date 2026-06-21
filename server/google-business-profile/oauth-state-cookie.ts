import { timingSafeEqual } from 'node:crypto';

import { env } from '@/lib/env';
import { buildSupabaseCookieOptions, resolveCookieDomain } from '@/lib/supabase/cookies';

import type { NextRequest, NextResponse } from 'next/server';

export const GOOGLE_BUSINESS_PROFILE_OAUTH_STATE_COOKIE = 'sr-gbp-oauth-state';

const OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 15 * 60;
const OAUTH_STATE_COOKIE_PATH = '/api/ops';

function shouldUseSecureCookie(): boolean {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  return env.node.appEnv !== 'development' && Boolean(resolveCookieDomain(rootDomain));
}

function buildCookieOptions(maxAgeSeconds: number) {
  return buildSupabaseCookieOptions({
    domain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost',
    secure: shouldUseSecureCookie(),
    sameSite: 'lax',
    httpOnly: true,
    path: OAUTH_STATE_COOKIE_PATH,
    maxAgeOverrideSeconds: maxAgeSeconds,
  });
}

export function setGoogleBusinessProfileOAuthStateCookie(
  response: NextResponse,
  stateToken: string,
): void {
  response.cookies.set({
    name: GOOGLE_BUSINESS_PROFILE_OAUTH_STATE_COOKIE,
    value: stateToken,
    ...buildCookieOptions(OAUTH_STATE_COOKIE_MAX_AGE_SECONDS),
  });
}

export function clearGoogleBusinessProfileOAuthStateCookie(response: NextResponse): void {
  response.cookies.set({
    name: GOOGLE_BUSINESS_PROFILE_OAUTH_STATE_COOKIE,
    value: '',
    ...buildCookieOptions(0),
    expires: new Date(0),
  });
}

export function hasMatchingGoogleBusinessProfileOAuthStateCookie(
  request: NextRequest,
  stateToken: string,
): boolean {
  const cookieToken = request.cookies.get(GOOGLE_BUSINESS_PROFILE_OAUTH_STATE_COOKIE)?.value;
  if (!cookieToken || !stateToken) {
    return false;
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const stateBuffer = Buffer.from(stateToken);
  if (cookieBuffer.length !== stateBuffer.length) {
    return false;
  }

  try {
    return timingSafeEqual(cookieBuffer, stateBuffer);
  } catch {
    return false;
  }
}
