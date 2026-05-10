import { NextResponse } from 'next/server';

import { getRequestOrigin } from '@/app/api/ops/google-business-profile/_origin';
import { logger } from '@/lib/logger';
import { completeGoogleBusinessProfileAuthorization } from '@/server/google-business-profile/service';

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

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get('state');
  const code = req.nextUrl.searchParams.get('code');
  const upstreamError = req.nextUrl.searchParams.get('error');

  if (upstreamError) {
    return NextResponse.redirect(
      buildRedirect(req, 'error', 'Google authorization was cancelled or denied.'),
    );
  }

  if (!state || !code) {
    return NextResponse.redirect(
      buildRedirect(req, 'error', 'Google authorization response was incomplete.'),
    );
  }

  try {
    const result = await completeGoogleBusinessProfileAuthorization({
      stateToken: state,
      code,
    });

    const redirectUrl = new URL(result.returnPath || DEFAULT_RETURN_PATH, getRequestOrigin(req));
    redirectUrl.searchParams.set('gbp', 'connected');
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Google Business Profile authorization failed.';
    logger.error('gbp.callback authorization failed', {
      requestOrigin: req.nextUrl.origin,
      hasState: Boolean(state),
      hasCode: Boolean(code),
      error,
    });
    return NextResponse.redirect(buildRedirect(req, 'error', message));
  }
}
