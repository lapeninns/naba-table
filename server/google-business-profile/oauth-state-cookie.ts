import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { env } from '@/lib/env';
import { buildSupabaseCookieOptions, resolveCookieDomain } from '@/lib/supabase/cookies';

import type { NextRequest, NextResponse } from 'next/server';

export const GOOGLE_BUSINESS_PROFILE_OAUTH_STATE_COOKIE = 'sr-gbp-oauth-state';

const OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 15 * 60;
const OAUTH_STATE_COOKIE_PATH = '/api/ops';
const OAUTH_STATE_COOKIE_VERSION = 'v1';
const OAuthStateCookiePayloadSchema = z
  .object({
    restaurantId: z.string().min(1).max(128),
    stateToken: z.string().min(1).max(1024),
  })
  .strict();

type OAuthStateCookiePayload = z.infer<typeof OAuthStateCookiePayloadSchema>;

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
  restaurantId: string,
): void {
  response.cookies.set({
    name: GOOGLE_BUSINESS_PROFILE_OAUTH_STATE_COOKIE,
    value: encodeOAuthStateCookiePayload({ restaurantId, stateToken }),
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

export function getGoogleBusinessProfileOAuthStateCookieRestaurantId(
  request: NextRequest,
  stateToken: string,
): string | null {
  const payload = parseOAuthStateCookiePayload(
    request.cookies.get(GOOGLE_BUSINESS_PROFILE_OAUTH_STATE_COOKIE)?.value,
  );
  if (!payload || !stateToken || !hasMatchingStateToken(payload.stateToken, stateToken)) {
    return null;
  }

  return payload.restaurantId;
}

export function hasMatchingGoogleBusinessProfileOAuthStateCookie(
  request: NextRequest,
  stateToken: string,
): boolean {
  return getGoogleBusinessProfileOAuthStateCookieRestaurantId(request, stateToken) !== null;
}

function encodeOAuthStateCookiePayload(payload: OAuthStateCookiePayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${OAUTH_STATE_COOKIE_VERSION}.${encodedPayload}`;
}

function parseOAuthStateCookiePayload(value: string | undefined): OAuthStateCookiePayload | null {
  if (!value) {
    return null;
  }

  const [version, encodedPayload, ...remainingParts] = value.split('.');
  if (
    version !== OAUTH_STATE_COOKIE_VERSION ||
    !encodedPayload ||
    remainingParts.length > 0 ||
    Buffer.from(encodedPayload, 'base64url').toString('base64url') !== encodedPayload
  ) {
    return null;
  }

  try {
    return (
      OAuthStateCookiePayloadSchema.safeParse(
        JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')),
      ).data ?? null
    );
  } catch {
    return null;
  }
}

function hasMatchingStateToken(cookieToken: string, stateToken: string): boolean {
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
