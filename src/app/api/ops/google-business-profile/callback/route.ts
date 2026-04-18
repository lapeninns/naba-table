import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { completeGoogleBusinessProfileAuthorization } from '@/server/google-business-profile/service';

import type { NextRequest } from 'next/server';

const DEFAULT_RETURN_PATH = '/settings/restaurant/google-business-profile';

function getAppOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const protocol = forwardedProto ?? request.nextUrl.protocol.replace(/:$/, '');
  const hostHeader =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host;
  const [, port] = hostHeader.split(':');
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost').toLowerCase();
  const appHostname = rootDomain === 'localhost' ? 'app.localhost' : `app.${rootDomain}`;
  return `${protocol}://${port ? `${appHostname}:${port}` : appHostname}`;
}

function buildRedirect(request: NextRequest, status: 'connected' | 'error', message?: string) {
  const url = new URL(DEFAULT_RETURN_PATH, getAppOrigin(request));
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

    const redirectUrl = new URL(result.returnPath || DEFAULT_RETURN_PATH, getAppOrigin(req));
    const appOrigin = new URL(getAppOrigin(req));
    redirectUrl.protocol = appOrigin.protocol;
    redirectUrl.host = appOrigin.host;
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
