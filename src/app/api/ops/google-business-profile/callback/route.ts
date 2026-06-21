import { NextResponse } from 'next/server';

import {
  getRequestOrigin,
  sanitizeGoogleBusinessProfileReturnPath,
} from '@/app/api/ops/google-business-profile/_origin';
import { logger } from '@/lib/logger';
import {
  clearGoogleBusinessProfileOAuthStateCookie,
  hasMatchingGoogleBusinessProfileOAuthStateCookie,
} from '@/server/google-business-profile/oauth-state-cookie';
import { completeGoogleBusinessProfileAuthorization } from '@/server/google-business-profile/service';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const DEFAULT_RETURN_PATH = '/app/settings/restaurant/google-business-profile';

function buildRedirect(request: NextRequest, status: 'connected' | 'error', message?: string) {
  const url = new URL(DEFAULT_RETURN_PATH, getRequestOrigin(request));
  url.searchParams.set('gbp', status);
  if (message) {
    url.searchParams.set('message', message);
  }
  return url;
}

function redirectWithClearedState(url: URL) {
  const response = NextResponse.redirect(url);
  clearGoogleBusinessProfileOAuthStateCookie(response);
  return response;
}

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get('state');
  const code = req.nextUrl.searchParams.get('code');
  const upstreamError = req.nextUrl.searchParams.get('error');

  if (upstreamError) {
    return redirectWithClearedState(
      buildRedirect(req, 'error', 'Google authorization was cancelled or denied.'),
    );
  }

  if (!state || !code) {
    return redirectWithClearedState(
      buildRedirect(req, 'error', 'Google authorization response was incomplete.'),
    );
  }

  if (!hasMatchingGoogleBusinessProfileOAuthStateCookie(req, state)) {
    return redirectWithClearedState(
      buildRedirect(req, 'error', 'Google authorization state could not be verified.'),
    );
  }

  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return redirectWithClearedState(
        buildRedirect(req, 'error', 'Sign in to Nabatable before connecting Google.'),
      );
    }

    const result = await completeGoogleBusinessProfileAuthorization({
      stateToken: state,
      code,
      requestedByUserId: user.id,
    });

    const redirectUrl = new URL(
      sanitizeGoogleBusinessProfileReturnPath(result.returnPath || DEFAULT_RETURN_PATH),
      getRequestOrigin(req),
    );
    redirectUrl.searchParams.set('gbp', 'connected');
    return redirectWithClearedState(redirectUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Google Business Profile authorization failed.';
    logger.error('gbp.callback authorization failed', {
      requestOrigin: req.nextUrl.origin,
      hasState: Boolean(state),
      hasCode: Boolean(code),
      error,
    });
    return redirectWithClearedState(buildRedirect(req, 'error', message));
  }
}
