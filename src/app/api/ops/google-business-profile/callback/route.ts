import { NextResponse } from 'next/server';

import { verifyGoogleBusinessProfileState } from '@/server/google-business-profile/crypto';
import { connectRestaurantGoogleBusinessProfile } from '@/server/google-business-profile/service';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { NextRequest } from 'next/server';

function isLocalLikeOrigin(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
  } catch {
    return false;
  }
}

function getEffectiveOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host');

  if (!host) {
    return request.nextUrl.origin;
  }

  const protocol = forwardedProto ?? request.nextUrl.protocol.replace(/:$/, '');
  return `${protocol}://${host}`;
}

function buildRedirectUrl(origin: string, pathname: string, params: Record<string, string>) {
  const url = new URL(pathname, origin);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url;
}

export async function GET(request: NextRequest) {
  const callbackOrigin = getEffectiveOrigin(request);
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const googleError = request.nextUrl.searchParams.get('error');
  let redirectOrigin = callbackOrigin;
  let parsedState:
    | ReturnType<typeof verifyGoogleBusinessProfileState>
    | null = null;

  if (state) {
    try {
      parsedState = verifyGoogleBusinessProfileState(state);
      redirectOrigin = parsedState.returnOrigin ?? callbackOrigin;
    } catch {
      parsedState = null;
    }
  }

  if (googleError) {
    return NextResponse.redirect(
      buildRedirectUrl(redirectOrigin, '/settings/restaurant/google-business-profile', {
        googleBusinessProfile: 'error',
        message: googleError,
      }),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      buildRedirectUrl(redirectOrigin, '/settings/restaurant/google-business-profile', {
        googleBusinessProfile: 'error',
        message: 'Missing Google Business Profile callback parameters.',
      }),
    );
  }

  try {
    parsedState = parsedState ?? verifyGoogleBusinessProfileState(state);
    redirectOrigin = parsedState.returnOrigin ?? callbackOrigin;
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    const allowLocalCallbackWithoutSession =
      process.env.NODE_ENV !== 'production' &&
      isLocalLikeOrigin(parsedState.redirectUri) &&
      isLocalLikeOrigin(parsedState.returnOrigin);

    if ((error || !user) && !allowLocalCallbackWithoutSession) {
      return NextResponse.redirect(
        buildRedirectUrl(redirectOrigin, parsedState.returnTo, {
          googleBusinessProfile: 'error',
          message: 'Sign in again to complete Google Business Profile connection.',
        }),
      );
    }

    if (user) {
      await requireAdminMembership({
        userId: user.id,
        restaurantId: parsedState.restaurantId,
        client: supabase,
      });
    }

    const serviceClient = getServiceSupabaseClient();
    await connectRestaurantGoogleBusinessProfile(parsedState.restaurantId, code, serviceClient, {
      redirectUri: parsedState.redirectUri,
    });

    return NextResponse.redirect(
      buildRedirectUrl(redirectOrigin, parsedState.returnTo, {
        googleBusinessProfile: 'connected',
      }),
    );
  } catch (error) {
    console.error('[ops][google-business-profile][callback] failed', error);
    return NextResponse.redirect(
      buildRedirectUrl(redirectOrigin, '/settings/restaurant/google-business-profile', {
        googleBusinessProfile: 'error',
        message: error instanceof Error ? error.message : 'Unable to complete Google Business Profile connection.',
      }),
    );
  }
}
