import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { verifyGoogleBusinessProfileState } from '@/server/google-business-profile/crypto';
import { connectRestaurantGoogleBusinessProfile } from '@/server/google-business-profile/service';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { NextRequest } from 'next/server';

function buildRedirectUrl(pathname: string, params: Record<string, string>) {
  const url = new URL(pathname, env.app.url);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const googleError = request.nextUrl.searchParams.get('error');

  if (googleError) {
    return NextResponse.redirect(
      buildRedirectUrl('/settings/restaurant/profile', {
        googleBusinessProfile: 'error',
        message: googleError,
      }),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      buildRedirectUrl('/settings/restaurant/profile', {
        googleBusinessProfile: 'error',
        message: 'Missing Google Business Profile callback parameters.',
      }),
    );
  }

  try {
    const parsedState = verifyGoogleBusinessProfileState(state);
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.redirect(
        buildRedirectUrl(parsedState.returnTo, {
          googleBusinessProfile: 'error',
          message: 'Sign in again to complete Google Business Profile connection.',
        }),
      );
    }

    await requireAdminMembership({
      userId: user.id,
      restaurantId: parsedState.restaurantId,
      client: supabase,
    });

    const serviceClient = getServiceSupabaseClient();
    await connectRestaurantGoogleBusinessProfile(parsedState.restaurantId, code, serviceClient);

    return NextResponse.redirect(
      buildRedirectUrl(parsedState.returnTo, {
        googleBusinessProfile: 'connected',
      }),
    );
  } catch (error) {
    console.error('[ops][google-business-profile][callback] failed', error);
    return NextResponse.redirect(
      buildRedirectUrl('/settings/restaurant/profile', {
        googleBusinessProfile: 'error',
        message: error instanceof Error ? error.message : 'Unable to complete Google Business Profile connection.',
      }),
    );
  }
}
